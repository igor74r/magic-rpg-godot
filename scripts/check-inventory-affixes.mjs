import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inventoryUI = await readFile(new URL('../ui/inventory.js', import.meta.url), 'utf8');
const inventoryCSS = await readFile(new URL('../css/rpg-overhaul.css', import.meta.url), 'utf8');
assert.ok(inventoryUI.includes('function filterBarHTML(counts, rarityCounts)'), 'inventory filters should display category totals');
assert.match(inventoryUI, /class="inv-filter-count"/, 'filter totals need a dedicated visual counter');
assert.match(inventoryUI, /class="inv-empty-state" role="status"/, 'empty inventory filters should explain the empty state accessibly');
assert.match(inventoryCSS, /\.inv-filter-count/);
assert.match(inventoryCSS, /\.inv-empty-state/);
assert.match(inventoryUI, /class="compare-heading"/, 'equipment comparison should identify the equipped item and slot');
assert.match(inventoryUI, /class="compare-rarity-row"/, 'comparison should show current and candidate rarity');
assert.ok(inventoryUI.includes('class="compare-verdict ${directionClass}"'), 'comparison should summarize upgrade/downgrade/equivalent');
assert.match(inventoryCSS, /\.tooltip-compare \.compare-heading/);
assert.match(inventoryCSS, /\.tooltip-compare \.compare-rarity-row/);
assert.match(inventoryCSS, /\.tooltip-compare \.compare-verdict\.compare-up/);

import { state } from '../systems/state.js';
import { ITEMS, RARITIES, rollRarity, rollItemAffixes } from '../data/items.js';
import { addItem, canAddItem, countItem, removeItem, useItem, getInventoryWeight } from '../systems/inventory.js';
import { craftRecipe } from '../systems/crafting.js';
import { NPCS } from '../data/npcs.js';

assert.deepEqual(Object.keys(RARITIES), ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
assert.deepEqual(Object.values(RARITIES).map(rarity => rarity.weight), [60, 25, 10, 4, 0.9, 0.1]);
assert.equal(rollRarity(() => 0), 'common');
assert.equal(rollRarity(() => 0.61), 'uncommon');
assert.equal(rollRarity(() => 0.86), 'rare');
assert.equal(rollRarity(() => 0.96), 'epic');
assert.equal(rollRarity(() => 0.995), 'legendary');
assert.equal(rollRarity(() => 0.9999, { allowMythic: true }), 'mythic');

const sword = ITEMS['iron-sword'];
assert.deepEqual(Object.values(RARITIES).map(rarity => rollItemAffixes(sword, Object.keys(RARITIES)[rarity.tier - 1], () => 0).length), [0, 1, 2, 3, 4, 5]);
assert.equal(new Set(rollItemAffixes(sword, 'mythic', () => 0).map(x => x.id)).size, 5);
for (const type of ['weapon','head','shoulders','chest','gloves','legs','boots','shield','ring','amulet','cloak']) {
  assert.equal(rollItemAffixes({ type }, 'mythic', () => 0).length, 5, `T6 affix pool missing for ${type}`);
}

state.game = { player: { inventory: [], gold: 0, equipped: {} } };
const legendary = addItem('iron-sword', 1, { rarity: 'legendary', random: () => 0 })[0];
assert.equal(legendary.rarity, 'legendary');
assert.equal(legendary.affixes.length, 4);
assert.ok(legendary.bonus.attack >= sword.bonus.attack);
assert.equal(canAddItem('health-potion', 0.5).ok, false, 'fractional quantities must be rejected');
assert.equal(canAddItem('health-potion', 1.5).ok, false, 'fractional quantities must be rejected');
assert.equal(getInventoryWeight({ inventory: [
  { id: 'unknown-weight-test', qty: -50 },
  { id: 'unknown-weight-test', qty: Number.NaN }
] }), 2, 'invalid stack counts must use safe unit quantities and never subtract weight');

assert.deepEqual(addItem('health-potion', 0.5), [], 'fractional quantities must not silently round down');
assert.deepEqual(addItem('health-potion', 1.5), [], 'fractional quantities must not silently round down');

state.game.player.inventory = [
  { id: 'herb-life', qty: 2 },
  { id: 'herb-life', qty: 3 }
];
assert.equal(countItem('herb-life'), 5);
assert.equal(removeItem('herb-life', 4), true);
assert.equal(countItem('herb-life'), 1);
assert.equal(removeItem('herb-life', 2), false);
assert.equal(countItem('herb-life'), 1);
assert.equal(removeItem('herb-life', 0), false);
assert.equal(removeItem('herb-life', 1.5), false);

for (const recipe of NPCS.alchemist.recipes) {
  assert.ok(ITEMS[recipe.result], `missing recipe result: ${recipe.id}`);
  for (const ingredient of recipe.ingredients) {
    assert.ok(ITEMS[ingredient.id], `missing ingredient: ${recipe.id}/${ingredient.id}`);
  }
}

globalThis.localStorage = {
  setItem() {},
  getItem() { return null; },
  removeItem() {}
};
state.game.player.inventory = [
  { id: 'root-fiber', qty: 3 },
  { id: 'herb-life', qty: 1 }
];
const crafted = craftRecipe('r-rune-root');
assert.equal(crafted.ok, true);
assert.equal(countItem('root-fiber'), 0);
assert.equal(countItem('herb-life'), 0);
assert.equal(countItem('rune-root'), 1);

// A consumable or scroll must be owned before its effect can be applied.
state.game.player = {
  hp: 20, maxHp: 100, mp: 0, maxMp: 100,
  inventory: [], spells: [], equipped: {}
};
assert.equal(useItem('health-potion'), false, 'cannot use a potion that is not owned');
assert.equal(state.game.player.hp, 20, 'missing potion must not apply its effect');
assert.equal(countItem('health-potion'), 0);

state.game.player.inventory = [{ id: 'health-potion', qty: 1 }];
assert.equal(useItem('health-potion'), true, 'owned potion should be usable');
assert.equal(state.game.player.hp, 100, 'owned potion should apply its effect');
assert.equal(countItem('health-potion'), 0, 'using a potion must consume exactly one item');

state.game.player.inventory = [{ id: 'health-potion', qty: 2 }];
state.game.player.hp = 0;
assert.equal(useItem('health-potion'), true);
assert.equal(countItem('health-potion'), 1, 'using one potion from a stack must leave the remainder');
assert.equal(state.game.player.hp, 80);

state.game = null;
console.log('Inventory, affix and crafting checks passed');

assert.match(inventoryUI, /data-inv-rarity/, 'inventory should expose rarity quick filters');
assert.match(inventoryUI, /invRarityFilter !== 'all'/, 'rarity selection must affect filtered entries');
assert.match(inventoryCSS, /\.inv-rarity-chip\.active/, 'active rarity filter should be visibly selected');
