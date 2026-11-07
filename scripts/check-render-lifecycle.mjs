import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { state } from '../systems/state.js';

const originalRaf = globalThis.requestAnimationFrame;
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

const frames = [];
let nextFrameId = 1;
globalThis.requestAnimationFrame = callback => {
  frames.push(callback);
  return nextFrameId++;
};

const intervals = [];
const cleared = [];
let nextIntervalId = 1;
globalThis.setInterval = callback => {
  const id = nextIntervalId++;
  intervals.push({ id, callback });
  return id;
};
globalThis.clearInterval = id => cleared.push(id);

try {
  const { initWeather, drawBloom } = await import('../ui/overworld/effects.js');
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  try {
    assert.doesNotThrow(() => initWeather('village'),
      'weather initialization must survive unavailable offscreen canvas contexts');
    assert.doesNotThrow(() => drawBloom(null),
      'optional bloom must be skipped when its canvas context is unavailable');
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }

  const { start, startAutosave } = await import('../ui/overworld/render.js');
  const renderSource = await readFile(new URL('../ui/overworld/render.js', import.meta.url), 'utf8');
  const overworldSource = await readFile(new URL('../ui/overworld.js', import.meta.url), 'utf8');
  assert.match(overworldSource, /function clearMovementKeys\(\)/,
    'movement input must be reset when the browser loses focus');
  assert.match(overworldSource, /window\.addEventListener\('blur', clearMovementKeys\)/,
    'window blur must release held movement keys');
  assert.match(overworldSource, /visibilitychange', \(\) => \{ if \(document\.hidden\) clearMovementKeys\(\); \}/,
    'backgrounding the tab must release held movement keys');
  assert.match(renderSource, /try\s*\{\s*if\s*\(saveGame\(\)\)/,
    'autosave storage failures must be caught');
  assert.match(renderSource, /autosaveErrorAt/);
  assert.match(renderSource, /autosaveSavedAt/,
    'the saved indicator must only appear after a successful write');
  assert.match(renderSource, /ошибка сохранения/,
    'the canvas should distinguish a failed write from a successful save');
  assert.match(renderSource, /Array\.isArray\(p\.effects\) \? p\.effects : \[\]/,
    'weather updates must normalize a malformed effects container');
  assert.match(renderSource, /e\?\._weatherEffect !== true/,
    'weather updates must ignore null entries while filtering temporary effects');
  assert.doesNotMatch(renderSource, /\(p\.effects \|\| \[\]\)\.filter\(e => e\._weatherEffect/,
    'weather updates must not dereference malformed effect entries');

  assert.match(renderSource, /autosaveAt = now/,
    'failed writes must be throttled instead of retried every second');
  state.overworld = null;

  start();
  assert.equal(frames.length, 1, 'render loop should schedule its first frame');
  frames.shift()(16.67);
  assert.equal(frames.length, 0, 'render loop must stop after leaving the overworld');

  start();
  assert.equal(frames.length, 1, 'render loop should be restartable on re-entry');

  assert.match(renderSource, /finally\s*\{[\s\S]*requestAnimationFrame\(tick\)/,
    'the animation loop must schedule its next frame from finally');
  const originalGame = state.game;
  state.overworld = { active: true, paused: false };
  state.game = null; // Force an update exception inside the frame callback.
  frames.shift()(33.34);
  assert.equal(frames.length, 1,
    'a frame exception must not permanently stop the overworld animation loop');
  state.overworld = null;
  frames.shift()(50.01);
  assert.equal(frames.length, 0,
    'the animation loop must still stop cleanly after leaving the overworld');
  state.game = originalGame;

  state.overworld = null;
  startAutosave();
  assert.equal(intervals.length, 1, 'autosave timer should start with the overworld');
  intervals[0].callback();
  assert.deepEqual(cleared, [intervals[0].id], 'autosave timer must clear after leaving the overworld');

  startAutosave();
  assert.equal(intervals.length, 2, 'autosave timer should restart on the next entry');
  intervals[1].callback();
  assert.deepEqual(cleared, [intervals[0].id, intervals[1].id]);
  console.log('check-render-lifecycle: PASS (RAF and autosave stop on exit and restart on re-entry)');
} finally {
  state.overworld = null;
  if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = originalRaf;
  if (originalSetInterval === undefined) delete globalThis.setInterval;
  else globalThis.setInterval = originalSetInterval;
  if (originalClearInterval === undefined) delete globalThis.clearInterval;
  else globalThis.clearInterval = originalClearInterval;
}
