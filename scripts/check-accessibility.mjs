import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, main, header, menu, css, inventory, shop, npcs, overworld, overworldRender, combatPanel, quests] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../main.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/header.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/menu.js', import.meta.url), 'utf8'),
  readFile(new URL('../css/rpg-overhaul.css', import.meta.url), 'utf8'),
  readFile(new URL('../ui/inventory.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/shop.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/npcs.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/overworld.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/overworld/render.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/overworld/combat-panel.js', import.meta.url), 'utf8'),
  readFile(new URL('../ui/quests.js', import.meta.url), 'utf8')
]);

const tabs = [...html.matchAll(/<(?:div|button)\b(?=[^>]*\bclass="(?:tab|settings-tab)[^"]*")(?=[^>]*\brole="tab")[^>]*>/g)];
assert.equal(tabs.length, 15, 'all game and settings navigation items must expose tab semantics');
for (const [tag] of tabs) {
  assert.match(tag, /aria-selected="(?:true|false)"/);
  assert.match(tag, /aria-controls="(?:tab-content|settings-content)"/);
  assert.match(tag, /tabindex="(?:0|-1)"/);
}
assert.match(html, /id="tab-content" role="tabpanel" aria-labelledby="game-tab-quests" tabindex="0"/,
  'initial dashboard panel must be labelled by the existing default tab');
const staticIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
for (const [, labelledBy] of html.matchAll(/\baria-labelledby="([^"]+)"/g)) {
  for (const id of labelledBy.split(/\s+/)) {
    assert.ok(staticIds.has(id), 'static aria-labelledby target "' + id + '" must exist in the document');
  }
}
assert.match(html, /id="game-tab-hero" role="tab"[^>]*data-tab="hero"/, 'the hero dossier must be reachable from primary navigation');
assert.match(html, /id="game-tab-world" role="tab"[^>]*data-tab="world"/, 'the faction and world journal must be reachable from primary navigation');
assert.match(html, /id="dashboard-context"[^>]*aria-label="Текущая цель"/, 'the dashboard must expose a persistent current-objective panel');
assert.match(html, /id="game-log-search" class="log-search" type="search"/, 'the event journal must provide text search');
for (const filter of ['all', 'combat', 'loot', 'story']) {
  assert.match(html, new RegExp(`data-log-filter="${filter}"`), `event journal filter ${filter} must be available`);
}
assert.match(header, /renderDashboardContext\(\)/, 'game refreshes must update the live dashboard context');
assert.ok(header.includes('<div class="hud-overview-columns">'), 'central hero HUD must use a split layout container');
assert.ok(header.includes('hud-panel-kicker'), 'resource panel must have a clear visual section label');
assert.ok(header.includes('aria-controls="game-header-combat-details"'), 'combat details toggle must be associated with its panel');
assert.ok(header.includes('id="game-header-combat-details"'), 'combat details panel must have a stable accessible id');
assert.ok(header.includes('hud-stat-group-label'), 'hero attributes must be visually grouped by type');
assert.ok(header.includes('<b>${p.str}</b>') && header.includes('<b>${crit}%</b>'), 'combat stat values must be emphasized for quick scanning');
assert.ok(css.includes('#game-header .hud-panel-kicker'), 'HUD resource section label must receive dedicated styling');
assert.ok(css.includes('#game-header .header-combat-stats') && css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'), 'combat attributes must use compact responsive chips');
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'HUD transitions must respect reduced-motion preferences');

assert.ok(header.includes('<section class="hud-overview-vitals" aria-label="Ресурсы героя">'), 'resource panel must be clearly labelled');
assert.ok(header.includes('<section class="hud-overview-details" aria-label="Боевые характеристики">'), 'combat details panel must be clearly labelled');
assert.ok(header.includes('data-hud-toggle aria-expanded="false"'), 'hero details toggle must expose its initial collapsed state');
assert.ok(header.includes('data-hud-details hidden'), 'hero details must start collapsed to keep the HUD compact');
assert.ok(css.includes('grid-template-columns:minmax(220px,.82fr) minmax(0,1.18fr)'), 'central hero HUD must display two columns on desktop');
assert.ok(css.includes('@media (max-width:760px)'), 'central hero HUD must adapt to mobile');
assert.ok(css.includes('#game-header .hud-overview-columns { grid-template-columns:minmax(0,1fr)'), 'central hero HUD must stack on mobile');

assert.match(header, /tab === 'hero'/, 'hero dossier must be rendered by the game tab router');
assert.match(css, /\.dashboard-sidebar \.tab:focus-visible/, 'dashboard navigation must provide visible keyboard focus');
assert.match(css, /@media \(max-width:700px\)/, 'dashboard must provide a compact mobile navigation layout');

assert.match(html, /id="settings-content" role="tabpanel" aria-labelledby="settings-tab-sound" tabindex="0"/);
for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) {
  assert.ok(main.includes(`event.key === '${key}'`), `keyboard navigation missing ${key}`);
}
assert.match(main, /tabs\[nextIndex\]\.focus\(\)/);
assert.match(main, /tabs\[nextIndex\]\.click\(\)/);
assert.match(header, /function syncDashboardTabSelection\(tab\)/,
  'dashboard tab selection must be synchronized from the current game state');
