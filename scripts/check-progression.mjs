import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { addExp, getExpNext, MAX_LEVEL } from '../systems/progression.js';
import { STORY } from '../data/story.js';
import { ENEMIES } from '../data/enemies.js';
import { getMissionReward } from '../systems/campaign.js';
import { migrateGame } from '../systems/save.js';

const player = {
  class: 'warrior', level: 1, exp: 25, expNext: getExpNext(1),
  maxHp: 100, hp: 80, maxMp: 50, mp: 10,
  str: 10, con: 10, dex: 5, int: 5, wis: 5,
  luck: 5, statPoints: 0, passivePoints: 0
};
state.game = { player };
const snapshot = JSON.stringify(player);
for (const invalid of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '50']) {
  addExp(invalid);
  assert.equal(JSON.stringify(player), snapshot, `invalid XP gain ${String(invalid)} must not mutate progression`);
}
player.exp = Number.MAX_SAFE_INTEGER - 10;
const overflowSnapshot = JSON.stringify(player);
addExp(100);
assert.equal(JSON.stringify(player), overflowSnapshot, 'XP total overflow must be rejected');
player.exp = 25;
player.expNext = 999999;
addExp(100);
assert.equal(player.level, 2);
assert.equal(player.exp, 0);
assert.equal(player.expNext, getExpNext(2));
assert.equal(player.statPoints, 1);
assert.equal(player.passivePoints, 1);
assert.equal(player.hp, player.maxHp);

// A malformed threshold must be repaired before adding a valid reward.
player.expNext = 0;
addExp(1);
assert.equal(player.expNext, getExpNext(player.level));
assert.ok(Number.isFinite(player.exp));
assert.ok(player.level < MAX_LEVEL);

// Invalid point balances must be repaired before level-up rewards.
for (const invalid of [NaN, Infinity, -Infinity, -1, 1.5, '7', Number.MAX_SAFE_INTEGER + 1]) {
  player.level = 1;
  player.exp = 0;
  player.expNext = getExpNext(1);
  player.statPoints = invalid;
  player.passivePoints = invalid;
  addExp(getExpNext(1));
  assert.equal(player.level, 2);
  assert.equal(player.statPoints, 1);
  assert.equal(player.passivePoints, 1);
}

// Legacy priest saves remain playable: the mana-based class must gain stats and restore MP on level-up.
const legacyPriest = {
  class: 'priest', level: 1, exp: 0, expNext: getExpNext(1),
  maxHp: 115, hp: 40, maxMp: 160, mp: 20,
  str: 6, int: 15, wis: 18, con: 10, dex: 7,
  luck: 5, statPoints: 0, passivePoints: 0
};
state.game = { player: legacyPriest };
addExp(getExpNext(1));
assert.equal(legacyPriest.level, 2);
assert.equal(legacyPriest.maxHp, 123, 'legacy priest should receive the mana-class HP growth');
assert.equal(legacyPriest.maxMp, 173, 'legacy priest should receive the mana-class MP growth');
assert.equal(legacyPriest.int, 17);
assert.equal(legacyPriest.wis, 19);
assert.equal(legacyPriest.con, 11);
assert.equal(legacyPriest.hp, legacyPriest.maxHp);
assert.equal(legacyPriest.mp, legacyPriest.maxMp, 'legacy priest mana must refill on level-up');
state.game = { player };

// Old saves keep their fractional progress when the XP curve is rebalanced.
const legacyXpSave = {
  version: 17,
  player: { level: 10, exp: 1990, expNext: 3981, equipped: {}, inventory: [] }
};
migrateGame(legacyXpSave);
assert.equal(legacyXpSave.player.expNext, getExpNext(10));
assert.equal(legacyXpSave.player.exp, 62, 'legacy XP progress ratio must be preserved');

// Simulate the campaign's guaranteed objective kills plus every turn-in reward.
// This is the minimum intended progression, without optional farming or buffs.
let campaignExp = 0;
const expectedActLevels = [10, 20, 30, 40, 50];
for (const [actIndex, act] of STORY.acts.entries()) {
  for (const mission of act.missions) {
    const enemy = ENEMIES[mission.enemyId];
    assert.ok(enemy, `${mission.id} must reference a defined enemy`);
    campaignExp += enemy.exp * mission.count;
    campaignExp += getMissionReward(mission).exp;
  }

  let simulatedLevel = 1;
  let remainingExp = campaignExp;
  while (simulatedLevel < MAX_LEVEL && remainingExp >= getExpNext(simulatedLevel)) {
    remainingExp -= getExpNext(simulatedLevel);
    simulatedLevel++;
  }
  assert.ok(
    simulatedLevel >= expectedActLevels[actIndex],
    `Act ${act.number} should naturally reach level ${expectedActLevels[actIndex]} (got ${simulatedLevel})`
  );
}

assert.equal(getExpNext(50), 535, 'level 50 should use the final campaign XP band');
assert.ok(getExpNext(51) > getExpNext(50), 'post-campaign XP requirements must continue increasing');

// The final region opens after mission 3 of Act V. Its level gate must be
// reachable from the guaranteed campaign rewards before mission 4 begins.
let beforeFinalRegionExp = 0;
for (const act of STORY.acts.slice(0, 4)) {
  for (const mission of act.missions) {
    beforeFinalRegionExp += ENEMIES[mission.enemyId].exp * mission.count;
    beforeFinalRegionExp += getMissionReward(mission).exp;
  }
}
for (const mission of STORY.acts[4].missions.slice(0, 3)) {
  beforeFinalRegionExp += ENEMIES[mission.enemyId].exp * mission.count;
  beforeFinalRegionExp += getMissionReward(mission).exp;
}
let beforeFinalRegionLevel = 1;
let beforeFinalRegionRemaining = beforeFinalRegionExp;
while (beforeFinalRegionLevel < MAX_LEVEL &&
       beforeFinalRegionRemaining >= getExpNext(beforeFinalRegionLevel)) {
  beforeFinalRegionRemaining -= getExpNext(beforeFinalRegionLevel);
  beforeFinalRegionLevel++;
}
assert.ok(beforeFinalRegionLevel >= 47,
  `Act V mission 4 region must be reachable at level 47 from guaranteed progress (got ${beforeFinalRegionLevel})`);
assert.equal(getExpNext(MAX_LEVEL), Infinity, 'level cap must stop further XP requirements');

state.game = null;
console.log('check-progression: PASS (XP guards, level-up, save thresholds and five-act pacing)');
