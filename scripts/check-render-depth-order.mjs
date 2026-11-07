import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDepthItems } from '../ui/overworld/depth-order.js';
import { LOCATIONS } from '../data/locations.js';
import { state } from '../systems/state.js';
import { spawnStatics } from '../systems/overworld/spawn.js';

const stat = { id: 'house', x: 10, y: 80, depthOffset: 4 };
const npc = { id: 'villager', x: 20, y: 60 };
const event = { id: 'altar', x: 30, y: 95 };
const liveEnemy = { id: 'ghoul', x: 40, y: 72 };
const deadEnemy = { id: 'fallen-ghoul', x: 50, y: 20, dead: true };
const player = { id: 'hero', x: 60, y: 84 };
const ordered = buildDepthItems({
  statics: [stat],
  npcs: [npc],
  events: [event],
  enemies: [deadEnemy, liveEnemy],
  player
});

assert.deepEqual(ordered.map(entry => entry.kind), ['npc', 'enemy', 'static', 'event', 'player']);
assert.deepEqual(ordered.map(entry => entry.footY), [60, 72, 84, 96, 95].sort((a, b) => a - b));
assert.equal(ordered.some(entry => entry.item === deadEnemy), false, 'dead enemies must not enter the draw order');
assert.equal(ordered.find(entry => entry.kind === 'player').item, player, 'player must participate in depth sorting');
assert.equal(buildDepthItems(null).length, 0, 'missing world state must produce an empty draw list');

const contactSorted = buildDepthItems({
  statics: [
    { id: 'large-prop', y: 100, depthY: 148 },
    { id: 'building', y: 130, depthY: 138 }
  ],
  player: { id: 'hero', y: 120 }
});
assert.deepEqual(contactSorted.map(entry => entry.item.id), ['hero', 'building', 'large-prop'],
  'large Aurora props and buildings must sort against their rendered ground-contact points');

const auroraStatics = spawnStatics(LOCATIONS.village, 'village');
const byId = id => auroraStatics.find(item => item.id === id);
assert.equal(byId('forge-building').depthY, 7 * 48 + 24 + 8,
  'Aurora buildings must use the rendered sprite base as their depth anchor');
assert.equal(byId('aurora-oak-nw').depthY, 3 * 48 + 24 + 8,
  'Aurora nature sprites must use their ground-contact base as their depth anchor');
assert.equal(byId('world-portal').depthY, 13 * 48 + 24 + 48,
  '64px prop-atlas frames scaled to 96px must sort by their bottom edge');

const previousGame = state.game;
try {
  state.game = { storyDragons: { 'ash-herald': true, 'ice-grasp': true, 'blood-crown': true } };
  const storyStatics = spawnStatics(LOCATIONS.village, 'village');
  const storyById = id => storyStatics.find(item => item.id === id);
  assert.equal(storyById('aurora-ash-victory').depthY, 6 * 48 + 24 + 48,
    'Ash Herald victory banner must use the prop atlas ground-contact anchor');
  assert.equal(storyById('aurora-ice-victory').depthY, 10 * 48 + 24 + 48,
    'Ice Grasp victory lantern must use the prop atlas ground-contact anchor');
  assert.equal(storyById('aurora-rift-ward').depthY, 5 * 48 + 24 + 48,
    'Blood Crown memorial must use the prop atlas ground-contact anchor');
} finally {
  state.game = previousGame;
}

const renderSource = readFileSync(new URL('../ui/overworld/render.js', import.meta.url), 'utf8');
assert.ok(renderSource.includes('const depthItems = buildDepthItems(ow);'), 'renderer must use the shared depth-order helper');
assert.ok(renderSource.includes('drawPlayerByClass(ctx, sx + pLungeX, sy + pLungeY, state.game.player.class, theme.shadow, heroMoving)'), 'player sprite must receive screen coordinates, class, shadow and movement in the renderer signature order');
assert.equal((renderSource.match(/drawPlayerByClass\s*\(/g) || []).length, 1,
  'player must be drawn exactly once; a later unconditional draw would cover every foreground building');

console.log('Render depth order passed: player, buildings, NPCs, events and living enemies share one sorted layer');
