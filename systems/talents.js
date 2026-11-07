import { findTalentById, getClassTalents } from '../data/talents.js';
import { getPassiveTree } from '../data/passives.js';
import { state } from './state.js';
import { saveGame } from './save.js';
import { emit } from './events.js';

const BONUS_DEFAULTS = {
  dmgMult: 1,
  healMult: 1,
  spellMult: 1,
  defMult: 1,
  critChance: 0,
  critMult: 1.5,
  lifesteal: 0,
  manaRegen: 0,
  hpRegen: 0,
  abilityCdDelta: 0,
  meteorMult: 1,
  prayerMult: 1,
  resurrectPct: 0.3,
  dodgeChance: 0,
  blockChance: 0,
  blockPower: 0,
  armorPen: 0,
  atkFlat: 0,
  magFlat: 0,
  defFlat: 0,
  dexFlat: 0
};

function snapshotPlayer(player) {
  try {
    return JSON.parse(JSON.stringify(player));
  } catch {
    return null;
  }
}

function restorePlayer(player, snapshot) {
  for (const key of Object.keys(player)) delete player[key];
  Object.assign(player, snapshot);
}

function addEffects(bonus, effects = {}) {
  for (const key of ['dmgMult', 'healMult', 'spellMult', 'defMult', 'meteorMult', 'prayerMult']) {
    if (effects[key]) bonus[key] *= effects[key];
  }

  for (const key of [
    'critChance', 'lifesteal', 'manaRegen', 'hpRegen',
    'abilityCdDelta', 'dodgeChance', 'blockChance', 'armorPen',
    'atkFlat', 'magFlat', 'defFlat', 'dexFlat'
  ]) {
    if (effects[key]) bonus[key] += effects[key];
  }

  if (effects.critMult) {
    bonus.critMult = Math.max(bonus.critMult, effects.critMult);
  }

  if (effects.blockPower) {
    bonus.blockPower += effects.blockPower;
  }

  if (effects.resurrectPct) {
    bonus.resurrectPct = Math.max(bonus.resurrectPct, effects.resurrectPct);
  }
}

export function getTalentBonus(player) {
  const bonus = { ...BONUS_DEFAULTS };
  if (!player) return bonus;

  // Старые классовые таланты остаются действительными в уже существующих сейвах.
  if (Array.isArray(player.talents)) {
    for (const id of player.talents) {
      const talent = findTalentById(player.class, id);
      if (talent?.effects) addEffects(bonus, talent.effects);
    }
  }

  // Новое древо пассивок — отдельное для каждого из трёх классов.
  const tree = getPassiveTree(player.class);

  if (Array.isArray(player.passives)) {
    for (const id of player.passives) {
      const node = tree.nodes[id];
      if (node?.effects) addEffects(bonus, node.effects);
    }
  }

  return bonus;
}

export function canAllocatePassive(player, nodeId) {
  if (!player || !nodeId || nodeId === 'start') return false;

  const tree = getPassiveTree(player.class);
  const node = tree.nodes[nodeId];
  if (!node) return false;

  const allocated = Array.isArray(player.passives)
    ? player.passives
    : ['start'];

  if (allocated.includes(nodeId)) return false;
  if ((player.passivePoints || 0) <= 0) return false;
  if ((player.level || 1) < (node.levelReq || 1)) return false;

  return node.conn.some(parentId => allocated.includes(parentId));
}

export function getPassiveNodeStatus(player, nodeId) {
  if (!player || !nodeId) return 'Нет данных персонажа';
  if (nodeId === 'start') return 'Стартовый узел';
  const node = getPassiveTree(player.class).nodes[nodeId];
  if (!node) return 'Узел не найден';
  const allocated = Array.isArray(player.passives) ? player.passives : ['start'];
  if (allocated.includes(nodeId)) return 'Уже изучено';
  if ((player.passivePoints || 0) <= 0) return 'Нет свободных очков навыков';
  const level = player.level || 1;
  if (level < (node.levelReq || 1)) return `Требуется уровень ${node.levelReq || 1} (текущий: ${level})`;
  if (!node.conn.some(parentId => allocated.includes(parentId))) return 'Сначала изучите соединённый узел';
  return 'Доступно для изучения';
}

export function allocatePassive(player, nodeId) {
  if (!canAllocatePassive(player, nodeId)) return false;

  const tree = getPassiveTree(player.class);
  const node = tree.nodes[nodeId];

  const tracked = state.game?.player === player;
  const snapshot = tracked ? snapshotPlayer(player) : null;
  if (tracked && !snapshot) return false;

  if (!Array.isArray(player.passives)) {
    player.passives = ['start'];
  }

  if (!player.passives.includes('start')) {
    player.passives.unshift('start');
  }

  player.passives.push(nodeId);
  player.passivePoints = Math.max(0, (player.passivePoints || 0) - 1);

  if (tracked && !saveGame()) {
    restorePlayer(player, snapshot);
    return false;
  }

  emit('toast', `✦ Изучено: ${node.name}`);
  emit('log', {
    channel: 'game',
    msg: `✦ Новая пассивка: «${node.name}» — ${node.desc}`,
    cls: 'success'
  });

  return true;
}

