import assert from 'node:assert/strict';
import { STORY } from '../data/story.js';
import { state } from '../systems/state.js';
import {
  acceptCampaignMission, recordCampaignKill, claimCampaignMission,
  getCampaignProgress, getNextCampaignMission, getMissionProgress, canCompleteMainQuest, countStoryShards
} from '../systems/campaign.js';
import { STORY_DRAGONS, claimStoryDragonReward } from '../systems/story-dragons.js';
import { isRiftReady } from '../systems/rift.js';

assert.equal(countStoryShards({ flame: true, ice: true, blood: true }), 3);
assert.equal(countStoryShards({ flame: 'true', ice: 1, blood: {}, extra: true }), 0,
  'HUD shard total must ignore malformed truthy values and unknown flags');
assert.equal(countStoryShards([]), 0, 'malformed shard collections must not contribute to HUD totals');

assert.equal(STORY.acts.length, 5, 'campaign must contain exactly five acts');
assert.equal(STORY.acts.reduce((sum, act) => sum + act.missions.length, 0), 25, 'campaign must contain exactly 25 missions');

assert.equal(Object.keys(STORY_DRAGONS).length, 3, 'exactly three story dragons are allowed');

// Malformed truthy completion flags must not skip an unclaimed campaign mission.
const firstMission = STORY.acts[0].missions[0];
const malformedCampaignPlayer = {
  campaignKills: {},
  campaignClaimed: { [firstMission.id]: 'false' },
  activeCampaignMission: firstMission.id
};
assert.equal(getNextCampaignMission(malformedCampaignPlayer)?.mission.id, firstMission.id,
  'string "false" must not mark a mission as claimed');
assert.equal(malformedCampaignPlayer.campaignClaimed[firstMission.id], false,
  'malformed completion flags must be normalized to boolean false');
assert.equal(getCampaignProgress(malformedCampaignPlayer).completed, 0,
  'malformed completion flags must not inflate campaign progress');

const malformedKillPlayer = {
  campaignKills: { [firstMission.id]: '999999', 'a1-m2': -2, 'a1-m3': 1.5 },
  campaignClaimed: {},
  activeCampaignMission: firstMission.id
};
const malformedMissionProgress = getMissionProgress(malformedKillPlayer, firstMission);
assert.equal(malformedMissionProgress.kills, 0,
  'string campaign counters must not complete a mission');
assert.equal(malformedKillPlayer.campaignKills[firstMission.id], 0,
  'malformed campaign counters must be normalized to zero');
assert.equal(recordCampaignKill(malformedKillPlayer, firstMission.locationId || STORY.acts[0].locationId, firstMission.enemyId)[0], firstMission.id,
  'valid mission kills must still progress after counter recovery');
assert.equal(malformedKillPlayer.campaignKills[firstMission.id], 1,
  'recovered campaign counter must increment numerically');


const game = {
  storyDragons: {},
  storyShards: {},
  riftEnding: null,
  player: { campaignKills: {}, campaignClaimed: {}, activeCampaignMission: null }
};
state.game = game;

let claimedCount = 0;
for (const act of STORY.acts) {
  assert.equal(act.missions.length, 5, 'each act must have exactly five missions');
  for (const mission of act.missions) {
    const locationId = mission.locationId || act.locationId;
    assert.ok(locationId, mission.id + ': mission location missing');
    assert.equal(acceptCampaignMission(game.player, mission.id), true, mission.id + ': mission could not be accepted');
    assert.equal(game.player.activeCampaignMission, mission.id, mission.id + ': wrong active mission');
    assert.deepEqual(recordCampaignKill(game.player, 'wrong-location', mission.enemyId), [], mission.id + ': wrong location advanced objective');
    assert.deepEqual(recordCampaignKill(game.player, locationId, 'wrong-enemy'), [], mission.id + ': wrong enemy advanced objective');

    for (let kill = 0; kill < mission.count; kill++) {
      assert.deepEqual(recordCampaignKill(game.player, locationId, mission.enemyId), [mission.id], mission.id + ': valid kill did not advance objective');
    }
    assert.deepEqual(recordCampaignKill(game.player, locationId, mission.enemyId), [], mission.id + ': objective exceeded its required count');

    const dragon = Object.values(STORY_DRAGONS).find(entry => entry.enemyId === mission.enemyId);
    if (dragon) {
      assert.equal(dragon.missionId, mission.id, mission.id + ': dragon mapped to wrong finale mission');
      assert.equal(dragon.locationId, locationId, mission.id + ': dragon mapped to wrong finale location');
      assert.equal(claimStoryDragonReward(game, mission.enemyId, 'wrong-location'), null, mission.id + ': dragon awarded a shard outside its canonical location');
      const reward = claimStoryDragonReward(game, mission.enemyId, locationId);
      assert.equal(reward?.newlyDefeated, true, mission.id + ': designated dragon did not award its shard');
      assert.equal(reward.shardItemId, dragon.shardItemId, mission.id + ': wrong shard item awarded');
      assert.equal(game.storyShards[dragon.shardId], true, mission.id + ': story shard flag missing');
      assert.equal(claimStoryDragonReward(game, mission.enemyId, locationId)?.newlyDefeated, false, mission.id + ': dragon shard could be claimed twice');
      if (dragon.id !== 'blood-crown') assert.equal(isRiftReady(), false, mission.id + ': Rift opened before the final dragon');
    } else {
      assert.equal(claimStoryDragonReward(game, mission.enemyId), null, mission.id + ': non-dragon awarded a story shard');
    }

    const claimed = claimCampaignMission(game.player);
    assert.equal(claimed?.mission?.id, mission.id, mission.id + ': completed mission could not be claimed');
    claimedCount++;
    assert.equal(game.player.campaignClaimed[mission.id], true, mission.id + ': mission claim flag missing');
    assert.equal(game.player.activeCampaignMission, null, mission.id + ': active mission did not clear');
    const progress = getCampaignProgress(game.player);
    assert.equal(progress.completed, claimedCount, 'campaign completion counter mismatch');
    assert.equal(progress.total, 25, 'campaign total changed');
    const next = getNextCampaignMission(game.player);
    if (claimedCount < 25) assert.equal(next?.mission?.id, STORY.acts.flatMap(entry => entry.missions)[claimedCount].id, 'next mission order changed');
  }
}

assert.equal(claimedCount, 25);
assert.equal(getCampaignProgress(game.player).percent, 100);
assert.equal(game.storyShards.flame, true);
assert.equal(game.storyShards.ice, true);
assert.equal(game.storyShards.blood, true);
assert.equal(Object.values(game.storyShards).filter(Boolean).length, 3);
assert.equal(Object.values(game.storyDragons).filter(Boolean).length, 3);
assert.equal(isRiftReady(), true, 'Rift must unlock after Blood Crown falls');
assert.equal(canCompleteMainQuest(game), true, 'final campaign completion gate should pass after all 25 missions and all dragons');

state.game = null;
console.log('PASS 5 acts / 25 missions completed in canonical order');
console.log('PASS every mission rejects wrong enemy and wrong location; kill counts are capped');
console.log('PASS exactly three dragons award exactly three unique shards once each');
console.log('PASS Rift stays closed until Blood Crown, then unlocks');
console.log('PASS final campaign gate requires and accepts all story progress');
console.log('check-campaign-full: OK');
