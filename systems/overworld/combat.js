import { state } from '../state.js';
import { ENEMIES } from '../../data/enemies.js';
import { ITEMS, RARITIES } from '../../data/items.js';
import { SPELLS } from '../../data/spells.js';
import { CLASSES } from '../../data/classes.js';
import { LOCATIONS } from '../../data/locations.js';
import { getEffStats, incrementSafeCount, resolveCriticalChance } from '../stats.js';
import { addItemOrStore, countItem, removeItem } from '../inventory.js';
import { addExp } from '../progression.js';
import { checkAchievements } from '../achievements.js';
import {
  applyEffect,
  tickEffects,
  getAtkMult,
  getDefMult,
  getLifesteal,
  isStunned,
  consumeStun,
  clearDebuffs
} from '../status.js';
import { emit } from '../events.js';
import { saveGame } from '../save.js';
import { recordWorldEventKill } from '../world-events.js';
import { recordRegionBossDefeat, recordRegionBossProgress, recordRegionEnemyDefeat } from '../region-state.js';
import { playSound } from '../audio.js';
import { getNGPlusMult } from '../ngplus.js';
import { getTalentBonus } from '../talents.js';
import { getRiftMult } from '../rift.js';
import { getTowerMult } from '../tower.js';
import { claimStoryDragonReward } from '../story-dragons.js';
import { getActPriceMultiplier } from '../economy.js';
import { getLootDropChance } from '../loot.js';
import { getFactionDamageReduction } from '../factions.js';
import { updateQuestProgress } from '../dailyQuests.js';
import { canCompleteMainQuest, getActiveCampaignMission, getMissionProgress, recordCampaignKill, recordCampaignShard } from '../campaign.js';
import { pushLog } from './log.js';
import { spawnParticles } from './particles.js';
import { getEnemyCombatDecision, interruptEnemyTelegraph } from './enemy-ai.js';
import {
  MODIFIERS,
  ELITE_ATK_MULT,
  getDropChance,
  getRespawnMs
} from './spawn.js';

const HERB_DROP_CHANCE = 0.30;
const HERB_DROP_CHANCE_ELITE = 0.70;

const COMBAT_ABILITY_IDS = new Set([
  'aimed-shot', 'evasion', 'toxic-blade', 'charge', 'war-cry',
  'bloodthirst', 'mana-shield', 'teleport', 'meteor', 'prayer', 'sanctify',
  'shield-bash', 'frost-nova', 'piercing-shot'
]);

function isFiniteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function hasValidCombatStats(stats, talent) {
  return stats && talent &&
    Number.isFinite(stats.atk) &&
    Number.isFinite(stats.mag) &&
    Number.isFinite(stats.def) &&
    Number.isFinite(stats.armorPen || 0) &&
    ['dmgMult', 'spellMult', 'healMult', 'critMult', 'meteorMult', 'prayerMult', 'abilityCdDelta']
      .every(key => Number.isFinite(talent[key]));
}

export function triggerShake(mag, dur = 0.25) {
  const ow = state.overworld;
  if (!ow) return;
  ow.shake = { t: dur, mag };
}

export function clearPlayerEffects() {
  const p = state.game?.player;
  if (!p) return;

  p.effects = [];
  p.cooldowns = {};

  if (p.class === 'warrior' || p.class === 'archer') {
    p.mp = 0;
  }
}

function enemyDisplayName(e) {
  const def = ENEMIES[e.enemyId];

  if (e.boss) return `☠ ${def.name}`;
  if (e.elite) return `★ ${def.name}`;

  if (e.modifier) {
    const modifier = MODIFIERS[e.modifier];
    return `${modifier.prefix} ${modifier.name} ${def.name}`;
  }

  return def.name;
}

function enemyDefValue(e) {
  const base = ENEMIES[e.enemyId].defense;
  const mult = e.modifier
    ? MODIFIERS[e.modifier].defMult
    : 1;

  return Math.floor(base * mult);
}

function recordPlayerStyle(ow, style) {
  if (!ow?.combat || !['melee', 'ranged', 'magic'].includes(style)) return;
  const history = ow.combat.playerStyleHistory || (ow.combat.playerStyleHistory = []);
  history.push(style);
  if (history.length > 4) history.shift();
}

const ENEMY_DAMAGE_MATCHUPS = {
  // Weakness 1.25x; resistance 0.80x; unlisted matchups are neutral.
  magicWeak: new Set(['skeleton', 'skeleton-archer', 'dark-knight', 'magma-golem', 'grave-king']),
  physicalWeak: new Set(['ghost', 'wraith', 'shadow-mage', 'fire-elemental', 'flame-lord']),
  magicResist: new Set(['ghost', 'wraith', 'shadow-mage']),
  physicalResist: new Set(['magma-golem', 'dark-knight', 'grave-king'])
};

function enemyDamageMultiplier(enemy, style) {
  const id = enemy?.enemyId;
  if (!id || !['melee', 'ranged', 'magic'].includes(style)) return 1;
  const physical = style === 'melee' || style === 'ranged';
  const weak = physical
    ? ENEMY_DAMAGE_MATCHUPS.physicalWeak.has(id)
    : ENEMY_DAMAGE_MATCHUPS.magicWeak.has(id);
  const resist = physical
    ? ENEMY_DAMAGE_MATCHUPS.physicalResist.has(id)
    : ENEMY_DAMAGE_MATCHUPS.magicResist.has(id);
  if (weak && resist) return 1;
  return weak ? 1.25 : resist ? 0.80 : 1;
}

function applyElementalReaction(enemy, element) {
  if (!enemy || !Array.isArray(enemy.effects)) return 1;
  const has = id => enemy.effects.some(effect => effect?.id === id);
  const remove = id => { enemy.effects = enemy.effects.filter(effect => effect?.id !== id); };
  let multiplier = 1;

  if (element === 'ice' && has('burn')) {
    remove('burn');
    pushLog('❄️🔥 Реакция стихий: лёд гасит ожог и охлаждает цель!', 'info');
  } else if (element === 'fire' && has('slow')) {
    remove('slow');
    pushLog('🔥❄️ Реакция стихий: огонь снимает замедление!', 'info');
  } else if (element === 'lightning' && has('slow')) {
    multiplier = 1.20;
    remove('slow');
    pushLog('⚡❄️ Реакция стихий: молния поражает охлаждённую цель (+20% урона)!', 'success');
  }

  return multiplier;
}

function enemyDefenseForStyle(enemy, style, armorPen = 0) {
  const rawDefense = enemyDefValue(enemy);
  const penetration = Math.max(0, Math.min(0.75, armorPen * 0.025));
  const base = Math.max(0, Math.floor(rawDefense * (1 - penetration) - armorPen * 0.5));
  const counter = enemy?.adaptiveCounter;
  if (!counter || counter.style !== style || counter.remaining <= 0) return base;
  const def = ENEMIES[enemy.enemyId];
  const reduction = def?.boss ? 0.12 : 0.20;
  return base + Math.floor(Math.max(1, base) * reduction);
}

// Keep the persistent player HP and the overworld combat HUD/model in sync.
// All incoming attacks use one guarded path so malformed damage cannot heal
// the hero or leave the visual HP stale.
function applyPlayerDamage(player, overworld, amount) {
  if (!player || !overworld?.player) return 0;
  const safeHp = Number.isFinite(player.hp) ? Math.max(0, player.hp) : 0;
  const safeDamage = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const factionReduction = getFactionDamageReduction(state.game);
  const mitigatedDamage = safeDamage > 0 ? Math.max(1, Math.floor(safeDamage * (1 - factionReduction))) : 0;
  const actual = Math.min(safeHp, mitigatedDamage);
  player.hp = safeHp - actual;
  overworld.player.hp = player.hp;
  overworld.player.maxHp = Number.isFinite(player.maxHp) ? Math.max(1, player.maxHp) : 1;
  return actual;
}

