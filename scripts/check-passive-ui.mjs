import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../ui/passives.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/rpg-overhaul.css', import.meta.url), 'utf8');

for (const contract of [
  'export function passiveTreeZoom(delta)',
  'export function passiveTreeResetView()',
  'export function passiveTreeKeyDown(e)',
  'aria-label="Управление масштабом древа"',
  'aria-live="polite"',
  'tabindex="0" role="group"',
  'data-x="${node.x}" data-y="${node.y}"',
  "e.key === 'Home'",
  "e.key === 'End'",
  "'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'",
  "e.key === '0'"
]) {
  assert.ok(ui.includes(contract), `passive tree UI is missing: ${contract}`);
}

assert.match(ui, /<canvas class="passive-lines"/, 'passive connections must use a canvas rather than SVG');
assert.match(ui, /function drawPassiveLines\(connections\)/);
assert.match(ui, /imageSmoothingEnabled = false/);
assert.equal(ui.includes('<svg'), false, 'passive tree must not emit SVG markup');
assert.equal(ui.includes('</svg>'), false, 'passive tree must not emit SVG markup');

assert.match(ui, /treeZoom = Math\.max\(0\.65, Math\.min\(1\.6/);
assert.match(ui, /best\?\.focus\(\)/);

assert.equal(ui.includes('<svg'), false, 'passive tree must not render inline SVG');
assert.equal(ui.includes('</svg>'), false, 'passive tree must not render inline SVG');
assert.match(css, /\.passive-lines\s*\{[^}]*image-rendering:\s*pixelated/s);
assert.equal(css.includes('.passive-lines line'), false, 'canvas connections must not retain SVG line styles');
assert.equal(css.includes('filter:drop-shadow(0 0 2px'), false, 'passive connections must not use blur shadows');

assert.match(css, /\.passive-tree-viewport:focus-visible/);
assert.match(css, /\.passive-tree-viewport \.passive-node:focus-visible/);
assert.match(css, /@media \(max-width:600px\)/);
assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);

console.log('Passive tree UI accessibility checks passed');

assert.ok(ui.includes('aria-disabled="${!available}"'), 'locked nodes must expose aria-disabled without removing keyboard focus');
assert.doesNotMatch(ui, /(?<!aria-)disabled="\$\{!available\}"/, 'locked nodes must not use native disabled');