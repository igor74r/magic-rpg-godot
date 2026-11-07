import assert from 'node:assert/strict';
import { createWorldState, ensureWorldState } from '../systems/world-state.js';
import { readFileSync } from 'node:fs';
import { createEnemyPersistentId, createSpawnRoster } from '../systems/overworld/spawn.js';
import {
  ensureRegionRecord,
  recordRegionChestOpened,
  recordRegionEnemyDefeat,
  recordRegionBossDefeat,
  recordRegionBossProgress,
  recordRegionEnemyRespawned,
  recordRegionEventResolved,
  recordRegionSecretDiscovered,
  recordRegionSecretLayout,
  applyRegionPersistence
} from '../systems/region-state.js';

assert.equal(createEnemyPersistentId('grave-king', true, 1), 'boss-grave-king');
assert.equal(createEnemyPersistentId('grave-king', true, 2), 'boss-grave-king-2');
assert.equal(createEnemyPersistentId('grave-king', true, 3), 'boss-grave-king-3');
assert.equal(createEnemyPersistentId('wolf', false, 0, 4), 'enemy-4');
const repeatedBossRoster = createSpawnRoster(['wolf', 'grave-king'], 4, () => 0.5);
assert.equal(repeatedBossRoster.filter(id => id === 'grave-king').length, 3,
  'small enemy rosters must preserve repeated boss entries for distinct encounters');

const game = { world: createWorldState({ seed: 998877 }) };
const world = ensureWorldState(game);
const first = ensureRegionRecord(world, 'forest', 2);
assert.equal(first.generationVisit, 2);
assert.equal(ensureRegionRecord(world, 'forest', 9).generationVisit, 2,
  'region generation seed index must remain stable across revisits');
assert.equal(recordRegionChestOpened(world, 'forest', 'chest-1'), true);
assert.equal(recordRegionChestOpened(world, 'forest', 'chest-1'), false);
assert.equal(recordRegionEnemyDefeat(world, 'forest', 'enemy-2', 35), true);
assert.equal(recordRegionBossProgress(world, 'forest', 'boss-ancient-ent', { hp: 100, maxHp: 500, phase: 1 }, 3), true);
assert.equal(recordRegionBossDefeat(world, 'forest', 'boss-ancient-ent'), true);
assert.equal(Object.hasOwn(first.bossProgress, 'boss-ancient-ent'), false,
  'defeating a boss must immediately clear its stale encounter progress');
assert.equal(recordRegionBossProgress(world, 'forest', 'boss-ash-herald', { hp: 210, maxHp: 420, phase: 2, tacticalSpecialPending: true }, 7), true,
  'a surviving boss must persist health, phase, tactical turn count and a pending special');
assert.equal(recordRegionBossDefeat(world, 'forest', 'boss-ancient-ent'), false,
  'a regional boss defeat must be recorded only once');
assert.equal(recordRegionEventResolved(world, 'forest', 'event-altar-0'), true);
assert.equal(recordRegionEventResolved(world, 'forest', 'event-altar-0'), false);
assert.equal(recordRegionSecretDiscovered(world, 'forest', 'secret-12-8', { id: 'secret-12-8-chest', x: 320, y: 240 }), true);
assert.equal(recordRegionSecretDiscovered(world, 'forest', 'secret-12-8'), false);
const secretLayout = [{ id: 'secret-12-8', tx: 12, ty: 8, wx: 600, wy: 408, ax: 13, ay: 8, rewardType: 'chest' }];
assert.equal(recordRegionSecretLayout(world, 'forest', secretLayout), true);
assert.equal(recordRegionSecretLayout(world, 'forest', []), false, 'generated secret layout must not be rerolled on revisits');
world.clockMinutes = 20;
const enemies = [
  { persistentId: 'enemy-2', hp: 40, dead: false, effects: [] },
  { persistentId: 'enemy-1', hp: 30, dead: false },
  { id: 6, persistentId: 'boss-ancient-ent', boss: true, hp: 500, maxHp: 500, dead: false, state: 'idle', effects: [] },
  { id: 6, persistentId: 'boss-ash-herald', boss: true, hp: 450, maxHp: 450, dead: false, state: 'idle', phase: 0, effects: [] }
];
const chests = [{ id: 'chest-0', opened: false }, { id: 'chest-1', opened: false }];
const events = [{ id: 'event-altar-0', resolved: false }, { id: 'event-crystal-0', resolved: false }];
applyRegionPersistence(world, 'forest', enemies, chests, events, 1000);
assert.equal(chests[0].opened, false);
assert.equal(chests[1].opened, true);
assert.deepEqual(events.map(event => event.id), ['event-crystal-0'], 'resolved exploration events must not respawn on revisiting');
assert.equal(enemies[0].dead, true);
assert.equal(enemies[0].hp, 0);
assert.equal(enemies[0].respawnAt, 901000);
assert.equal(enemies[1].dead, false);
assert.equal(enemies[2].dead, true, 'a defeated regional boss must stay defeated without a respawn timer');
assert.equal(enemies[2].hp, 0);
assert.equal(enemies[2].respawnAt, 0);
assert.equal(enemies[3].dead, false, 'a different boss occupying the same spawn slot must not inherit the previous boss defeat');
assert.equal(enemies[3].hp, 225, 'a surviving boss must resume at its persisted health ratio');
assert.equal(enemies[3].phase, 2, 'boss phase must survive a retreat and region reload');
assert.equal(enemies[3].persistentTurnCount, 7, 'boss tactical turn count must survive a retreat');
assert.equal(enemies[3].tacticalSpecialPending, true, 'a telegraphed boss special must remain pending after a retreat');
world.clockMinutes = 36;
applyRegionPersistence(world, 'forest', enemies, chests, events, 2000);
assert.equal(enemies[0].dead, false, 'expired defeat cooldown must not keep an enemy dead');
assert.equal(recordRegionEnemyRespawned(world, 'forest', 'enemy-2'), false);
const roundTrip = JSON.parse(JSON.stringify(game));
ensureWorldState(roundTrip);
assert.deepEqual(roundTrip.world.regions.forest.bossProgress['boss-ash-herald'], { hpRatio: 0.5, phase: 2, turnCount: 7, pendingSpecial: true },
  'boss encounter progress must survive save serialization and world-state sanitization');
