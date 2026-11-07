import { state } from '../state.js';
import { ENEMIES } from '../../data/enemies.js';
import { ITEMS, RARITIES } from '../../data/items.js';
import { addItemOrStore } from '../inventory.js';
import { checkAchievements } from '../achievements.js';
import { saveGame } from '../save.js';
import { playSound } from '../audio.js';
import { emit } from '../events.js';
import { getNGPlusMult } from '../ngplus.js';
import { getRiftMult } from '../rift.js';
import { getTowerMult } from '../tower.js';
import { findFreeCell, TILE } from './map.js';
import { NPC_COLLISION_RADIUS, ENEMY_COLLISION_RADIUS } from './collisions.js';
import { spawnParticles } from './particles.js';
import { pushLog } from './log.js';
import { recordRegionChestOpened } from '../region-state.js';
import { updateQuestProgress } from '../dailyQuests.js';
import { STORY_DRAGON_BY_ENEMY } from '../story-dragons.js';
import { STORY_MINI_BOSS_LEVELS } from '../story-mini-bosses.js';

export const ELITE_HP_MULT = 1.5;
export const ELITE_ATK_MULT = 1.3;
export const MODIFIER_CHANCE = 0.10;
const CHEST_HERB_CHANCE = 0.40;

export const MODIFIERS = {
  poisonous:    { name: 'Ядовитый', prefix: '☣️', hpMult: 1.0, atkMult: 1.15, defMult: 1.0, color: '#60a060' },
  armored:      { name: 'Бронированный', prefix: '🛡️', hpMult: 1.3, atkMult: 1.0,  defMult: 1.5, color: '#a0a0a0' },
  swift:        { name: 'Стремительный', prefix: '💨', hpMult: 0.9, atkMult: 1.2,  defMult: 1.0, color: '#60a0ff' },
  vampiric:     { name: 'Вампирский', prefix: '🧛', hpMult: 1.0, atkMult: 1.0,  defMult: 1.0, color: '#800060', vampiricPct: 0.3 },
  regenerating: { name: 'Регенерирующий', prefix: '💚', hpMult: 1.1, atkMult: 1.0, defMult: 1.0, color: '#60ff60', regenPerTurn: 5 },
  berserk:      { name: 'Берсерк',       prefix: '💢', hpMult: 0.9, atkMult: 1.25, defMult: 1.0, color: '#ff4040' }
};

export function getRespawnMs() { const d = state.settings.difficulty; return d === 'easy' ? 15000 : d === 'hard' ? 60000 : 30000; }
export function getEliteChance() { const d = state.settings.difficulty; return d === 'easy' ? 0.15 : d === 'hard' ? 0.35 : 0.20; }

export function getRegionalEliteChance(securityThreat = 0, baseChance = getEliteChance()) {
  const threat = Math.max(0, Math.min(3, Number(securityThreat) || 0));
  const base = Number.isFinite(Number(baseChance)) ? Math.max(0, Number(baseChance)) : 0;
  return Math.min(0.5, base + threat * 0.05);
}
export function getDropChance() { const d = state.settings.difficulty; return d === 'easy' ? 0.70 : d === 'hard' ? 0.30 : 0.50; }

export function getEligibleSpawnEnemyIds(enemyIds, locationId, opts = {}, activeMissionId = state.game?.player?.activeCampaignMission || null, playerLevel = state.game?.player?.level || 1) {
  return (Array.isArray(enemyIds) ? enemyIds : []).filter(enemyId => {
    const miniBossLevel = STORY_MINI_BOSS_LEVELS[enemyId];
    if (miniBossLevel && Math.max(1, Number(playerLevel) || 1) < miniBossLevel) return false;
    const dragon = STORY_DRAGON_BY_ENEMY[enemyId];
    return !dragon || (
      !opts.rifMode &&
      !opts.towerMode &&
      locationId === dragon.locationId &&
      activeMissionId === dragon.missionId
    );
  });
}

