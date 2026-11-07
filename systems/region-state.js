import { WORLD_REGION_IDS } from '../data/world.js';

export function ensureRegionRecord(world, regionId, generationVisit = 1) {
  if (!world || !WORLD_REGION_IDS.includes(regionId)) return null;
  if (!world.regions || typeof world.regions !== 'object' || Array.isArray(world.regions)) world.regions = {};
  let record = world.regions[regionId];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    record = world.regions[regionId] = {
      generationVisit: Math.max(1, Math.floor(Number(generationVisit) || 1)),
      openedChests: [],
      defeatedEnemies: {},
      defeatedBosses: [],
      bossProgress: {},
      resolvedEvents: [],
      discoveredSecrets: [],
      secretChests: [],
      secretLayoutGenerated: false,
      secretWalls: []
    };
  }
  if (!Number.isSafeInteger(record.generationVisit) || record.generationVisit < 1) {
    record.generationVisit = Math.max(1, Math.floor(Number(generationVisit) || 1));
  }
  if (!Array.isArray(record.openedChests)) record.openedChests = [];
  if (!record.defeatedEnemies || typeof record.defeatedEnemies !== 'object' || Array.isArray(record.defeatedEnemies)) record.defeatedEnemies = {};
  if (!Array.isArray(record.defeatedBosses)) record.defeatedBosses = [];
  record.defeatedBosses = [...new Set(record.defeatedBosses.filter(id => typeof id === 'string' && id.length <= 80))];
  if (!record.bossProgress || typeof record.bossProgress !== 'object' || Array.isArray(record.bossProgress)) record.bossProgress = {};
  for (const [id, progress] of Object.entries(record.bossProgress)) {
    if (!id || id.length > 80 || !progress || typeof progress !== 'object' || Array.isArray(progress)
      || !Number.isFinite(progress.hpRatio) || progress.hpRatio <= 0 || progress.hpRatio > 1
      || !Number.isSafeInteger(progress.phase) || progress.phase < 0 || progress.phase > 20
      || !Number.isSafeInteger(progress.turnCount) || progress.turnCount < 0 || progress.turnCount > 100000) {
      delete record.bossProgress[id];
      continue;
    }
    record.bossProgress[id] = { hpRatio: progress.hpRatio, phase: progress.phase, turnCount: progress.turnCount, pendingSpecial: progress.pendingSpecial === true };
  }
  if (!Array.isArray(record.resolvedEvents)) record.resolvedEvents = [];
  record.resolvedEvents = [...new Set(record.resolvedEvents.filter(id => typeof id === 'string' && id.length <= 80))];
  if (!Array.isArray(record.discoveredSecrets)) record.discoveredSecrets = [];
  record.discoveredSecrets = [...new Set(record.discoveredSecrets.filter(id => typeof id === 'string' && id.length <= 80))];
  if (!Array.isArray(record.secretChests)) record.secretChests = [];
  record.secretChests = record.secretChests.filter(chest => chest && typeof chest.id === 'string' && chest.id.length <= 80 && Number.isFinite(chest.x) && Number.isFinite(chest.y));
  record.secretLayoutGenerated = record.secretLayoutGenerated === true;
  if (!Array.isArray(record.secretWalls)) record.secretWalls = [];
  record.secretWalls = record.secretWalls.filter(wall => wall && typeof wall.id === 'string' && wall.id.length <= 80
    && Number.isFinite(wall.tx) && Number.isFinite(wall.ty) && Number.isFinite(wall.wx) && Number.isFinite(wall.wy)
    && Number.isFinite(wall.ax) && Number.isFinite(wall.ay)
    && ['chest', 'elite', 'loot'].includes(wall.rewardType));
  return record;
}

export function recordRegionChestOpened(world, regionId, chestId) {
  if (typeof chestId !== 'string' || !chestId) return false;
  const record = ensureRegionRecord(world, regionId);
  if (!record || record.openedChests.includes(chestId)) return false;
  record.openedChests.push(chestId);
  return true;
}

export function recordRegionEventResolved(world, regionId, eventId) {
  if (typeof eventId !== 'string' || !eventId) return false;
  const record = ensureRegionRecord(world, regionId);
  if (!record || record.resolvedEvents.includes(eventId)) return false;
  record.resolvedEvents.push(eventId);
  return true;
}

export function recordRegionSecretDiscovered(world, regionId, secretId, chest = null) {
  if (typeof secretId !== 'string' || !secretId) return false;
  const record = ensureRegionRecord(world, regionId);
  if (!record || record.discoveredSecrets.includes(secretId)) return false;
  record.discoveredSecrets.push(secretId);
  if (chest && typeof chest.id === 'string' && Number.isFinite(chest.x) && Number.isFinite(chest.y)) {
    if (!Array.isArray(record.secretChests)) record.secretChests = [];
    if (!record.secretChests.some(item => item.id === chest.id)) record.secretChests.push({ id: chest.id, x: chest.x, y: chest.y });
  }
  return true;
}

