import { state } from './state.js';
import { saveGame } from './save.js';
import { LOCATIONS } from '../data/locations.js';
import { ENEMIES } from '../data/enemies.js';

export const TOWER_MAX_FLOOR = 40;
const TOWER_REGIONS = ['forest', 'ruins', 'swamp', 'graveyard', 'volcano', 'ice-peaks', 'wasteland', 'library', 'sunken-necropolis', 'obsidian-fields', 'frost-citadel', 'void-crater'];
// Tower guardians are non-dragon bosses: the three story dragons remain exclusive to the campaign.
const TOWER_BOSSES = ['grave-king', 'sand-king', 'archmage', 'elder-treant', 'bone-tyrant', 'bone-colossus', 'void-harbinger', 'shadow-mage'];

export function getTowerMult(floor = 1) {
  const f = Number.isSafeInteger(floor) && floor >= 1
    ? Math.min(TOWER_MAX_FLOOR, floor)
    : 1;
  return {
    hpMult: 1 + (f - 1) * 0.08,
    atkMult: 1 + (f - 1) * 0.055,
    goldMult: 1 + (f - 1) * 0.08,
    expMult: 1 + (f - 1) * 0.07
  };
}

export function getTowerLocation(floor = 1) {
  const f = Math.max(1, Math.min(TOWER_MAX_FLOOR, Math.floor(Number(floor) || 1)));
  const sourceId = TOWER_REGIONS[(f - 1) % TOWER_REGIONS.length];
  const source = LOCATIONS[sourceId];
  if (!source) return null;
  const regularEnemies = (source.enemies || []).filter(id => !ENEMIES[id]?.boss).slice(0, 4);
  const fallbackEnemies = TOWER_REGIONS.flatMap(region => LOCATIONS[region]?.enemies || [])
    .filter(id => ENEMIES[id] && !ENEMIES[id].boss && !regularEnemies.includes(id));
  while (regularEnemies.length < 4 && fallbackEnemies.length) regularEnemies.push(fallbackEnemies.shift());
  const isGuardianFloor = f % 5 === 0;
  const bossId = isGuardianFloor ? TOWER_BOSSES[(f / 5 - 1) % TOWER_BOSSES.length] : null;
  const enemies = bossId ? [...regularEnemies, bossId] : regularEnemies;
  return {
    ...source,
    id: `tower-floor-${String(f).padStart(2, '0')}`,
    name: `Башня · Этаж ${f}`,
    desc: isGuardianFloor
      ? `Этаж ${f} из 40. Страж этажа ждёт в конце испытания.`
      : `Этаж ${f} из 40. Пройдите зал и победите всех противников, чтобы подняться выше.`,
    sourceId,
    enemies,
    chestsCount: isGuardianFloor ? 2 : 1
  };
}

export function getTowerBest() {
  const value = state.game?.player?.towerBest;
  return Number.isSafeInteger(value) && value >= 0
    ? Math.min(TOWER_MAX_FLOOR, value)
    : 0;
}

export function getTowerStartFloor() {
  const best = getTowerBest();
  return best >= TOWER_MAX_FLOOR ? 1 : best + 1;
}

export function recordTowerFloor(floor) {
  const player = state.game?.player;
  if (!player || !Number.isSafeInteger(floor) || floor < 1 || floor > TOWER_MAX_FLOOR) return false;

  const original = player.towerBest;
  const previous = Number.isSafeInteger(original) && original >= 0
    ? Math.min(TOWER_MAX_FLOOR, original)
    : 0;
  if (floor <= previous && original === previous) return false;

  player.towerBest = Math.max(previous, floor);
  if (!saveGame()) {
    player.towerBest = original;
    return false;
  }
  return player.towerBest > previous;
}

export function endTower(floor) {
  const best = recordTowerFloor(floor);
  return { best: getTowerBest(), newRecord: best, completed: getTowerBest() >= TOWER_MAX_FLOOR };
}
