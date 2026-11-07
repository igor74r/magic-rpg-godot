import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { createCharacter } from '../systems/character.js';
import { recordRiftFloor } from '../systems/rift.js';
import { recordTowerFloor } from '../systems/tower.js';
import { saveGame } from '../systems/save.js';

const originalStorage = globalThis.localStorage;
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

try {
  assert.equal(createCharacter('Record Save Regression', 'warrior'), true);
  state.currentSlot = 1;
  const player = state.game.player;
  player.riftBest = 2;
  player.towerBest = 3;

  const persistedBeforeSerializationFailure = storage.get('magic-rpg-save-1');
  player.unexpectedExtensionValue = 1n;
  assert.equal(saveGame(), false, 'save must return false when JSON serialization fails');
  assert.equal(storage.get('magic-rpg-save-1'), persistedBeforeSerializationFailure,
    'serialization failure must preserve the previously persisted character');
  delete player.unexpectedExtensionValue;

  const originalSetItem = globalThis.localStorage.setItem;
  for (const invalidFloor of [0, -1, 1.5, NaN, Infinity, -Infinity, '5', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(recordRiftFloor(invalidFloor), false,
      `invalid rift floor ${String(invalidFloor)} must be rejected`);
    assert.equal(player.riftBest, 2, 'invalid rift floor must not mutate the saved record');
  }
  for (const invalidFloor of [0, -1, 1.5, NaN, Infinity, -Infinity, '5', Number.MAX_SAFE_INTEGER + 1, 41]) {
    assert.equal(recordTowerFloor(invalidFloor), false,
      `invalid tower floor ${String(invalidFloor)} must be rejected`);
    assert.equal(player.towerBest, 3, 'invalid tower floor must not mutate the saved record');
  }

  globalThis.localStorage.setItem = () => { throw new Error('simulated storage quota'); };

  player.towerBest = Infinity;
  assert.equal(recordTowerFloor(5), false,
    'a corrupted infinite tower record must be normalized instead of treated as a valid high score');
  assert.equal(player.towerBest, Infinity,
    'tower normalization must roll back when storage rejects the corrected record');
  globalThis.localStorage.setItem = originalSetItem;
  assert.equal(recordTowerFloor(5), true, 'valid floor should repair and persist a corrupted tower record');
  assert.equal(player.towerBest, 5);
  globalThis.localStorage.setItem = () => { throw new Error('simulated storage quota'); };
  player.towerBest = 3;

  player.riftBest = Infinity;
  assert.equal(recordRiftFloor(5), false,
    'a corrupted infinite record must be normalized instead of treated as a valid high score');
  assert.equal(player.riftBest, Infinity,
    'normalization must roll back when storage rejects the corrected record');
  globalThis.localStorage.setItem = originalSetItem;
  assert.equal(recordRiftFloor(5), true, 'valid floor should repair and persist a corrupted record');
  assert.equal(player.riftBest, 5);
  globalThis.localStorage.setItem = () => { throw new Error('simulated storage quota'); };
  player.riftBest = 2;

  assert.equal(recordRiftFloor(5), false, 'rift record must not confirm a failed save');
  assert.equal(player.riftBest, 2, 'rift record must roll back on save failure');
  assert.equal(recordTowerFloor(7), false, 'tower record must not confirm a failed save');
  assert.equal(player.towerBest, 3, 'tower record must roll back on save failure');

  globalThis.localStorage.setItem = originalSetItem;
  assert.equal(recordRiftFloor(5), true, 'rift record should persist successfully');
  assert.equal(player.riftBest, 5);
  assert.equal(recordTowerFloor(7), true, 'tower record should persist successfully');
  assert.equal(player.towerBest, 7);

  console.log('check-record-save: PASS (rift/tower records roll back on persistence failure)');
} finally {
  state.game = null;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