export function createSpawnRoster(enemyIds, count, random = Math.random) {
  const roster = Array.isArray(enemyIds) ? enemyIds.filter(Boolean) : [];
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (!roster.length || total === 0) return [];

  // Fisher–Yates first guarantees every act enemy (including its boss) is represented.
  for (let i = roster.length - 1; i > 0; i--) {
    const raw = Math.floor(random() * (i + 1));
    const j = Math.max(0, Math.min(i, raw));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }

  const result = roster.slice(0, total);
  while (result.length < total) {
    result.push(roster[Math.floor(random() * roster.length)]);
  }
  return result;
}

export function createEnemyPersistentId(enemyId, isBoss, occurrence = 1, spawnIndex = 0) {
  if (isBoss) {
    const safeOccurrence = Math.max(1, Math.floor(Number(occurrence) || 1));
    return safeOccurrence === 1 ? `boss-${enemyId}` : `boss-${enemyId}-${safeOccurrence}`;
  }
  return `enemy-${Math.max(0, Math.floor(Number(spawnIndex) || 0))}`;
}

export function spawnEnemies(loc, map, cols, rows, playerPos, opts = {}, locationId = null, random = Math.random) {
  if (loc.safe) return [];
  const ng = getNGPlusMult();
  const riftM = opts.rifMode ? getRiftMult(opts.rifFloor || 1) : opts.towerMode ? getTowerMult(opts.towerFloor || 1) : { hpMult: 1 };
  const enemies = [];

  // Canonical story dragons are removed from ambient spawns. They appear only
  // in their designated finale region while that exact campaign mission is active.
  const eligibleEnemyIds = getEligibleSpawnEnemyIds(loc.enemies, locationId, opts);
  const count = Math.min(Math.max(eligibleEnemyIds.length, 4), 7);
  const spawnRoster = createSpawnRoster(eligibleEnemyIds, count, random);
  // Neglected regions attract more elite threats; successful Guardian operations restore security.
  const eliteChance = getRegionalEliteChance(opts.regionSecurityThreat);

  const bossOccurrences = new Map();
  for (let i = 0; i < count; i++) {
    const pos = findFreeCell(map, cols, rows, enemies, 220, playerPos, locationId, random);
    if (!pos) continue;
    const enemyId = spawnRoster[i];
    const def = ENEMIES[enemyId];
    if (!def) continue;
    const isBoss = !!def.boss;
    const bossOccurrence = isBoss ? (bossOccurrences.get(enemyId) || 0) + 1 : 0;
    if (isBoss) bossOccurrences.set(enemyId, bossOccurrence);
    const isElite = !isBoss && random() < eliteChance;
    let modifier = null;
    if (!isBoss && !isElite && random() < MODIFIER_CHANCE) {
      const keys = Object.keys(MODIFIERS);
      modifier = keys[Math.floor(random() * keys.length)];
    }
    const mod = modifier ? MODIFIERS[modifier] : null;
    const hp = Math.round(def.hp * (isElite ? ELITE_HP_MULT : 1) * (mod ? mod.hpMult : 1) * ng.hpMult * riftM.hpMult);
    enemies.push({
      id: i, persistentId: createEnemyPersistentId(enemyId, isBoss, bossOccurrence, i), enemyId, x: pos.x * TILE + TILE / 2, y: pos.y * TILE + TILE / 2,
      homeX: pos.x * TILE + TILE / 2, homeY: pos.y * TILE + TILE / 2,
      hp, maxHp: hp, elite: isElite, boss: isBoss, modifier, collisionRadius: ENEMY_COLLISION_RADIUS,
      effects: [], phase: 0, state: 'idle', tacticalSpecialPending: false,
      wanderTimer: 1 + random() * 2, wanderDx: 0, wanderDy: 0,
      dead: false, respawnAt: 0,
    });
  }
  return enemies;
}

