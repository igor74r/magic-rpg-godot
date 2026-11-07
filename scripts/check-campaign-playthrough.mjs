// Full deterministic campaign playthrough: 25 missions, three dragon rewards, Rift gate.
import { STORY } from '../data/story.js';
import { ENEMIES } from '../data/enemies.js';
import {
  acceptCampaignMission, recordCampaignKill, claimCampaignMission,
  getCampaignProgress, getNextCampaignMission, canCompleteMainQuest
} from '../systems/campaign.js';
import { STORY_DRAGONS, claimStoryDragonReward } from '../systems/story-dragons.js';
import { isRiftReady } from '../systems/rift.js';
import { state } from '../systems/state.js';

const checks = [];
const check = (name, ok) => checks.push({ name, ok: !!ok });
const game = {
  player: { campaignKills: {}, campaignClaimed: {}, activeCampaignMission: null, level: 1 },
  storyDragons: {},
  storyShards: { flame: false, ice: false, blood: false }
};
state.game = game;
let processed = 0;
let dragonRewards = 0;

for (const act of STORY.acts) {
  for (const mission of act.missions) {
    const next = getNextCampaignMission(game.player);
    check(`mission order ${mission.id}`, next?.mission.id === mission.id);
    check(`accept ${mission.id}`, acceptCampaignMission(game.player, mission.id));
    const locationId = mission.locationId || act.locationId;
    for (let i = 0; i < mission.count; i++) {
      recordCampaignKill(game.player, locationId, mission.enemyId);
    }
    check(`kill counter ${mission.id}`, game.player.campaignKills[mission.id] === mission.count);
    if (Object.values(STORY_DRAGONS).some(dragon => dragon.missionId === mission.id)) {
      const dragon = Object.values(STORY_DRAGONS).find(item => item.missionId === mission.id);
      check(`finale enemy ${mission.id}`, dragon.enemyId === mission.enemyId && ENEMIES[mission.enemyId]?.boss === true);
      check(`wrong location rejected ${dragon.shardId}`, claimStoryDragonReward(game, mission.enemyId, 'wrong-location') === null);
      const reward = claimStoryDragonReward(game, mission.enemyId, locationId);
      check(`one-time shard ${dragon.shardId}`, reward?.newlyDefeated === true && reward.shardItemId === dragon.shardItemId && game.storyShards[dragon.shardId] === true);
      const duplicate = claimStoryDragonReward(game, mission.enemyId, locationId);
      check(`no duplicate shard ${dragon.shardId}`, duplicate?.newlyDefeated === false);
      dragonRewards++;
    }
    const claimed = claimCampaignMission(game.player);
    check(`turn in ${mission.id}`, claimed?.mission.id === mission.id && game.player.campaignClaimed[mission.id] === true);
    processed++;
    if (mission.id !== 'a5-m5') {
      check(`Rift remains closed after ${mission.id}`, !isRiftReady());
    }
  }
}

const progress = getCampaignProgress(game.player);
check('all 25 missions processed in strict order', processed === 25 && progress.total === 25 && progress.completed === 25 && progress.percent === 100);
check('exactly three dragon shard rewards', dragonRewards === 3 && Object.values(game.storyShards).filter(Boolean).length === 3);
check('final campaign unlocks victory condition', canCompleteMainQuest(game));
check('Rift opens only after Blood Crown and full campaign', isRiftReady());
check('no further campaign mission remains', getNextCampaignMission(game.player) === null);

for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
const failed = checks.filter(result => !result.ok);
console.log(`Campaign integration: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exitCode = 1;
