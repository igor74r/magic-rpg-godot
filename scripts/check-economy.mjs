import assert from 'node:assert/strict';
import { ITEMS } from '../data/items.js';
import { STORY } from '../data/story.js';
import { getCurrentActIndex, getActPriceMultiplier, getBuyPrice, getSellPrice, getGoldRewardTotals } from '../systems/economy.js';
import { getMissionReward } from '../systems/campaign.js';
import { state } from '../systems/state.js';
import { buyItem, buybackItem, getBuybackItems, sellItemsByIndices } from '../systems/shop.js';
import { NPCS } from '../data/npcs.js';
import { createFactionState, changeFactionReputation } from '../systems/factions.js';

const player = { campaignClaimed: {} };
assert.deepEqual(getGoldRewardTotals({ gold: 10, stats: { goldEarned: 20 } }, 5),
  { gold: 15, goldEarned: 25 });
for (const invalid of [
  { gold: Number.MAX_SAFE_INTEGER, stats: { goldEarned: 0 } },
  { gold: 0, stats: { goldEarned: Number.MAX_SAFE_INTEGER } },
  { gold: Infinity, stats: { goldEarned: 0 } },
  { gold: 0, stats: { goldEarned: NaN } }
]) {
  assert.equal(getGoldRewardTotals(invalid, 1), null,
    'world and campaign rewards must reject unsafe balance or lifetime-stat totals');
}
assert.equal(getCurrentActIndex(player), 0);
assert.equal(getActPriceMultiplier(player), 1);
assert.equal(getBuyPrice('health-potion', player), ITEMS['health-potion'].price);
const factionPricingGame = { factions: createFactionState() };
assert.equal(getBuyPrice('health-potion', player, factionPricingGame), ITEMS['health-potion'].price);
changeFactionReputation(factionPricingGame, 'free-traders', 30, 'test', 'test');
assert.equal(getBuyPrice('health-potion', player, factionPricingGame), Math.round(ITEMS['health-potion'].price * 0.95));
changeFactionReputation(factionPricingGame, 'free-traders', 40, 'test', 'test');
assert.equal(getBuyPrice('health-potion', player, factionPricingGame), Math.round(ITEMS['health-potion'].price * 0.90));
changeFactionReputation(factionPricingGame, 'free-traders', 20, 'test', 'test');
assert.equal(getBuyPrice('health-potion', player, factionPricingGame), Math.round(ITEMS['health-potion'].price * 0.85));
changeFactionReputation(factionPricingGame, 'free-traders', -100, 'test', 'test');
assert.equal(getBuyPrice('health-potion', player, factionPricingGame), ITEMS['health-potion'].price);
assert.equal(getBuyPrice('old-archive-seal', player), 0);
assert.equal(getBuyPrice('missing-item', player), 0);
assert.equal(getSellPrice({ id: 'old-archive-seal', qty: 1 }, player), 0);
assert.equal(getBuyPrice('shard-flame', player), 0);
assert.equal(getSellPrice({ id: 'shard-flame', qty: 1 }, player), 0);
assert.equal(getSellPrice({ id: 'iron-sword', rarity: 'mythic' }, player), 0);
assert.equal(getSellPrice({ id: 'iron-sword', rarity: 'epic' }, player), Math.floor(150 * 0.35));
assert.ok(getSellPrice({ id: 'health-potion', qty: 3 }, player) >= 3);
assert.equal(getSellPrice({ id: 'scroll-lightning', qty: 3 }, player),
  Math.floor(ITEMS['scroll-lightning'].price * 0.35) * 3,
  'selling a stack of spell scrolls must pay for every scroll');

for (let act = 0; act < STORY.acts.length; act++) {
  const missions = STORY.acts[act].missions;
  for (const mission of missions) {
    player.campaignClaimed[mission.id] = true;
  }
  if (act < 4) {
    assert.equal(getCurrentActIndex(player), act + 1);
    assert.equal(getActPriceMultiplier(player), [1, 1.2, 1.4, 1.6, 1.8][act + 1]);
  }
}
assert.equal(getCurrentActIndex(player), 4);
assert.equal(getBuyPrice('health-potion', player), Math.round(ITEMS['health-potion'].price * 1.8));
assert.equal(getSellPrice({ id: 'health-potion', qty: 1 }, player), Math.floor(ITEMS['health-potion'].price * 1.8 * 0.35));
assert.equal(getSellPrice({ id: 'scroll-lightning', qty: 3 }, player),
  Math.floor(ITEMS['scroll-lightning'].price * 1.8 * 0.35) * 3,
  'scroll stack sale price must scale with the current campaign act');


