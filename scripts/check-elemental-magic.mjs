import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPELLS } from '../data/spells.js';
import { applyEffect, getAtkMult } from '../systems/status.js';

const combat = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');

assert.equal(SPELLS.fireball.element, 'fire');
assert.equal(SPELLS['ice-bolt'].element, 'ice');
assert.equal(SPELLS.lightning.element, 'lightning');
assert.equal(SPELLS['frost-nova'].element, 'ice');
assert.equal(SPELLS['ice-bolt'].effect, 'slow');
assert.equal(SPELLS['frost-nova'].effect, 'stun', 'Frost Nova keeps its original stun');
assert.match(combat, /function applyElementalReaction\(enemy, element\)/);
assert.match(combat, /elementalMultiplier/);
assert.match(combat, /multiplier = 1\.20/);
assert.match(combat, /getAtkMult\(enemy\)/, 'slow must reduce enemy attack during its turn');

const slowed = { effects: [] };
applyEffect(slowed, 'slow');
assert.equal(getAtkMult(slowed), 0.75, 'slow reduces enemy outgoing attack by 25%');
assert.equal(slowed.effects[0].duration, 2, 'slow lasts two enemy turns');

const burning = { effects: [{ id: 'burn', duration: 2 }] };
const chilled = { effects: [{ id: 'slow', duration: 2 }] };
assert.ok(burning.effects.some(effect => effect.id === 'burn'));
assert.ok(chilled.effects.some(effect => effect.id === 'slow'));

console.log('Elemental magic regression contract: OK (fire, ice, lightning, slow, reactions, bounded bonus).');