function mitigateIncomingDamage(attack, defense) {
  const safeAttack = Number.isFinite(attack) ? Math.max(0, attack) : 0;
  const safeDefense = Number.isFinite(defense) ? Math.max(0, defense) : 0;
  return Math.max(1, Math.floor(safeAttack * (100 / (100 + safeDefense * 1.5))));
}

function resolveCriticalMultiplier(value) {
  return Number.isFinite(value) ? Math.max(1.25, Math.min(2.5, value)) : 1.5;
}

function consumeEnemyAdaptation(enemy, style) {
  const counter = enemy?.adaptiveCounter;
  if (!counter || counter.style !== style || counter.remaining <= 0) return false;
  counter.remaining -= 1;
  if (counter.remaining <= 0) enemy.adaptiveCounter = null;
  return true;
}

function prepareEnemyAdaptation(ow, enemy) {
  const history = ow?.combat?.playerStyleHistory || [];
  if (history.length < 3) return;
  const recent = history.slice(-3);
  const style = ['melee', 'ranged', 'magic']
    .find(candidate => recent.filter(value => value === candidate).length >= 2);
  if (!style || enemy.adaptiveCounter?.remaining > 0) return;
  const def = ENEMIES[enemy.enemyId];
  // Bosses learn more slowly and their counter is weaker.
  enemy.adaptiveCounter = { style, remaining: def?.boss ? 2 : 1 };
  const label = style === 'melee' ? 'ближний бой' : style === 'ranged' ? 'дальние атаки' : 'магия';
  pushLog(`🧠 ${enemyDisplayName(enemy)} приспособился к вашему стилю (${label})!`, 'warning');
  if (def?.boss) {
    pushLog('⚠️ Босс изучает ваши действия, но его защита слабее.', 'info');
  }
}

function hasBuff(p, id) {
  return Array.isArray(p.buffs) &&
    p.buffs.some(buff => buff.id === id);
}

function consumeBuffRound(p, id) {
  if (!Array.isArray(p.buffs)) return;

  const buff = p.buffs.find(item => item.id === id);
  if (!buff) return;

  buff.duration -= 1;

  if (buff.duration <= 0) {
    p.buffs = p.buffs.filter(item => item.id !== id);
  }
}

export function enterCombat(enemy) {
  const ow = state.overworld;
  if (!ow || !enemy || enemy.dead || enemy.hp <= 0 || ow.combat) return;

  enemy.state = 'combat';
  enemy.tacticalSpecialPending = enemy.tacticalSpecialPending === true;

  ow.combat = {
    enemy,
    turn: 'player',
    over: false,
    turnCount: Math.max(0, Math.floor(Number(enemy.persistentTurnCount) || 0)),
    blocking: false,
    guaranteedDodge: false,
    playerChargeNext: false,
    playerResurrectionUsed: false
  };

  pushLog(`⚔️ Бой: ${enemyDisplayName(enemy)}`, 'info');
  emit('combat:start');
}

function checkBossPhase(enemy) {
  if (!ENEMIES[enemy.enemyId].phases) return;

  const phases = ENEMIES[enemy.enemyId].phases;

  for (let i = enemy.phase || 0; i < phases.length; i++) {
    const phase = phases[i];

    if (enemy.hp / enemy.maxHp <= phase.atHp) {
      enemy.phase = i + 1;

      pushLog(`⚠️ ${phase.msg}`, 'damage');
      playSound('cast');
      triggerShake(10, 0.4);
    }
  }
}

export function combatAttack() {
  const ow = state.overworld;

  if (!ow || !ow.combat || ow.combat.turn !== 'player') {
    return;
  }

  const enemy = ow.combat.enemy;
  const p = state.game.player;
  const stats = getEffStats();
  const atkMult = getAtkMult(p);
  const talent = getTalentBonus(p);

  const style = p.class === 'archer' ? 'ranged' : 'melee';
  recordPlayerStyle(ow, style);
  const enemyDefense = enemyDefenseForStyle(enemy, style, stats.armorPen || 0);
  consumeEnemyAdaptation(enemy, style);

  let damage = Math.max(
    1,
    Math.floor(
      (
        stats.atk +
        Math.floor(Math.random() * 5) -
        Math.floor(enemyDefense / 2)
      ) *
      atkMult *
      talent.dmgMult *
      enemyDamageMultiplier(enemy, style)
    )
  );

  const catLuckBonus = hasBuff(p, 'catLuck') ? 0.05 : 0;

  const isCrit = Math.random() < resolveCriticalChance(stats, catLuckBonus);

  if (isCrit) {
    damage = Math.floor(damage * resolveCriticalMultiplier(talent.critMult));
    triggerShake(8, 0.3);
    spawnParticles(enemy.x, enemy.y, 'spark', 10);
  }
  spawnParticles(enemy.x, enemy.y, p.class === 'archer' ? 'arrow' : 'slash', isCrit ? 14 : 7);

  if (ow.combat.playerChargeNext) {
    damage = Math.floor(damage * 2);
    ow.combat.playerChargeNext = false;

    pushLog('⚡ Рывок: двойной урон!', 'damage');
    spawnParticles(enemy.x, enemy.y, 'spark', 8);
  }

  // Lifesteal is based on health actually removed, not overkill damage.
  const actualDamage = Math.min(Math.max(0, enemy.hp), damage);
  const lifesteal = Math.min(
    1,
    getLifesteal(p) + talent.lifesteal
  );

  if (lifesteal > 0 && actualDamage > 0) {
    const heal = Math.floor(actualDamage * lifesteal);

    p.hp = Math.min(p.maxHp, p.hp + heal);
    ow.player.hp = p.hp;

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '+' + heal,
      type: 'heal',
      life: 1.2
    });

    pushLog(`🩸 Кровожадность: +${heal} HP`, 'heal');
  }

  enemy.hp -= damage;

  ow.floatingNumbers.push({
    x: enemy.x,
    y: enemy.y - 20,
    text: (isCrit ? '!' : '-') + damage,
    type: isCrit ? 'crit' : 'damage',
    life: 1.2
  });

  pushLog(
    `Вы нанесли ${damage} урона (${enemyDisplayName(enemy)})${isCrit ? ' КРИТ!' : ''}`,
    'damage'
  );

  if (p.class === 'warrior') {
    p.mp = Math.min(p.maxMp, p.mp + 15);
    ow.player.mp = p.mp;

    pushLog(
      `🔥 Ярость: +15 (${p.mp}/${p.maxMp})`,
      'info'
    );
  } else if (p.class === 'archer') {
    p.mp = Math.min(p.maxMp, p.mp + 10);
    ow.player.mp = p.mp;

    pushLog(
      `🎯 Концентрация: +10 (${p.mp}/${p.maxMp})`,
      'info'
    );
  }

  playSound(isCrit ? 'crit' : 'hit');

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    return combatVictory();
  }

  checkBossPhase(enemy);
  tickEnemyEffects();

  if (ow.combat && enemy.hp <= 0) {
    enemy.hp = 0;
    return combatVictory();
  }

  ow.combat.turn = 'enemy';
  scheduleEnemyCombatTurn(700);
}

