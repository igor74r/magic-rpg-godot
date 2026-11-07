import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { collectCraftingJobs, canUpgrade, healAtHealer } from '../systems/crafting.js';

const originalStorage = globalThis.localStorage;
const originalSlot = state.currentSlot;
const originalGame = state.game;
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
state.currentSlot = 1;
state.game = {
  version: 17,
  player: {
    name: 'Crafting job rollback',
    level: 1,
    gold: 0,
    str: 10,
    inventory: [],
    craftingJobs: [{ id: 'test-order', result: 'health-potion', qty: 2, rarity: undefined, readyAt: 0 }],
    stats: { kills: {} }
  }
};
const player = state.game.player;
player.equipped = { weapon: { id: 'iron-sword', qty: 1 } };
player.hp = 10; player.maxHp = 100; player.mp = 5; player.maxMp = 50; player.class = 'mage';
const originalSetItem = globalThis.localStorage.setItem;
try {
  globalThis.localStorage.setItem = () => { throw new Error('simulated storage quota'); };
  assert.deepEqual(collectCraftingJobs(1000), [], 'failed order claim must not report a completed job');
  assert.deepEqual(player.inventory, [], 'failed order claim must remove the unpersisted reward');
  assert.equal(player.craftingJobs.length, 1, 'failed order claim must preserve the ready order for retry');

  globalThis.localStorage.setItem = originalSetItem;
  const claimed = collectCraftingJobs(1000);
  assert.equal(claimed.length, 1, 'ready order must be claimable after storage recovers');
  assert.equal(player.craftingJobs.length, 0, 'successfully claimed order must be removed');
  assert.deepEqual(player.inventory, [{ id: 'health-potion', qty: 2 }], 'successful claim must grant the reward exactly once');

  player.gold = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(canUpgrade('weapon').ok, false, 'blacksmith must reject unsafe gold balances');
  assert.equal(healAtHealer().ok, false, 'healer must reject unsafe gold balances');
  assert.equal(player.gold, Number.MAX_SAFE_INTEGER + 1, 'invalid balance must remain untouched');
} finally {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
  state.currentSlot = originalSlot;
  state.game = originalGame;
}
console.log('check-crafting-jobs: PASS (failed claims roll back inventory and preserve retryable orders)');
