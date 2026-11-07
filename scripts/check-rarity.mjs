import assert from 'node:assert/strict';
import { RARITIES, rollRarity } from '../data/items.js';

assert.deepEqual(
  Object.fromEntries(Object.entries(RARITIES).map(([key, value]) => [key, value.weight])),
  { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 0.9, mythic: 0.1 }
);
assert.equal(rollRarity(() => 0), 'common');
assert.equal(rollRarity(() => 0.61), 'uncommon');
assert.equal(rollRarity(() => 0.86), 'rare');
assert.equal(rollRarity(() => 0.96), 'epic');
assert.equal(rollRarity(() => 0.995), 'legendary');
assert.equal(rollRarity(() => 1), 'legendary');
assert.equal(rollRarity(() => 0.999, { allowMythic: true }), 'mythic');
console.log('Rarity distribution checks passed.');
