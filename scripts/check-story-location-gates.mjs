import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canEnterStoryLocation, getStoryLocationProgression, getStoryLocationRequirement } from '../systems/campaign.js';

const route = getStoryLocationProgression();
assert.ok(route.length > 10, 'all campaign regions must appear in the ordered route');
assert.equal(new Set(route.map(item => item.id)).size, route.length, 'each story region must appear only once');
assert.deepEqual(route.map(item => item.sequence), route.map((_, index) => index + 1),
  'story route sequence numbers must be continuous');
assert.deepEqual(
  [...new Set(route.map(item => item.actNumber))],
  [1, 2, 3, 4, 5],
  'the route must cover all five campaign acts'
);

const expected = [
  ['briar-hollow', 1, null],
  ['forest', 3, 'a1-m1'],
  ['ruins', 5, 'a1-m2'],
  ['shadow', 7, 'a1-m3'],
  ['swamp', 11, 'a1-m5'],
  ['graveyard', 13, 'a2-m1'],
  ['sunken-necropolis', 15, 'a2-m2'],
  ['library', 17, 'a2-m3'],
  ['volcano', 21, 'a2-m5'],
  ['wasteland', 23, 'a3-m1'],
  ['obsidian-fields', 25, 'a3-m2'],
  ['ice-peaks', 31, 'a3-m5'],
  ['frost-citadel', 33, 'a4-m1'],
  ['dragon-lair', 41, 'a4-m5'],
  ['void-crater', 47, 'a5-m3']
];
for (const [locationId, requiredLevel, prerequisiteMission] of expected) {
  const requirement = getStoryLocationRequirement(locationId);
  assert.equal(requirement?.requiredLevel, requiredLevel,
    `${locationId} must use its mission's level step`);
  assert.equal(requirement?.unlockAfterMissionId || null, prerequisiteMission,
    `${locationId} must depend on the immediately preceding campaign mission`);

  const player = { level: requiredLevel, campaignClaimed: {} };
  const locked = canEnterStoryLocation(player, locationId);
  if (prerequisiteMission) {
    assert.equal(locked.allowed, false, `${locationId} must remain locked before its prerequisite mission`);
    assert.equal(locked.reason, 'campaign');
    player.campaignClaimed[prerequisiteMission] = true;
  }
  assert.equal(canEnterStoryLocation(player, locationId).allowed, true,
    `${locationId} must unlock when both level and campaign requirements are met`);
  if (requiredLevel > 1) {
    assert.equal(canEnterStoryLocation({ ...player, level: requiredLevel - 1 }, locationId).allowed, false,
      `${locationId} must reject a character below its level gate`);
  }
}
assert.equal(canEnterStoryLocation({ level: 1 }, 'village').allowed, true,
  'the village must never be level-gated');
assert.equal(canEnterStoryLocation({ level: 1 }, 'rift').allowed, true,
  'rift access continues to use its own story-dragon progression gate');

const campaignSource = readFileSync(new URL('../systems/campaign.js', import.meta.url), 'utf8');
const overworldSource = readFileSync(new URL('../systems/overworld.js', import.meta.url), 'utf8');
const portalSource = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
assert.ok(campaignSource.includes('getStoryLocationProgression'),
  'campaign must expose a single source of truth for story route order');
assert.ok(!overworldSource.includes('canEnterStoryLocation'),
  'recommended story levels must not prevent entry into an open-world region');
assert.ok(portalSource.includes('WORLD_REGION_IDS') && portalSource.includes('WORLD_CONNECTIONS'),
  'Aurora atlas must show regions from the connected world graph');
assert.ok(portalSource.includes('canTravelToRegion') && portalSource.includes('discoverWorldRegion'),
  'the atlas must allow only connected routes and reveal neighboring routes on arrival');
assert.ok(portalSource.includes('routeLines') && portalSource.includes('ctx.lineTo(route.to.x / 4, route.to.y / 4)'),
  'the pixel map must render the actual world graph rather than a linear campaign path');
assert.ok(!portalSource.includes('canEnterStoryLocation(state.game?.player, id)'),
  'the unified portal atlas must not hard-lock regions by campaign level');

console.log('check-story-location-gates: OK — story recommendations remain ordered while exploration is graph-based');