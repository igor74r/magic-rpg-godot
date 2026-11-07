import { TILE, findFreeCell } from './map.js';
import { createSeededRandom } from '../world-state.js';

const EVENT_EMOJIS = Object.freeze({
  'hub-patrol': '🛡️',
  'hub-outpost-defense': '🏰',
  'free-trader-caravan': '🐎',
  'rift-breach': '🌀',
  'ash-nomad-scouts': '🔥',
  'elite-hunt': '☠️',
  'regional-boss-bounty': '🐉',
  'frontier-survey': '🧭'
});

export function createWorldEventMarker(ow, event) {
  if (!ow || !event || !ow.map || !Number.isFinite(ow.cols) || !Number.isFinite(ow.rows)) return null;
  const avoid = [
    ...(ow.enemies || []),
    ...(ow.chests || []),
    ...(ow.npcs || []),
    ...(ow.statics || []),
    ...(ow.events || [])
  ];
  const random = createSeededRandom(event.seed);
  const position = findFreeCell(
    ow.map,
    ow.cols,
    ow.rows,
    avoid,
    180,
    ow.player,
    ow.sourceLocationId || ow.locationId,
    random
  );
  if (!position) return null;

  const completed = event.status === 'completed';
  return {
    id: `event-world-${event.id}`,
    worldEventId: event.id,
    eventType: 'world-event',
    name: completed ? `Награда: ${event.name}` : event.name,
    description: event.objectiveText || '',
    emoji: completed ? '🎁' : (EVENT_EMOJIS[event.templateId] || '⚔️'),
    completed,
    x: position.x * TILE + TILE / 2,
    y: position.y * TILE + TILE / 2,
    interactionRadius: 70,
    isEvent: true
  };
}

export function addWorldEventMarker(ow, event) {
  if (!ow || !event) return null;
  if (!Array.isArray(ow.events)) ow.events = [];
  const existing = ow.events.find(marker => marker.worldEventId === event.id);
  if (existing) return existing;
  const marker = createWorldEventMarker(ow, event);
  if (marker) ow.events.push(marker);
  return marker;
}

export function removeWorldEventMarker(ow, eventId) {
  if (!ow || !Array.isArray(ow.events)) return false;
  const before = ow.events.length;
  ow.events = ow.events.filter(marker => marker.worldEventId !== eventId);
  return ow.events.length !== before;
}

export function markWorldEventMarkerCompleted(ow, eventId) {
  const marker = ow?.events?.find(item => item.worldEventId === eventId);
  if (!marker) return false;
  marker.name = 'Награда за событие';
  marker.emoji = '🎁';
  marker.completed = true;
  return true;
}

export function syncWorldEventMarkers(ow, activeEvents = [], finishedEvents = []) {
  if (!ow) return;
  if (!Array.isArray(ow.events)) ow.events = [];
  const activeIds = new Set(activeEvents.map(event => event.id));
  const finishedById = new Map(finishedEvents.map(event => [event.id, event]));

  ow.events = ow.events.filter(marker => {
    if (!marker.worldEventId) return true;
    if (activeIds.has(marker.worldEventId)) return true;
    return finishedById.get(marker.worldEventId)?.status === 'completed';
  });

  for (const event of activeEvents) addWorldEventMarker(ow, event);
  for (const [eventId, event] of finishedById) {
    if (event.status === 'completed') markWorldEventMarkerCompleted(ow, eventId);
  }
}