// Direct purchase calls must respect the merchant's actual stock, not just item prices.
const originalStorage = globalThis.localStorage;
const saved = new Map();
globalThis.localStorage = { setItem: (key, value) => saved.set(key, String(value)) };
state.currentSlot = 1;
state.game = { version: 17, player: { gold: 1000, str: 10, inventory: [], stats: { kills: {} } } };
const buyer = state.game.player;
assert.ok(getBuyPrice('steel-sword', buyer) > 0);
assert.equal(NPCS.merchant.stock.includes('steel-sword'), false);
assert.equal(buyItem('steel-sword'), false, 'unlisted gear must not be purchasable through the public API');
assert.equal(buyer.gold, 1000);
assert.equal(buyer.inventory.length, 0);
ITEMS['test-free-material'] = { name: 'Test material', type: 'material' };
NPCS.merchant.stock.push('test-free-material');
assert.equal(buyItem('test-free-material'), false, 'zero-price items must not be purchasable for free');
assert.equal(buyer.gold, 1000);
assert.equal(buyer.inventory.length, 0);
NPCS.merchant.stock.pop();
delete ITEMS['test-free-material'];
buyer.gold = Number.MAX_SAFE_INTEGER + 1;
assert.equal(buyItem('iron-sword'), false, 'shop must reject unsafe gold balances');
buyer.gold = 1000;
assert.equal(buyItem('iron-sword'), true, 'listed stock must remain purchasable');
assert.equal(buyer.gold, 1000 - getBuyPrice('iron-sword', buyer));
assert.equal(buyer.inventory[0]?.id, 'iron-sword');
buyer.buyback = [{ id: 'bad-price', soldAt: new Date().toDateString(), price: -500, item: { id: 'iron-sword', qty: 1 } }];
assert.equal(buybackItem(0).ok, false, 'zero buyback price must be rejected');
assert.equal(buybackItem(0).ok, false, 'negative buyback price must be rejected');
assert.equal(buyer.gold, 1000 - getBuyPrice('iron-sword', buyer), 'invalid buyback must not create gold');
buyer.buyback = [{ id: 'bad-qty', soldAt: new Date().toDateString(), price: 1, item: { id: 'iron-sword', qty: 0 } }];
assert.equal(buybackItem(0).ok, false, 'zero buyback quantity must be rejected');
buyer.buyback = [{ id: 'bad-equipment-qty', soldAt: new Date().toDateString(), price: 1, item: { id: 'iron-sword', qty: 2 } }];
assert.equal(buybackItem(0).ok, false, 'non-stackable buyback quantity must be exactly one');
buyer.buyback = [null, { soldAt: new Date().toDateString(), price: 1 }, { soldAt: new Date().toDateString(), price: 1, item: { id: 'iron-sword', qty: 1 } }];
assert.equal(getBuybackItems().length, 1, 'shop should hide malformed buyback records');
buyer.gold = Number.MAX_SAFE_INTEGER + 1;
assert.equal(buybackItem(0).ok, false, 'buyback must reject unsafe gold balances');
buyer.gold = 1000;
assert.equal(buybackItem(0).ok, true, 'valid buyback remains selectable after malformed records are filtered');
assert.equal(buyer.inventory.length, 2, 'valid buyback restores one item');
assert.equal(getBuybackItems().length, 0, 'claimed buyback record is removed');

// Zero-value or malformed catalog entries must not disappear in a mixed sale.
ITEMS['test-no-price-material'] = { name: 'Test material', type: 'material' };
buyer.inventory = [
  { id: 'test-no-price-material', qty: 1 },
  { id: 'iron-sword', qty: 1, rarity: 'common' }
];
const mixedSale = sellItemsByIndices([0, 1]);
assert.equal(mixedSale.ok, true);
assert.equal(buyer.inventory.length, 1);
assert.equal(buyer.inventory[0].id, 'test-no-price-material',
  'an item with no sale value must remain in inventory');
delete ITEMS['test-no-price-material'];

