import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { sellItemsByIndices, getSellPrice } from '../systems/shop.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

const commonSword = { id: 'iron-sword', qty: 1, rarity: 'common', bonus: {}, affixes: [], runes: [] };
const legendarySword = { id: 'iron-sword', qty: 1, rarity: 'legendary', bonus: {}, affixes: [], runes: [] };
const questToken = { id: 'old-archive-seal', qty: 1 };
state.game = { player: {
  name: 'Sale regression', gold: 0, inventory: [commonSword, legendarySword, questToken],
  stats: {}, equipped: {}
} };

const invalid = sellItemsByIndices([-1, 99, 1.5, '0']);
assert.equal(invalid.ok, false);
assert.equal(state.game.player.inventory.length, 3, 'invalid indices must not mutate inventory');

const protectedSale = sellItemsByIndices([2]);
assert.equal(protectedSale.ok, false, 'quest items must not be sellable');
assert.equal(state.game.player.inventory.length, 3);
assert.equal(state.game.player.gold, 0);

const expensive = sellItemsByIndices([1]);
assert.equal(expensive.ok, false);
assert.equal(expensive.requiresConfirmation, true, 'legendary equipment requires explicit confirmation');
assert.equal(state.game.player.inventory.length, 3, 'first confirmation attempt must not sell items');

const confirmed = sellItemsByIndices([1], { confirmed: true });
assert.equal(confirmed.ok, true);
assert.equal(confirmed.count, 1);
assert.equal(confirmed.total, getSellPrice(legendarySword, state.game.player));
assert.deepEqual(state.game.player.inventory, [commonSword, questToken]);
assert.equal(state.game.player.gold, confirmed.total);
assert.equal(state.game.player.buyback.length, 1, 'sold equipment must be available for buyback');

state.game = null;
console.log('check-sale: PASS (invalid indices, quest protection, confirmation and buyback)');