assert.deepEqual(roundTrip.world.regions.forest.defeatedBosses, ['boss-ancient-ent'],
  'regional boss victories must survive save serialization and sanitization');
assert.deepEqual(roundTrip.world.regions.forest.discoveredSecrets, ['secret-12-8'],
  'discovered secret IDs must survive save serialization and world-state sanitization');
assert.deepEqual(roundTrip.world.regions.forest.secretChests, [{ id: 'secret-12-8-chest', x: 320, y: 240 }],
  'revealed secret treasure chests must survive save serialization until opened');
assert.equal(roundTrip.world.regions.forest.secretLayoutGenerated, true);
assert.deepEqual(roundTrip.world.regions.forest.secretWalls, secretLayout,
  'the exact secret wall layout and reward type must survive save serialization');
assert.equal(ensureRegionRecord(world, 'ruins', 1).discoveredSecrets.length, 0,
  'secret discovery must be isolated per region');
assert.equal(ensureRegionRecord(world, 'ruins', 1).openedChests.length, 0, 'region state must be isolated');
const spawnSource = readFileSync(new URL('../systems/overworld/spawn.js', import.meta.url), 'utf8');
assert.ok(spawnSource.includes('createEnemyPersistentId(enemyId, isBoss, bossOccurrence, i)'),
  'boss persistent IDs must use stable type and occurrence identity');
const combatSource = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
assert.match(combatSource, /const defeatedRegionId = ow\.sourceLocationId \|\| ow\.locationId;/,
  'enemy defeat persistence must use the resolved region even when sourceLocationId is absent');

assert.ok(combatSource.includes('recordRegionBossDefeat(state.game.world, defeatedRegionId, enemy.persistentId)'),
  'regional boss victories must use permanent defeat persistence');
assert.ok(combatSource.includes('recordRegionBossProgress(state.game.world, regionId, enemy.persistentId, enemy, ow.combat.turnCount)'),
  'retreating from a regional boss must persist its encounter progress');
assert.ok(combatSource.includes('function persistRegionalBossCheckpoint(ow)'),
  'regional boss rounds must have a dedicated save checkpoint');
assert.equal((combatSource.match(/persistRegionalBossCheckpoint\(ow\);/g) || []).length, 4,
  'boss progress must be checkpointed after every enemy-turn completion path');
assert.ok(combatSource.includes("if (!saveGame()) {\n    const warning = 'Не удалось сохранить контрольную точку босса."),
  'failed boss checkpoints must notify the player instead of silently losing progress');
assert.match(combatSource, /function combatDefeat\(\)[\s\S]*?persistRegionalBossCheckpoint\(ow\);/,
  'a boss checkpoint must be saved when the player is resurrected');
assert.match(combatSource, /const regionId = ow\.sourceLocationId \|\| ow\.locationId;[\s\S]*?recordRegionBossProgress\(state\.game\.world, regionId, enemy\.persistentId, enemy, ow\.combat\.turnCount\);[\s\S]*?enemy\.state = 'idle';/,
  'player defeat must preserve regional boss progress before ending the encounter');
console.log('Persistent region state: stable generation, opened chests, defeated enemies, boss progress, permanent victories and respawn cooldown passed.');
