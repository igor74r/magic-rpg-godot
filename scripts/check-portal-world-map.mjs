import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const portalStart = main.indexOf('function openWorldPortalMenu() {');
const portalEnd = main.indexOf('function interactNpc(npcId) {', portalStart);
assert.ok(portalStart >= 0 && portalEnd > portalStart, 'world portal handler must exist');
const portal = main.slice(portalStart, portalEnd);

assert.match(portal, /class="portal-atlas"/, 'portal must render one unified atlas window');
assert.match(portal, /portal-map-stage/, 'atlas must contain a large map viewport');
assert.match(portal, /portal-map-node/, 'every destination must be represented by an interactive map point');
assert.match(portal, /<canvas class="portal-map-art"/, 'portal map art must use a crisp pixelated canvas');
assert.match(portal, /drawPortalPixelMap\(overlay\.querySelector\('#portal-map-art'\), points, routeLines\)/,
  'pixel map canvas must draw actual graph routes');
assert.match(portal, /routeLines = Object\.entries\(WORLD_CONNECTIONS\)/,
  'map edges must be derived from the region graph');
assert.match(portal, /canTravelToRegion\(latestWorld, currentId, id\)/,
  'travel must be checked against the current connected route');
assert.match(portal, /discoverWorldRegion\(latest, id, currentId\)/,
  'arriving in a new region must reveal its next routes');
assert.doesNotMatch(portal, /canEnterStoryLocation/,
  'recommended story level must not hard-lock open-world travel');
assert.match(portal, /latestAllowed/, 'travel must re-check route access immediately before transition');
assert.match(portal, /saveGame\(\)[\s\S]*?enterOverworld\(id\)/,
  'travel must persist the destination before entering it');
assert.equal(portal.includes('<svg'), false, 'portal must not use inline SVG graphics');
assert.equal(portal.includes('</svg>'), false, 'portal must not use inline SVG graphics');
const pixelMapStart = main.indexOf('function drawPortalPixelMap(');
const pixelMapEnd = main.indexOf('function openWorldPortalMenu()', pixelMapStart);
const pixelMap = main.slice(pixelMapStart, pixelMapEnd);
assert.match(pixelMap, /imageSmoothingEnabled = false/, 'portal canvas must preserve crisp pixel edges');
assert.match(pixelMap, /route\.from\.x/);
assert.match(pixelMap, /route\.to\.x/);
const portalStyleStart = portal.indexOf('<style>');
const portalStyleEnd = portal.indexOf('</style>', portalStyleStart);
const portalCss = portal.slice(portalStyleStart, portalStyleEnd);
assert.doesNotMatch(portalCss, /linear-gradient|radial-gradient|blur\s*\(|backdrop-filter|filter\s*:/i,
  'portal UI must use flat colors without blur or filter effects');
assert.match(portal, /portal-destination/, 'selecting a point must show its detailed destination panel');
assert.match(portal, /isRiftReady\(\)/, 'rift availability must remain gated by progression');
assert.match(portal, /@media\(max-width:650px\)/, 'atlas must adapt to mobile screens');
assert.match(portal, /aria-pressed/, 'map points must expose their selection state accessibly');
assert.doesNotMatch(portal, /data-world-list|data-world-grid|data-world-location|aurora-world-search/,
  'old searchable destination list must be removed');
assert.doesNotMatch(portal, /grid-template-columns:repeat\(auto-fit,minmax/,
  'portal must not render the old card grid');

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
assert.match(workflow, /node scripts\/check-portal-world-map\.mjs/, 'CI must execute the portal atlas contract checks');
console.log('Interactive graph-based portal world atlas checks passed.');