export function recordRegionSecretLayout(world, regionId, walls) {
  const record = ensureRegionRecord(world, regionId);
  if (!record || record.secretLayoutGenerated || !Array.isArray(walls)) return false;
  record.secretWalls = walls.filter(wall => wall && typeof wall.id === 'string'
    && Number.isFinite(wall.tx) && Number.isFinite(wall.ty)
    && Number.isFinite(wall.wx) && Number.isFinite(wall.wy)
    && Number.isFinite(wall.ax) && Number.isFinite(wall.ay)
    && ['chest', 'elite', 'loot'].includes(wall.rewardType))
    .map(wall => ({
      id: wall.id, tx: wall.tx, ty: wall.ty, wx: wall.wx, wy: wall.wy,
      ax: wall.ax, ay: wall.ay, rewardType: wall.rewardType
    }));
  record.secretLayoutGenerated = true;
  return true;
}

export function recordRegionEnemyDefeat(world, regionId, enemyId, respawnAtClock) {
  if (typeof enemyId !== 'string' || !enemyId || !Number.isFinite(respawnAtClock)) return false;
  const record = ensureRegionRecord(world, regionId);
  if (!record) return false;
  record.defeatedEnemies[enemyId] = Math.max(0, respawnAtClock);
  return true;
}

export function recordRegionBossDefeat(world, regionId, bossId) {
  if (typeof bossId !== 'string' || !bossId || bossId.length > 80) return false;
  const record = ensureRegionRecord(world, regionId);
  if (!record || record.defeatedBosses.includes(bossId)) return false;
  record.defeatedBosses.push(bossId);
  delete record.bossProgress[bossId];
  delete record.defeatedEnemies[bossId];
  return true;
}

export function recordRegionBossProgress(world, regionId, bossId, boss, turnCount = 0) {
  if (typeof bossId !== 'string' || !bossId || bossId.length > 80 || !boss || boss.dead
    || !Number.isFinite(boss.hp) || !Number.isFinite(boss.maxHp) || boss.maxHp <= 0 || boss.hp <= 0) return false;
  const record = ensureRegionRecord(world, regionId);
  if (!record || record.defeatedBosses.includes(bossId)) return false;
  const phase = Math.max(0, Math.min(20, Math.floor(Number(boss.phase) || 0)));
  const turns = Math.max(0, Math.min(100000, Math.floor(Number(turnCount) || 0)));
  record.bossProgress[bossId] = {
    hpRatio: Math.max(0.001, Math.min(1, boss.hp / boss.maxHp)),
    phase,
    turnCount: turns,
    pendingSpecial: boss.tacticalSpecialPending === true
  };
  return true;
}

export function recordRegionEnemyRespawned(world, regionId, enemyId) {
  const record = ensureRegionRecord(world, regionId);
  if (!record || !Object.prototype.hasOwnProperty.call(record.defeatedEnemies, enemyId)) return false;
  delete record.defeatedEnemies[enemyId];
  return true;
}

export function applyRegionPersistence(world, regionId, enemies, chests, events = [], now = globalThis.performance?.now?.() ?? Date.now()) {
  const record = ensureRegionRecord(world, regionId);
  if (!record) return false;
  const clock = Math.max(0, Number(world.clockMinutes) || 0);
  const opened = new Set(record.openedChests);
  const resolved = new Set(record.resolvedEvents);
  const defeatedBosses = new Set(record.defeatedBosses);
  for (const chest of Array.isArray(chests) ? chests : []) chest.opened = opened.has(chest.id);
  if (Array.isArray(events)) {
    for (let index = events.length - 1; index >= 0; index--) {
      if (resolved.has(events[index].id)) events.splice(index, 1);
    }
  }
  for (const enemy of Array.isArray(enemies) ? enemies : []) {
    if (enemy?.boss && defeatedBosses.has(enemy.persistentId)) {
      enemy.dead = true;
      enemy.hp = 0;
      enemy.respawnAt = 0;
      enemy.effects = [];
      delete record.bossProgress[enemy.persistentId];
      if (enemy.state === 'combat') enemy.state = 'dead';
      continue;
    }
    if (enemy?.boss && record.bossProgress[enemy.persistentId]) {
      const progress = record.bossProgress[enemy.persistentId];
      enemy.hp = Math.max(1, Math.min(enemy.maxHp, Math.round(enemy.maxHp * progress.hpRatio)));
      enemy.phase = progress.phase;
      enemy.persistentTurnCount = progress.turnCount;
      enemy.tacticalSpecialPending = progress.pendingSpecial;
    }
    const respawnAtClock = record.defeatedEnemies[enemy.persistentId];
    if (!Number.isFinite(respawnAtClock)) continue;
    if (respawnAtClock <= clock) {
      delete record.defeatedEnemies[enemy.persistentId];
      enemy.dead = false;
      if (Number.isFinite(enemy.maxHp)) enemy.hp = enemy.maxHp;
      enemy.respawnAt = 0;
      enemy.effects = [];
      if (enemy.state === 'dead') enemy.state = 'idle';
      continue;
    }
    enemy.dead = true;
    enemy.hp = 0;
    enemy.respawnAt = now + (respawnAtClock - clock) * 60000;
    enemy.effects = [];
  }
  return true;
}
