import assert from 'node:assert/strict';
import { canOccupyPlayerPosition, isVillagePositionBlocked, PLAYER_COLLISION_RADIUS, NPC_COLLISION_RADIUS, ENEMY_COLLISION_RADIUS, isActorPositionClear, canOccupyActorPosition } from '../systems/overworld/collisions.js';
import { resolveSweptMovement } from '../systems/overworld/movement.js';

assert.equal(PLAYER_COLLISION_RADIUS, 9, 'hero collision must match the visible 18px body footprint, not held equipment');

const open = Array.from({ length: 8 }, () => Array(8).fill(0));
const wall = open.map(row => [...row]);
wall[3][3] = 2;

assert.equal(canOccupyPlayerPosition(open, 8, 8, 3 * 48 + 24, 3 * 48 + 24, PLAYER_COLLISION_RADIUS, 'forest'), true,
  'player must move freely on clear ground');
assert.equal(canOccupyPlayerPosition(wall, 8, 8, 3 * 48 + 24, 3 * 48 + 24, PLAYER_COLLISION_RADIUS, 'forest'), false,
  'player center inside a blocked tile must be rejected');
assert.equal(canOccupyPlayerPosition(wall, 8, 8, 3 * 48 - 6, 3 * 48 - 6, PLAYER_COLLISION_RADIUS, 'forest'), false,
  'player circle must not clip a diagonal obstacle corner');
assert.equal(canOccupyPlayerPosition(wall, 8, 8, 3 * 48 - 18, 3 * 48 + 24, PLAYER_COLLISION_RADIUS, 'forest'), true,
  'player must remain able to pass beside a wall with sufficient clearance');
assert.equal(canOccupyPlayerPosition(wall, 8, 8, 3 * 48 - 4, 3 * 48 + 24, PLAYER_COLLISION_RADIUS, 'forest'), false,
  'player footprint must not overlap a wall from the side');
assert.equal(canOccupyPlayerPosition(open, 8, 8, 24, 24, PLAYER_COLLISION_RADIUS, 'forest'), true,
  'walkable map interior must remain traversable');
assert.equal(canOccupyPlayerPosition(open, 8, 8, 2, 24, PLAYER_COLLISION_RADIUS, 'forest'), false,
  'player footprint must remain inside map bounds');

const building = { id: 'test-house', buildingStyle: 'home', x: 5, y: 5 };
const customVillage = [building];
assert.equal(isVillagePositionBlocked(5 * 48 + 24 - 66, 5 * 48 + 24, 12, customVillage), true,
  'custom village building wall must block the player');
assert.equal(isVillagePositionBlocked(5 * 48 + 24, 5 * 48 + 24 + 8, 10, customVillage), false,
  'custom village front doorway must stay open');
const customNature = [{ id: 'test-oak', natureStyle: 'oak', x: 5, y: 5 }];
assert.equal(isVillagePositionBlocked(5 * 48 + 24, 5 * 48 + 24 + 3, 5, customNature), true,
  'custom village nature footprints must block their solid ground-contact bases');

console.log('Overworld collision checks passed: full player footprint, diagonal corners, clearance, bounds and village doorways');

// A diagonal approach to a blocked corner should route around its edge,
// rather than always attempting the horizontal axis first.
const corner = (x, y) => !(x > 10 && x < 20 && y > 10 && y < 20);
const aroundCorner = resolveSweptMovement(0, 0, 28, 28, corner, 2);
assert.ok(aroundCorner.moved, 'corner navigation must make progress');
assert.ok(aroundCorner.x > 10 && aroundCorner.y > 20,
  'balanced sliding must get around the obstacle corner in both axes');
assert.equal(corner(aroundCorner.x, aroundCorner.y), true,
  'corner navigation must never finish inside the obstacle');

const horizontalWall = (x, y) => !(x > 8 && x < 24 && y > 8 && y < 16);
const slide = resolveSweptMovement(0, 12, 32, 0, horizontalWall, 2);
assert.ok(slide.x <= 8, 'movement must stop at the wall when no sliding axis is requested');

console.log('Corner navigation checks passed: balanced diagonal sliding and obstacle clearance');


const actorA = { x: 100, y: 100, collisionRadius: NPC_COLLISION_RADIUS };
const actorB = { x: 116, y: 100, collisionRadius: ENEMY_COLLISION_RADIUS };
assert.equal(isActorPositionClear(actorB.x, actorB.y, actorB.collisionRadius, [actorA], null), false,
  'NPC and enemy bodies must not overlap');
assert.equal(isActorPositionClear(121, 100, actorB.collisionRadius, [actorA], actorB), true,
  'actors may pass when their body footprints have clearance');
assert.equal(isActorPositionClear(109, 100, actorB.collisionRadius, [actorA], actorB), false,
  'an actor may not move deeper into another actor');
const overlapping = { x: 110, y: 100, collisionRadius: ENEMY_COLLISION_RADIUS };
assert.equal(isActorPositionClear(113, 100, overlapping.collisionRadius, [actorA], overlapping), true,
  'actors that begin overlapped must be able to move apart');
assert.equal(isActorPositionClear(109, 100, overlapping.collisionRadius, [actorA], overlapping), false,
  'actors that begin overlapped may not worsen the overlap');
assert.equal(canOccupyActorPosition(open, 8, 8, 24, 24, NPC_COLLISION_RADIUS, 'forest', [actorA], null), true,
  'NPC footprint uses the same map bounds and tile collision checks');
assert.equal(canOccupyActorPosition(wall, 8, 8, 3 * 48 - 4, 3 * 48 + 24, ENEMY_COLLISION_RADIUS, 'forest', [], null), false,
  'enemy footprint must respect wall clearance');

console.log('Actor collision checks passed: NPC/enemy separation, overlap recovery and world obstacles');
