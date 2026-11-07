import assert from 'node:assert/strict';
import { STORY_DRAGONS } from '../systems/story-dragons.js';
import { getEligibleSpawnEnemyIds } from '../systems/overworld/spawn.js';

const allStoryDragons = Object.values(STORY_DRAGONS);
const allDragonIds = allStoryDragons.map(dragon => dragon.enemyId);

for (const dragon of allStoryDragons) {
  const ambient = getEligibleSpawnEnemyIds([dragon.enemyId, 'ghoul'], dragon.locationId, {});
  assert.equal(ambient.includes(dragon.enemyId), false,
    `${dragon.id} must not appear as an ambient enemy`);

  const finale = getEligibleSpawnEnemyIds(
    [dragon.enemyId, 'ghoul'],
    dragon.locationId,
    {},
    dragon.missionId
  );
  assert.equal(finale.includes(dragon.enemyId), true,
    `${dragon.id} must appear during its own finale mission`);

  const wrongMission = getEligibleSpawnEnemyIds(
    [dragon.enemyId, 'ghoul'],
    dragon.locationId,
    {},
    'a1-m1'
  );
  assert.equal(wrongMission.includes(dragon.enemyId), false,
    `${dragon.id} must be blocked during another mission`);

  const wrongLocation = getEligibleSpawnEnemyIds(
    [dragon.enemyId, 'ghoul'],
    'village',
    {},
    dragon.missionId
  );
  assert.equal(wrongLocation.includes(dragon.enemyId), false,
    `${dragon.id} must be blocked outside its canonical location`);

  for (const mode of [{ rifMode: true }, { towerMode: true }]) {
    const specialMode = getEligibleSpawnEnemyIds(
      [dragon.enemyId, 'ghoul'],
      dragon.locationId,
      mode,
      dragon.missionId
    );
    assert.equal(specialMode.includes(dragon.enemyId), false,
      `${dragon.id} must not spawn in Rift or Tower mode`);
  }
}

const nonStoryRoster = getEligibleSpawnEnemyIds(
  [...allDragonIds, 'ghoul', 'skeleton'],
  'forest',
  {},
  null
);
assert.deepEqual(nonStoryRoster, ['ghoul', 'skeleton'],
  'all three story dragons must be excluded from ordinary regions');

console.log('check-story-dragon-spawns: OK — all three dragons are gated to their own finale encounters');
