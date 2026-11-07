import assert from 'node:assert/strict';
import { getMovementDelta, getCameraPosition } from '../systems/overworld/movement.js';

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


const cameraOneFrame = getCameraPosition(0, 100, 1);
const cameraTwoFrames = getCameraPosition(0, 100, 2);
assert.ok(cameraOneFrame > 0 && cameraOneFrame < 100, 'camera eases toward its target');
assert.ok(cameraTwoFrames > cameraOneFrame, 'camera advances farther over a longer elapsed frame interval');
const cameraAt60 = Array.from({ length: 60 }).reduce(value => getCameraPosition(value, 100, 1), 0);
const cameraAt30 = Array.from({ length: 30 }).reduce(value => getCameraPosition(value, 100, 2), 0);
assert.ok(Math.abs(cameraAt60 - cameraAt30) < 1e-9, 'camera easing is frame-rate independent');
assert.equal(getCameraPosition(10, 20, 0), 10, 'zero elapsed time must not move the camera');
assert.equal(getCameraPosition(99.99, 100, 1), 100, 'camera snaps to target inside the sub-pixel dead zone');
assert.equal(getCameraPosition(10, 20, 1, 0), 10, 'zero smoothing preserves the current camera position');
assert.equal(getCameraPosition(10, 20, 1, 1), 20, 'full smoothing reaches the target immediately');

console.log('Overworld camera checks passed: smooth follow, frame-rate independence, dead zone and edge cases');
