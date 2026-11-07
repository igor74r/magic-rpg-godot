import { WORLD_REGION_IDS, WORLD_CONNECTIONS } from '../data/world.js';
import { LOCATIONS } from '../data/locations.js';
import { createSeededRandom, deriveWorldSeed, ensureWorldState } from './world-state.js';
import { changeFactionReputation, getFactionEventGoldBonus, getFactionReputation } from './factions.js';
import { ensureRegionRecord } from './region-state.js';

export const WORLD_EVENT_MIN_INTERVAL = 480;
export const WORLD_EVENT_INTERVAL_VARIANCE = 240;
export const WORLD_EVENT_DURATION = 180;
export const WORLD_EVENT_MAX_ACTIVE = 2;
export const WORLD_EVENT_HISTORY_LIMIT = 50;

export const WORLD_EVENT_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'hub-patrol',
    name: 'Засада на патруль',
    regions: ['forest', 'briar-hollow', 'ruins'],
    factionId: 'hub-guardians',
    goldMin: 30,
    goldMax: 50,
    reputationReward: 8,
    failureReputationDelta: -5,
    objectiveType: 'enemy-kill',
    targetCount: 3,
    objectiveText: 'Победите 3 противников, угрожающих патрулю.'
  }),
  Object.freeze({
    id: 'hub-outpost-defense',
    name: 'Оборона пограничной заставы',
    regions: ['forest', 'briar-hollow', 'ruins'],
    factionId: 'hub-guardians',
    goldMin: 50,
    goldMax: 75,
    reputationReward: 10,
    failureReputationDelta: -6,
    objectiveType: 'defend-region',
    targetCount: 3,
    objectiveText: 'Удерживайте заставу в этом регионе 3 игровых минуты. Если покинете регион, оборона приостановится.'
  }),
  Object.freeze({
    id: 'free-trader-caravan',
    name: 'Караван торговцев',
    regions: ['forest', 'briar-hollow', 'swamp', 'graveyard', 'wasteland'],
    factionId: 'free-traders',
    goldMin: 35,
    goldMax: 60,
    reputationReward: 8,
    failureReputationDelta: -5,
    objectiveType: 'enemy-kill',
    targetCount: 2,
    objectiveText: 'Отразите 2 нападения на торговый караван.'
  }),
  Object.freeze({
    id: 'rift-breach',
    name: 'Локальный прорыв Разлома',
    regions: ['shadow', 'graveyard', 'sunken-necropolis', 'void-crater'],
    factionId: 'rift-cult',
    goldMin: 40,
    goldMax: 65,
    reputationReward: -8,
    failureReputationDelta: 8,
    objectiveType: 'enemy-kill',
    targetCount: 4,
    objectiveText: 'Победите 4 существа, вышедших из прорыва.'
  }),
  Object.freeze({
    id: 'ash-nomad-scouts',
    name: 'Следы пепельного отряда',
    regions: ['wasteland', 'volcano', 'obsidian-fields'],
    factionId: 'ash-nomads',
    goldMin: 35,
    goldMax: 60,
    reputationReward: 8,
    failureReputationDelta: -5,
    objectiveType: 'elite-kill',
    targetCount: 2,
    objectiveText: 'Победите 2 элитных противников.'
  }),
  Object.freeze({
    id: 'ash-warband-scouting',
    name: 'I. Следы военного отряда',
    regions: ['wasteland', 'volcano', 'obsidian-fields'],
    factionId: 'ash-nomads',
    minFactionReputation: 50,
    campaignId: 'ash-nomad-warband',
    campaignStage: 1,
    goldMin: 45,
    goldMax: 60,
    reputationReward: 8,
    failureReputationDelta: -4,
    objectiveType: 'elite-kill',
    targetCount: 2,
    objectiveText: 'Победите двух элитных разведчиков пепельного отряда.'
  }),
  Object.freeze({
    id: 'ash-warband-champion',
    name: 'II. Вызов предводителю',
    regions: ['wasteland', 'volcano', 'obsidian-fields'],
    factionId: 'ash-nomads',
    campaignId: 'ash-nomad-warband',
    campaignStage: 2,
    goldMin: 100,
    goldMax: 140,
    reputationReward: 12,
    failureReputationDelta: -8,
    objectiveType: 'boss-kill',
    targetCount: 1,
    objectiveText: 'Найдите и победите предводителя пепельного отряда.'
  }),
  Object.freeze({
    id: 'regional-boss-bounty',
    name: 'Охота на регионального босса',
    regions: ['shadow', 'sunken-necropolis', 'volcano', 'obsidian-fields', 'void-crater'],
    factionId: 'rift-cult',
    minFactionReputation: 30,
    goldMin: 90,
    goldMax: 130,
    reputationReward: -12,
    failureReputationDelta: 6,
    objectiveType: 'boss-kill',
    targetCount: 1,
    objectiveText: 'Найдите и победите регионального босса.'
  }),
  Object.freeze({
    id: 'frontier-survey',
    name: 'Разведка неизведанной границы',
    regions: WORLD_REGION_IDS.filter(id => id !== 'village'),
    factionId: 'free-traders',
    goldMin: 55,
    goldMax: 80,
    reputationReward: 10,
    failureReputationDelta: -4,
    objectiveType: 'region-discovery',
    targetCount: 1,
    objectiveText: 'Откройте соседний неизведанный регион.'
  }),
  Object.freeze({
    id: 'elite-hunt',
    name: 'Охота на элиту',
    regions: WORLD_REGION_IDS.filter(id => id !== 'village'),
    factionId: null,
    goldMin: 25,
    goldMax: 45,
    reputationReward: 0,
    failureReputationDelta: 0,
    objectiveType: 'elite-kill',
    targetCount: 1,
    objectiveText: 'Победите элитного противника.'
  })
]);

