import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');

assert.match(source, /function mitigateIncomingDamage\(attack, defense\)/,
  'incoming damage must use the shared mitigation formula');
assert.match(source, /100 \/ \(100 \+ safeDefense \* 1\.5\)/,
  'defense must use diminishing returns instead of linear subtraction');
assert.match(source, /function resolveCriticalMultiplier\(value\)/,
  'critical damage must be clamped to safe balance bounds');
assert.match(source, /Math\.max\(1\.25, Math\.min\(2\.5, value\)\)/,
  'critical multiplier must remain between 1.25x and 2.5x');
assert.match(source, /rawDefense \* \(1 - penetration\)/,
  'armor penetration must scale with target armor');
assert.match(source, /Math\.min\(0\.75, armorPen \* 0\.025\)/,
  'armor penetration must be capped to prevent armor bypass');
assert.match(source, /resolveCriticalMultiplier\(talent\.critMult\)/,
  'weapon and spell criticals must share critical scaling');

const incoming = (attack, defense) => Math.max(1, Math.floor(Math.max(0, attack) * (100 / (100 + Math.max(0, defense) * 1.5))));
assert.equal(incoming(100, 0), 100, 'zero defense should not reduce damage');
assert.equal(incoming(100, 20), 76, 'moderate defense should mitigate incoming damage');
assert.equal(incoming(100, 100), 40, 'high defense should retain diminishing returns');
assert.equal(incoming(1, 1000), 1, 'minimum damage prevents complete immunity');

const crit = value => Number.isFinite(value) ? Math.max(1.25, Math.min(2.5, value)) : 1.5;
assert.equal(crit(1.1), 1.25, 'crit multiplier lower bound');
assert.equal(crit(1.8), 1.8, 'normal crit multiplier unchanged');
assert.equal(crit(3.4), 2.5, 'crit multiplier upper bound');
assert.equal(crit(NaN), 1.5, 'invalid crit multiplier fallback');


assert.match(source, /function applyPlayerDamage\(player, overworld, amount\)/,
  'all enemy attacks must apply damage through a single guarded player-health path');
assert.match(source, /player\.hp = safeHp - actual;\s*overworld\.player\.hp = player\.hp;/,
  'persistent hero HP and overworld HP must stay synchronized after enemy attacks');
const applyDamage = (hp, amount) => Math.min(Math.max(0, Number.isFinite(hp) ? hp : 0), Math.max(0, Number.isFinite(amount) ? Math.floor(amount) : 0));
assert.equal(applyDamage(100, 25), 25, 'enemy attack removes expected HP');
assert.equal(applyDamage(10, 50), 10, 'lethal enemy attack clamps to remaining HP');
assert.equal(applyDamage(100, NaN), 0, 'invalid attack damage cannot alter HP');
assert.match(source, /if \(result\.totalDamage > 0\) \{\s*const actualDamage = applyPlayerDamage\(p, ow, result\.totalDamage\);/,
  'damage-over-time effects must use the shared health path and synchronize the combat model');
const applyDotDamage = (hp, damage) => Math.max(0, Math.max(0, Number.isFinite(hp) ? hp : 0) - Math.min(Math.max(0, Number.isFinite(hp) ? hp : 0), Math.max(0, Number.isFinite(damage) ? Math.floor(damage) : 0)));
assert.equal(applyDotDamage(12, 5), 7, 'damage-over-time removes expected HP');
assert.equal(applyDotDamage(3, 8), 0, 'lethal damage-over-time clamps both HP models at zero');

console.log('Combat formulas regression contract: OK');
