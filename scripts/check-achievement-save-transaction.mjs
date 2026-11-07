import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { checkAchievements, getUnlockedAchievementIds, unlockedCount } from '../systems/achievements.js';
import { on, off } from '../systems/events.js';

const knownAchievementId = 'first-blood';
assert.equal(getUnlockedAchievementIds({ achievements: [knownAchievementId, knownAchievementId, 'unknown', 7] }).size, 1,
  'achievement views must count unique known IDs only');
assert.equal(getUnlockedAchievementIds({ achievements: {} }).size, 0,
  'malformed achievement collections must not crash or inflate progress');

const originalStorage = globalThis.localStorage;
const originalGame = state.game;
const originalSlot = state.currentSlot;
let writes = 0;
globalThis.localStorage = {
  setItem() { writes += 1; throw new Error('simulated quota failure'); },
  getItem() { return null; },
  removeItem() {}
};
const game = { player: { achievements: [], gold: 10, stats: { kills: { goblin: 1 } } } };
state.game = game;
state.currentSlot = 1;
const emitted = [];
const onAchievement = payload => emitted.push(['achievement', payload]);
const onToast = payload => emitted.push(['toast', payload]);
const onLog = payload => emitted.push(['log', payload]);
const onUpdate = () => emitted.push(['game:update']);
on('achievement', onAchievement);
on('toast', onToast);
on('log', onLog);
on('game:update', onUpdate);

try {
  game.player.gold = Number.MAX_SAFE_INTEGER;
  checkAchievements();
  assert.deepEqual(game.player.achievements, [],
    'achievement reward must not unlock when its gold reward would overflow');
  assert.equal(game.player.gold, Number.MAX_SAFE_INTEGER);
  assert.equal(writes, 0, 'overflow rejection must not write a corrupted balance');
  game.player.gold = 10;

  checkAchievements();
  assert.equal(writes, 1);
  assert.deepEqual(game.player.achievements, []);
  assert.equal(game.player.gold, 10);
  assert.deepEqual(emitted, [], 'failure must suppress achievement events and UI feedback');

  game.player.achievements = 'corrupt-achievement-list';
  assert.equal(unlockedCount(), 0, 'malformed achievement data must not be counted as unlocked entries');
  checkAchievements();
  assert.equal(game.player.achievements, 'corrupt-achievement-list',
    'failed unlock must restore the original malformed achievement value');
  assert.equal(game.player.gold, 10, 'failed unlock must also restore the currency balance');
  assert.equal(writes, 2);

  game.player.achievements = [];
  globalThis.localStorage.setItem = () => {};
  game.player.stats = {
    kills: { goblin: '10', skeleton: -5, wolf: 1.5, ghost: Number.MAX_SAFE_INTEGER + 1 },
    chestsOpened: '10',
    goldEarned: 1000.5,
    eliteKills: Infinity,
    bossKills: -2,
    dailyChestsOpened: '3'
  };
  game.player.level = '100';
  game.player.riftBest = 50.5;
  game.storyShards = { flame: 'true', ice: 1, blood: {} };
  checkAchievements();
  assert.deepEqual(game.player.achievements, [],
    'malformed counters and truthy non-boolean shard values must not unlock achievements');
  assert.equal(game.player.gold, 10, 'malformed counters must not grant rewards');

  game.player.stats = { kills: { goblin: 1 } };
  game.player.level = 1;
  game.player.riftBest = 0;
  game.storyShards = {};
  checkAchievements();
  assert.deepEqual(game.player.achievements, ['first-blood']);
  assert.equal(game.player.gold, 13);
  assert.equal(emitted.filter(([type]) => type === 'achievement').length, 1);
  assert.equal(emitted.filter(([type]) => type === 'toast').length, 1);
  assert.equal(emitted.filter(([type]) => type === 'game:update').length, 1);

  checkAchievements();
  assert.equal(game.player.gold, 13, 'reward must not be duplicated');
  assert.equal(emitted.filter(([type]) => type === 'achievement').length, 1);
  console.log('check-achievement-save-transaction: PASS (rollback, deferred events, exactly-once reward)');
} finally {
  off('achievement', onAchievement);
  off('toast', onToast);
  off('log', onLog);
  off('game:update', onUpdate);
  state.game = originalGame;
  state.currentSlot = originalSlot;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