function pushHistory(events, event) {
  events.history.push({ ...event });
  while (events.history.length > WORLD_EVENT_HISTORY_LIMIT) {
    const removable = events.history.findIndex(item => item.status !== 'completed' || item.rewardClaimed);
    if (removable < 0) break;
    events.history.splice(removable, 1);
  }
}

function finishEvent(game, event, status, now) {
  const worldEvents = game.world.events;
  const completed = {
    ...event,
    status,
    finishedAt: now,
    rewardClaimed: false
  };
  if (event.campaignId && Number.isSafeInteger(event.campaignStage)) {
    const campaign = game.world.factionCampaigns?.[event.campaignId];
    if (campaign && campaign.status === 'active' && campaign.stage === event.campaignStage) {
      if (status === 'completed' && event.campaignStage < 2) campaign.stage = event.campaignStage + 1;
      else campaign.status = status === 'completed' ? 'completed' : 'failed';
    }
  }
  if (event.factionId === 'hub-guardians' && ['completed', 'failed'].includes(status)) {
    const region = ensureRegionRecord(game.world, event.regionId);
    if (region) {
      const currentThreat = Number.isSafeInteger(region.securityThreat) ? region.securityThreat : 0;
      region.securityThreat = Math.max(0, Math.min(3, currentThreat + (status === 'completed' ? -1 : 1)));
    }
  }
  if (status === 'completed' && event.factionId && event.reputationReward) {
    changeFactionReputation(game, event.factionId, event.reputationReward, event.name, 'world-event');
  } else if (status === 'failed' && event.accepted && event.factionId && event.failureReputationDelta) {
    changeFactionReputation(game, event.factionId, event.failureReputationDelta, `Провал: ${event.name}`, 'world-event');
  }
  pushHistory(worldEvents, completed);
  const cooldownRandom = createSeededRandom(deriveWorldSeed(game.world.seed, 'world-event-cooldown', event.id));
  worldEvents.cooldowns[event.templateId] = now + WORLD_EVENT_MIN_INTERVAL + Math.floor(cooldownRandom() * WORLD_EVENT_INTERVAL_VARIANCE);
  worldEvents.active = worldEvents.active.filter(item => item.id !== event.id);
  return completed;
}

export function getWorldEventsForRegion(game, regionId) {
  const active = game?.world?.events?.active;
  if (!Array.isArray(active)) return [];
  return active.filter(event => event.regionId === regionId && event.status === 'active');
}

export function getVisibleWorldEventsForRegion(game, regionId) {
  const events = game?.world?.events;
  if (!events) return [];
  const active = Array.isArray(events.active)
    ? events.active.filter(event => event.regionId === regionId && event.status === 'active')
    : [];
  const claimable = Array.isArray(events.history)
    ? events.history.filter(event => event.regionId === regionId && event.status === 'completed' && event.rewardClaimed !== true)
    : [];
  return [...active, ...claimable];
}