assert.match(header, /syncDashboardTabSelection\(state\.currentTab\)/,
  'the initial game render must activate the default tab and expose it to keyboard navigation');
assert.match(header, /setAttribute\('aria-selected', String\(active\)\)/);
assert.match(header, /setAttribute\('aria-labelledby', activeTab\.id\)/);
assert.match(menu, /setAttribute\('aria-selected', String\(active\)\)/);
assert.match(menu, /setAttribute\('aria-labelledby', activeTab\.id\)/);
assert.match(css, /\.settings-tab:focus-visible/);
const settingsControls = [
  'set-music-volume', 'set-sfx-volume', 'set-sound',
  'set-difficulty', 'set-autosave', 'set-autosave-interval', 'set-hotkeys', 'set-fps',
  'set-graphics-quality', 'set-weather-effects', 'set-ambient-fog', 'set-bloom-effects',
  'set-damage-numbers', 'set-screen-shake', 'set-low-health', 'set-reduced-motion'
];
for (const id of settingsControls) {
  assert.match(menu, new RegExp(`<label for="${id}">[^<]+</label>\\s*<(?:input|select)\\b[^>]*\\bid="${id}"`),
    `settings control ${id} must have an explicitly associated label`);
}
assert.match(menu, /aria-label="Удалить сохранение в слоте \${slot}"/,
  'icon-only save deletion buttons must have a descriptive accessible name');
assert.match(html, /id="overworld-canvas"[^>]*tabindex="0"[^>]*aria-label="Игровой мир\. WASD или стрелки — движение, E — взаимодействие, Escape — пауза\."/,
  'overworld canvas must be keyboard focusable and provide controls guidance');
assert.match(html, /id="npc-dialog-modal" class="npc-modal" style="display:none;" role="dialog" aria-modal="true" aria-label="Диалог с персонажем"/,
  'NPC dialogue must expose modal dialog semantics');
assert.match(npcs, /modal\.addEventListener\('keydown', event =>/,
  'NPC dialogue must handle keyboard input at the modal level');
assert.match(npcs, /if \(event\.key === 'Escape'\)/,
  'NPC dialogue must close with Escape');
assert.match(npcs, /if \(event\.key !== 'Tab'\) return;/,
  'NPC dialogue must contain keyboard Tab navigation');
assert.match(npcs, /npcDialogReturnFocus\?\.isConnected\) npcDialogReturnFocus\.focus\(\)/,
  'closing NPC dialogue must restore focus to its opener');
assert.match(npcs, /querySelector\('\.npc-modal-close'\)/,
  'NPC dialogue must move initial focus inside its modal');
assert.match(html, /id="combat-panel" role="region" aria-label="Боевая панель"/, 'combat interface must be exposed as a named region');
assert.match(html, /id="combat-panel-info" role="status" aria-live="polite" aria-atomic="true"/, 'combat status updates must be announced politely and atomically');
assert.match(html, /id="combat-panel-actions" role="group" aria-label="Боевые действия"/, 'combat controls must form a labelled group');
assert.ok(combatPanel.includes('function setCombatActionsMarkup'), 'combat action renderer must use a focus-aware helper');
assert.match(combatPanel, /next \|\| actions\.querySelector/, 'combat submenu rerender must restore focus to an equivalent or first available action');
assert.ok(combatPanel.includes('setCombatActionsMarkup'), 'combat panel must route updates through the focus-aware helper');
assert.ok(shop.includes('aria-pressed="${shopPreset === id}"'), 'shop filters must announce selected state');
assert.ok(shop.includes('type="button" data-shop-buy='), 'shop purchase controls must be explicit buttons');
assert.ok(combatPanel.includes('data-combat-action'), 'combat panel must expose actionable combat controls');
assert.match(html, /id="game-log" role="log" aria-live="polite"/,
  'game log updates must be announced politely to assistive technology');
for (const [key, label] of [
  ['w', 'Двигаться вверх'], ['a', 'Двигаться влево'],
  ['d', 'Двигаться вправо'], ['s', 'Двигаться вниз']
]) {
  assert.match(html, new RegExp(`class="dpad-btn" data-key="${key}" aria-label="${label}"`),
    `mobile direction key ${key} must have a descriptive accessible name`);
}

assert.match(overworldRender, /role="dialog" aria-modal="true" aria-labelledby="pause-title"/,
  'overworld pause menu must expose modal semantics');
