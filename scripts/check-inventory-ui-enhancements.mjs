import fs from 'node:fs';
import assert from 'node:assert/strict';
const inventory = fs.readFileSync('ui/inventory.js', 'utf8');
const styles = fs.readFileSync('css/rpg-overhaul.css', 'utf8');
const baseStyles = fs.readFileSync('css/style.css', 'utf8');
const dashboardStyles = fs.readFileSync('css/dashboard-refresh.css', 'utf8');
assert.match(inventory, /let invSearch = ''/);
assert.match(inventory, /data-inv-search value="\$\{escapeHtml\(invSearch\)\}"/);
assert.match(inventory, /toLocaleLowerCase\('ru'\)/);
assert.match(inventory, /data-inv-search-clear/);
assert.match(inventory, /rarity-frame-\$\{rarity\}/);
assert.match(inventory, /invSort === 'power'/);
assert.match(inventory, /invSort === 'name'/);
assert.match(styles, /\.inv-search-wrap:focus-within/);
assert.match(styles, /@media \(max-width:760px\)/);
assert.match(styles, /@media \(max-width:380px\)/);
const tooltipZ = Number(baseStyles.match(/\.item-tooltip\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
const modalZ = Number(dashboardStyles.match(/#dashboard-tab-modal\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
assert.ok(Number.isFinite(tooltipZ) && Number.isFinite(modalZ) && tooltipZ > modalZ,
  `Item tooltip must render above inventory modal (tooltip=${tooltipZ}, modal=${modalZ}).`);
console.log('Inventory UI enhancements: search, clear, sort, rarity and responsive styles verified.');

assert.ok(inventory.indexOf("const rarities = [") >= 0, 'Inventory rarity filter controls should exist.');
assert.match(inventory, /data-inv-rarity/);
assert.match(inventory, /invRarityFilter !== 'all'/);
assert.match(inventory, /rarityCounts = entries\.reduce/);
assert.match(inventory, /slot-rarity-label/);
assert.match(styles, /\.inv-rarity-row/);
assert.match(styles, /\.slot-rarity-label/);