export function combatCastSpell(spellId) {
  const ow = state.overworld;

  if (!ow || !ow.combat || ow.combat.turn !== 'player') {
    return;
  }

  const p = state.game.player;
  const spell = SPELLS[spellId];

  if (!spell) return;

  if (p.class === 'warrior') {
    pushLog('Воин не умеет колдовать!', 'info');
    return;
  }

  // Validate catalog values before any resource is spent or turn is advanced.
  if (spellId === 'sacrifice') {
    if (
      !Number.isFinite(spell.selfDamagePct) ||
      spell.selfDamagePct < 0 || spell.selfDamagePct > 1 ||
      !isFiniteNonNegative(spell.restoreMp)
    ) return;
  } else if (
    !isFiniteNonNegative(spell.cost) ||
    (spell.damage !== undefined && (!Number.isFinite(spell.damage) || spell.damage <= 0)) ||
    (spell.heal !== undefined && (!Number.isFinite(spell.heal) || spell.heal <= 0)) ||
    ((spell.damage === undefined && spell.heal === undefined && !spell.selfEffect) ||
    (spell.damage !== undefined && spell.heal !== undefined))
  ) {
    return;
  }

  if (spellId === 'sacrifice') {
    const hpCost = Math.ceil(p.maxHp * spell.selfDamagePct);

    if (p.hp <= hpCost) {
      pushLog('Недостаточно HP для Жертвы!', 'info');
      return;
    }

    p.hp -= hpCost;
    p.mp = Math.min(p.maxMp, p.mp + spell.restoreMp);

    ow.player.hp = p.hp;
    ow.player.mp = p.mp;

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '-' + hpCost,
      type: 'damage',
      life: 1.2
    });

    ow.floatingNumbers.push({
      x: ow.player.x + 15,
      y: ow.player.y - 30,
      text: '+' + spell.restoreMp + ' MP',
      type: 'heal',
      life: 1.2
    });

    pushLog(
      `🩸 Жертва: потрачено ${hpCost} HP, восстановлено ${spell.restoreMp} MP`,
      'heal'
    );

    playSound('heal');

    ow.combat.turn = 'enemy';
    scheduleEnemyCombatTurn(700);
    return;
  }

  const stats = getEffStats();
  const talent = getTalentBonus(p);
  const enemy = ow.combat.enemy;

  // Reject invalid derived stats before spending mana or changing combat state.
  if (!hasValidCombatStats(stats, talent)) return;

  const freeMana = p.effects?.some(
    effect => effect?.id === 'manaShield'
  );

  if (!freeMana && p.mp < spell.cost) {
    pushLog('Мало маны', 'info');
    return;
  }

  if (!freeMana) {
    p.mp -= spell.cost;
    ow.player.mp = p.mp;
  } else {
    pushLog('💧 Эликсир маны: мана не тратится', 'success');
  }

  if (spell.damage) {
    recordPlayerStyle(ow, 'magic');
    consumeEnemyAdaptation(enemy, 'magic');
    const elementalMultiplier = applyElementalReaction(enemy, spell.element);
    const rawDamage = Math.max(
      1,
      Math.floor(
        (
          spell.damage +
          Math.floor(stats.mag / 2) -
          Math.floor(
            enemyDefenseForStyle(enemy, 'magic', stats.armorPen || 0) / 2
          )
        ) *
        talent.spellMult *
        enemyDamageMultiplier(enemy, 'magic') *
        elementalMultiplier
      )
    );
    // Damaging spells share weapon attacks' critical-hit formula.
    const isCrit = Math.random() < resolveCriticalChance(stats);
    const damage = isCrit ? Math.floor(rawDamage * resolveCriticalMultiplier(talent.critMult)) : rawDamage;

    enemy.hp -= damage;

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: (isCrit ? '!' : '-') + damage,
      type: isCrit ? 'crit' : 'damage',
      life: isCrit ? 1.4 : 1.2
    });

    pushLog(`${spell.name}: нанесено ${damage} урона${isCrit ? ' КРИТ!' : ''}`, 'damage');

    playSound(isCrit ? 'crit' : 'cast');
    if (isCrit) triggerShake(8, 0.3);
    const spellBurst = spell.element === 'fire' ? 'fire'
      : spell.element === 'ice' ? 'ice'
        : spell.element === 'lightning' ? 'arcane' : 'spark';
    spawnParticles(enemy.x, enemy.y, spellBurst, isCrit ? 16 : 9);
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }

    checkBossPhase(enemy);
  } else if (spell.heal) {
    const heal = Math.floor(
      (spell.heal + Math.floor(stats.mag / 2)) *
      talent.healMult
    );

    p.hp = Math.min(p.maxHp, p.hp + heal);
    ow.player.hp = p.hp;

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '+' + heal,
      type: 'heal',
      life: 1.2
    });

    pushLog(`${spell.name}: восстановлено ${heal} HP`, 'heal');

    playSound('heal');
    spawnParticles(ow.player.x, ow.player.y, 'levelup', 6);
  }

  if (spell.effect) {
    applyEffect(enemy, spell.effect);
    pushLog(`☠️ Наложен эффект: ${spell.effect}`, 'damage');
  }

  if (spell.selfEffect) {
    applyEffect(p, spell.selfEffect);
    pushLog(`🛡️ Эффект на вас: ${spell.selfEffect}`, 'success');
  }

  tickEnemyEffects();

  if (ow.combat && enemy.hp <= 0) {
    enemy.hp = 0;
    return combatVictory();
  }

  ow.combat.turn = 'enemy';
  scheduleEnemyCombatTurn(700);
}