export function spawnNPCs(loc, locationId = '', random = Math.random) {
  if (typeof locationId === 'function') { random = locationId; locationId = ''; }
  const baseNPCs = Array.isArray(loc.npcs) ? [...loc.npcs] : [];
  // A wandering merchant may appear in ordinary exploration, never in the Rift,
  // Tower, or story-dragon arenas. Each entry rolls independently.
  const specialInstance = /^(rift|tower-floor-)/.test(locationId) ||
    loc.storyDragon || loc.bossArena || loc.safe;
  if (!specialInstance && random() < 0.16 && !baseNPCs.some(n => n.id === 'wandering-merchant')) {
    const cols = loc.mapCols || 40, rows = loc.mapRows || 30;
    baseNPCs.push({
      id: 'wandering-merchant', npcType: 'merchant',
      name: 'Странствующий торговец', emoji: '🧳',
      x: 3 + Math.floor(random() * Math.max(1, cols - 6)),
      y: 3 + Math.floor(random() * Math.max(1, rows - 6)),
      greetings: ['Удача привела нас друг к другу.', 'Есть кое-что из дальних земель.', 'Редкости долго не залеживаются!']
    });
  }
  return baseNPCs.map(npc => ({
    ...npc,
    x: npc.x * TILE + TILE / 2,
    y: npc.y * TILE + TILE / 2,
    homeX: npc.x * TILE + TILE / 2,
    homeY: npc.y * TILE + TILE / 2,
    interactionRadius: npc.ambient ? 0 : 65,
    collisionRadius: NPC_COLLISION_RADIUS,
    wanderTimer: random() * 3,
    wanderDx: 0, wanderDy: 0,
    facing: 'down'
  }));
}

export function spawnStatics(loc, locationId = null, cols = loc.mapCols || 40, rows = loc.mapRows || 30) {
  const objects = (loc.statics || []).map(obj => {
    const x = obj.x * TILE + TILE / 2;
    const y = obj.y * TILE + TILE / 2;
    // Depth follows each sprite's actual ground contact, not its visual center.
    // Buildings/nature end at y+8; the 96px prop atlas is centered on y.
    const depthY = (obj.buildingStyle || obj.natureStyle) ? y + 8
      : obj.propStyle ? y + 48 : undefined;
    return {
      ...obj,
      x, y,
      ...(Number.isFinite(depthY) ? { depthY } : {}),
      interactionRadius: obj.decorative ? 0 : (Number(obj.interactionRadius) || 65)
    };
  });

  // Aurora visibly records the campaign's victories without changing the
  // three-dragon story rules or creating new combat encounters.
  if (loc.theme === 'village') {
    const dragons = state.game?.storyDragons || {};
    const addStoryProp = (id, name, x, y, propStyle) => {
      const worldX = x * TILE + TILE / 2;
      const worldY = y * TILE + TILE / 2;
      objects.push({
        id, name, x: worldX, y: worldY, depthY: worldY + 48,
        propStyle, decorative: true, interactionRadius: 0, storyDecoration: true
      });
    };
    if (dragons['ash-herald']) addStoryProp('aurora-ash-victory', 'Знамя победы над Пепельным Вестником', 18, 6, 'banner');
    if (dragons['ice-grasp']) addStoryProp('aurora-ice-victory', 'Ледяной фонарь северного тракта', 27, 10, 'frost-lantern');
    if (dragons['blood-crown']) addStoryProp('aurora-rift-ward', 'Памятный знак открытого Разлома', 19, 5, 'rift-ward');
  } else if (locationId && locationId !== 'rift' && !locationId.startsWith('tower-floor-')) {
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    objects.push(
      { id: 'world-waystone', name: 'Портал миров', x: (cx - 2) * TILE + TILE / 2, y: cy * TILE + TILE / 2, propStyle: `world-waystone-${loc.theme || locationId}`, interactionRadius: 76, decorative: false }
    );
  }
  return objects;
}

export function spawnChests(loc, map, cols, rows, enemies, playerPos, locationId = null, random = Math.random) {
  if (loc.safe) return [];
  const chests = [];
  const chestsCount = loc.chestsCount || 3;
  for (let i = 0; i < chestsCount; i++) {
    const pos = findFreeCell(map, cols, rows, [...enemies, ...chests], 150, playerPos, locationId, random);
    if (pos) chests.push({ id: `chest-${i}`, x: pos.x * TILE + TILE / 2, y: pos.y * TILE + TILE / 2, opened: false });
  }
  return chests;
}

