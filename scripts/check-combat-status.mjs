// Regression coverage for skip-turn effects in both combat directions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyEffect, tickEffects, isStunned, consumeStun, hasEffect, getAtkMult, getDefMult, getLifesteal, clearDebuffs } from '../systems/status.js';

for (const targetName of ['player', 'enemy']) {
  const target = { effects: [] };
  applyEffect(target, 'stun');
  tickEffects(target);
  assert.equal(isStunned(target), true, `${targetName} stun must survive the same-turn status tick`);
  assert.equal(consumeStun(target), true, `${targetName} stun must be consumed by the turn resolver`);
  assert.equal(isStunned(target), false, `${targetName} stun must not persist after skipping one turn`);
}

const recovering = { effects: [] };
applyEffect(recovering, 'stun');
tickEffects(recovering);
assert.equal(consumeStun(recovering), true);
assert.equal(recovering.stunImmunityTurns, 2);
applyEffect(recovering, 'stun');
assert.equal(isStunned(recovering), false, 'the next boss attack must not immediately re-stun the player');
tickEffects(recovering);
assert.equal(recovering.stunImmunityTurns, 1);
applyEffect(recovering, 'stun');
assert.equal(isStunned(recovering), false, 'stun immunity must last through the full intervening turn');
tickEffects(recovering);
assert.equal(recovering.stunImmunityTurns, 0);
applyEffect(recovering, 'stun');
assert.equal(isStunned(recovering), true, 'stun must be available again after one protected enemy turn');

const combatSource = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
assert.match(combatSource, /const actualDamage = applyPlayerDamage\(p, ow, result\.totalDamage\)/,
  'player damage-over-time feedback must use HP actually removed');
assert.match(combatSource, /text: '-' \+ actualDamage/,
  'damage-over-time floating numbers must not show overkill');

const poisoned = { effects: [] };
applyEffect(poisoned, 'poison');
const poisonTick = tickEffects(poisoned);
assert.equal(poisonTick.totalDamage, 5, 'damage-over-time effects must still tick immediately');
assert.equal(poisoned.effects[0].duration, 2, 'damage-over-time duration must still decrease');

const corruptedEffects = {
  effects: [null, 'broken-entry', { id: 'unknown-effect', duration: 3 }, { id: 'poison', duration: NaN }]
};
assert.doesNotThrow(() => applyEffect(corruptedEffects, 'burn'),
  'adding a status must tolerate malformed existing entries');
assert.equal(getAtkMult(corruptedEffects), 1, 'attack modifiers must ignore malformed entries');
assert.equal(getDefMult(corruptedEffects), 1, 'defense modifiers must ignore malformed entries');
assert.equal(getLifesteal(corruptedEffects), 0, 'lifesteal must ignore malformed entries');
assert.doesNotThrow(() => tickEffects(corruptedEffects),
  'status ticks must tolerate malformed effect entries');
assert.equal(hasEffect(corruptedEffects, 'poison'), true,
  'valid known effects must survive alongside malformed entries');
assert.equal(getAtkMult(corruptedEffects), 1);
assert.equal(getDefMult(corruptedEffects), 1);
assert.equal(getLifesteal(corruptedEffects), 0);
assert.doesNotThrow(() => clearDebuffs(corruptedEffects));
assert.ok(corruptedEffects.effects.every(effect => effect && typeof effect === 'object' && Number.isFinite(effect.duration)),
  'malformed entries must be removed before they can crash later combat ticks');

console.log('Combat status regression passed (player/enemy stun, anti-chain immunity, poison tick and malformed-entry guards).');
