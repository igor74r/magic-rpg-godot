import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const gameExports = readFileSync(new URL('../ui/game.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../ui/dashboard.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../ui/header.js', import.meta.url), 'utf8');
const spawn = readFileSync(new URL('../systems/overworld/spawn.js', import.meta.url), 'utf8');

assert.match(main, /class="portal-atlas"/, 'portal must expose one unified world atlas');
assert.match(main, /portal-map-stage/, 'the portal must render a large map viewport');
assert.match(main, /portal-map-node/, 'destinations must be represented by map points');
assert.match(main, /routeLines/, 'the map must render edges from the connected world graph');
assert.match(main, /drawPortalPixelMap\(overlay\.querySelector\('#portal-map-art'\), points, routeLines\)/,
  'the ordered route must be drawn on the portal canvas');
assert.match(main, /portal-destination/, 'the selected map point must show destination details');
assert.match(main, /canTravelToRegion\(latestWorld, currentId, id\)/, 'portal selection must follow the current connected route');
assert.match(main, /latestAllowed/, 'travel must revalidate route access before transition');
assert.match(main, /saveGame\(\)[\s\S]*?enterOverworld\(id\)/, 'travel must persist and enter the selected location');
assert.match(main, /discoverWorldRegion\(latest, id, currentId\)/, 'entering a region must reveal its outgoing routes');
assert.doesNotMatch(main, /canEnterStoryLocation\(state\.game\?\.player, id\)/, 'story level must not hard-lock graph exploration');
assert.doesNotMatch(main, /mapSelect|mapTravel|mapEnter|ui\/locations\.js/, 'legacy radial map API must be removed');
assert.doesNotMatch(gameExports, /locations\.js|mapSelect|mapTravel|mapEnter/, 'game module must not export the legacy map');
assert.equal(existsSync(new URL('../ui/locations.js', import.meta.url)), false, 'legacy radial map module must be deleted');

assert.match(main, /enterOverworld\('village'\)/, 'new heroes must start inside Aurora');
assert.match(main, /openWorldPortalMenu,/, 'the portal atlas action must remain exposed');
assert.match(html, /id="screen-overworld" class="dashboard-overworld"/, 'the location scene must live inside the dashboard');
assert.doesNotMatch(html, /id="game-tab-locations"/, 'the redundant world-map sidebar entry must remain absent');
assert.match(dashboard, /GameAPI\.interactNpc\('world-portal'\)/, 'the portal shortcut must use the village portal interaction');
assert.doesNotMatch(main, /data-world-tower/, 'the portal atlas must not contain a tower shortcut');
assert.doesNotMatch(header, /data-header-action="tower"/, 'the HUD must not duplicate the village tower gate');
assert.match(spawn, /id: 'world-waystone'/, 'other locations must retain their world portal');
assert.doesNotMatch(spawn, /id: 'tower-gate'/, 'other locations must not spawn duplicate tower gates');
assert.match(main, /classList\.add\('overworld-active'\)/, 'the village scene must retain dashboard side panels');
assert.match(main, /classList\.remove\('overworld-active'\)/, 'leaving a location must restore dashboard content');

console.log('Unified portal world atlas navigation checks passed.');
