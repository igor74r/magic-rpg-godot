import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
assert.match(source, /function enemyDamageMultiplier\(enemy, style\)/);
assert.match(source, /magicWeak: new Set/);
assert.match(source, /physicalWeak: new Set/);
assert.match(source, /magicResist: new Set/);
assert.match(source, /physicalResist: new Set/);
assert.match(source, /enemyDamageMultiplier\(enemy, style\)/, 'normal physical attacks use matchup multiplier');
assert.match(source, /enemyDamageMultiplier\(enemy, 'magic'\)/, 'spell damage uses matchup multiplier');
assert.match(source, /enemyDamageMultiplier\(enemy, 'ranged'\)/, 'aimed ranged attack uses matchup multiplier');
assert.match(source, /return weak \? 1\.25 : resist \? 0\.80 : 1;/, 'multipliers must stay bounded to 25% weakness and 20% resistance');
console.log('Enemy weaknesses/resistances regression contract: OK');
