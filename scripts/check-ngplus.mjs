import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { STORY } from '../data/story.js';
import { startNGPlus, getNGPlusMult } from '../systems/ngplus.js';
import { getExpNext } from '../systems/progression.js';

const originalStorage = globalThis.localStorage;
const saved = new Map();
globalThis.localStorage = { setItem: (key, value) => saved.set(key, String(value)) };
state.currentSlot = 1;

try {
  for (const invalidCycle of [-1, 1.5, '2', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    state.game = { player: { ngPlus: invalidCycle } };
    assert.deepEqual(getNGPlusMult(), { hpMult: 1, atkMult: 1, goldMult: 1, expMult: 1 },
      `malformed NG+ cycle ${String(invalidCycle)} must not poison combat or reward scaling`);
  }
  state.game = { player: { ngPlus: 2 } };
  assert.deepEqual(getNGPlusMult(), { hpMult: 2, atkMult: 1.6, goldMult: 1.6, expMult: 1.6 },
    'valid NG+ scaling must remain unchanged');
  const incomplete = {
    storyShards: { flame: false, ice: false, blood: false },
    storyDragons: { 'blood-crown': false },
    player: { class: 'mage', level: 12, ngPlus: 0, victoryAchieved: true }
  };
  state.game = incomplete;
  assert.equal(startNGPlus(), false, 'NG+ must not start before campaign completion');
  assert.equal(incomplete.player.level, 12);
  assert.equal(incomplete.player.ngPlus, 0);

  const claimed = Object.fromEntries(STORY.acts.flatMap(act => act.missions.map(mission => [mission.id, true])));
  const ready = {
    storyShards: { flame: true, ice: true, blood: true },
    storyDragons: { 'ash-herald': true, 'ice-grasp': true, 'blood-crown': true },
    riftEnding: 'open',
    player: {
      class: 'mage', name: 'NG+ test', level: 50, exp: 999, expNext: 1000,
      gold: 777, hp: 1, maxHp: 100, mp: 1, maxMp: 100,
      str: 20, int: 20, wis: 20, con: 20, dex: 20, luck: 20,
      statPoints: 0, passivePoints: 7, passives: ['start', 'mage-fire-1', 'mage-fire-2'], ngPlus: 2, victoryAchieved: true,
      inventory: [{ id: 'iron-sword', qty: 1 }], equipped: { weapon: { id: 'iron-sword', qty: 1 } },
      achievements: ['first-kill'], stats: { kills: { wolf: 20 }, deaths: 2 },
      weaponLevel: 2, armorLevel: 1, herbs: { 'herb-life': 3 }, talents: [],
      playtimeSec: 3600, campaignKills: {}, campaignClaimed: claimed,
      activeCampaignMission: null, craftingJobs: [{ id: 'pending-forge', result: 'steel-sword', qty: 1, readyAt: Date.now() + 3600000 }],
      craftedHighTierByAct: { 5: true }, pendingLoot: [{ id: 'health-potion', qty: 1 }],
      buffs: [{ id: 'bardBuff', duration: 2 }], effects: [{ id: 'poison', duration: 2 }]
    }
  };
  ready.location = 'dragon-lair';
  ready.player.riftClearedLocations = ['rift-03', 'rift-17'];
  state.game = ready;
  const readyPlayerSnapshot = { ...ready.player };
  const readyGameSnapshot = {
    location: ready.location,
    storyShards: ready.storyShards,
    storyDragons: ready.storyDragons,
    riftEnding: ready.riftEnding,
    shards: ready.shards,
    quests: ready.quests,
    riftClearedLocations: ready.player.riftClearedLocations
  };
  const inventoryBefore = JSON.stringify(ready.player.inventory);
  const jobsBefore = JSON.stringify(ready.player.craftingJobs);
  const pendingBefore = JSON.stringify(ready.player.pendingLoot);
  assert.equal(startNGPlus(), true, 'NG+ should start after the final victory gate');
  assert.equal(ready.player.ngPlus, 3);
  assert.equal(ready.player.level, 1);
  assert.equal(ready.player.expNext, getExpNext(1), 'new cycle XP threshold must match the shared progression curve');
  assert.equal(ready.player.passivePoints, 0, 'unspent passive points must reset with the new cycle');
  assert.deepEqual(ready.player.passives, ['start'], 'old passive-tree bonuses must not leak into level 1');
  assert.equal(ready.player.gold, 777);
  assert.equal(JSON.stringify(ready.player.inventory), inventoryBefore, 'inventory must carry into NG+');
  assert.equal(JSON.stringify(ready.player.craftingJobs), jobsBefore, 'queued crafting jobs must not be lost');
  assert.equal(JSON.stringify(ready.player.pendingLoot), pendingBefore, 'pending loot must not be lost');
  assert.deepEqual(ready.player.buffs, [], 'temporary buffs must not leak into the new cycle');
  assert.deepEqual(ready.player.effects, []);
  assert.deepEqual(ready.player.craftedHighTierByAct, {});
  assert.deepEqual(ready.player.campaignClaimed, {});
  assert.deepEqual(ready.storyShards, { flame: false, ice: false, blood: false });
  assert.equal(ready.player.victoryAchieved, false);
  assert.ok(saved.has('magic-rpg-save-1'), 'new cycle should be saved');

  // Failed persistence must not report a successful cycle or destroy the completed campaign in memory.
  Object.assign(ready.player, readyPlayerSnapshot);
  Object.assign(ready, readyGameSnapshot);
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('simulated quota failure'); };
  assert.equal(startNGPlus(), false, 'NG+ must abort when the new cycle cannot be persisted');
  assert.equal(ready.player.level, 50, 'failed NG+ must restore the completed character level');
  assert.equal(ready.player.ngPlus, 2, 'failed NG+ must not increment the cycle');
  assert.deepEqual(ready.player.campaignClaimed, claimed, 'failed NG+ must restore all campaign flags');
  assert.equal(ready.location, 'dragon-lair', 'failed NG+ must restore the previous world location');
  assert.deepEqual(ready.player.riftClearedLocations, ['rift-03', 'rift-17'], 'failed NG+ must restore cleared Rift locations');
  globalThis.localStorage.setItem = originalSetItem;
  console.log('check-ngplus: PASS (completion gate, carry-over, XP threshold, and save-failure rollback)');
} finally {
  state.game = null;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