// ⬇️ НОВОЕ: спавн случайных событий на карте
export function spawnEvents(loc, map, cols, rows, playerPos, locationId = null, avoidList = [], random = Math.random) {
  if (loc.safe) return [];
  const events = [];
  const count = 1 + Math.floor(random() * 2);
  const types = ['altar', 'mimic', 'crystal', 'traveler'];
  const NAMES = { altar: 'Древний алтарь', mimic: 'Подозрительный сундук', crystal: 'Кристалл сырой магии', traveler: 'Странник' };
  const EMOJIS = { altar: '⛩️', mimic: '🎁', crystal: '💎', traveler: '🧙' };

  for (let i = 0; i < count; i++) {
    const pos = findFreeCell(map, cols, rows, avoidList.concat(events), 200, playerPos, locationId, random);
    if (!pos) continue;
    const type = types[Math.floor(random() * types.length)];
    events.push({
      id: `event-${type}-${i}`,
      eventType: type,
      name: NAMES[type],
      emoji: EMOJIS[type],
      x: pos.x * TILE + TILE / 2,
      y: pos.y * TILE + TILE / 2,
      interactionRadius: 65,
      isEvent: true,
    });
  }
  return events;
}

export function openChest(chest) {
  const ow = state.overworld;
  const p = state.game?.player;
  if (!ow || !p || !chest || chest.opened) return false;
  let previousGame;
  try {
    previousGame = JSON.parse(JSON.stringify(state.game));
  } catch {
    pushLog('⚠️ Не удалось подготовить награду из сундука.', 'warning');
    return false;
  }
  chest.opened = true;
  if (state.game.world && ow.sourceLocationId) recordRegionChestOpened(state.game.world, ow.sourceLocationId, chest.id);
  const pool = ['health-potion', 'mana-potion', 'iron-sword', 'apprentice-staff', 'leather-armor'];
  const id = pool[Math.floor(Math.random() * pool.length)];
  const result = addItemOrStore(id);
  const inst = result.created[0];
  let msg = result.stored
    ? `📦 Сундук: ${ITEMS[id].name} отправлено в хранилище добычи — в сумке нет места.`
    : `📦 Сундук: ${ITEMS[id].name}`;
  if (inst && inst.rarity && inst.rarity !== 'common') msg = `📦 Сундук: ${RARITIES[inst.rarity].name} ${ITEMS[id].name}`;
  const rewardLog = { msg, cls: result.stored ? 'warning' : 'success' };
  let herbLog = null;

  if (Math.random() < CHEST_HERB_CHANCE) {
    const herbId = Math.random() < 0.5 ? 'herb-life' : 'herb-moon';
    const herbResult = addItemOrStore(herbId, 1);
    herbLog = {
      msg: herbResult.stored
        ? `🌿 ${ITEMS[herbId].name} отправлено в хранилище добычи.`
        : `🌿 Сундук: ${ITEMS[herbId].name}`,
      cls: herbResult.stored ? 'warning' : 'success'
    };
  }

  const questUpdate = updateQuestProgress('chest', 'chest', 1, { persist: false, notify: false });

  if (!p.stats) p.stats = { kills: {}, deaths: 0, goldEarned: 0, chestsOpened: 0, dailyChestAt: 0, dailyChestsOpened: 0 };
  p.stats.chestsOpened = (p.stats.chestsOpened || 0) + 1;
  if (!saveGame()) {
    state.game = previousGame;
    chest.opened = false;
    pushLog('⚠️ Не удалось сохранить сундук. Награда отменена; сундук можно открыть повторно.', 'warning');
    emit('game:update');
    return false;
  }
  // Daily quest progress is committed with the chest reward, never in a separate save.
  for (const questText of questUpdate?.completedTexts || []) {
    emit('toast', `📜 Квест выполнен: ${questText}!`);
  }
  // Publish reward feedback and audiovisual effects only after persistence succeeds.
  pushLog(rewardLog.msg, rewardLog.cls);
  if (herbLog) pushLog(herbLog.msg, herbLog.cls);
  ow.floatingNumbers.push({ x: chest.x, y: chest.y - 20, text: '📦', type: 'heal', life: 1.5 });
  spawnParticles(chest.x, chest.y, 'spark', 8);
  playSound('chest');
  checkAchievements();
  return true;
}