export function combatUseAbility(abilityId) {
  const ow = state.overworld;

  if (!ow || !ow.combat || ow.combat.turn !== 'player') {
    return;
  }

  const p = state.game.player;
  const cls = CLASSES[p.class];
  const ability = cls.abilities?.find(item => item.id === abilityId);

  if (!ability || ability.passive) return;

  // Every catalog action must have a handler and sane numeric parameters.
  if (
    !COMBAT_ABILITY_IDS.has(abilityId) ||
    !isFiniteNonNegative(ability.cost ?? 0) ||
    !isFiniteNonNegative(ability.cooldown)
  ) return;

  const cooldown = p.cooldowns?.[abilityId] || 0;

  if (cooldown > 0) {
    pushLog(`${ability.name}: перезарядка (${cooldown})`, 'info');
    return;
  }

  const enemy = ow.combat.enemy;
  const stats = getEffStats();
  const talent = getTalentBonus(p);

  // Reject invalid derived stats before spending class resource or starting cooldown.
  if (!hasValidCombatStats(stats, talent)) return;

  const freeMana = p.effects?.some(
    effect => effect?.id === 'manaShield'
  );

  if (!freeMana && p.mp < (ability.cost || 0)) {
    pushLog(
      p.class === 'warrior'
        ? 'Недостаточно Ярости!'
        : p.class === 'archer'
          ? 'Недостаточно концентрации!'
          : 'Мало маны',
      'info'
    );
    return;
  }

  if (ability.cost && !freeMana) {
    p.mp -= ability.cost;
  }

  if (freeMana && ability.cost > 0) {
    pushLog('💧 Эликсир маны: мана не тратится', 'success');
  }

  ow.player.mp = p.mp;

  if (!p.cooldowns) {
    p.cooldowns = {};
  }

  p.cooldowns[abilityId] = Math.max(
    1,
    ability.cooldown + (talent.abilityCdDelta || 0)
  );

  if (abilityId === 'aimed-shot') {
    recordPlayerStyle(ow, 'ranged');
    consumeEnemyAdaptation(enemy, 'ranged');
    const damage = Math.max(
      1,
      Math.floor(
        (
          stats.atk * 1.65 +
          Math.floor(Math.random() * 6) -
          Math.floor(
            enemyDefenseForStyle(enemy, 'ranged', stats.armorPen || 0) / 2
          )
        ) *
        talent.dmgMult *
        resolveCriticalMultiplier(talent.critMult) *
        enemyDamageMultiplier(enemy, 'ranged')
      )
    );

    enemy.hp -= damage;

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '🎯-' + damage,
      type: 'crit',
      life: 1.3
    });

    pushLog(
      `🎯 Прицельный выстрел: ${damage} урона — гарантированный крит!`,
      'damage'
    );

    playSound('crit');
    spawnParticles(enemy.x, enemy.y, 'spark', 9);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }

    checkBossPhase(enemy);
  } else if (abilityId === 'evasion') {
    ow.combat.guaranteedDodge = true;

    pushLog(
      '💨 Уклонение: следующая атака противника будет полностью отбита',
      'success'
    );

    spawnParticles(ow.player.x, ow.player.y, 'smoke', 8);
  } else if (abilityId === 'toxic-blade') {
    recordPlayerStyle(ow, 'melee');
    consumeEnemyAdaptation(enemy, 'melee');
    const enemyDefense = Math.max(
      0,
      enemyDefenseForStyle(enemy, 'melee', stats.armorPen || 0)
    );
    const damage = Math.max(
      1,
      Math.floor(stats.atk * 0.7 - Math.floor(enemyDefense / 2))
    );

    enemy.hp -= damage;
    applyEffect(enemy, 'poison');

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '-' + damage,
      type: 'damage',
      life: 1.2
    });

    pushLog(
      `☠️ Отравленный наконечник: ${damage} урона и яд на 3 хода`,
      'damage'
    );

    playSound('hit');
    spawnParticles(enemy.x, enemy.y, 'poison', 8);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }

    checkBossPhase(enemy);
  } else if (abilityId === 'shield-bash') {
    recordPlayerStyle(ow, 'melee');
    consumeEnemyAdaptation(enemy, 'melee');
    const defense = Math.max(0, enemyDefenseForStyle(enemy, 'melee', stats.armorPen || 0));
    const damage = Math.max(1, Math.floor((stats.atk * 1.05 - defense * 0.65) * talent.dmgMult * enemyDamageMultiplier(enemy, 'melee')));
    enemy.hp = Math.max(0, enemy.hp - damage);
    applyEffect(enemy, 'stun');
    ow.floatingNumbers.push({ x: enemy.x, y: enemy.y - 22, text: '🛡️-' + damage, type: 'crit', life: 1.25 });
    pushLog(`🛡️ Щитовой удар: ${damage} урона и оглушение!`, 'success');
    playSound('hit');
    spawnParticles(enemy.x, enemy.y, 'impact', 12);
    triggerShake(4, 0.14);
    if (enemy.hp <= 0) { enemy.hp = 0; return combatVictory(); }
    checkBossPhase(enemy);
  } else if (abilityId === 'frost-nova') {
    recordPlayerStyle(ow, 'magic');
    consumeEnemyAdaptation(enemy, 'magic');
    const elementalMultiplier = applyElementalReaction(enemy, 'ice');
    const defense = Math.max(0, enemyDefenseForStyle(enemy, 'magic', stats.armorPen || 0));
    const damage = Math.max(1, Math.floor((34 + Math.floor(stats.mag * 0.7) - Math.floor(defense / 2)) * talent.spellMult * enemyDamageMultiplier(enemy, 'magic') * elementalMultiplier));
    enemy.hp = Math.max(0, enemy.hp - damage);
    applyEffect(enemy, 'stun');
    ow.floatingNumbers.push({ x: enemy.x, y: enemy.y - 22, text: '❄️-' + damage, type: 'crit', life: 1.35 });
    pushLog(`❄️ Ледяная нова: ${damage} урона, цель оглушена!`, 'success');
    playSound('cast');
    spawnParticles(enemy.x, enemy.y, 'ice', 16);
    triggerShake(5, 0.18);
    if (enemy.hp <= 0) { enemy.hp = 0; return combatVictory(); }
    checkBossPhase(enemy);
  } else if (abilityId === 'piercing-shot') {
    recordPlayerStyle(ow, 'ranged');
    consumeEnemyAdaptation(enemy, 'ranged');
    const defense = Math.max(0, enemyDefenseForStyle(enemy, 'ranged', stats.armorPen || 0));
    const damage = Math.max(1, Math.floor((stats.atk * 1.35 - defense * 0.25) * talent.dmgMult * enemyDamageMultiplier(enemy, 'ranged')));
    enemy.hp = Math.max(0, enemy.hp - damage);
    ow.floatingNumbers.push({ x: enemy.x, y: enemy.y - 22, text: '🏹-' + damage, type: 'crit', life: 1.25 });
    pushLog(`🏹 Пробивающий выстрел: ${damage} урона, броня частично пробита!`, 'damage');
    playSound('crit');
    spawnParticles(enemy.x, enemy.y, 'arrow', 12);
    if (enemy.hp <= 0) { enemy.hp = 0; return combatVictory(); }
    checkBossPhase(enemy);
  } else if (abilityId === 'charge') {
    ow.combat.playerChargeNext = true;

    pushLog('⚡ Рывок: следующая атака ×2', 'damage');
  } else if (abilityId === 'war-cry') {
    applyEffect(p, 'atkBuff');

    pushLog(
      '📢 Боевой клич: +30% атаки (2 хода)',
      'success'
    );
  } else if (abilityId === 'bloodthirst') {
    applyEffect(p, 'lifesteal');

    pushLog(
      '🩸 Кровожадность: вампиризм 50% (2 хода)',
      'success'
    );
  } else if (abilityId === 'mana-shield') {
    applyEffect(p, 'defBuff');

    pushLog(
      '🛡️ Щит маны: +50% защиты (2 хода)',
      'success'
    );
  } else if (abilityId === 'teleport') {
    pushLog(
      '💨 Телепорт: враг пропускает ход',
      'success'
    );

    playSound('cast');
    ow.combat.turn = 'enemy';

    setTimeout(() => {
      const ow2 = state.overworld;

      if (!ow2 || !ow2.combat) return;

      pushLog(
        '💨 Враг дезориентирован и пропускает ход',
        'info'
      );

      tickEnemyEffects();

      const ow3 = state.overworld;

      if (!ow3 || !ow3.combat) return;

      if (ow3.combat.enemy.hp <= 0) {
        ow3.combat.enemy.hp = 0;
        return combatVictory();
      }

      tickPlayerEffects();

      const ow4 = state.overworld;

      if (!ow4 || !ow4.combat) return;

      decreaseCooldowns();

      ow4.combat.turn = 'player';
      ow4.combat.turnCount = (ow4.combat.turnCount || 0) + 1;
    }, 500);

    return;
  } else if (abilityId === 'meteor') {
    const damage = Math.floor(
      (60 + Math.floor(stats.mag / 2)) *
      talent.meteorMult *
      talent.spellMult
    );

    enemy.hp -= damage;
    applyEffect(enemy, 'burn');

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '-' + damage,
      type: 'crit',
      life: 1.4
    });

    pushLog(
      `☄️ Метеор: ${damage} урона + ожог`,
      'damage'
    );

    playSound('cast');
    triggerShake(10, 0.4);
    spawnParticles(enemy.x, enemy.y, 'spark', 15);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }

    checkBossPhase(enemy);
  } else if (abilityId === 'prayer') {
    const heal = Math.floor(
      (50 + Math.floor(stats.mag / 2)) *
      talent.prayerMult *
      talent.healMult
    );

    p.hp = Math.min(p.maxHp, p.hp + heal);
    ow.player.hp = p.hp;

    clearDebuffs(p);

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '+' + heal,
      type: 'heal',
      life: 1.4
    });

    pushLog(
      `🙏 Молитва: +${heal} HP, дебаффы сняты`,
      'heal'
    );

    playSound('heal');
    spawnParticles(ow.player.x, ow.player.y, 'levelup', 8);
  } else if (abilityId === 'sanctify') {
    const damage = Math.floor(
      (25 + Math.floor(stats.mag / 2)) *
      talent.spellMult
    );

    enemy.hp -= damage;
    applyEffect(enemy, 'burn');

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '-' + damage,
      type: 'damage',
      life: 1.2
    });

    pushLog(
      `☀️ Освящение: ${damage} урона + ожог`,
      'damage'
    );

    playSound('cast');
    spawnParticles(enemy.x, enemy.y, 'spark', 6);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }

    checkBossPhase(enemy);
  }

  tickEnemyEffects();

  if (ow.combat && enemy.hp <= 0) {
    enemy.hp = 0;
    return combatVictory();
  }

  ow.combat.turn = 'enemy';
  scheduleEnemyCombatTurn(700);
}