// Malformed stack quantities and unsafe sale totals must never mint infinite gold.
assert.equal(getSellPrice({ id: 'health-potion', qty: Infinity }, buyer), 0);
assert.equal(getSellPrice({ id: 'health-potion', qty: Number.MAX_SAFE_INTEGER }, buyer), 0);
buyer.inventory = [{ id: 'health-potion', qty: Infinity }];
const malformedSale = sellItemsByIndices([0], { confirmed: true });
assert.equal(malformedSale.ok, false);
assert.equal(buyer.inventory.length, 1, 'malformed stack must remain in inventory');
buyer.inventory = [{ id: 'iron-sword', qty: 1, rarity: 'common' }];
buyer.gold = Number.MAX_SAFE_INTEGER;
const overflowSale = sellItemsByIndices([0], { confirmed: true });
assert.equal(overflowSale.ok, false, 'sale must reject a balance overflow');
assert.equal(buyer.gold, Number.MAX_SAFE_INTEGER);
assert.equal(buyer.inventory.length, 1, 'overflowing sale must not remove the item');
buyer.gold = 1000;

// Sale proceeds must also fit the persistent earned-gold counter.
buyer.inventory = [{ id: 'iron-sword', qty: 1, rarity: 'common' }];
buyer.stats.goldEarned = Number.MAX_SAFE_INTEGER;
const overflowEarnedGold = sellItemsByIndices([0], { confirmed: true });
assert.equal(overflowEarnedGold.ok, false, 'sale must reject earned-gold statistics overflow');
assert.equal(buyer.stats.goldEarned, Number.MAX_SAFE_INTEGER);
assert.equal(buyer.inventory.length, 1, 'overflowing earned-gold statistics must not remove the item');
buyer.stats.goldEarned = 0;
buyer.gold = 1000;

// A failed storage write must roll back bulk sale and buyback as one transaction.
buyer.inventory = [{ id: 'iron-sword', qty: 1, rarity: 'common' }];
buyer.buyback = [{ id: 'prior-record', soldAt: new Date().toDateString(), price: 50, item: { id: 'health-potion', qty: 1 } }];
buyer.stats.goldEarned = 7;
const saleBefore = {
  inventory: JSON.stringify(buyer.inventory), gold: buyer.gold,
  buyback: JSON.stringify(buyer.buyback), goldEarned: buyer.stats.goldEarned
};
globalThis.localStorage.setItem = () => { throw new Error('simulated storage quota'); };
const failedSale = sellItemsByIndices([0], { confirmed: true });
assert.equal(failedSale.ok, false, 'sale must report a storage failure');
assert.equal(JSON.stringify(buyer.inventory), saleBefore.inventory, 'failed sale must restore the exact inventory');
assert.equal(buyer.gold, saleBefore.gold, 'failed sale must restore gold');
assert.equal(JSON.stringify(buyer.buyback), saleBefore.buyback, 'failed sale must restore buyback records');
assert.equal(buyer.stats.goldEarned, saleBefore.goldEarned, 'failed sale must restore earned-gold statistics');

buyer.inventory = [];
buyer.gold = 1000;
buyer.buyback = [{
  id: 'retry-buyback', soldAt: new Date().toDateString(), price: 50,
  item: { id: 'iron-sword', qty: 1, rarity: 'common' }
}];
const buybackBefore = { gold: buyer.gold, buyback: JSON.stringify(buyer.buyback) };
const failedBuyback = buybackItem(0);
assert.equal(failedBuyback.ok, false, 'buyback must report a storage failure');
assert.equal(buyer.inventory.length, 0, 'failed buyback must not grant an unpersisted item');
assert.equal(buyer.gold, buybackBefore.gold, 'failed buyback must restore gold');
assert.equal(JSON.stringify(buyer.buyback), buybackBefore.buyback, 'failed buyback must preserve its retryable record');
globalThis.localStorage.setItem = (key, value) => saved.set(key, String(value));

state.game = null;
if (originalStorage === undefined) delete globalThis.localStorage;
else globalThis.localStorage = originalStorage;

const rewards = [1, 2, 3, 4, 5].map(act => getMissionReward({ id: `a${act}-m1` }));
assert.deepEqual(rewards.map(r => r.gold), [18, 32, 50, 72, 100]);
assert.deepEqual(rewards.map(r => r.exp), [70, 145, 250, 390, 570]);
console.log('Economy checks passed');
