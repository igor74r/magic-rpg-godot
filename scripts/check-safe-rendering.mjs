import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escapeHtml } from '../ui/screens.js';
import { state } from '../systems/state.js';
import { renderInventory, buildTooltipHTML } from '../ui/inventory.js';
import { renderSlots } from '../ui/menu.js';
import { showAchievementNotification } from '../ui/overworld.js';

assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
assert.equal(escapeHtml("O'Neil & Sons"), 'O&#39;Neil &amp; Sons');
assert.equal(escapeHtml(null), '');
assert.equal(escapeHtml(42), '42');
const menuSource = readFileSync(new URL('../ui/menu.js', import.meta.url), 'utf8');
assert.ok(menuSource.includes('setTimeout(() => URL.revokeObjectURL(url), 1000);'), 'save export must keep its object URL alive until the browser has accepted the download');
assert.ok(!menuSource.includes('  URL.revokeObjectURL(url);'), 'save export must not revoke its object URL synchronously');
const importedJobResult = '<svg onload=alert(1)>';
assert.equal(escapeHtml(importedJobResult), '&lt;svg onload=alert(1)&gt;');
const previousGame = state.game;
const previousDocument = globalThis.document;
const grid = { innerHTML: '' };
globalThis.document = { getElementById: id => id === 'slots-grid' ? grid : null };
state.game = {
  player: {
    name: 'Safe render test', class: 'warrior', level: 1, gold: 0, str: 10,
    inventory: [{
      id: 'iron-sword', qty: 1, rarity: '" onmouseover="alert(1)',
      forgeLevel: '<svg onload=alert(1)>',
      affixes: [{ name: '<img src=x onerror=alert(1)>' }],
      runes: [], sockets: 1
    }],
    equipped: {
      weapon: {
        id: 'iron-sword', qty: 1, rarity: 'common',
        forgeLevel: '<svg onload=alert(2)>',
        affixes: [{ name: '<script>alert(2)</script>' }],
        runes: [], sockets: 1
      }
    },
    pendingLoot: [{ id: 'health-potion', qty: '<img src=x onerror=alert(3)>' }]
  }
};
try {
  const slotData = {
    player: { name: '<img src=x onerror=alert(9)>', class: 'mage', level: 4 },
    location: 'village'
  };
  globalThis.localStorage = {
    getItem: key => key === 'magic-rpg-save-1' ? JSON.stringify(slotData) : null
  };
  renderSlots();
  assert.ok(grid.innerHTML.includes('&lt;img src=x onerror=alert(9)&gt;'), 'save-slot character names must be escaped');
  assert.ok(!grid.innerHTML.includes('<img src=x onerror=alert(9)>'), 'imported character name must not inject markup');


  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousSetTimeout = globalThis.setTimeout;
  const notificationElement = { style: {}, innerHTML: '', remove() {} };
  globalThis.document = {
    getElementById: id => id === 'slots-grid' ? grid : null,
    createElement: () => notificationElement,
    body: { appendChild() {} }
  };
  globalThis.requestAnimationFrame = callback => callback();
  globalThis.setTimeout = () => 0;
  showAchievementNotification({
    name: '<img src=x onerror=alert(10)>',
    desc: '<svg onload=alert(11)>',
    icon: '<script>alert(12)</script>'
  });
  assert.ok(notificationElement.innerHTML.includes('&lt;img src=x onerror=alert(10)&gt;'), 'achievement names must be escaped');
  assert.ok(notificationElement.innerHTML.includes('&lt;svg onload=alert(11)&gt;'), 'achievement descriptions must be escaped');
  assert.ok(notificationElement.innerHTML.includes('&lt;script&gt;alert(12)&lt;/script&gt;'), 'achievement icons must be escaped');
  assert.ok(!notificationElement.innerHTML.includes('<img src=x onerror=alert(10)>'), 'achievement payload must not inject markup');
  if (previousRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
  else globalThis.requestAnimationFrame = previousRequestAnimationFrame;
  if (previousSetTimeout === undefined) delete globalThis.setTimeout;
  else globalThis.setTimeout = previousSetTimeout;

  const inventoryHtml = renderInventory();
  const importedTooltip = buildTooltipHTML(state.game.player.inventory[0]);
  assert.ok(importedTooltip.includes('&lt;img src=x onerror=alert(1)&gt;'), 'imported affix name must be escaped in tooltip');
  assert.ok(inventoryHtml.includes('&lt;script&gt;alert(2)&lt;/script&gt;'), 'equipped affix name must be escaped');
  assert.ok(!importedTooltip.includes('<img src=x onerror=alert(1)>'), 'raw imported affix HTML must not enter tooltip markup');
  assert.ok(!inventoryHtml.includes('<img src=x onerror=alert(1)>'), 'raw affix HTML must not enter inventory markup');
  assert.ok(!inventoryHtml.includes('<svg onload=alert(1)>'), 'invalid forge levels must not enter inventory markup');
  assert.ok(!inventoryHtml.includes('onmouseover="alert(1)'), 'invalid rarity must not enter class attributes');
  assert.ok(!inventoryHtml.includes('<img src=x onerror=alert(3)>'), 'invalid pending-loot quantities must not enter markup');
} finally {
  state.game = previousGame;
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}
console.log('check-safe-rendering: PASS (text, quotes and markup are escaped)');