export function advanceWorldEvents(game, deltaFrames, regionId) {
  const world = ensureWorldState(game, { legacy: false });
  if (!world || !WORLD_REGION_IDS.includes(regionId)) {
    return { changed: false, started: [], finished: [] };
  }

  // updateOverworld supplies normalized frame units (1 ~= 16.67 ms at 60 FPS).
  const delta = Math.max(0, Math.min(15, Number(deltaFrames) || 0)) / 60;
  if (delta <= 0) return { changed: false, started: [], finished: [] };

  const events = world.events;
  world.clockMinutes += delta;
  const now = world.clockMinutes;
  const finished = [];

  let objectiveProgressed = false;
  for (const event of [...events.active]) {
    if (event.status !== 'active') continue;
    if (event.accepted && event.objectiveType === 'defend-region' && event.regionId === regionId && now < event.expiresAt) {
      const previousProgress = Number(event.progress) || 0;
      event.holdElapsedMinutes = Math.min(event.targetCount || 1,
        Math.max(0, Number(event.holdElapsedMinutes) || 0) + delta);
      event.progress = Math.min(event.targetCount || 1, Math.floor(event.holdElapsedMinutes + 1e-9));
      event.phase = event.progress;
      if (event.progress > previousProgress) objectiveProgressed = true;
      if (event.progress >= (event.targetCount || 1)) {
        finished.push(finishEvent(game, event, 'completed', now));
        continue;
      }
    }
    if (now < event.expiresAt) continue;
    finished.push(finishEvent(game, event, event.accepted ? 'failed' : 'expired', now));
  }

  for (const [templateId, until] of Object.entries(events.cooldowns)) {
    if (!Number.isFinite(until) || until <= now) delete events.cooldowns[templateId];
  }

  const started = [];
  const occupiedRegion = events.active.some(event => event.regionId === regionId && event.status === 'active');
  if (
    now >= events.nextSpawnAt &&
    events.active.length < WORLD_EVENT_MAX_ACTIVE &&
    !occupiedRegion
  ) {
    const available = WORLD_EVENT_TEMPLATES.filter(template =>
      template.regions.includes(regionId) &&
      (template.objectiveType !== 'region-discovery' || (WORLD_CONNECTIONS[regionId] || []).some(id => !world.discoveredRegions.includes(id))) &&
      (!template.campaignId || (template.campaignStage === 1
        ? !world.factionCampaigns[template.campaignId]
        : world.factionCampaigns[template.campaignId]?.status === 'active' && world.factionCampaigns[template.campaignId]?.stage === template.campaignStage)) &&
      (!template.factionId || !Number.isFinite(template.minFactionReputation) || getFactionReputation(game, template.factionId) >= template.minFactionReputation) &&
      (!events.cooldowns[template.id] || events.cooldowns[template.id] <= now)
    );
    // An active campaign's next chapter takes priority over unrelated random events.
    const campaignCandidates = available.filter(template =>
      template.campaignId &&
      world.factionCampaigns[template.campaignId]?.status === 'active' &&
      world.factionCampaigns[template.campaignId]?.stage === template.campaignStage
    );
    const spawnCandidates = campaignCandidates.length ? campaignCandidates : available;

    if (spawnCandidates.length) {
      const sequence = events.sequence++;
      const random = createSeededRandom(deriveWorldSeed(world.seed, 'world-event', sequence, regionId));
      const template = spawnCandidates[Math.floor(random() * spawnCandidates.length)];
      const eventSeed = deriveWorldSeed(world.seed, template.id, sequence, regionId);
      const rewardRandom = createSeededRandom(eventSeed);
      const targetRegionId = template.objectiveType === 'region-discovery'
        ? (WORLD_CONNECTIONS[regionId] || []).filter(id => !world.discoveredRegions.includes(id))[Math.floor(rewardRandom() * (WORLD_CONNECTIONS[regionId] || []).filter(id => !world.discoveredRegions.includes(id)).length)]
        : null;
      const event = {
        id: `world-event-${sequence + 1}`,
        campaignId: template.campaignId || null,
        campaignStage: Number.isSafeInteger(template.campaignStage) ? template.campaignStage : null,
        templateId: template.id,
        name: template.name,
        factionId: template.factionId,
        requiredFactionReputation: Number.isFinite(template.minFactionReputation) ? template.minFactionReputation : null,
        regionId,
        seed: eventSeed,
        status: 'active',
        accepted: false,
        phase: 0,
        maxPhases: template.targetCount,
        startedAt: now,
        expiresAt: now + WORLD_EVENT_DURATION,
        rewardClaimed: false,
        reputationReward: template.reputationReward,
        failureReputationDelta: template.failureReputationDelta,
        objectiveType: template.objectiveType,
        objectiveText: targetRegionId
          ? `Откройте регион «${LOCATIONS[targetRegionId]?.name || targetRegionId}».`
          : template.objectiveText,
        targetRegionId,
        targetCount: template.targetCount,
        progress: 0,
        ...(template.objectiveType === 'defend-region' ? { holdElapsedMinutes: 0 } : {}),
        reward: {
          gold: template.goldMin + Math.floor(rewardRandom() * (template.goldMax - template.goldMin + 1))
        }
      };
      if (event.campaignId && event.campaignStage === 1 && !world.factionCampaigns[event.campaignId]) {
        world.factionCampaigns[event.campaignId] = { status: 'active', stage: 1, startedAt: now };
      }
      events.active.push(event);
      started.push(event);
      events.nextSpawnAt = now + WORLD_EVENT_MIN_INTERVAL + Math.floor(random() * WORLD_EVENT_INTERVAL_VARIANCE);
    } else {
      events.nextSpawnAt = now + 30;
    }
  }

  return { changed: started.length > 0 || finished.length > 0 || objectiveProgressed, started, finished };
}