export function combatUseItem(itemId) {
  const ow = state.overworld;

  if (!ow || !ow.combat || ow.combat.turn !== 'player') {
    return;
  }

  const item = ITEMS[itemId];

  if (!item || item.type !== 'consumable' || typeof item.use !== 'function' || countItem(itemId) < 1) {
    return;
  }

  const p = state.game.player;
  const before = {
    hp: p.hp,
    mp: p.mp
  };

  item.use(p);

  if (item.effect === 'antidote') {
    clearDebuffs(p);
    pushLog('🧪 Антидот: дебаффы сняты', 'heal');
  } else if (item.effect) {
    applyEffect(p, item.effect);
    pushLog(`✨ Эффект: ${item.name}`, 'success');
  }

  updateQuestProgress('potion-used', 'any', 1);

  const healed = p.hp - before.hp;
  const mana = p.mp - before.mp;

  ow.player.hp = p.hp;
  ow.player.mp = p.mp;

  if (healed > 0) {
    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '+' + healed,
      type: 'heal',
      life: 1.2
    });

    spawnParticles(ow.player.x, ow.player.y, 'levelup', 5);
    pushLog(`Вы восстановили ${healed} HP`, 'heal');
  } else if (mana > 0) {
    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '+' + mana,
      type: 'heal',
      life: 1.2
    });

    spawnParticles(ow.player.x, ow.player.y, 'levelup', 5);
    pushLog(`Вы восстановили ${mana} MP`, 'heal');
  }

  removeItem(itemId);
  playSound('heal');
  tickEnemyEffects();

  if (ow.combat && ow.combat.enemy.hp <= 0) {
    ow.combat.enemy.hp = 0;
    return combatVictory();
  }

  ow.combat.turn = 'enemy';
  scheduleEnemyCombatTurn(700);
}

export function combatBlock() {
  const ow = state.overworld;

  if (!ow || !ow.combat || ow.combat.turn !== 'player') {
    return;
  }

  ow.combat.blocking = true;
  spawnParticles(ow.player.x, ow.player.y, 'guard', 12);

  const blockPower = getEffStats().blockPower || 0.6;

  pushLog(
    `🛡️ Защитная стойка: следующий удар будет ослаблен на ${Math.round(Math.max(0.5, blockPower) * 100)}%`,
    'info'
  );

  tickEnemyEffects();

  if (ow.combat && ow.combat.enemy.hp <= 0) {
    ow.combat.enemy.hp = 0;
    return combatVictory();
  }

  ow.combat.turn = 'enemy';
  scheduleEnemyCombatTurn(500);
}

export function combatFlee(forced = false) {
  const ow = state.overworld;

  if (!ow || !ow.combat) return;

  if (!forced && Math.random() >= 0.6) {
    pushLog('Побег не удался!', 'info');
    ow.combat.turn = 'enemy';
    scheduleEnemyCombatTurn(700);
    return;
  }

  pushLog('Вы сбежали', 'info');
  const enemy = ow.combat.enemy;
  const regionId = ow.sourceLocationId || ow.locationId;
  if (enemy?.boss && !ow.rifMode && !ow.towerMode && state.game?.world && regionId && enemy.persistentId) {
    recordRegionBossProgress(state.game.world, regionId, enemy.persistentId, enemy, ow.combat.turnCount);
  }
  clearPlayerEffects();
  endCombat();
  if (enemy?.boss && !ow.rifMode && !ow.towerMode && !saveGame()) {
    const warning = 'Не удалось сохранить прогресс босса. Победа не потеряна, но перед выходом сохраните игру повторно.';
    pushLog(warning, 'warning');
    emit('toast', warning);
  }
}

function tickEnemyEffects() {
  const ow = state.overworld;
  if (!ow || !ow.combat) return;

  const enemy = ow.combat.enemy;
  const result = tickEffects(enemy);

  if (result.totalDamage > 0) {
    enemy.hp -= result.totalDamage;

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '-' + result.totalDamage,
      type: 'damage',
      life: 1.2
    });

    const parts = result.messages
      .map(message => `${message.icon} ${message.name} ${message.damage}`)
      .join(', ');

    pushLog(`Эффекты на враге: ${parts}`, 'damage');
  }

  if (enemy.hp > 0) checkBossPhase(enemy);
}
function tickPlayerEffects() {
  const ow = state.overworld;
  if (!ow || !ow.combat) return;

  const p = state.game.player;
  const result = tickEffects(p);

  if (result.totalDamage > 0) {
    const actualDamage = applyPlayerDamage(p, ow, result.totalDamage);

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '-' + actualDamage,
      type: 'damage',
      life: 1.2
    });

    pushLog(`Эффекты на вас: ${actualDamage} фактического урона`, 'damage');
  }

  if (p.hp <= 0) {
    p.hp = 0;
    combatDefeat();
  }
}

function decreaseCooldowns() {
  const p = state.game.player;
  if (!p.cooldowns) return;

  for (const key in p.cooldowns) {
    if (p.cooldowns[key] > 0) {
      p.cooldowns[key] -= 1;
    }
  }
}

function scheduleEnemyCombatTurn(delay = 700) {
  const combat = state.overworld?.combat;
  if (!combat) return;

  // A delayed response belongs to one encounter only; never let an old
  // timer attack a player who has already started a different fight.
  setTimeout(() => {
    if (state.overworld?.combat !== combat) return;
    enemyCombatTurn();
  }, delay);
}

function persistRegionalBossCheckpoint(ow) {
  const enemy = ow?.combat?.enemy;
  const regionId = ow?.sourceLocationId || ow?.locationId;
  if (!enemy?.boss || ow.rifMode || ow.towerMode || !state.game?.world || !regionId || !enemy.persistentId) return;
  if (!recordRegionBossProgress(state.game.world, regionId, enemy.persistentId, enemy, ow.combat.turnCount)) return;
  if (!saveGame()) {
    const warning = 'Не удалось сохранить контрольную точку босса. Текущий прогресс останется в памяти до следующего успешного сохранения.';
    pushLog(warning, 'warning');
    emit('toast', warning);
  }
}

