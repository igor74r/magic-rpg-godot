import assert from 'node:assert/strict';
import { getEnemyCombatRole, getEnemyCombatDecision, getEnemyEngagementRange, interruptEnemyTelegraph } from '../systems/overworld/enemy-ai.js';

assert.equal(getEnemyCombatRole('snipe'), 'marksman', 'snipe enemies should use the marksman role');
assert.equal(getEnemyCombatRole('double'), 'bruiser', 'double-strike enemies should use the bruiser role');
assert.equal(getEnemyCombatRole('drain'), 'leech', 'drain enemies should use the leech role');
assert.equal(getEnemyCombatRole(null), 'skirmisher', 'ordinary enemies should use the skirmisher role');

assert.equal(getEnemyEngagementRange('snipe'), 118, 'marksmen should engage from ranged distance');
assert.equal(getEnemyEngagementRange('drain'), 76, 'leech enemies should engage at medium distance');
assert.equal(getEnemyEngagementRange('double'), 48, 'bruisers should close in before engaging');
assert.equal(getEnemyEngagementRange(null), 44, 'ordinary enemies should retain contact engagement');


let decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 1, playerHpRatio: 0.3
});
assert.deepEqual(decision, { role: 'marksman', action: 'telegraph', reason: 'opening' },
  'marksman should warn before exploiting a low-health opening');
decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 2, pendingSpecial: true
});
assert.equal(decision.action, 'special', 'a telegraphed attack must resolve on the next enemy turn');

decision = getEnemyCombatDecision({
  specialType: 'double', specialEvery: 3, turnCount: 1, blocking: true
});
assert.equal(decision.role, 'bruiser');
assert.equal(decision.reason, 'opening', 'bruisers should recognize a defensive stance as an opening');

decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 1,
  blocking: true, isBoss: true
});
assert.equal(decision.action, 'telegraph', 'bosses should prepare a counter when the player blocks');
assert.equal(decision.reason, 'punish-block');

decision = getEnemyCombatDecision({
  specialType: 'drain', specialEvery: 3, turnCount: 1,
  enemyHpRatio: 0.2, isBoss: true
});
assert.equal(decision.action, 'telegraph', 'bosses should enter an enrage sequence below 25% health');
assert.equal(decision.reason, 'enrage');


decision = getEnemyCombatDecision({
  specialType: 'drain', specialEvery: 3, turnCount: 1, enemyHpRatio: 0.4
});
assert.equal(decision.action, 'telegraph', 'leech enemies should prepare drain when critically injured');

decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 3
});
assert.equal(decision.reason, 'cadence', 'scheduled specials should still occur on their configured cadence');
assert.equal(getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 3, pendingSpecial: true
}).action, 'special', 'pending specials should take priority over another telegraph');

decision = getEnemyCombatDecision({
  specialType: 'double', specialEvery: 0, turnCount: 3, blocking: true
});
assert.equal(decision.action, 'attack', 'invalid special cadence must safely fall back to a basic attack');


decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 4, turnCount: 1, playerHpRatio: 0.42
});
assert.equal(decision.reason, 'opening', 'marksmen should telegraph when the player is vulnerable, not nearly defeated');

decision = getEnemyCombatDecision({
  specialType: 'double', specialEvery: 4, turnCount: 1, enemyHpRatio: 0.25
});
assert.equal(decision.reason, 'survival', 'non-leech enemies should telegraph a survival move at critical health');

// Invalid telemetry must not manufacture a low-health tactical opening.
decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 1,
  playerHpRatio: Number.NaN, enemyHpRatio: Number.POSITIVE_INFINITY
});
assert.equal(decision.action, 'attack',
  'non-finite health ratios should be treated as healthy/neutral');
decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: Number.NaN,
  playerHpRatio: -10
});
assert.equal(decision.action, 'telegraph',
  'finite out-of-range low player HP should be clamped to zero');
decision = getEnemyCombatDecision({
  specialType: 'double', specialEvery: 3, turnCount: Number.POSITIVE_INFINITY,
  enemyHpRatio: 10
});
assert.equal(decision.action, 'attack',
  'invalid turn count and over-max enemy HP should not trigger specials');

// Threshold boundaries keep boss enrage and player counterplay deterministic.
decision = getEnemyCombatDecision({
  specialType: 'drain', specialEvery: 4, turnCount: 1,
  enemyHpRatio: 0.25, isBoss: true, blocking: true
});
assert.equal(decision.action, 'telegraph');
assert.equal(decision.reason, 'enrage',
  'boss enrage should take priority when enrage and block-punish overlap');
decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 4, turnCount: 1,
  playerHpRatio: 0.45
});
assert.equal(decision.reason, 'opening',
  'marksman vulnerability threshold should include exactly 45% HP');
decision = getEnemyCombatDecision({
  specialType: 'drain', specialEvery: 4, turnCount: 1,
  enemyHpRatio: 0.50
});
assert.equal(decision.reason, 'opening',
  'leech recovery threshold should include exactly 50% HP');

// Stun must cancel a queued special, including a boss telegraph.
const interruptedBoss = { tacticalSpecialPending: true };
assert.equal(interruptEnemyTelegraph(interruptedBoss), true,
  'stun should report that it interrupted a prepared boss special');
assert.equal(interruptedBoss.tacticalSpecialPending, false,
  'an interrupted special must not fire after the boss recovers');
assert.equal(interruptEnemyTelegraph(interruptedBoss), false,
  'interrupting an already-cleared telegraph must be idempotent');
assert.equal(interruptEnemyTelegraph(null), false,
  'missing enemy state must be handled safely');

console.log('Enemy tactical checks passed: archetype roles, telegraphs, counterplay, openings and special cadence');