export function resetPassives(player) {
  if (!player) return { ok: false, msg: 'Нет игрока' };

  const allocated = Array.isArray(player.passives)
    ? player.passives.filter(id => id !== 'start')
    : [];

  if (allocated.length === 0) {
    return { ok: false, msg: 'Нет изученных пассивных навыков' };
  }

  const cost = 500;
  if (!Number.isSafeInteger(player.gold) || player.gold < 0) {
    return { ok: false, msg: 'Некорректный баланс золота' };
  }
  if (player.gold < cost) {
    return { ok: false, msg: `Нужно ${cost}💰` };
  }

  const tracked = state.game?.player === player;
  const snapshot = tracked ? snapshotPlayer(player) : null;
  if (tracked && !snapshot) return { ok: false, msg: 'Не удалось подготовить сброс навыков' };

  player.gold -= cost;
  player.passivePoints = Math.max(0, player.passivePoints || 0) + allocated.length;
  player.passives = ['start'];

  if (tracked && !saveGame()) {
    restorePlayer(player, snapshot);
    return { ok: false, msg: 'Не удалось сохранить сброс навыков; изменения отменены' };
  }

  emit('toast', `Пассивные навыки сброшены (−${cost}💰), возвращено очков: ${allocated.length}`);
  emit('log', {
    channel: 'game',
    msg: `Древо пассивных навыков сброшено. Возвращено очков: ${allocated.length}.`,
    cls: 'success'
  });

  return { ok: true, refunded: allocated.length, cost };
}

export function getAvailablePassives(player) {
  if (!player) return [];

  return Object.values(getPassiveTree(player.class).nodes)
    .filter(node => canAllocatePassive(player, node.id));
}

// Совместимый интерфейс прежней системы талантов.
export function canTakeTalent(player, talent) {
  if (!player || !talent) return false;
  const talents = Array.isArray(player.talents) ? player.talents : [];
  if (talents.includes(talent.id)) return false;
  if ((player.level || 1) < talent.tier) return false;

  const tierTaken = talents.some(id => {
    const taken = findTalentById(player.class, id);
    return taken && taken.tier === talent.tier;
  });

  return !tierTaken;
}

export function takeTalent(player, talentId) {
  const talent = findTalentById(player?.class, talentId);
  if (!talent || !canTakeTalent(player, talent)) return false;

  const tracked = state.game?.player === player;
  const snapshot = tracked ? snapshotPlayer(player) : null;
  if (tracked && !snapshot) return false;

  if (!Array.isArray(player.talents)) player.talents = [];
  player.talents.push(talentId);

  const effects = talent.effects || {};

  if (effects.hpMult) {
    player.maxHp = Math.round(player.maxHp * effects.hpMult);
    player.hp = Math.min(player.maxHp, Math.round(player.hp * effects.hpMult));
  }

  if (effects.mpMult) {
    player.maxMp = Math.round(player.maxMp * effects.mpMult);
    player.mp = Math.min(player.maxMp, Math.round(player.mp * effects.mpMult));
  }

  if (tracked && !saveGame()) {
    restorePlayer(player, snapshot);
    return false;
  }

  emit('toast', `✦ Талант: ${talent.name}`);
  emit('log', {
    channel: 'game',
    msg: `✦ Выбран талант: «${talent.name}»`,
    cls: 'success'
  });

  return true;
}

export function getAvailableTalents(player) {
  if (!player) return [];
  return getClassTalents(player.class)
    .filter(talent => canTakeTalent(player, talent));
}

export function getTakenTalents(player) {
  if (!player || !Array.isArray(player.talents)) return [];
  return player.talents
    .map(id => findTalentById(player.class, id))
    .filter(Boolean);
}

export function getNextTierLevel(player) {
  if (!player) return null;

  const tiers = [...new Set(
    getClassTalents(player.class).map(talent => talent.tier)
  )].sort((a, b) => a - b);

  for (const tier of tiers) {
    const taken = player.talents?.some(id =>
      findTalentById(player.class, id)?.tier === tier
    );

    if (!taken) return tier;
  }

  return null;
}

export function resetTalents(player) {
  if (!player) return { ok: false, msg: 'Нет игрока' };

  const cost = 500;

  if (!Number.isSafeInteger(player.gold) || player.gold < 0 ||
      !Number.isFinite(player.hp) || player.hp < 0 ||
      !Number.isFinite(player.maxHp) || player.maxHp <= 0 ||
      !Number.isFinite(player.mp) || player.mp < 0 ||
      !Number.isFinite(player.maxMp) || player.maxMp < 0) {
    return { ok: false, msg: 'Некорректное состояние персонажа' };
  }
  if (player.gold < cost) {
    return { ok: false, msg: `Нужно ${cost}💰` };
  }

  const oldTalents = Array.isArray(player.talents)
    ? player.talents
    : [];

  if (!oldTalents.length) {
    return { ok: false, msg: 'Нет взятых классовых талантов' };
  }

  let hpMult = 1;
  let mpMult = 1;

  for (const id of oldTalents) {
    const effects = findTalentById(player.class, id)?.effects || {};
    if (effects.hpMult) hpMult *= effects.hpMult;
    if (effects.mpMult) mpMult *= effects.mpMult;
  }

  const tracked = state.game?.player === player;
  const snapshot = tracked ? snapshotPlayer(player) : null;
  if (tracked && !snapshot) return { ok: false, msg: 'Не удалось подготовить сброс талантов' };

  player.gold -= cost;
  player.maxHp = Math.max(1, Math.round(player.maxHp / hpMult));
  player.hp = Math.min(player.hp, player.maxHp);
  player.maxMp = Math.max(0, Math.round(player.maxMp / mpMult));
  player.mp = Math.min(player.mp, player.maxMp);
  player.talents = [];

  if (tracked && !saveGame()) {
    restorePlayer(player, snapshot);
    return { ok: false, msg: 'Не удалось сохранить сброс талантов; изменения отменены' };
  }

  emit('toast', `Таланты сброшены (−${cost}💰)`);
  return { ok: true };
}