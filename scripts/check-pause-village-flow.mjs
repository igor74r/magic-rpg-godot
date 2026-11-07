import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../ui/overworld.js', import.meta.url), 'utf8');
const actionStart = source.indexOf('export function owPauseSaveVillage()');
const actionEnd = source.indexOf('\nexport function owPauseExit()', actionStart);
assert.notEqual(actionStart, -1, 'pause menu must expose save-and-return-to-village');
assert.notEqual(actionEnd, -1, 'save-and-return action must have a clear boundary');
const action = source.slice(actionStart, actionEnd);

assert.match(source, /import\s*\{[\s\S]*?\benterOverworld\b[\s\S]*?\}\s*from ['"]\.\.\/systems\/overworld\.js['"]/,
  'the UI must import the overworld entry point');
assert.ok(action.indexOf('if (!saveGame())') >= 0,
  'a failed save must prevent leaving the current location');
assert.ok(action.indexOf('exitOverworld()') < action.indexOf("enterOverworld('village')"),
  'the previous location must be exited before creating the village scene');
assert.match(action, /state\.game\.location\s*=\s*'village'/,
  'the save must record the village as the current location');
assert.match(action, /if \(state\.overworld === previousOverworld\)/,
  'a cancelled combat escape must not create a second overworld');
assert.match(action, /closePauseMenu\(\)/,
  'the pause overlay must be released during the transition');

console.log('check-pause-village-flow: PASS (save, exit, persist village, enter village)');
