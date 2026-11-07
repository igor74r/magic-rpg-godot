// Regression checks for boss phase health UI and readable special-attack warnings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../ui/overworld/combat-panel.js', import.meta.url), 'utf8');
assert.match(source, /combat-boss-status/, 'bosses must receive a dedicated phase/status panel');
assert.match(source, /role="progressbar"/, 'boss health must expose an accessible progress bar');
assert.match(source, /aria-valuenow=/, 'boss health progress must expose its current value');
assert.match(source, /def\.phases \|\| \[\]/, 'phase transition thresholds must be visible on the health bar');
assert.match(source, /tacticalSpecialPending/, 'prepared special attacks must be surfaced in the combat HUD');
assert.match(source, /удар подготовлен/, 'the player must receive a clear warning before the prepared attack resolves');
assert.match(source, /c\.enemy\.phase \|\| 0/, 'phase changes must invalidate the cached combat panel');
assert.match(source, /specialEvery/, 'special-attack countdown must follow the active boss phase cadence');

console.log('Combat boss UI checks passed: phase health bar, threshold markers, accessible progress and telegraph warnings');