function enemyCombatTurn() {
  const ow = state.overworld;

  if (!ow || !ow.combat || ow.combat.turn !== 'enemy') {
    return;
  }

  const enemy = ow.combat.enemy;
  const def = ENEMIES[enemy.enemyId];
  const stats = getEffStats();
  const p = state.game.player;
  const name = enemyDisplayName(enemy);

  if (enemy.modifier === 'regenerating' && enemy.hp < enemy.maxHp) {
    const regen = MODIFIERS.regenerating.regenPerTurn || 5;

    enemy.hp = Math.min(enemy.maxHp, enemy.hp + regen);

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '+' + regen,
      type: 'heal',
      life: 1
    });
  }

  if (isStunned(enemy)) {
    consumeStun(enemy);
    if (interruptEnemyTelegraph(enemy)) {
      pushLog(`🛑 Подготовка особого приёма ${name} сорвана оглушением!`, 'success');
    }
    pushLog(`💫 ${name} оглушён, пропускает ход`, 'info');

    tickEnemyEffects();

    if (ow.combat && enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }

    tickPlayerEffects();

    if (!ow.combat) return;

    decreaseCooldowns();

    ow.combat.turn = 'player';
    ow.combat.turnCount = (ow.combat.turnCount || 0) + 1;
    ow.combat.blocking = false;
    persistRegionalBossCheckpoint(ow);

    return;
  }

  const difficulty =
    state.settings.difficulty === 'easy'
      ? 0.7
      : state.settings.difficulty === 'hard'
        ? 1.4
        : 1;

  const modifierAttack = enemy.modifier
    ? MODIFIERS[enemy.modifier].atkMult
    : 1;

  const phaseAttack =
    enemy.phase > 0 && def.phases
      ? (def.phases[enemy.phase - 1]?.atkMult || 1)
      : 1;

  const ng = getNGPlusMult();

  const rift = ow.rifMode
    ? getRiftMult(ow.rifFloor)
    : ow.towerMode ? getTowerMult(ow.towerFloor) : { atkMult: 1 };

  const attack =
    def.attack *
    getAtkMult(enemy) *
    (enemy.elite ? ELITE_ATK_MULT : 1) *
    modifierAttack *
    phaseAttack *
    ng.atkMult *
    rift.atkMult;

  let baseDamage = Math.max(
    1,
    Math.floor(
      mitigateIncomingDamage(attack + Math.floor(Math.random() * 5), stats.def) *
      difficulty
    )
  );

  ow.combat.turnCount = (ow.combat.turnCount || 0) + 1;
  prepareEnemyAdaptation(ow, enemy);

  // Уклонение: полностью отменяет одну атаку, включая специальную атаку босса.
  const dodgeChance = Math.max(
    0,
    Math.min(0.65, stats.dodgeChance || 0)
  );

  const dodged =
    ow.combat.guaranteedDodge ||
    Math.random() < dodgeChance;

  ow.combat.guaranteedDodge = false;

  if (dodged) {
    pushLog(
      '💨 Вы уклонились от атаки — урон полностью предотвращён!',
      'success'
    );

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 22,
      text: 'DODGE',
      type: 'heal',
      life: 1
    });

    spawnParticles(ow.player.x, ow.player.y, 'smoke', 10);

    ow.combat.blocking = false;

    tickPlayerEffects();

    if (!ow.combat) return;

    const talent = getTalentBonus(p);

    if (talent.hpRegen > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + talent.hpRegen);
      ow.player.hp = p.hp;
    }

    if (talent.manaRegen > 0 && p.mp < p.maxMp) {
      p.mp = Math.min(p.maxMp, p.mp + talent.manaRegen);
      ow.player.mp = p.mp;
    }

    decreaseCooldowns();
    ow.combat.turn = 'player';
    persistRegionalBossCheckpoint(ow);

    return;
  }

  // Автоматический блок от экипировки и пассивных характеристик.
  const playerGuarding = Boolean(ow.combat.blocking);
  const automaticBlock =
    !ow.combat.blocking &&
    Math.random() < Math.max(
      0,
      Math.min(0.6, stats.blockChance || 0)
    );

  if (ow.combat.blocking || automaticBlock) {
    const reduction = ow.combat.blocking
      ? Math.max(0.5, stats.blockPower || 0.6)
      : Math.max(0.35, stats.blockPower || 0.45);

    baseDamage = Math.max(
      1,
      Math.floor(
        baseDamage * (1 - Math.min(0.9, reduction))
      )
    );

    pushLog(
      ow.combat.blocking
        ? '🛡️ Вы приняли удар в защитную стойку'
        : '🛡️ Сработал автоматический блок',
      'success'
    );
  }

  const defenseMult = getDefMult(p);

  if (defenseMult > 1) {
    baseDamage = Math.max(
      1,
      Math.floor(baseDamage / defenseMult)
    );
  }

  const special = def.special;

  const specialEvery =
    enemy.phase > 0 && def.phases
      ? (def.phases[enemy.phase - 1]?.specialEvery || special?.every)
      : special?.every;

  const playerHpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
  const enemyHpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const tacticalDecision = getEnemyCombatDecision({
    specialType: special?.type,
    specialEvery,
    turnCount: ow.combat.turnCount,
    playerHpRatio,
    enemyHpRatio,
    blocking: ow.combat.blocking,
    pendingSpecial: Boolean(enemy.tacticalSpecialPending),
    isBoss: Boolean(def.boss)
  });
  const useSpecial = tacticalDecision.action === 'special';
  if (tacticalDecision.action === 'telegraph') {
    enemy.tacticalSpecialPending = true;
    pushLog(`⚠️ ${name} готовит особый приём: ${special.name}!`, 'warning');
  } else if (useSpecial) {
    enemy.tacticalSpecialPending = false;
    pushLog(`❗ ${name} применяет подготовленный приём: ${special.name}!`, 'warning');
    const signatureEffect = special.element === 'ice' ? 'ice'
      : special.element === 'blood' ? 'blood'
        : special.element === 'fire' ? 'fire' : 'arcane';
    spawnParticles(ow.player.x, ow.player.y, signatureEffect, def.boss ? 24 : 12);
    if (def.boss) triggerShake(7, 0.28);
  }

  if (playerGuarding && (def.boss || enemy.elite) && p.hp > 0 && enemy.hp > 0) {
    const counterDamage = Math.max(1, Math.floor(
      stats.atk * (0.28 + Math.min(0.25, (stats.blockPower || 0.5) * 0.25))
    ));
    enemy.hp = Math.max(0, enemy.hp - counterDamage);
    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 34,
      text: 'КОНТР -' + counterDamage,
      type: 'crit',
      life: 1.25
    });
    spawnParticles(enemy.x, enemy.y, 'impact', 13);
    spawnParticles(ow.player.x, ow.player.y, 'guard', 8);
    triggerShake(4, 0.16);
    pushLog(`⚔️ Контратака из блока: ${counterDamage} урона!`, 'success');
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      return combatVictory();
    }
  }

  let actualDamage = 0;

  if (useSpecial && special.type === 'double') {
    const damage1 = Math.max(
      1,
      Math.floor(baseDamage * 0.6)
    );

    const damage2 = Math.max(
      1,
      Math.floor(baseDamage * 0.6)
    );

    actualDamage = applyPlayerDamage(p, ow, damage1 + damage2);

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '-' + damage1,
      type: 'damage',
      life: 1.2
    });

    ow.floatingNumbers.push({
      x: ow.player.x + 12,
      y: ow.player.y - 30,
      text: '-' + damage2,
      type: 'damage',
      life: 1.2
    });

    pushLog(
      `${name} использовал ${special.name} и нанёс вам ${damage1}+${damage2} урона`,
      'damage'
    );

    if (special.effect) {
      applyEffect(p, special.effect);
      pushLog(`☠️ Наложен эффект: ${special.effect}`, 'damage');
    }
  } else if (useSpecial && special.type === 'snipe') {
    const mult = special.mult || 2;
    const damage = Math.max(
      1,
      Math.floor(baseDamage * mult)
    );

    actualDamage = applyPlayerDamage(p, ow, damage);

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '-' + damage,
      type: 'crit',
      life: 1.4
    });

    pushLog(
      `${name} использовал ${special.name} и нанёс вам ${damage} урона`,
      'damage'
    );

    if (special.effect) {
      applyEffect(p, special.effect);
      pushLog(`☠️ Наложен эффект: ${special.effect}`, 'damage');
    }
  } else if (useSpecial && special.type === 'drain') {
    const damage = baseDamage;
    actualDamage = applyPlayerDamage(p, ow, damage);

    // Drain healing is limited to HP actually removed, including lethal hits.
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + actualDamage);

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '-' + actualDamage,
      type: 'damage',
      life: 1.2
    });

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '+' + actualDamage,
      type: 'heal',
      life: 1.2
    });

    pushLog(
      `${name} использовал ${special.name} (${actualDamage} урона) и восстановил ${actualDamage} HP`,
      'damage'
    );

    if (special.effect) {
      applyEffect(p, special.effect);
      pushLog(`☠️ Наложен эффект: ${special.effect}`, 'damage');
    }
  } else {
    actualDamage = applyPlayerDamage(p, ow, baseDamage);

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '-' + baseDamage,
      type: 'damage',
      life: 1.2
    });

    pushLog(
      `${name} нанёс вам ${baseDamage} урона`,
      'damage'
    );
  }

  if (enemy.modifier === 'vampiric' && actualDamage > 0 && enemy.hp > 0) {
    const heal = Math.floor(
      actualDamage * (MODIFIERS.vampiric.vampiricPct || 0.3)
    );

    enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);

    ow.floatingNumbers.push({
      x: enemy.x,
      y: enemy.y - 20,
      text: '+' + heal,
      type: 'heal',
      life: 1
    });
  }

  triggerShake(5, 0.2);
  spawnParticles(ow.player.x, ow.player.y, 'hurt', 6);

  ow.combat.blocking = false;
  playSound('hurt');

  if (p.hp > 0 && p.class === 'warrior') {
    p.mp = Math.min(p.maxMp, p.mp + 10);
    ow.player.mp = p.mp;

    pushLog(
      `🔥 Ярость: +10 (${p.mp}/${p.maxMp})`,
      'info'
    );
  }

  if (p.hp <= 0) {
    p.hp = 0;
    return combatDefeat();
  }
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    return combatVictory();
  }

  tickPlayerEffects();

  if (!ow.combat) return;

  if (isStunned(p)) {
    consumeStun(p);
    pushLog('💫 Вы оглушены и пропускаете ход', 'info');
    decreaseCooldowns();
    ow.combat.turn = 'enemy';
    scheduleEnemyCombatTurn(500);
    return;
  }

  const talent = getTalentBonus(p);

  if (talent.hpRegen > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + talent.hpRegen);
    ow.player.hp = p.hp;

    ow.floatingNumbers.push({
      x: ow.player.x,
      y: ow.player.y - 20,
      text: '+' + talent.hpRegen,
      type: 'heal',
      life: 1
    });
  }

  if (talent.manaRegen > 0 && p.mp < p.maxMp) {
    p.mp = Math.min(p.maxMp, p.mp + talent.manaRegen);
    ow.player.mp = p.mp;
  }

  decreaseCooldowns();
  ow.combat.turn = 'player';
  persistRegionalBossCheckpoint(ow);
}

