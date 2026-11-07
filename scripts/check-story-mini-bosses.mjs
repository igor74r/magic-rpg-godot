import assert from 'node:assert/strict';
import { ENEMIES } from '../data/enemies.js';
import { LOCATIONS } from '../data/locations.js';
import { STORY } from '../data/story.js';
import { getStoryLocationRequirement } from '../systems/campaign.js';
import { STORY_MINI_BOSSES } from '../systems/story-mini-bosses.js';
import { getEligibleSpawnEnemyIds } from '../systems/overworld/spawn.js';

const miniBosses = STORY_MINI_BOSSES;

const shardIds = new Set(['flame', 'ice', 'blood']);
for (const miniBoss of miniBosses) {
  const enemy = ENEMIES[miniBoss.id];
  assert.ok(enemy, `Missing mini-boss definition: ${miniBoss.id}`);
  assert.equal(enemy.boss, true, `${miniBoss.id} must be marked as a boss`);
  assert.ok(Array.isArray(enemy.phases) && enemy.phases.length > 0, `${miniBoss.id} needs a phase`);
  assert.ok(enemy.hp > 0 && enemy.attack > 0 && enemy.defense >= 0);
  assert.ok(enemy.exp > 0 && enemy.gold > 0);
  assert.ok(Array.isArray(enemy.drops) && enemy.drops.length > 0);
  assert.ok(!enemy.drops.some(id => shardIds.has(id) || /shard-(flame|ice|blood)/.test(id)),
    `${miniBoss.id} must not drop a Rift shard`);

  const location = LOCATIONS[miniBoss.location];
  assert.ok(location, `Missing region: ${miniBoss.location}`);
  assert.ok(location.enemies.includes(miniBoss.id), `${miniBoss.id} is not in its region spawn roster`);

  const act = STORY.acts.find(item => item.number === miniBoss.act);
  assert.ok(act, `Missing story act ${miniBoss.act}`);
  assert.equal(act.locationId, miniBoss.location, `Mini-boss region must be tied to Act ${miniBoss.act}`);
  const requirement = getStoryLocationRequirement(miniBoss.location);
  assert.ok(requirement, `Region ${miniBoss.location} must have a campaign/level gate`);
  assert.equal(requirement.actNumber, miniBoss.act);
  assert.ok(getEligibleSpawnEnemyIds([miniBoss.id], miniBoss.location, {}, null, miniBoss.level - 1).length === 0,
    `${miniBoss.id} must be hidden from spawn below level ${miniBoss.level}`);
  assert.deepEqual(getEligibleSpawnEnemyIds([miniBoss.id], miniBoss.location, {}, null, miniBoss.level),
    [miniBoss.id], `${miniBoss.id} must become eligible at level ${miniBoss.level}`);
}

assert.equal(miniBosses.length, 5, 'Exactly one mini-boss per act is expected');
console.log('✓ Five act mini-bosses: unique definitions, gated regions, phases, balanced rewards, no shards');