export function acceptWorldEvent(game, eventId) {
  const event = game?.world?.events?.active?.find(item => item.id === eventId);
  if (!event || event.status !== 'active' || event.accepted) return false;
  event.accepted = true;
  return true;
}

export function resolveWorldEvent(game, eventId, outcome = 'completed') {
  if (!['completed', 'failed', 'expired'].includes(outcome)) return null;
  const world = ensureWorldState(game, { legacy: false });
  const event = world?.events?.active?.find(item => item.id === eventId);
  if (!event || event.status !== 'active') return null;
  if (outcome === 'failed' && !event.accepted) outcome = 'expired';
  return finishEvent(game, event, outcome, world.clockMinutes);
}

export function recordWorldEventKill(game, regionId, enemy) {
  const world = ensureWorldState(game, { legacy: false });
  if (!world || !enemy || !WORLD_REGION_IDS.includes(regionId)) return [];
  const completed = [];

  for (const event of [...world.events.active]) {
    if (event.status !== 'active' || !event.accepted || event.regionId !== regionId) continue;
    if (event.objectiveType === 'elite-kill' && !enemy.elite && !enemy.boss) continue;
    if (event.objectiveType === 'boss-kill' && !enemy.boss) continue;
    if (!['enemy-kill', 'elite-kill', 'boss-kill'].includes(event.objectiveType)) continue;

    event.progress = Math.min(event.targetCount || 1, (Number(event.progress) || 0) + 1);
    event.phase = event.progress;
    if (event.progress >= (event.targetCount || 1)) {
      completed.push(finishEvent(game, event, 'completed', world.clockMinutes));
    }
  }
  return completed;
}

export function claimWorldEventReward(game, eventId) {
  const history = game?.world?.events?.history;
  if (!Array.isArray(history)) return null;
  const event = history.find(item => item.id === eventId);
  if (!event || event.status !== 'completed' || event.rewardClaimed) return null;
  event.rewardClaimed = true;
  const reward = { ...event.reward };
  if (Number.isSafeInteger(reward.gold) && reward.gold > 0) {
    reward.gold = Math.max(1, Math.round(reward.gold * (1 + getFactionEventGoldBonus(game, event.factionId))));
  }
  return reward;
}

export function recordWorldEventDiscovery(game, regionId) {
  const world = ensureWorldState(game, { legacy: false });
  if (!world || !WORLD_REGION_IDS.includes(regionId)) return [];
  const completed = [];
  for (const event of [...world.events.active]) {
    if (event.status !== 'active' || !event.accepted
      || event.objectiveType !== 'region-discovery' || event.targetRegionId !== regionId) continue;
    event.progress = Math.min(event.targetCount || 1, (Number(event.progress) || 0) + 1);
    event.phase = event.progress;
    if (event.progress >= (event.targetCount || 1)) {
      completed.push(finishEvent(game, event, 'completed', world.clockMinutes));
    }
  }
  return completed;
}
