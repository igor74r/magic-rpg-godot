import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { ITEMS } from '../data/items.js';
import { addItem, addItemOrStore, canAddItem, claimPendingLoot } from '../systems/inventory.js';

const player = {
  str: 1000,
  inventory: Array.from({ length: 30 }, () => ({
    id: 'iron-sword', qty: 1, rarity: 'common', bonus: {}, affixes: [], runes: []
  })),
  pendingLoot: []
};
state.game = { player };

const overflow = addItemOrStore('leather-armor', 1, { allowMythic: true });
assert.deepEqual(overflow.created, []);
assert.equal(overflow.stored, true);
assert.equal(player.pendingLoot.length, 1);
assert.equal(player.pendingLoot[0].id, 'leather-armor');
assert.equal(player.pendingLoot[0].qty, 1);
assert.equal(player.pendingLoot[0].allowMythic, true);
assert.ok(Number.isFinite(player.pendingLoot[0].seed));

// Pending rewards survive saves and keep the same random item roll after reload.
const savedPendingGame = JSON.stringify(state.game);
state.game = JSON.parse(savedPendingGame);
assert.equal(state.game.player.pendingLoot[0].id, 'leather-armor');

const stillFull = claimPendingLoot(0);
assert.equal(stillFull.ok, false);
assert.equal(stillFull.reason, 'capacity');
assert.equal(state.game.player.pendingLoot.length, 1);

state.game.player.inventory.pop();
const claimed = claimPendingLoot(0);
assert.equal(claimed.ok, true);
assert.equal(claimed.entry.id, 'leather-armor');
assert.equal(claimed.created.length, 1);
assert.equal(state.game.player.inventory.at(-1).id, 'leather-armor');
assert.equal(state.game.player.pendingLoot.length, 0);
const firstRoll = JSON.stringify(claimed.created[0]);

state.game = JSON.parse(savedPendingGame);
state.game.player.inventory.pop();
const claimedAfterReload = claimPendingLoot(0);
assert.equal(claimedAfterReload.ok, true);
assert.equal(JSON.stringify(claimedAfterReload.created[0]), firstRoll, 'reloading must not reroll pending equipment');

// Stackable rewards are also preserved when weight capacity is exceeded.
state.game.player.str = 10;
state.game.player.inventory = Array.from({ length: 30 }, () => ({
  id: 'iron-sword', qty: 1, rarity: 'common', bonus: {}, affixes: [], runes: []
}));
const herbs = addItemOrStore('herb-life', 2);
assert.equal(herbs.stored, true);
assert.equal(state.game.player.pendingLoot.length, 1);
assert.equal(claimPendingLoot(0).reason, 'capacity');
state.game.player.inventory = [];
const claimedHerbs = claimPendingLoot(0);
assert.equal(claimedHerbs.ok, true);
assert.equal(state.game.player.inventory.at(-1).id, 'herb-life');
assert.equal(state.game.player.inventory.at(-1).qty, 2);
assert.equal(state.game.player.pendingLoot.length, 0);

// Legacy stack entries without qty count as one item; additions must normalize them safely.
state.game.player.inventory = [{ id: 'herb-life' }];
assert.equal(addItem('herb-life', 2).length, 1);
assert.equal(state.game.player.inventory[0].qty, 3,
  'adding to a legacy stack without qty must start from its implicit quantity of one');

// Stack quantities must remain safe integers so weight, saves and counts cannot be corrupted.
state.game.player.inventory = [{ id: 'herb-life', qty: Number.MAX_SAFE_INTEGER }];
assert.equal(canAddItem('herb-life', 1).ok, false,
  'stack additions that overflow safe integer quantity must be rejected');
assert.deepEqual(addItem('herb-life', 1), []);
assert.equal(state.game.player.inventory[0].qty, Number.MAX_SAFE_INTEGER);

const invalid = addItemOrStore('missing-item', 1);
assert.equal(invalid.stored, false);
assert.equal(state.game.player.pendingLoot.length, 0);
const invalidRarity = addItemOrStore('leather-armor', 1, { rarity: 'not-a-rarity' });
assert.equal(invalidRarity.stored, false, 'unknown rarity must not create an unclaimable reward');
const lockedRarity = addItemOrStore('leather-armor', 1, { rarity: 'mythic' });
assert.equal(lockedRarity.stored, false, 'boss-only rarity must require its explicit permission');
assert.equal(state.game.player.pendingLoot.length, 0, 'invalid reward options must not pollute pending loot');
// Refill every slot so the permitted mythic reward exercises the overflow path.
state.game.player.inventory = Array.from({ length: 30 }, () => ({
  id: 'iron-sword', qty: 1, rarity: 'common', bonus: {}, affixes: [], runes: []
}));
const mythicOverflow = addItemOrStore('leather-armor', 1, { rarity: 'mythic', allowMythic: true });
assert.equal(mythicOverflow.stored, true, 'permitted mythic reward should be preserved on overflow');
assert.equal(state.game.player.pendingLoot[0].rarity, 'mythic');
state.game.player.inventory = [];
const claimedMythic = claimPendingLoot(0);
assert.equal(claimedMythic.ok, true, 'permitted mythic reward must remain claimable');
assert.equal(claimedMythic.created[0].rarity, 'mythic');
assert.equal(state.game.player.pendingLoot.length, 0);

for (const entry of state.game.player.inventory) {
  assert.ok(ITEMS[entry.id], 'claimed item must exist in item catalog');
}
// A failed save while claiming must restore the exact player state and keep the reward pending.
const originalDocument = globalThis.document;
const originalStorage = globalThis.localStorage;
const originalSetTimeout = globalThis.setTimeout;
const toastMessages = [];
globalThis.document = {
  addEventListener() {},
  createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
  body: { appendChild(element) { toastMessages.push(element.textContent); } }
};
globalThis.localStorage = {
  setItem() { throw new Error('simulated storage quota failure'); }
};
globalThis.setTimeout = () => 0;
try {
  const { claimPendingLootUI } = await import('../ui/inventory.js');
  const rollbackPlayer = {
    name: 'Loot rollback hero', level: 5, gold: 0, str: 1000,
    inventory: [],
    pendingLoot: [{ id: 'leather-armor', qty: 1, allowMythic: true, seed: 0.25 }],
    spells: [], equipped: {}, stats: { kills: {} },
    campaignKills: {}, campaignClaimed: {}, activeCampaignMission: null
  };
  state.currentSlot = 1;
  state.game = { player: rollbackPlayer };
  const beforeFailedClaim = JSON.stringify(rollbackPlayer);
  claimPendingLootUI(0);
  assert.equal(JSON.stringify(rollbackPlayer), beforeFailedClaim,
    'failed persistence must roll back both the granted item and pending-loot removal');
  assert.match(toastMessages.at(-1), /не удалось сохранить награду/i,
    'failed persistence must not display a success message');
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
  if (originalSetTimeout === undefined) delete globalThis.setTimeout;
  else globalThis.setTimeout = originalSetTimeout;
}

state.game = null;
console.log('PASS overflow equipment rewards persist and can be claimed after freeing capacity');
console.log('PASS overflow stackable rewards persist and preserve quantity');
console.log('PASS pending rewards survive save serialization and invalid IDs are rejected');
console.log('check-loot-overflow: OK');
