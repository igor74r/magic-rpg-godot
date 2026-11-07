import { state } from './state.js';
import { saveGame } from './save.js';
import { emit } from './events.js';
import { LOCATIONS } from '../data/locations.js';
import { isRiftUnlockedByStory } from './story-dragons.js';

// 30 уникальных областей послесюжетного Разлома. Последние десять требуют 50 уровень.
const RIFT_LOCATIONS = Object.freeze([
  ['rift-01', 'Пепельный порог', 'forest', 1],
  ['rift-02', 'Лес обратных корней', 'briar-hollow', 1],
  ['rift-03', 'Затонувший двор', 'ruins', 1],
  ['rift-04', 'Топь без отражений', 'swamp', 1],
  ['rift-05', 'Кладбище забытых имён', 'graveyard', 1],
  ['rift-06', 'Пустошь стеклянного ветра', 'wasteland', 1],
  ['rift-07', 'Библиотека шёпота', 'library', 1],
  ['rift-08', 'Поля чёрного стекла', 'obsidian-fields', 1],
  ['rift-09', 'Ледяные катакомбы', 'ice-peaks', 1],
  ['rift-10', 'Площадь павших башен', 'sunken-necropolis', 1],
  ['rift-11', 'Грот гаснущего света', 'shadow', 1],
  ['rift-12', 'Кузня пустого солнца', 'volcano', 1],
  ['rift-13', 'Зал костяных приливов', 'sunken-necropolis', 1],
  ['rift-14', 'Долина пепельных крыльев', 'obsidian-fields', 1],
  ['rift-15', 'Сад ледяных масок', 'frost-citadel', 1],
  ['rift-16', 'Тропа расколотой луны', 'wasteland', 1],
  ['rift-17', 'Архив живой пыли', 'library', 1],
  ['rift-18', 'Болото кровавых звёзд', 'swamp', 1],
  ['rift-19', 'Трон без короля', 'graveyard', 1],
  ['rift-20', 'Порог драконьей памяти', 'dragon-lair', 1],
  ['rift-21', 'Обсерватория пустоты', 'void-crater', 50],
  ['rift-22', 'Лабиринт красного стекла', 'obsidian-fields', 50],
  ['rift-23', 'Безмолвная цитадель', 'frost-citadel', 50],
  ['rift-24', 'Некрополь последнего часа', 'sunken-necropolis', 50],
  ['rift-25', 'Сердце чёрного вулкана', 'volcano', 50],
  ['rift-26', 'Лес по ту сторону времени', 'briar-hollow', 50],
  ['rift-27', 'Крипта первых магов', 'ruins', 50],
  ['rift-28', 'Предел драконьего сна', 'dragon-lair', 50],
  ['rift-29', 'Грань немого моря', 'swamp', 50],
  ['rift-30', 'Сердцевина Разлома', 'void-crater', 50]
].map(([id, name, sourceId, minLevel]) => Object.freeze({ id, name, sourceId, minLevel })));

const RIFT_LOCATION_IDS = new Set(RIFT_LOCATIONS.map(location => location.id));

export function getRiftClearedCount(player = state.game?.player) {
  const values = Array.isArray(player?.riftClearedLocations) ? player.riftClearedLocations : [];
  return new Set(values.filter(id => RIFT_LOCATION_IDS.has(id))).size;
}

export function getRiftLocations(level = state.game?.player?.level || 1) {
  return RIFT_LOCATIONS.map(location => ({
    ...location,
    unlocked: level >= location.minLevel
  }));
}

export function getRiftLocation(id) {
  const entry = RIFT_LOCATIONS.find(location => location.id === id);
  const source = entry && LOCATIONS[entry.sourceId];
  if (!entry || !source) return null;
  return { ...source, id: entry.id, name: entry.name, desc: `Область Разлома: ${entry.name}. ${source.desc || ''}`, sourceId: entry.sourceId, minLevel: entry.minLevel };
}

export function getRiftMult(floor) {
  // Rift floors are unbounded, but corrupted/non-integer values must never
  // propagate NaN or Infinity into enemy stats and reward calculations.
  const f = Number.isSafeInteger(floor) && floor >= 1 ? floor : 1;
  return {
    hpMult: 1 + (f - 1) * 0.15,
    atkMult: 1 + (f - 1) * 0.10,
    goldMult: 1 + (f - 1) * 0.25,
    expMult: 1 + (f - 1) * 0.20
  };
}

export function getRandomRiftLocation(excludeId = null, level = state.game?.player?.level || 1, excludedIds = []) {
  const excluded = new Set([excludeId, ...(Array.isArray(excludedIds) ? excludedIds : [])].filter(Boolean));
  const pool = RIFT_LOCATIONS.filter(location => !excluded.has(location.id) && level >= location.minLevel);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function isRiftReady() {
  return isRiftUnlockedByStory(state.game) && state.game?.riftEnding !== 'closed';
}

export function recordRiftFloor(floor) {
  const p = state.game?.player;
  if (!p || !Number.isSafeInteger(floor) || floor < 1) return false;
  const value = floor;

  const original = p.riftBest;
  const previous = Number.isSafeInteger(original) && original >= 0 ? original : 0;
  if (value <= previous && original === previous) return false;

  p.riftBest = Math.max(previous, value);
  if (!saveGame()) {
    p.riftBest = original;
    return false;
  }
  return p.riftBest > previous;
}

export function getRiftBest() {
  const value = state.game?.player?.riftBest;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function endRift() {
  const ow = state.overworld;
  if (!ow || !ow.rifMode) return;
  const floor = ow.rifFloor || 1;
  const isNewRecord = recordRiftFloor(floor);
  if (isNewRecord) {
    emit('toast', `🌀 Новый рекорд Разлома: этаж ${floor}!`);
  } else {
    emit('toast', `🌀 Разлом: этаж ${floor}. Рекорд: ${getRiftBest()}`);
  }
}