function combatVictory() {
  const ow = state.overworld;
  if (!ow || !ow.combat) return;

  const enemy = ow.combat.enemy;
  // Victory is a one-shot transition: stale callbacks must never duplicate rewards.
  if (!enemy || enemy.dead || enemy.hp > 0) return;

  const def = ENEMIES[enemy.enemyId];
  if (!def || !state.game?.player) return;
  const p = state.game.player;
  let previousGame;
  try {
    previousGame = JSON.parse(JSON.stringify(state.game));
  } catch {
    pushLog('Не удалось подготовить сохранение награды.', 'warning');
    return;
  }
  const previousEnemy = {
    dead: enemy.dead,
    respawnAt: enemy.respawnAt,
    effects: Array.isArray(enemy.effects) ? [...enemy.effects] : enemy.effects,
    hp: enemy.hp,
    state: enemy.state
  };
  const previousOverworld = {
    log: Array.isArray(ow.log) ? [...ow.log] : null,
    particles: Array.isArray(ow.particles) ? [...ow.particles] : null,
    floatingNumbers: Array.isArray(ow.floatingNumbers) ? [...ow.floatingNumbers] : null,
    shake: ow.shake
  };
  const campaignNotifications = [];
  let riftOpened = false;

  const ng = getNGPlusMult();

  const rift = ow.rifMode
    ? getRiftMult(ow.rifFloor)
    : ow.towerMode ? getTowerMult(ow.towerFloor) : { goldMult: 1, expMult: 1 };

  const rawGold = Math.round(
    def.gold * 0.15 *
    getActPriceMultiplier(p) *
    (enemy.elite ? 2 : 1) *
    ng.goldMult *
    rift.goldMult
  );
  // Keep the live balance a safe integer. At the cap, award the remaining
  // representable amount instead of corrupting the next save.
  const gold = Number.isSafeInteger(p.gold) && p.gold >= 0 && Number.isSafeInteger(rawGold) && rawGold >= 0
    ? Math.min(rawGold, Number.MAX_SAFE_INTEGER - p.gold)
    : 0;
  const goldWasCapped = gold < rawGold;

  const hasElderBlessing = p.effects?.some(
    effect => effect?.id === 'elderBlessing'
  );

  let savedBlessingDuration = 0;

  let exp = Math.round(
    def.exp *
    (enemy.elite ? 1.5 : 1) *
    ng.expMult *
    rift.expMult
  );

  if (hasElderBlessing) {
    exp = Math.round(exp * 1.2);

    const blessing = p.effects.find(
      effect => effect?.id === 'elderBlessing'
    );

    blessing.duration -= 1;
    savedBlessingDuration = blessing.duration;

    if (blessing.duration <= 0) {
      p.effects = p.effects.filter(
        effect => effect?.id !== 'elderBlessing'
      );

      pushLog(
        '✨ Благословение старейшины закончилось.',
        'info'
      );
    }
  }

  if (hasBuff(p, 'bardBuff')) {
    exp = Math.round(exp * 1.1);
    pushLog('🎵 Вдохновение барда: +10% опыта', 'info');
  }

  pushLog(
    `🏆 Победа! +${exp} опыта, +${gold} золота`,
    'success'
  );
  if (goldWasCapped) {
    pushLog('Баланс золота достиг безопасного предела: начислена только доступная сумма.', 'warning');
  }

  // Defer daily quest persistence and feedback until the complete victory
  // transaction (loot, stats, XP and enemy state) has been saved.
  const deferredQuestUpdates = [
    updateQuestProgress('kill', enemy.enemyId, 1, { persist: false, notify: false })
  ];

  if (enemy.boss) {
    deferredQuestUpdates.push(updateQuestProgress('boss-kill', 'any', 1, { persist: false, notify: false }));
  }

  if (!p.stats) {
    p.stats = {
      kills: {},
      deaths: 0,
      goldEarned: 0,
      chestsOpened: 0,
      dailyChestAt: 0,
      dailyChestsOpened: 0,
      flawlessStreak: 0
    };
  }

  p.stats.flawlessStreak =
    incrementSafeCount(p.stats.flawlessStreak);

  deferredQuestUpdates.push(updateQuestProgress(
    'flawless',
    'any',
    p.stats.flawlessStreak,
    { persist: false, notify: false }
  ));

  spawnParticles(enemy.x, enemy.y, 'smoke', 15);
  spawnParticles(enemy.x, enemy.y, 'spark', 6);

  p.stats.kills[enemy.enemyId] =
    incrementSafeCount(p.stats.kills[enemy.enemyId]);

  recordWorldEventKill(state.game, ow.sourceLocationId || ow.locationId, enemy);

  const campaignUpdates = recordCampaignKill(p, ow.locationId, enemy.enemyId);
  if (campaignUpdates.length > 0) {
    const activeMission = getActiveCampaignMission(p);
    if (activeMission && campaignUpdates.includes(activeMission.mission.id)) {
      const missionProgress = getMissionProgress(p, activeMission.mission);
      const missionTitle = activeMission.mission.title;
      const progressLabel = `${missionProgress.current}/${missionProgress.required}`;
      const notification = missionProgress.complete
        ? `📜 ${missionTitle}: цель выполнена (${progressLabel}). Вернитесь к Эдвину.`
        : missionProgress.current >= missionProgress.required && !missionProgress.shardFound
          ? `📜 ${missionTitle}: убийства выполнены (${progressLabel}), но нужен сюжетный осколок.`
          : `📜 ${missionTitle}: ${progressLabel}`;
      campaignNotifications.push(notification);
    }
  }

  const previousGoldEarned = Number.isSafeInteger(p.stats.goldEarned) && p.stats.goldEarned >= 0
    ? p.stats.goldEarned
    : 0;
  p.stats.goldEarned = Math.min(Number.MAX_SAFE_INTEGER, previousGoldEarned + gold);

  if (enemy.elite) {
    p.stats.eliteKills = incrementSafeCount(p.stats.eliteKills);
  }

  if (enemy.boss) {
    p.stats.bossKills = incrementSafeCount(p.stats.bossKills);
  }

  // Elites have a high chance for each listed drop. Bosses guarantee
  // their first signature drop; additional drops still use normal difficulty odds.
  const baseDropChance = enemy.elite ? 0.85 : getDropChance();
  const dropChance = getLootDropChance(baseDropChance, p, state.game);

  def.drops.forEach((id, index) => {
    const shouldDrop = enemy.boss
      ? index === 0 || Math.random() < getLootDropChance(getDropChance(), p, state.game)
      : Math.random() < dropChance;

    if (shouldDrop) {
      const result = addItemOrStore(id, 1, { allowMythic: !!enemy.boss });
      const instance = result.created[0];
      if (result.stored) {
        pushLog(`Сумка заполнена: ${ITEMS[id].name} отправлено в хранилище добычи.`, 'warning');
        return;
      }
      if (!instance) return;

      const rarity =
        instance.rarity && instance.rarity !== 'common'
          ? `${RARITIES[instance.rarity].name} `
          : '';

      pushLog(
        `Добыча: ${rarity}${ITEMS[id].name}`,
        'success'
      );
    }
  });

  const herbChance = enemy.boss
    ? Math.min(1, HERB_DROP_CHANCE_ELITE * 1.25)
    : enemy.elite
      ? HERB_DROP_CHANCE_ELITE
      : HERB_DROP_CHANCE;

  if (Math.random() < herbChance) {
    const herbQty = (enemy.elite || enemy.boss) ? 2 : 1;

    const herbId =
      Math.random() < 0.5
        ? 'herb-life'
        : 'herb-moon';

    const herbResult = addItemOrStore(herbId, herbQty);
    if (herbResult.created.length) {
      pushLog(`Трава: ${ITEMS[herbId].name} ×${herbQty}`, 'success');
    } else if (herbResult.stored) {
      pushLog(`Сумка заполнена: ${ITEMS[herbId].name} отправлено в хранилище добычи.`, 'warning');
    }
  }

  // Legacy location-based shard rewards disabled; canonical shards come from story dragons.
  const dragonReward = claimStoryDragonReward(state.game, enemy.enemyId, ow.locationId);
  if (dragonReward?.newlyDefeated) {
    const shardId = dragonReward.shardItemId;
    if (shardId && ITEMS[shardId]) {
      const shardResult = addItemOrStore(shardId, 1);
      pushLog('🐉 Сюжетный дракон повержен!', 'success');
      pushLog(`💎 Получен сюжетный осколок: ${ITEMS[shardId].name}`, shardResult.created.length || shardResult.stored ? 'success' : 'warning');
      if (dragonReward.dragon.id === 'blood-crown') {
        state.game.riftOpenedAt = Date.now();
        riftOpened = true;
      }
    }
  }

  p.gold += gold;

  const previousLevel = p.level;

  addExp(exp);

  if (p.level > previousLevel) {
    spawnParticles(ow.player.x, ow.player.y, 'levelup', 25);
    triggerShake(6, 0.3);
  }

  enemy.dead = true;
  enemy.respawnAt = performance.now() + getRespawnMs();
  const defeatedRegionId = ow.sourceLocationId || ow.locationId;
  if (state.game?.world && defeatedRegionId && enemy.persistentId) {
    if (enemy.boss) {
      recordRegionBossDefeat(state.game.world, defeatedRegionId, enemy.persistentId);
    } else {
      const respawnMinutes = getRespawnMs() / 60000;
      recordRegionEnemyDefeat(state.game.world, defeatedRegionId, enemy.persistentId,
        (Number(state.game.world.clockMinutes) || 0) + respawnMinutes);
    }
  }
  enemy.effects = [];

  clearPlayerEffects();

  if (hasElderBlessing && savedBlessingDuration > 0) {
    p.effects.push({
      id: 'elderBlessing',
      duration: savedBlessingDuration
    });
  }

  if (hasBuff(p, 'catLuck')) {
    consumeBuffRound(p, 'catLuck');
  }

  if (hasBuff(p, 'bardBuff')) {
    consumeBuffRound(p, 'bardBuff');
  }

  // Save after temporary combat effects and cooldowns have been cleared.
  // If persistence fails, restore the full pre-victory snapshot and keep
  // the encounter retryable instead of granting unsaved rewards.
  if (!saveGame()) {
    state.game = previousGame;
    enemy.dead = previousEnemy.dead;
    enemy.respawnAt = previousEnemy.respawnAt;
    enemy.effects = previousEnemy.effects;
    enemy.hp = enemy.maxHp;
    enemy.state = previousEnemy.state || 'idle';
    if (previousOverworld.log) ow.log = previousOverworld.log;
    if (previousOverworld.particles) ow.particles = previousOverworld.particles;
    if (previousOverworld.floatingNumbers) ow.floatingNumbers = previousOverworld.floatingNumbers;
    ow.shake = previousOverworld.shake;
    ow.player.hp = state.game.player.hp;
    ow.player.mp = state.game.player.mp;
    ow.combat.turn = 'player';
    pushLog('Награда не сохранена. Победа отменена — попробуйте ещё раз.', 'warning');
    return;
  }
  for (const notification of campaignNotifications) emit('toast', notification);
  for (const update of deferredQuestUpdates) {
    for (const questText of update?.completedTexts || []) {
      emit('toast', `📜 Квест выполнен: ${questText}!`);
    }
  }
  if (riftOpened) setTimeout(() => emit('rift:opened'), 900);
  endCombat();
  checkAchievements();

  if (ow.rifMode || ow.towerMode) {
    const alive = ow.enemies.filter(
      currentEnemy => !currentEnemy.dead
    ).length;

    if (alive === 0) {
      setTimeout(
        () => emit(ow.towerMode ? 'tower:floor-cleared' : 'rift:floor-cleared', {
          floor: ow.towerMode ? ow.towerFloor : ow.rifFloor
        }),
        900
      );
    }
  }

  if (canCompleteMainQuest(state.game) && !p.victoryAchieved) {
    setTimeout(
      () => emit('victory'),
      1500
    );
  }
}

