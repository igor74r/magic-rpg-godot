import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const css = await readFile('css/dashboard-refresh.css', 'utf8');
const link = html.indexOf('css/dashboard-refresh.css');
assert.ok(link > html.indexOf('css/2d-art-direction.css'), 'dashboard refresh must load after existing visual layers');
assert.match(html, /id="screen-game" class="screen screen-dashboard"/, 'dashboard root hook must remain stable');
for (const selector of [
  '#screen-game .dashboard-layout',
  '#screen-game .dashboard-sidebar',
  '#screen-game .dashboard-main',
  '#screen-game .dashboard-log',
  '#screen-game #overworld-canvas',
  '#dashboard-tab-modal .dashboard-tab-dialog'
]) assert.ok(css.includes(selector), `missing refreshed layout selector: ${selector}`);
assert.match(css, /grid-template-columns:\s*minmax\(194px, 218px\) minmax\(0, 1fr\) minmax\(250px, 282px\)/,
  'desktop dashboard must preserve three usable columns');
assert.match(css, /@media \(max-width: 1050px\)[\s\S]*?dashboard-log\s*\{\s*display:\s*none/s,
  'right journal must collapse cleanly on narrower screens');
assert.match(css, /@media \(max-width: 720px\)[\s\S]*?dashboard-tablist[\s\S]*?overflow-x:\s*auto/s,
  'mobile navigation must become horizontally scrollable');
assert.match(css, /:focus-visible/, 'keyboard focus indicators must remain visible');
assert.match(css, /prefers-reduced-motion/, 'reduced-motion preference must be respected');
assert.match(css, /#dashboard-tab-modal\s*\{\s*z-index:\s*100000/, 'tab dialog must remain above the game shell');
assert.ok(css.includes('#screen-game .hud-overview-vitals') &&
  css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'),
  'hero HUD must render health, class resource and experience as three cards');
assert.ok(css.includes('#screen-game .hud-overview-details') &&
  css.includes('justify-content: flex-end'),
  'combat details must remain in a separate collapsible area');
assert.ok(css.includes('.hud-details-panel[hidden] { display: none !important;'),
  'collapsed combat details must not occupy screen space');
assert.ok(css.includes('#dashboard-tab-modal .hero-overview .hero-overview-left') &&
  css.includes('grid-template-columns: repeat(3,minmax(0,1fr))'),
  'hero profile must group its three resources in a dedicated row');
assert.ok(css.includes('#dashboard-tab-modal .hero-overview .hero-stat-grid') &&
  css.includes('#dashboard-tab-modal .hero-overview .hero-progression-grid'),
  'hero profile must separate attributes from campaign progression');
assert.ok(css.includes('#dashboard-tab-modal .hero-overview-actions button'),
  'hero profile must expose clear shortcuts to related sections');
assert.ok(css.includes('#dashboard-tab-modal .rpg-inventory-layout') &&
  css.includes('grid-template-columns: minmax(250px, .78fr) minmax(0, 1.42fr)'),
  'inventory must balance the paperdoll and backpack as separate desktop columns');
assert.ok(css.includes('#dashboard-tab-modal .inv-controls') &&
  css.includes('#dashboard-tab-modal .inv-search-wrap'),
  'inventory filters, sorting and search must share a clear control group');
assert.ok(css.includes('#dashboard-tab-modal .paperdoll-combat-summary'),
  'equipment bonus summary must remain visible below the paperdoll');
assert.ok(css.includes('#dashboard-tab-modal .campaign-current-objective') &&
  css.includes('#dashboard-tab-modal .campaign-mission.current'),
  'quest journal must distinguish the active objective and mission cards');
assert.ok(css.includes('#dashboard-tab-modal .ability-status.ready') &&
  css.includes('#dashboard-tab-modal .ability-status.cooldown'),
  'magic section must clearly distinguish ability readiness states');
assert.ok(css.includes('#dashboard-tab-modal .passive-tree-controls') &&
  css.includes('#dashboard-tab-modal .talent-card.ready'),
  'talent section must retain tree controls and readable talent states');
assert.ok(css.includes('#screen-game .dashboard-context-actions button') &&
  css.includes('grid-template-columns: minmax(0,1fr)'),
  'single portal shortcut must use the full context panel width');
assert.ok(css.includes('#screen-game .context-progress') &&
  css.includes('#screen-game .dashboard-log .log-body > div'),
  'right rail must distinguish the current mission progress and individual log events');
assert.ok(css.includes('#screen-game .log-filter.active') &&
  css.includes('#screen-game .log-search:focus-visible'),
  'event filters and log search must retain clear active and keyboard-focus states');
assert.ok(css.includes('#dashboard-tab-modal .dashboard-tab-dialog-body') &&
  css.includes('overscroll-behavior: contain') &&
  css.includes('scrollbar-gutter: stable'),
  'dialog content must scroll independently without leaking scroll to the game');
assert.ok(css.includes('#dashboard-tab-modal .dashboard-tab-dialog-body button:focus-visible') &&
  css.includes('min-height: 36px'),
  'dialog controls must have consistent touch targets and keyboard focus');
assert.ok(css.includes('#screen-game .dashboard-content {') &&
  css.includes('overflow-wrap: anywhere'),
  'dashboard content must not create horizontal overflow');
console.log('Dashboard refresh layout contract passed.');
