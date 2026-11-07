import assert from 'node:assert/strict';
import { ENEMIES } from '../data/enemies.js';
import { LOCATIONS } from '../data/locations.js';
import { TOWER_MAX_FLOOR, getTowerLocation, getTowerMult } from '../systems/tower.js';
import { getRiftClearedCount, getRiftLocation, getRiftLocations, getRiftMult } from '../systems/rift.js';
import { state } from '../systems/state.js';
import { getNGPlusMult } from '../systems/ngplus.js';

// Validate every enemy definition used by campaign, tower and rift encounters.
for (const [id, enemy] of Object.entries(ENEMIES)) {
  assert.ok(Number.isFinite(enemy.hp) && enemy.hp > 0, `${id}: HP must be positive`);
  assert.ok(Number.isFinite(enemy.attack) && enemy.attack > 0, `${id}: attack must be positive`);
  assert.ok(Number.isFinite(enemy.defense) && enemy.defense >= 0, `${id}: defense must be non-negative`);

  if (enemy.special) {
    assert.ok(['double', 'snipe', 'drain'].includes(enemy.special.type), `${id}: unknown special type`);
    assert.ok(Number.isInteger(enemy.special.every) && enemy.special.every > 0, `${id}: special cadence must be a positive integer`);
    if (enemy.special.type === 'snipe') {
      assert.ok(Number.isFinite(enemy.special.mult) && enemy.special.mult > 0, `${id}: snipe multiplier must be positive`);
    }
  }

  if (enemy.phases) {
    assert.ok(enemy.boss || enemy.special, `${id}: phased enemy needs an encounter mechanic`);
    let previousThreshold = 1;
    for (const [index, phase] of enemy.phases.entries()) {
      assert.ok(Number.isFinite(phase.atHp) && phase.atHp > 0 && phase.atHp < previousThreshold,
        `${id}: phase ${index + 1} thresholds must descend and stay within (0, 1)`);
      assert.ok(Number.isFinite(phase.atkMult) && phase.atkMult > 0,
        `${id}: phase ${index + 1} attack multiplier must be positive`);
      if (phase.specialEvery !== undefined) {
        assert.ok(Number.isInteger(phase.specialEvery) && phase.specialEvery > 0,
          `${id}: phase ${index + 1} special cadence must be a positive integer`);
      }
      previousThreshold = phase.atHp;
    }
  }
}

// Every campaign region must reference existing enemy records.
for (const [locationId, location] of Object.entries(LOCATIONS)) {
  for (const enemyId of location.enemies || []) {
    assert.ok(ENEMIES[enemyId], `${locationId}: unknown enemy ${enemyId}`);
  }
}

// Every tower floor must resolve to a valid region and valid roster.
for (let floor = 1; floor <= TOWER_MAX_FLOOR; floor++) {
  const location = getTowerLocation(floor);
  assert.ok(location, `tower floor ${floor}: missing location`);
  assert.ok(LOCATIONS[location.sourceId], `tower floor ${floor}: unknown source region`);
  assert.ok(location.enemies.length >= 4, `tower floor ${floor}: roster is too small`);
  for (const enemyId of location.enemies) {
    assert.ok(ENEMIES[enemyId], `tower floor ${floor}: unknown enemy ${enemyId}`);
  }
  assert.equal(location.enemies.some(id => ENEMIES[id].boss), floor % 5 === 0,
    `tower floor ${floor}: guardian cadence must be every fifth floor`);
}

// All 30 rift regions must resolve, and each must have an existing source map.
const riftLocations = getRiftLocations(50);
assert.equal(riftLocations.length, 30);
for (const entry of riftLocations) {
  assert.equal(entry.unlocked, true, `${entry.id}: should unlock at level 50`);
  const location = getRiftLocation(entry.id);
  assert.ok(location, `${entry.id}: missing location data`);
  assert.ok(LOCATIONS[location.sourceId], `${entry.id}: unknown source region`);
  assert.ok(location.enemies.length > 0, `${entry.id}: no enemy roster`);
}

// Endgame difficulty and reward multipliers must be finite and monotonic.
for (const getMult of [getTowerMult, getRiftMult]) {
  let previous = getMult(1);
  for (const floor of [2, 5, 10, 20, 30, 40]) {
    const current = getMult(floor);
    for (const key of Object.keys(previous)) {
      assert.ok(Number.isFinite(current[key]) && current[key] >= previous[key],
        `${getMult.name} ${key} must remain finite and non-decreasing`);
    }
    previous = current;
  }
}
assert.equal(getTowerMult(TOWER_MAX_FLOOR).hpMult, 4.12);
assert.equal(getTowerMult(TOWER_MAX_FLOOR).atkMult, 3.145);
assert.equal(getRiftMult(1).hpMult, 1);
assert.equal(getRiftMult(1).atkMult, 1);
for (const invalidFloor of [0, -1, 1.5, NaN, Infinity, -Infinity, '5', Number.MAX_SAFE_INTEGER + 1]) {
  assert.deepEqual(getRiftMult(invalidFloor), getRiftMult(1),
    `invalid Rift floor ${String(invalidFloor)} must use safe baseline multipliers`);
}
assert.equal(getRiftClearedCount({ riftClearedLocations: ['rift-01', 'rift-01', 'unknown', 7] }), 1,
  'rift clear count must include unique known rift IDs only');
assert.equal(getRiftClearedCount({ riftClearedLocations: {} }), 0,
  'malformed rift clear collection must not crash or inflate the count');
assert.equal(getRiftMult(5).hpMult, 1.6);
assert.equal(getRiftMult(5).atkMult, 1.4);
for (const invalidFloor of [0, -1, 1.5, NaN, Infinity, -Infinity, '5', Number.MAX_SAFE_INTEGER + 1]) {
  assert.deepEqual(getTowerMult(invalidFloor), getTowerMult(1),
    `invalid Tower floor ${String(invalidFloor)} must use safe baseline multipliers`);
}
assert.deepEqual(getTowerMult(TOWER_MAX_FLOOR + 1), getTowerMult(TOWER_MAX_FLOOR),
  'valid floors above the Tower cap must remain clamped to the final floor');

const previousGame = state.game;
try {
  for (const cycle of [0, 1, 5]) {
    state.game = { player: { ngPlus: cycle } };
    const mult = getNGPlusMult();
    assert.deepEqual(mult, {
      hpMult: 1 + 0.5 * cycle,
      atkMult: 1 + 0.3 * cycle,
      goldMult: 1 + 0.3 * cycle,
      expMult: 1 + 0.3 * cycle
    });
    assert.ok(Object.values(mult).every(Number.isFinite));
  }
} finally {
  state.game = previousGame;
}

console.log('Endgame balance/configuration checks passed: enemy roster, boss phases, tower, rift and NG+ scaling.');
