import assert from 'node:assert/strict';
import { getMovementDelta } from '../systems/overworld/movement.js';

const oneFrame = getMovementDelta(1, 0, 1);
const twoFrames = getMovementDelta(1, 0, 2);
assert.equal(oneFrame.x, 3.2, 'one normalized frame uses the configured movement speed');
assert.equal(twoFrames.x, 6.4, 'movement distance scales with elapsed frames');
assert.equal(twoFrames.y, 0);

const diagonal = getMovementDelta(1, 1, 1);
assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 3.2) < 1e-10,
  'diagonal movement must not be faster than cardinal movement');
assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-10,
  'diagonal movement must remain evenly normalized');

assert.deepEqual(getMovementDelta(0, 0, 1), { x: 0, y: 0 }, 'no input must not move the player');
assert.deepEqual(getMovementDelta(1, 0, 0), { x: 0, y: 0 }, 'zero elapsed time must not move the player');
const cappedStep = getMovementDelta(1, 0, 10);
assert.ok(Math.abs(cappedStep.x - 9.6) < 1e-10 && cappedStep.y === 0,
  'large frame gaps must be capped to avoid teleport-like steps');
assert.deepEqual(getMovementDelta(1, 0, -1), { x: 0, y: 0 }, 'negative elapsed time must be ignored');

console.log('Overworld movement checks passed: frame-rate scaling, diagonal normalization and safe delta caps');