assert.match(overworldRender, /div\.addEventListener\('keydown', event =>/,
  'overworld pause menu must constrain keyboard navigation');
assert.match(overworldRender, /pauseReturnFocus\?\.isConnected\) pauseReturnFocus\.focus\(\)/,
  'closing pause menu must restore focus');
assert.match(overworldRender, /querySelector\('button:not\(:disabled\)'\)/,
  'opening pause menu must move focus to an action');
for (const event of ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'keyup', 'blur']) {
  assert.ok(overworld.includes(`btn.addEventListener('${event}'`),
    `mobile d-pad must support ${event} to avoid stuck movement and enable keyboard input`);
}
assert.match(overworld, /event\.code !== 'Space' && event\.code !== 'Enter'/,
  'mobile d-pad must support Space and Enter key activation');
assert.match(inventory, /data-inv-filter="\$\{key\}" aria-pressed="\$\{invFilter === key\}"/,
  'inventory filters must expose their selected state');
assert.match(inventory, /data-inv-sort="\$\{key\}" aria-pressed="\$\{invSort === key\}"/,
  'inventory sorting controls must expose their selected state');
assert.match(shop, /data-shop-preset="\$\{escapeHtml\(id\)\}" aria-pressed="\$\{shopPreset === id\}"/,
  'shop filters must expose their selected state');
assert.match(inventory, /role="dialog" aria-modal="true" aria-labelledby="inventory-sale-title"/,
  'sale overlay must expose modal dialog semantics');
assert.match(inventory, /if \(event.key === 'Escape'\) \{ event.preventDefault\(\); cancelSaleUI\(\); return; \}/,
  'sale dialog must close with Escape');
assert.match(inventory, /if \(saleReturnFocus\?\.isConnected\) saleReturnFocus\.focus\(\)/,
  'sale dialog must restore focus to its opener');
assert.match(inventory, /aria-label="Снять: \$\{escapeHtml\(label\)\}"/,
  'equipment removal controls must identify their slot');
assert.ok(quests.includes('role="progressbar" aria-label="Прогресс: ${quest.text}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${current}"'),
  'daily quest progress must expose accessible min/max/current values');
assert.ok(quests.includes('type="button" data-game-action="claim-quest"'),
  'daily quest reward controls must declare button type');
assert.ok(quests.includes('role="progressbar" aria-label="Прогресс миссии: ${mission.title}" aria-valuemin="0" aria-valuemax="${mission.count}" aria-valuenow="${Math.min(missionProgress.current, mission.count)}"'),
  'campaign mission progress must expose accessible progress semantics');
console.log('check-accessibility: PASS (15 keyboard-operable tabs, labelled settings, modal/live-region/progress semantics)');

const npcButtons = npcs.match(/<button\b[^>]*>/g) || [];
assert.ok(npcButtons.length > 0, 'NPC screens should render interactive buttons');
for (const tag of npcButtons) assert.match(tag, /\btype="button"/, `NPC button must explicitly declare type=button: ${tag}`);

const questBoard = quests;
assert.match(questBoard, /<button type="button" data-game-action="close-npc"/,
  'quest board exit control must not submit an enclosing form');
// combatPanel is loaded with the other accessibility fixtures above.
for (const action of ['attack', 'open-spells', 'open-items', 'flee', 'block', 'open-abilities']) {
  assert.match(combatPanel, new RegExp('<button type="button" data-combat-action="' + action + '"'),
    `combat action "${action}" must be an explicit button`);
}

const headerActions = (await readFile(new URL('../ui/header.js', import.meta.url), 'utf8'));
for (const stat of ['str', 'int', 'wis', 'con', 'dex']) {
  assert.ok(headerActions.includes('type="button" data-spend-stat="' + stat + '"'),
    `stat increase action "${stat} must be a non-submit button`);
}
for (const action of ['rift']) {
  assert.ok(headerActions.includes('type="button" data-header-action="' + action + '"'),
    `header action "${action} must be a non-submit button`);
}

const portalStart = main.indexOf('function openWorldPortalMenu() {');
const portalEnd = main.indexOf('function interactNpc(npcId) {', portalStart);
assert.ok(portalStart >= 0 && portalEnd > portalStart, 'portal atlas handler must exist');
const portalAtlas = main.slice(portalStart, portalEnd);
for (const [name, source] of [['inventory', inventory], ['portal atlas', portalAtlas], ['menu', await readFile(new URL('../ui/menu.js', import.meta.url), 'utf8')]]) {
  const buttonTags = source.match(/<button\b[^>]*>/g) || [];
  assert.ok(buttonTags.length > 0, `${name} should render interactive buttons`);
  for (const tag of buttonTags) assert.match(tag, /\btype="button"/, `${name} button must explicitly declare type=button: ${tag}`);
}
