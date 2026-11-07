import assert from 'node:assert/strict';
import { ITEMS, RARITIES } from '../data/items.js';
import { ENEMIES } from '../data/enemies.js';
import { NPCS } from '../data/npcs.js';
import { STORY } from '../data/story.js';
import { state } from '../systems/state.js';
import { canCraftRecipe, craftRecipe } from '../systems/crafting.js';
import { countItem } from '../systems/inventory.js';

const trophies = [
  { enemy: 'root-court-executioner', item: 'root-court-seal', recipe: 'r-briar-court-mantle', result: 'briar-court-mantle', act: 1 },
  { enemy: 'drowned-queen', item: 'drowned-lament', recipe: 'r-mourner-signet', result: 'mourner-signet', act: 2 },
  { enemy: 'oath-forge-warden', item: 'oathforge-heart', recipe: 'r-oathfire-cleaver', result: 'oathfire-cleaver', act: 3 },
  { enemy: 'mirror-icekeeper', item: 'mirror-shard', recipe: 'r-mirrorweave-cloak', result: 'mirrorweave-cloak', act: 4 },
  { enemy: 'echo-devourer', item: 'echo-core', recipe: 'r-echo-prism-amulet', result: 'echo-prism-amulet', act: 5 }
];
const allRecipes = [...NPCS.blacksmith.recipes, ...NPCS.alchemist.recipes];

for (const entry of trophies) {
  assert.ok(ITEMS[entry.item], `Trophy must be registered in ITEMS: ${entry.item}`);
  assert.ok(!Object.hasOwn(RARITIES, entry.item), `Trophy must not be registered as a rarity: ${entry.item}`);
  assert.ok(ITEMS[entry.result], `Relic must be registered in ITEMS: ${entry.result}`);
  assert.ok(!Object.hasOwn(RARITIES, entry.result), `Relic must not be registered as a rarity: ${entry.result}`);
  const enemy = ENEMIES[entry.enemy];
  const trophy = ITEMS[entry.item];
  const recipe = allRecipes.find(item => item.id === entry.recipe);
  const result = ITEMS[entry.result];
  assert.ok(enemy && enemy.boss, `Boss definition missing/invalid: ${entry.enemy}`);
  assert.equal(enemy.drops[0], entry.item, `Trophy must be guaranteed as first boss drop: ${entry.enemy}`);
  assert.ok(trophy && trophy.type === 'material', `Trophy must be a material: ${entry.item}`);
  assert.ok(result && result.bonus && result.type !== 'quest', `Crafted relic invalid: ${entry.result}`);
  assert.ok(recipe, `Recipe missing: ${entry.recipe}`);
  assert.equal(recipe.result, entry.result);
  assert.equal(recipe.qty, 1);
  assert.equal(recipe.requiredAct, entry.act, `Recipe must unlock in act ${entry.act}`);
  assert.ok(recipe.ingredients.some(ingredient => ingredient.id === entry.item && ingredient.qty === 1),
    `Recipe must consume its signature trophy: ${entry.recipe}`);
  assert.ok(recipe.ingredients.every(ingredient => ITEMS[ingredient.id] && ingredient.qty > 0),
    `Unknown/invalid ingredient in ${entry.recipe}`);
  assert.ok(!enemy.drops.some(id => ITEMS[id]?.storyShard), `Mini-boss must not drop a Rift shard: ${entry.enemy}`);
  assert.ok(!recipe.ingredients.some(ingredient => ITEMS[ingredient.id]?.storyShard),
    `Recipe must not consume a Rift shard: ${entry.recipe}`);
}

// Verify campaign-act gating in the actual crafting API.
const oldStorage = globalThis.localStorage;
const memory = new Map();
globalThis.localStorage = { setItem: (key, value) => memory.set(key, String(value)), getItem: key => memory.get(key) ?? null };
state.currentSlot = 1;
state.game = { version: 17, location: 'village', player: { level: 20, gold: 0, inventory: [], equipped: {}, campaignClaimed: {}, craftedHighTierByAct: {} } };
state.game.player.inventory = [
  { id: 'root-court-seal', qty: 1 }, { id: 'root-fiber', qty: 2 },
  { id: 'drowned-lament', qty: 1 }, { id: 'grave-salt', qty: 2 },
  { id: 'oathforge-heart', qty: 1 }, { id: 'ember-core', qty: 2 },
  { id: 'mirror-shard', qty: 1 }, { id: 'frost-essence', qty: 2 },
  { id: 'echo-core', qty: 1 }, { id: 'void-dust', qty: 3 }
];
assert.equal(canCraftRecipe('r-briar-court-mantle').ok, true, 'Act I relic should be craftable in Act I');
assert.equal(canCraftRecipe('r-mourner-signet').ok, false, 'Act II relic must be locked in Act I');
for (const mission of STORY.acts[0].missions) state.game.player.campaignClaimed[mission.id] = true;
assert.equal(canCraftRecipe('r-mourner-signet').ok, true, 'Act II relic should unlock after completing Act I');
assert.equal(canCraftRecipe('r-oathfire-cleaver').ok, false, 'Act III relic must remain gated before Act III');

// Failed persistence must restore ingredients and not grant the crafted relic.
const before = state.game.player.inventory.map(item => ({ ...item }));
globalThis.localStorage.setItem = () => { throw new Error('simulated storage failure'); };
const crafted = craftRecipe('r-briar-court-mantle');
assert.equal(crafted.ok, false, 'craft must fail when save fails');
assert.equal(countItem('root-court-seal'), 1, 'signature trophy must be restored on save failure');
assert.equal(countItem('root-fiber'), 2, 'common materials must be restored on save failure');
assert.equal(countItem('briar-court-mantle'), 0, 'failed save must not grant crafted relic');
assert.deepEqual(state.game.player.inventory, before, 'inventory snapshot must be restored atomically');

state.game = null;
if (oldStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = oldStorage;
console.log('Five mini-boss trophies, guaranteed drops, act-gated relic recipes and save rollback passed');