function combatDefeat() {
  const ow = state.overworld;

  if (!ow || !ow.combat) return;

  const p = state.game.player;
  const cls = CLASSES[p.class];

  const hasResurrection = cls.abilities?.some(
    ability => ability.id === 'resurrection'
  );

  if (
    hasResurrection &&
    !ow.combat.playerResurrectionUsed
  ) {
    ow.combat.playerResurrectionUsed = true;

    const talent = getTalentBonus(p);

    const restore = Math.ceil(
      p.maxHp * (talent.resurrectPct || 0.3)
    );

    p.hp = restore;
    ow.player.hp = restore;

    pushLog(
      `✨ Воскрешение! Возрождение с ${restore} HP`,
      'success'
    );

    playSound('heal');
    triggerShake(12, 0.5);
    spawnParticles(ow.player.x, ow.player.y, 'levelup', 20);

    ow.combat.turn = 'player';
    persistRegionalBossCheckpoint(ow);
    return;
  }

  const enemy = ow.combat.enemy;

  pushLog('💀 Поражение...', 'damage');
  playSound('defeat');
  spawnParticles(ow.player.x, ow.player.y, 'hurt', 25);

  if (!p.stats) {
    p.stats = {
      kills: {},
      deaths: 0,
      goldEarned: 0,
      chestsOpened: 0,
      dailyChestAt: 0,
      dailyChestsOpened: 0,
      flawlessStreak: 0
    };
  }

  p.stats.deaths = incrementSafeCount(p.stats.deaths);
  p.stats.flawlessStreak = 0;

  if (p.dailyQuests?.list) {
    const quest = p.dailyQuests.list.find(item =>
      item.type === 'flawless' &&
      !item.completed &&
      !item.claimed
    );

    if (quest) {
      quest.current = 0;
    }
  }

  p.hp = 0;
  ow.player.hp = 0;

  // A defeat ends the encounter, but it must not erase damage already dealt
  // to a persistent regional boss. The normal defeat save below commits both.
  const regionId = ow.sourceLocationId || ow.locationId;
  if (enemy?.boss && !ow.rifMode && !ow.towerMode && state.game?.world && regionId && enemy.persistentId) {
    recordRegionBossProgress(state.game.world, regionId, enemy.persistentId, enemy, ow.combat.turnCount);
  }

  enemy.state = 'idle';
  ow.defeated = true;
  ow.combat = null;

  clearPlayerEffects();
  // Persist the death counter and zero-HP state immediately. loadGameData
  // safely restores this state at half HP in the village after a restart.
  // Keep the defeat flow intact if storage is unavailable, but never fail
  // silently: the player must know that this death may not survive a reload.
  if (!saveGame()) {
    const warning = 'Не удалось сохранить поражение. Проверьте свободное место в хранилище и сохраните игру повторно.';
    pushLog(warning, 'warning');
    emit('toast', warning);
  }

  emit('rift:defeated');
  emit('overworld:defeat');
}

function endCombat() {
  const ow = state.overworld;
  if (!ow) return;

  if (ow.combat) {
    ow.combat.enemy.state = 'idle';
  }

  ow.combat = null;

  emit('combat:end');
}
