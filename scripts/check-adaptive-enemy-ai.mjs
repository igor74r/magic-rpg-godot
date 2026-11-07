import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');

assert.match(source, /function recordPlayerStyle\(ow, style\)/,
  'combat must record recent player styles');
assert.match(source, /playerStyleHistory/);
assert.match(source, /function prepareEnemyAdaptation\(ow, enemy\)/,
  'enemy turn must evaluate the player pattern');
assert.match(source, /recent\.filter\(value => value === candidate\)\.length >= 2/,
  'counter requires repeated style, not a single action');
assert.match(source, /style === 'melee' \? 'ближний бой'/,
  'adaptation must log a localized style message');
assert.match(source, /def\?\.boss \? 0\.12 : 0\.20/,
  'boss counter must be weaker than regular enemy counter');
assert.match(source, /enemyDefenseForStyle\(enemy, style, stats\.armorPen \|\| 0\)/,
  'basic attacks must respect adaptive defense');
assert.match(source, /recordPlayerStyle\(ow, 'magic'\)/,
  'damaging spells must be recorded as magic');
assert.match(source, /enemyDefenseForStyle\(enemy, 'magic', stats\.armorPen \|\| 0\)/,
  'magic damage must respect anti-magic adaptation');
assert.match(source, /recordPlayerStyle\(ow, 'ranged'\)/,
  'aimed shots must be recorded as ranged');
assert.match(source, /enemyDefenseForStyle\(enemy, 'ranged', stats\.armorPen \|\| 0\)/,
  'ranged damage must respect ranged adaptation');
assert.match(source, /prepareEnemyAdaptation\(ow, enemy\);/,
  'enemy must adapt during its turn');
assert.match(source, /consumeEnemyAdaptation\(enemy, style\)/,
  'adaptive defense must be consumed after one matching attack');
console.log('Adaptive enemy AI regression contract: OK');

assert.match(source, /getEnemyCombatDecision\(/,
  'enemy turns must use the tactical decision engine');
assert.match(source, /tacticalDecision\.action === 'telegraph'/,
  'special attacks must be telegraphed one turn ahead');
assert.match(source, /enemy\.tacticalSpecialPending = true/,
  'the warning must persist until the next enemy turn');
assert.match(source, /enemy\.tacticalSpecialPending = false/,
  'the prepared special must be consumed exactly once');
