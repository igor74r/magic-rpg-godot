import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
const spellCombat = source.slice(
  source.indexOf("if (spell.damage) {"),
  source.indexOf("} else if (spell.heal)", source.indexOf("if (spell.damage) {"))
);

assert.match(spellCombat, /const rawDamage = Math\.max\(/,
  'spell damage must preserve the existing defense/elemental formula');
assert.match(spellCombat, /resolveCriticalChance\(stats\)/,
  'damaging spells must use the shared critical chance');
assert.match(spellCombat, /Math\.floor\(rawDamage \* resolveCriticalMultiplier\(talent\.critMult\)\)/,
  'spell critical damage must use the shared bounded class/talent critical multiplier');
assert.match(spellCombat, /type: isCrit \? 'crit' : 'damage'/,
  'critical spells must use critical floating-number presentation');
assert.match(spellCombat, /playSound\(isCrit \? 'crit' : 'cast'\)/,
  'critical spells must use critical-hit sound');
assert.match(spellCombat, /if \(isCrit\) triggerShake\(8, 0\.3\)/,
  'critical spells must trigger impact feedback');
console.log('Combat spell-critical regression checks: OK');
