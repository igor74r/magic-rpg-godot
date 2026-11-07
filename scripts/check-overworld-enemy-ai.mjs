import assert from 'node:assert/strict';
import { getEnemyBehavior, getEnemyGroupBehaviors, getEnemySteering } from '../systems/overworld/enemy-ai.js';

const enemy = { x: 20, y: 0, homeX: 0, homeY: 0, state: 'idle' };
let behavior = getEnemyBehavior(enemy, { x: 100, y: 0 });
assert.equal(behavior.state, 'chase', 'enemy should aggro when player enters its range');
assert.deepEqual([behavior.targetX, behavior.targetY], [100, 0]);

behavior = getEnemyBehavior({ ...enemy, x: 350, state: 'chase' }, { x: 370, y: 0 });
assert.equal(behavior.state, 'return', 'enemy must return when pulled beyond its home leash');
assert.deepEqual([behavior.targetX, behavior.targetY], [0, 0]);

behavior = getEnemyBehavior({ ...enemy, x: 60, state: 'chase' }, { x: 350, y: 0 });
assert.equal(behavior.state, 'return', 'enemy must disengage after player escapes the disengage hysteresis range');

behavior = getEnemyBehavior({ ...enemy, x: 45, state: 'return' }, { x: 120, y: 0 });
assert.equal(behavior.state, 'return', 'returning enemy must finish reaching its home before reacquiring');
behavior = getEnemyBehavior({ ...enemy, x: 10, state: 'return' }, { x: 100, y: 0 });
assert.equal(behavior.state, 'chase', 'enemy may reacquire player after reaching home');


const pack = [
  { id: 'scout', x: 20, y: 0, homeX: 0, homeY: 0, state: 'idle' },
  { id: 'ally', x: 120, y: 20, homeX: 120, homeY: 20, state: 'idle' },
  { id: 'distant', x: 500, y: 0, homeX: 500, homeY: 0, state: 'idle' },
  { id: 'leashed', x: 80, y: 0, homeX: -300, homeY: 0, state: 'idle' },
  { id: 'dead', x: 30, y: 10, homeX: 30, homeY: 10, state: 'idle', dead: true }
];
const group = getEnemyGroupBehaviors(pack, { x: -150, y: 0 });
assert.equal(group[0].state, 'chase', 'enemy that sees the player should raise an alarm');
assert.equal(group[1].state, 'chase', 'nearby living allies should join the alerted pack');
assert.equal(group[1].assisted, true, 'assisting allies should be marked as group-alerted');
assert.equal(group[2].state, 'idle', 'distant enemies must not join an unrelated fight');
assert.equal(group[3].state, 'return', 'group alert must never pull an enemy beyond its home leash');
assert.equal(group[4].state, 'idle', 'dead enemies must not receive pack orders');

const noAlert = getEnemyGroupBehaviors(pack.slice(1, 3), { x: 1000, y: 0 });
assert.equal(noAlert[0].state, 'idle', 'a pack should not alert without a member detecting the player');

const open = () => true;
const direct = getEnemySteering(0, 0, 100, 0, open);
assert.ok(direct.x > 0.999 && Math.abs(direct.y) < 0.001, 'open route should preserve direct pursuit');
const wall = (x, y) => !(x > 3 && x < 15 && Math.abs(y) < 5);
const around = getEnemySteering(0, 0, 100, 0, wall);
assert.ok(around.x > 0 && Math.abs(around.y) > 0.1, 'enemy should choose an angled route around a blocked corridor');
assert.equal(around.blocked, false);
const trapped = getEnemySteering(0, 0, 100, 0, () => false);
assert.equal(trapped.blocked, true, 'enemy must wait safely when every direction is blocked');

console.log('Enemy overworld AI checks passed: aggro, leash, disengage, return-home, reacquire and obstacle steering');
