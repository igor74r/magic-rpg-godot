import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { getEffStats, getSafeCount, getTotalKills, incrementSafeCount, resolveCriticalChance } from '../systems/stats.js';

const player = {
  class: 'warrior',
  str: 18, int: 4, con: 16, dex: 6,
  passives: ['start', 'warrior-might-1'],
  talents: [],
  effects: [{ id: 'strength', duration: 2 }],
  equipped: {
    weapon: {
      id: 'iron-sword', qty: 1,
      bonus: { attack: 10 },
      runes: ['rune-ember']
    }
  }
};
state.game = { player };

assert.equal(getSafeCount(5), 5);
assert.equal(getSafeCount('5'), 0);
assert.equal(getSafeCount(-1), 0);
assert.equal(getSafeCount(1.5), 0);
assert.equal(incrementSafeCount('4'), 1);
assert.equal(incrementSafeCount(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
assert.equal(getTotalKills({ goblin: 2, skeleton: 3 }), 5);
assert.equal(getTotalKills({ goblin: '10', skeleton: -5, wolf: 1.5, ghost: Number.MAX_SAFE_INTEGER + 1 }), 0,
  'HUD kill total must ignore malformed save counters');
assert.equal(getTotalKills({ goblin: Number.MAX_SAFE_INTEGER, skeleton: 1 }), Number.MAX_SAFE_INTEGER,
  'HUD kill total must saturate at the safe integer limit');
assert.equal(getTotalKills([]), 0, 'malformed kill collections must not contribute to HUD totals');

const stats = getEffStats();
assert.equal(stats.atk, 39, 'base, rolled instance, rune, effect and passive attack bonuses must stack');
assert.equal(stats.mag, 4);
assert.equal(stats.def, 8);
assert.equal(stats.dex, 6);
assert.equal(stats.armorPen, 2);
assert.ok(Math.abs(stats.critChance - 0.096) < 1e-9, 'class, dexterity and rune critical chance must stack');
assert.ok(Math.abs(stats.dodgeChance - 0.052) < 1e-9, 'class, dexterity and equipment dodge must stack');

player.equipped.weapon.bonus = {
  dodgeChance: 2,
  blockChance: 2,
  blockPower: 2,
  critChance: 2,
  armorPen: -10
};
player.passives = ['start'];
player.effects = [];
const capped = getEffStats();
assert.equal(capped.dodgeChance, 0.65, 'dodge chance must be capped');
assert.equal(capped.blockChance, 0.6, 'block chance must be capped');
assert.equal(capped.blockPower, 0.9, 'block power must be capped');
assert.equal(capped.critChance, 0.75, 'critical chance must be capped');
assert.equal(capped.armorPen, 0, 'armor penetration cannot become negative');
assert.equal(resolveCriticalChance({ critChance: 0.8 }, 0.2), 0.75);
assert.equal(resolveCriticalChance({ critChance: -1 }, -1), 0);

state.game = null;
console.log('check-stats: PASS (class, gear, rune, effect, passive stacking and combat caps)');
