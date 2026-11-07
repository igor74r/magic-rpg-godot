import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENEMIES } from '../data/enemies.js';
import { PARTICLE_PRESETS } from '../systems/overworld/particles.js';

const combat = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../ui/overworld/render.js', import.meta.url), 'utf8');

for (const effect of ['slash', 'arrow', 'fire', 'ice', 'blood', 'arcane', 'guard', 'impact']) {
  assert.ok(PARTICLE_PRESETS[effect], effect + ' combat effect preset must exist');
}
assert.match(combat, /p\.class === 'archer' \? 'arrow' : 'slash'/,
  'weapon attacks must show class-appropriate hit effects');
assert.match(combat, /playerGuarding && \(def\.boss \|\| enemy\.elite\) && p\.hp > 0 && enemy\.hp > 0/,
  'manual block should trigger a safe counterattack');
assert.match(combat, /Контратака из блока/,
  'counterattack must be communicated to the player');
assert.match(combat, /signatureEffect/,
  'boss signature attacks must use elemental visual effects');
assert.match(combat, /spellBurst/,
  'elemental spells must use matching visual effects');
assert.match(renderer, /for \(const part of ow\.particles \|\| \[\]\)/,
  'combat particles must be drawn by the overworld renderer');

assert.equal(ENEMIES['flame-lord'].special.element, 'fire');
assert.equal(ENEMIES['ice-queen'].special.element, 'ice');
assert.equal(ENEMIES['ice-queen'].special.effect, 'slow',
  'the ice dragon signature attack should slow the player');
assert.equal(ENEMIES['ancient-dragon'].special.type, 'drain',
  'the final dragon should have a distinct life-draining signature attack');
assert.equal(ENEMIES['ancient-dragon'].special.name, 'Кровавый пир');
assert.equal(ENEMIES['ancient-dragon'].special.element, 'blood');

console.log('Combat visuals and counterplay checks passed');
