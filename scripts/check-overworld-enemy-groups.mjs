import assert from 'node:assert/strict';
import { getEnemyGroupBehaviors } from '../systems/overworld/enemy-ai.js';

const pack = [
  { id: 'scout', x: 20, y: 0, homeX: 20, homeY: 0, state: 'idle' },
  { id: 'ally', x: 120, y: 20, homeX: 120, homeY: 20, state: 'idle' },
  { id: 'distant', x: 500, y: 0, homeX: 500, homeY: 0, state: 'idle' },
  { id: 'leashed', x: 80, y: 0, homeX: -300, homeY: 0, state: 'idle' },
  { id: 'dead', x: 30, y: 10, homeX: 30, homeY: 10, state: 'idle', dead: true }
];

const orders = getEnemyGroupBehaviors(pack, { x: -150, y: 0 });
assert.equal(orders[0].state, 'chase', 'the detecting enemy should engage');
assert.equal(orders[1].state, 'chase', 'nearby ally inside assist range should join');
assert.equal(orders[1].assisted, true, 'ally should be identified as responding to the pack alarm');
assert.equal(orders[2].state, 'idle', 'distant enemy must remain uninvolved');
assert.equal(orders[3].state, 'return', 'pack alarm must not override the home leash');
assert.equal(orders[4].state, 'idle', 'dead enemy must not receive group orders');

const quiet = getEnemyGroupBehaviors(pack.slice(1, 3), { x: 1000, y: 0 });
assert.equal(quiet[0].state, 'idle', 'group remains idle when nobody detects the player');

const chain = [
  { x: 0, y: 0, homeX: 0, homeY: 0, state: 'idle' },
  { x: 100, y: 0, homeX: 100, homeY: 0, state: 'idle' },
  { x: 200, y: 0, homeX: 200, homeY: 0, state: 'idle' }
];
const chained = getEnemyGroupBehaviors(chain, { x: -150, y: 0 }, { groupRadius: 110, assistRange: 400 });
assert.equal(chained[2].state, 'chase', 'alarm should propagate through a connected nearby pack');

console.log('Enemy group checks passed: shared alert, proximity, isolation, leash, dead actors and chained packs');
