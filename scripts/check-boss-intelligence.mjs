import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENEMIES } from '../data/enemies.js';
import { getEnemyCombatDecision } from '../systems/overworld/enemy-ai.js';

for (const id of ['flame-lord', 'ice-queen', 'ancient-dragon']) {
  const boss = ENEMIES[id];
  assert.ok(boss?.boss, id + ' must remain a boss');
  assert.ok(Array.isArray(boss.phases) && boss.phases.length >= 2,
    id + ' must have a mid-fight and final enrage phase');
  assert.ok(boss.phases.some(phase => phase.atHp <= 0.25),
    id + ' must transition to its final phase at low health');
  assert.ok(boss.phases.every((phase, index, phases) =>
    index === 0 || phases[index - 1].atHp > phase.atHp),
  id + ' phase thresholds must descend in order');
}

const source = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
assert.match(source, /enemy\.adaptiveCounter = \{ style, remaining: def\?\.boss \? 2 : 1 \}/,
  'bosses should retain their learned counter for two matching hits');
assert.match(source, /def\?\.boss \? 0\.12 : 0\.20/,
  'boss adaptive defense should be distinct from ordinary enemies');

let decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 1,
  blocking: true, isBoss: true
});
assert.equal(decision.action, 'telegraph');
assert.equal(decision.reason, 'punish-block');

decision = getEnemyCombatDecision({
  specialType: 'drain', specialEvery: 3, turnCount: 1,
  enemyHpRatio: 0.2, isBoss: true
});
assert.equal(decision.action, 'telegraph');
assert.equal(decision.reason, 'enrage');

decision = getEnemyCombatDecision({
  specialType: 'snipe', specialEvery: 3, turnCount: 1,
  enemyHpRatio: 0.2, isBoss: true, pendingSpecial: true
});
assert.equal(decision.action, 'special', 'prepared boss attacks must resolve before another warning');

console.log('Boss intelligence checks passed: dragon phases, persistent adaptation, block counterplay and enrage');
