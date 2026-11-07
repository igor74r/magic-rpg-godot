import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { createCharacter } from '../systems/character.js';
import { on, off } from '../systems/events.js';

const originalStorage = globalThis.localStorage;
let writes = 0;
globalThis.localStorage = {
  setItem() {
    writes += 1;
    throw new Error('simulated quota failure');
  },
  getItem() { return null; },
  removeItem() {}
};

const previousGame = { sentinel: true };
state.game = previousGame;
state.currentSlot = 1;
state.pendingSlot = 2;
let startedEvents = 0;
const onStarted = () => { startedEvents += 1; };
on('game:started', onStarted);

try {
  assert.equal(createCharacter('Storage test', 'mage'), false,
    'character creation must fail if the save cannot be persisted');
  assert.equal(writes, 1, 'creation should attempt exactly one save');
  assert.equal(state.game, previousGame, 'failed creation must restore the prior game object');
  assert.equal(state.currentSlot, 1, 'failed creation must restore the active slot');
  assert.equal(state.pendingSlot, 2, 'failed creation must preserve the pending slot for retry');
  assert.equal(startedEvents, 0, 'failed creation must not emit game:started');

  globalThis.localStorage.setItem = () => {};
  state.game = previousGame;
  state.currentSlot = 1;
  state.pendingSlot = 2;
  assert.equal(createCharacter('Storage test', 'mage'), true,
    'character creation should proceed when persistence succeeds');
  assert.equal(state.currentSlot, 2, 'successful creation should use the selected pending slot');
  assert.equal(state.pendingSlot, null, 'successful creation should consume the pending slot');
  assert.equal(state.game.player.name, 'Storage test');
  assert.equal(startedEvents, 1, 'successful creation should emit game:started exactly once');

  console.log('check-character-save-transaction: PASS (rollback, pending slot, event suppression, success path)');
} finally {
  off('game:started', onStarted);
  state.game = null;
  state.currentSlot = null;
  state.pendingSlot = null;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
