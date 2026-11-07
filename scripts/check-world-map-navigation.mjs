import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORLD_REGION_IDS, WORLD_CONNECTIONS } from '../data/world.js';
import {
  createWorldState,
  canTravelToRegion,
  discoverWorldRegion,
  getAccessibleWorldRegions
} from '../systems/world-state.js';

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const overworld = readFileSync(new URL('../systems/overworld.js', import.meta.url), 'utf8');
const portalStart = main.indexOf('function openWorldPortalMenu()');
const portalEnd = main.indexOf('function interactNpc(npcId)', portalStart);
assert.ok(portalStart >= 0 && portalEnd > portalStart, 'world portal menu must be present');
const portal = main.slice(portalStart, portalEnd);

assert.equal(WORLD_REGION_IDS.length, 16, 'Aurora plus 15 adventure regions');
assert.match(main, /WORLD_CONNECTIONS/);
assert.match(portal, /WORLD_REGION_IDS/);
assert.match(portal, /Object\.entries\(WORLD_CONNECTIONS\)/, 'map paths must be drawn from the world graph');
assert.match(portal, /canTravelToRegion\(latestWorld, currentId, id\)/, 'travel must re-check the current route');
assert.match(portal, /discoverWorldRegion\(latest, id, currentId\)/, 'arriving must reveal the region and its next routes');
assert.doesNotMatch(portal, /canEnterStoryLocation/, 'recommended story level must not hard-lock open-world travel');
assert.doesNotMatch(overworld, /canEnterStoryLocation/, 'overworld entry must not restore linear campaign gates');

const world = createWorldState({ seed: 314159 });
assert.deepEqual(getAccessibleWorldRegions(world, 'village').sort(), ['briar-hollow', 'forest', 'ruins']);
assert.equal(canTravelToRegion(world, 'village', 'forest'), true);
assert.equal(canTravelToRegion(world, 'village', 'shadow'), false);
assert.equal(discoverWorldRegion(world, 'forest', 'village'), true);
assert.equal(canTravelToRegion(world, 'forest', 'shadow'), true);
assert.equal(canTravelToRegion(world, 'village', 'shadow'), false);

const legacy = createWorldState({ seed: 314159, legacy: true });
assert.equal(legacy.legacyFastTravel, true);
assert.equal(canTravelToRegion(legacy, 'village', 'void-crater'), true);
assert.equal(legacy.discoveredRegions.length, 16);

console.log('World map navigation: graph routes, three starter exits, exploration unlocks and legacy fast travel passed.');