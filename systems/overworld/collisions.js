import { LOCATIONS } from '../../data/locations.js';
import { TILE, isWalkable } from './map.js';

// The collision silhouette follows drawVillageBuilding() in ui/overworld/sprites.js.
// The central south opening is intentionally left clear as the front doorway.
// Hero body footprint: 18 px diameter, aligned with the visible torso/legs.
// Weapons, staffs, bows and animated headwear are cosmetic and do not collide.
export const PLAYER_COLLISION_RADIUS = 9;

const BUILDING_BODY = Object.freeze({
  // Enlarged wall footprint follows the 3×3-tile pixel-art building sprite.
  left: -66,
  right: 66,
  top: -35,
  bottom: 30,
  doorHalfWidth: 25,
  doorTop: -7
});

// Solid square-footprint props in Aurora. Decorative lanterns/flowers are
// intentionally excluded so the plaza remains open and comfortable to walk.
const SOLID_PROP_STYLES = new Set(['fountain', 'bench', 'memorial', 'anvil', 'woodpile', 'cart', 'barrels', 'stall', 'herb-rack']);
const PROP_HALF_SIZE = Object.freeze({
  fountain: 18, bench: 17, memorial: 13, anvil: 13, woodpile: 15,
  cart: 18, barrels: 14, stall: 20, 'herb-rack': 14
});

export function getVillageBuildingColliders(statics = LOCATIONS.village.statics) {
  const buildings = statics.filter(item => item?.buildingStyle);
  return buildings.flatMap(building => {
    const x = building.x * TILE + TILE / 2;
    const y = building.y * TILE + TILE / 2;
    const b = BUILDING_BODY;
    const width = b.right - b.left;
    const height = b.bottom - b.top;
    const sideWidth = (width - b.doorHalfWidth * 2) / 2;
    const doorwayWidth = b.doorHalfWidth * 2;
    return [
      { id: building.id, part: 'left-wall', x: x + b.left, y: y + b.top, width: sideWidth, height },
      { id: building.id, part: 'right-wall', x: x + b.doorHalfWidth, y: y + b.top, width: sideWidth, height },
      { id: building.id, part: 'back-wall', x: x - b.doorHalfWidth, y: y + b.top, width: doorwayWidth, height: b.doorTop - b.top }
    ];
  });
}

function circleIntersectsRect(x, y, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function getVillagePropColliders(statics = LOCATIONS.village.statics) {
  return statics.filter(item => item?.propStyle && SOLID_PROP_STYLES.has(item.propStyle))
    .map(item => {
      const half = PROP_HALF_SIZE[item.propStyle] || 14;
      return {
        id: item.id,
        part: 'solid-prop',
        x: item.x * TILE + TILE / 2 - half,
        y: item.y * TILE + TILE / 2 - half,
        width: half * 2,
        height: half * 2
      };
    });
}

// Solid natural scenery uses only its visible ground-contact footprint.
// Canopies stay non-solid so the player can pass behind/under tree crowns.
const NATURE_COLLISION_BOUNDS = Object.freeze({
  oak: { left: -8, top: -3, width: 16, height: 12 },
  pine: { left: -8, top: -3, width: 16, height: 12 },
  rock: { left: -20, top: -23, width: 40, height: 15 },
  stump: { left: -15, top: -23, width: 30, height: 16 },
  hedge: { left: -31, top: -15, width: 62, height: 17 },
  fence: { left: -35, top: -5, width: 70, height: 12 }
});

export function getVillageNatureColliders(statics = LOCATIONS.village.statics) {
  return statics.filter(item => item?.natureStyle && NATURE_COLLISION_BOUNDS[item.natureStyle])
    .map(item => {
      const bounds = NATURE_COLLISION_BOUNDS[item.natureStyle];
      const x = item.x * TILE + TILE / 2;
      const y = item.y * TILE + TILE / 2;
      return {
        id: item.id,
        part: 'nature-base',
        x: x + bounds.left,
        y: y + bounds.top,
        width: bounds.width,
        height: bounds.height
      };
    });
}

const DEFAULT_VILLAGE_COLLIDERS = [
  ...getVillageBuildingColliders(),
  ...getVillagePropColliders(),
  ...getVillageNatureColliders()
];

export function isVillagePositionBlocked(x, y, radius = 10, statics = LOCATIONS.village.statics) {
  const colliders = statics === LOCATIONS.village.statics
    ? DEFAULT_VILLAGE_COLLIDERS
    : [...getVillageBuildingColliders(statics), ...getVillagePropColliders(statics), ...getVillageNatureColliders(statics)];
  return colliders.some(rect => circleIntersectsRect(x, y, radius, rect));
}

// Check the complete player footprint instead of testing only its center.
// Eight perimeter samples catch diagonal corner clipping while preserving
// the existing circle-vs-building/prop checks in Aurora.
export function canOccupyPlayerPosition(map, cols, rows, x, y, radius = 12, locationId = null) {
  const samples = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
    [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2],
    [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]
  ];
  if (samples.some(([sx, sy]) => !isWalkable(map, cols, rows, x + sx * radius, y + sy * radius, locationId))) {
    return false;
  }
  return locationId !== 'village' || !isVillagePositionBlocked(x, y, radius);
}


// Physical radii for non-player actors, measured against their rendered body.
export const NPC_COLLISION_RADIUS = 8;
export const ENEMY_COLLISION_RADIUS = 10;

// Actor-to-actor circle collision. If legacy placement already overlaps,
// permit only movement that does not make that overlap worse, so actors can
// separate instead of becoming permanently stuck.
export function isActorPositionClear(x, y, radius, actors = [], self = null) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return false;
  return actors.every(actor => {
    if (!actor || actor === self || actor.dead || !Number.isFinite(actor.x) || !Number.isFinite(actor.y)) return true;
    const otherRadius = Number.isFinite(actor.collisionRadius) ? actor.collisionRadius : PLAYER_COLLISION_RADIUS;
    const minDistance = radius + otherRadius;
    const dx = x - actor.x, dy = y - actor.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared >= minDistance * minDistance) return true;
    // New actors must never be placed inside another footprint. Only an
    // already-existing actor may retain an overlap while moving out of it.
    if (!self || !Number.isFinite(self.x) || !Number.isFinite(self.y)) return false;
    const currentX = self.x;
    const currentY = self.y;
    const currentDistance = Math.hypot(currentX - actor.x, currentY - actor.y);
    return currentDistance < minDistance && Math.sqrt(distanceSquared) >= currentDistance - 0.001;
  });
}

export function canOccupyActorPosition(map, cols, rows, x, y, radius, locationId, actors = [], self = null) {
  return canOccupyPlayerPosition(map, cols, rows, x, y, radius, locationId)
    && isActorPositionClear(x, y, radius, actors, self);
}
