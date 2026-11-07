import {
  WORLD_CONNECTIONS,
  WORLD_REGION_IDS,
  STARTING_REGIONS,
  STARTING_ROUTES,
  getWorldRouteKey,
  isWorldRoute
} from '../data/world.js';

export const WORLD_STATE_VERSION = 1;
export const WORLD_GENERATOR_VERSION = 1;

function toUint32(value) {
  return Number(value) >>> 0;
}

export function deriveWorldSeed(...parts) {
  let hash = 2166136261;
  const input = parts.map(value => String(value ?? '')).join('|');
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return toUint32(hash) || 1;
}

export function createWorldSeed(random = Math.random) {
  const value = Number(random());
  const seed = Number.isFinite(value)
    ? Math.floor(Math.max(0, Math.min(0.999999999, value)) * 0x100000000) >>> 0
    : 1;
  return seed || 1;
}

// Mulberry32: deterministic, compact and independent of browser/global RNG state.
export function createSeededRandom(seed) {
  let value = toUint32(seed) || 1;
  return function random() {
    value = (value + 0x6D2B79F5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveRegionSeed(world, regionId, visitIndex = 0) {
  return deriveWorldSeed(
    world?.seed ?? 1,
    world?.generatorVersion ?? 0,
    regionId,
    Math.max(0, Math.floor(Number(visitIndex) || 0))
  );
}

export function createRegionRandom(world, regionId, visitIndex = 0) {
  return createSeededRandom(deriveRegionSeed(world, regionId, visitIndex));
}

function allRouteKeys() {
  const routes = new Set();
  for (const [fromId, neighbors] of Object.entries(WORLD_CONNECTIONS)) {
    for (const toId of neighbors) {
      if (isWorldRoute(fromId, toId)) routes.add(getWorldRouteKey(fromId, toId));
    }
  }
  return [...routes];
}

export function createWorldState({ seed, legacy = false } = {}) {
  const worldSeed = toUint32(seed ?? createWorldSeed()) || 1;
  const unlockedRoutes = legacy
    ? allRouteKeys()
    : STARTING_ROUTES.map(([fromId, toId]) => getWorldRouteKey(fromId, toId));

  return {
    schemaVersion: WORLD_STATE_VERSION,
    seed: worldSeed,
    generatorVersion: WORLD_GENERATOR_VERSION,
    clockMinutes: 0,
    legacyFastTravel: Boolean(legacy),
    discoveredRegions: legacy
      ? [...WORLD_REGION_IDS]
      : [...STARTING_REGIONS],
    unlockedRoutes,
    currentRegionId: null,
    regionVisits: {},
    factionCampaigns: {},
    events: {
      active: [],
      cooldowns: {},
      history: [],
      sequence: 0,
      nextSpawnAt: 480 + (deriveWorldSeed(worldSeed, 'world-events') % 241)
    }
  };
}

function sanitizeWorldEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  if (typeof event.id !== 'string' || !event.id || event.id.length > 100) return null;
  if (!WORLD_REGION_IDS.includes(event.regionId)) return null;
  if (event.objectiveType === 'region-discovery') {
    const validTarget = WORLD_REGION_IDS.includes(event.targetRegionId)
      && (WORLD_CONNECTIONS[event.regionId] || []).includes(event.targetRegionId);
    if (!validTarget) {
      event.targetRegionId = null;
      event.objectiveText = 'Цель разведки недоступна. Обратитесь к доске объявлений.';
    }
  }
  const targetCount = Number.isSafeInteger(event.targetCount) && event.targetCount > 0
    ? Math.min(1000, event.targetCount) : 1;
  event.targetCount = targetCount;
  event.progress = Number.isSafeInteger(event.progress)
    ? Math.max(0, Math.min(targetCount, event.progress)) : 0;
  if (event.objectiveType === 'defend-region') {
    event.holdElapsedMinutes = Number.isFinite(event.holdElapsedMinutes)
      ? Math.max(event.progress, Math.min(targetCount, event.holdElapsedMinutes))
      : event.progress;
  }
  event.phase = event.progress;
  if (typeof event.objectiveText !== 'string') event.objectiveText = '';
  if (event.objectiveText.length > 240) event.objectiveText = event.objectiveText.slice(0, 240);
  if (typeof event.accepted !== 'boolean') event.accepted = false;
  if (event.campaignId !== 'ash-nomad-warband' || ![1, 2].includes(event.campaignStage)) {
    event.campaignId = null;
    event.campaignStage = null;
  }
  return event;
}

export function ensureWorldState(game, { legacy = false } = {}) {
  if (!game || typeof game !== 'object') return null;
  if (!game.world || typeof game.world !== 'object' || Array.isArray(game.world)) {
    game.world = createWorldState({ seed: game.worldSeed, legacy });
  }

  const world = game.world;
  world.schemaVersion = WORLD_STATE_VERSION;
  if (!world.factionCampaigns || typeof world.factionCampaigns !== 'object' || Array.isArray(world.factionCampaigns)) world.factionCampaigns = {};
  for (const [id, campaign] of Object.entries(world.factionCampaigns)) {
    if (id !== 'ash-nomad-warband' || !campaign || typeof campaign !== 'object' || Array.isArray(campaign)) {
      delete world.factionCampaigns[id];
      continue;
    }
    if (!['active', 'completed', 'failed'].includes(campaign.status)) campaign.status = 'failed';
    campaign.stage = Number.isSafeInteger(campaign.stage) ? Math.max(1, Math.min(2, campaign.stage)) : 1;
    campaign.startedAt = Number.isFinite(campaign.startedAt) ? Math.max(0, campaign.startedAt) : 0;
  }
  if (!Number.isFinite(world.seed)) world.seed = Number.isFinite(game.worldSeed) ? game.worldSeed : createWorldSeed();
  world.seed = toUint32(world.seed) || 1;
  if (!Number.isFinite(world.generatorVersion) || world.generatorVersion < 1) world.generatorVersion = Number.isFinite(game.worldGeneratorVersion) && game.worldGeneratorVersion >= 1 ? Math.floor(game.worldGeneratorVersion) : WORLD_GENERATOR_VERSION;
  if (!Number.isFinite(world.clockMinutes) || world.clockMinutes < 0) world.clockMinutes = 0;
  world.legacyFastTravel = world.legacyFastTravel === true || Boolean(legacy);

  const discovered = Array.isArray(world.discoveredRegions) ? world.discoveredRegions : [];
  world.discoveredRegions = [...new Set(discovered.filter(id => WORLD_REGION_IDS.includes(id)))];
  if (!world.discoveredRegions.length) world.discoveredRegions = legacy ? [...WORLD_REGION_IDS] : [...STARTING_REGIONS];

  const routes = Array.isArray(world.unlockedRoutes) ? world.unlockedRoutes : [];
  world.unlockedRoutes = [...new Set(routes.filter(key => typeof key === 'string' && allRouteKeys().includes(key)))];
  if (world.legacyFastTravel) {
    world.discoveredRegions = [...WORLD_REGION_IDS];
    world.unlockedRoutes = allRouteKeys();
  } else {
    for (const regionId of world.discoveredRegions) {
      for (const neighborId of WORLD_CONNECTIONS[regionId] || []) {
        const routeKey = getWorldRouteKey(regionId, neighborId);
        if (!world.unlockedRoutes.includes(routeKey)) world.unlockedRoutes.push(routeKey);
      }
    }
  }

  if (!world.regionVisits || typeof world.regionVisits !== 'object' || Array.isArray(world.regionVisits)) {
    world.regionVisits = {};
  }
  if (!world.regions || typeof world.regions !== 'object' || Array.isArray(world.regions)) world.regions = {};
  for (const [regionId, record] of Object.entries(world.regions)) {
    if (!WORLD_REGION_IDS.includes(regionId) || !record || typeof record !== 'object' || Array.isArray(record)) {
      delete world.regions[regionId];
      continue;
    }
    if (!Number.isSafeInteger(record.generationVisit) || record.generationVisit < 1) record.generationVisit = 1;
    record.securityThreat = Number.isSafeInteger(record.securityThreat)
      ? Math.max(0, Math.min(3, record.securityThreat)) : 0;
    if (!Array.isArray(record.openedChests)) record.openedChests = [];
    record.openedChests = [...new Set(record.openedChests.filter(id => typeof id === 'string' && id.length <= 80))];
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
    for (const [enemyId, respawnAt] of Object.entries(record.defeatedEnemies)) {
      if (typeof enemyId !== 'string' || !Number.isFinite(respawnAt) || respawnAt < 0) delete record.defeatedEnemies[enemyId];
    }
  }
  for (const [id, count] of Object.entries(world.regionVisits)) {
    world.regionVisits[id] = WORLD_REGION_IDS.includes(id) && Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 0;
  }
  const savedRegionId = WORLD_REGION_IDS.includes(world.currentRegionId) ? world.currentRegionId : null;
  const gameRegionId = WORLD_REGION_IDS.includes(game.location) ? game.location : null;
  world.currentRegionId = savedRegionId || gameRegionId || 'village';
  if ((world.regionVisits[world.currentRegionId] || 0) < 1) world.regionVisits[world.currentRegionId] = 1;

  if (!world.events || typeof world.events !== 'object' || Array.isArray(world.events)) {
    world.events = { active: [], cooldowns: {}, history: [] };
  }
  if (!Array.isArray(world.events.active)) world.events.active = [];
  world.events.active = world.events.active.map(sanitizeWorldEvent).filter(Boolean);
  if (!world.events.cooldowns || typeof world.events.cooldowns !== 'object' || Array.isArray(world.events.cooldowns)) world.events.cooldowns = {};
  if (!Array.isArray(world.events.history)) world.events.history = [];
  world.events.history = world.events.history.map(sanitizeWorldEvent).filter(Boolean);
  if (world.events.history.length > 50) {
    const pendingRewards = world.events.history.filter(event => event?.status === 'completed' && event.rewardClaimed !== true);
    const otherHistory = world.events.history.filter(event => !(event?.status === 'completed' && event.rewardClaimed !== true));
    const otherLimit = Math.max(0, 50 - pendingRewards.length);
    world.events.history = [...(otherLimit ? otherHistory.slice(-otherLimit) : []), ...pendingRewards];
  }
  if (!Number.isFinite(world.events.sequence) || world.events.sequence < 0) world.events.sequence = 0;
  game.worldSeed = world.seed;
  game.worldGeneratorVersion = world.generatorVersion;
  if (!Number.isFinite(world.events.nextSpawnAt) || world.events.nextSpawnAt < 0) {
    world.events.nextSpawnAt = world.clockMinutes + 480 + (deriveWorldSeed(world.seed, 'world-events') % 241);
  }
  return world;
}

export function unlockWorldRoute(world, fromId, toId) {
  if (!world || !isWorldRoute(fromId, toId)) return false;
  if (!Array.isArray(world.unlockedRoutes)) world.unlockedRoutes = [];
  const key = getWorldRouteKey(fromId, toId);
  if (world.unlockedRoutes.includes(key)) return false;
  world.unlockedRoutes.push(key);
  return true;
}

export function discoverWorldRegion(world, regionId, fromId = null) {
  if (!world || !WORLD_REGION_IDS.includes(regionId)) return false;
  if (fromId && (!isWorldRoute(fromId, regionId) || !world.unlockedRoutes?.includes(getWorldRouteKey(fromId, regionId)))) {
    return false;
  }
  if (!Array.isArray(world.discoveredRegions)) world.discoveredRegions = [];
  if (!Array.isArray(world.unlockedRoutes)) world.unlockedRoutes = [];
  if (world.discoveredRegions.includes(regionId)) return false;
  world.discoveredRegions.push(regionId);
  // Discovering a region reveals its outgoing paths for the next exploration step.
  for (const neighborId of WORLD_CONNECTIONS[regionId] || []) {
    const routeKey = getWorldRouteKey(regionId, neighborId);
    if (!world.unlockedRoutes.includes(routeKey)) world.unlockedRoutes.push(routeKey);
  }
  return true;
}

export function getAccessibleWorldRegions(world, fromId) {
  if (!WORLD_REGION_IDS.includes(fromId)) return [];
  if (world?.legacyFastTravel) {
    return WORLD_REGION_IDS.filter(id => id !== fromId);
  }
  const unlocked = new Set(world?.unlockedRoutes || []);
  return (WORLD_CONNECTIONS[fromId] || []).filter(id => unlocked.has(getWorldRouteKey(fromId, id)));
}

export function canTravelToRegion(world, fromId, toId) {
  if (!WORLD_REGION_IDS.includes(fromId) || !WORLD_REGION_IDS.includes(toId) || fromId === toId) return false;
  if (world?.legacyFastTravel) return true;
  return getAccessibleWorldRegions(world, fromId).includes(toId);
}
