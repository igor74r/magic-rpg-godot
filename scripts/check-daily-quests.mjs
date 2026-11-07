import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { on, off } from '../systems/events.js';
import { getDailyQuests, updateQuestProgress, claimQuestReward } from '../systems/dailyQuests.js';

const previousStorage = globalThis.localStorage;
const saved = new Map();
globalThis.localStorage = { setItem: (key, value) => saved.set(key, String(value)) };
state.currentSlot = 1;
const now = Date.now();

try {
  state.game = {
    version: 17,
    player: {
      level: 1, exp: 0, expNext: 100, gold: 10,
      stats: { kills: {}, goldEarned: 995, dailyChestsOpened: 0 },
      achievements: [],
      dailyQuests: {
        date: now,
        list: [
          { id: 'q-kill-any', text: '<img src=x onerror=alert(1)>', type: 'kill', target: 'any', max: 10, current: 10, completed: true, claimed: false, gold: 999999, exp: 999999 },
          { id: 'q-kill-any', current: 10, completed: true, claimed: false },
          { id: '<svg onload=alert(1)>', current: 10, completed: true, claimed: false }
        ]
      }
    }
  };
  // A failed repair must not leak a malformed non-array list to UI/event callers.
  const originalSetItemForMalformed = globalThis.localStorage.setItem;
  state.game.player.dailyQuests = { date: now, list: null };
  globalThis.localStorage.setItem = () => { throw new Error('simulated quota failure'); };
  assert.deepEqual(getDailyQuests(), [],
    'malformed daily quest storage must return a safe array when repair cannot be saved');
  globalThis.localStorage.setItem = originalSetItemForMalformed;

  const quests = getDailyQuests();
  assert.equal(quests.length, 3, 'malformed or duplicate daily quests should be replaced');
  state.game.player.dailyQuests = {
    date: now,
    list: [
      { id: 'q-kill-any', current: '10', claimed: false },
      { id: 'q-kill-goblin', current: 1.5, claimed: false },
      { id: 'q-kill-skeleton', current: -2, claimed: false }
    ]
  };
  const malformedProgress = getDailyQuests();
  assert.equal(malformedProgress.find(q => q.id === 'q-kill-any').current, 0,
    'numeric strings must not complete a daily quest');
  assert.equal(malformedProgress.find(q => q.id === 'q-kill-goblin').current, 0,
    'fractional daily progress must be rejected');
  assert.equal(malformedProgress.find(q => q.id === 'q-kill-skeleton').current, 0,
    'negative daily progress must be rejected');
  assert.equal(claimQuestReward('q-kill-any'), false,
    'malformed saved progress must not grant a daily quest reward');
  assert.equal(updateQuestProgress('kill', 'any', '10').changed, false,
    'external numeric-string increments must be rejected');

  const corruptDailySave = {
    date: now,
    list: [
      { id: 'q-kill-any', current: '10', completed: true, claimed: false },
      { id: 'q-kill-goblin', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  state.game.player.dailyQuests = corruptDailySave;
  const originalSetItemForCounterFailure = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('simulated quota failure'); };
  const safeFallback = getDailyQuests();
  assert.equal(safeFallback.find(q => q.id === 'q-kill-any').current, 0,
    'failed normalization must return safe progress, not the raw corrupted save');
  assert.equal(safeFallback.find(q => q.id === 'q-kill-any').completed, false,
    'failed normalization must not trust a forged completion flag');
  assert.equal(claimQuestReward('q-kill-any'), false,
    'storage failure must not let corrupted progress claim a reward');
  assert.deepEqual(state.game.player.dailyQuests, corruptDailySave,
    'failed normalization must still roll back the original persisted state');

  const validProgressNeedsRepair = {
    date: now,
    list: [
      { id: 'q-kill-any', current: 10, completed: true, claimed: false, gold: 999999, exp: 999999 },
      { id: 'q-kill-goblin', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  state.game.player.dailyQuests = validProgressNeedsRepair;
  const detachedFallback = getDailyQuests();
  assert.equal(detachedFallback.find(q => q.id === 'q-kill-any').completed, true,
    'valid progress remains visible in a normalized fallback');
  assert.equal(claimQuestReward('q-kill-any'), false,
    'a detached fallback list must not grant a reward before normalization is persisted');
  assert.equal(state.game.player.gold, 10,
    'failed normalization must not grant currency from a detached quest list');
  globalThis.localStorage.setItem = originalSetItemForCounterFailure;
  assert.ok(quests.every(quest => !quest.text.includes('<')), 'quest display text must come from trusted definitions');

  state.game.player.dailyQuests = {
    date: now,
    list: [
      { id: 'q-kill-any', current: 10, completed: true, claimed: false, gold: 999999, exp: 999999 },
      { id: 'q-kill-goblin', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  const normalized = getDailyQuests();
  const target = normalized.find(quest => quest.id === 'q-kill-any');
  assert.ok(target);
  assert.equal(target.gold, 8);
  assert.equal(target.exp, 50);
  assert.equal(claimQuestReward('q-kill-any'), true);
  assert.equal(state.game.player.gold, 33, 'canonical daily reward and rich-achievement reward must both be granted');
  assert.ok(state.game.player.achievements.includes('rich'),
    'daily quest gold must immediately trigger the lifetime gold-earned achievement');
  assert.equal(state.game.player.stats.goldEarned, 1003,
    'daily quest gold must count toward the lifetime gold-earned achievement');
  assert.equal(state.game.player.exp, 50);
  assert.equal(claimQuestReward('q-kill-any'), false, 'daily quest reward can only be claimed once');

  state.game.player.dailyQuests = {
    date: now,
    list: [
      { id: 'q-kill-wolf', current: 0, completed: true, claimed: false },
      { id: 'q-kill-any', current: 0, completed: false, claimed: false },
      { id: 'q-kill-goblin', current: 0, completed: false, claimed: false }
    ]
  };
  const repairedCompletion = getDailyQuests().find(quest => quest.id === 'q-kill-wolf');
  assert.equal(repairedCompletion.completed, false, 'completion must be derived from progress, not a saved boolean');
  assert.equal(repairedCompletion.claimed, false, 'an incomplete quest cannot retain a claimed reward flag');
  assert.equal(claimQuestReward('q-kill-wolf'), false, 'a forged completion flag must not unlock a reward');

  updateQuestProgress('kill', 'goblin', 2);
  const goblinQuest = getDailyQuests().find(quest => quest.id === 'q-kill-goblin');
  assert.equal(goblinQuest.current, 2);
  assert.equal(typeof goblinQuest.current, 'number', 'numeric progress input must not turn the counter into a string');

  state.game.player.dailyQuests = {
    date: now,
    list: [
      { id: 'q-kill-goblin', current: 5, completed: true, claimed: false },
      { id: 'q-kill-any', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  getDailyQuests();
  state.game.player.gold = Number.MAX_SAFE_INTEGER;
  assert.equal(claimQuestReward('q-kill-goblin'), false, 'daily reward must reject gold balance overflow');
  assert.equal(state.game.player.gold, Number.MAX_SAFE_INTEGER);
  assert.equal(state.game.player.dailyQuests.list[0].claimed, false, 'overflow rejection must not consume the reward');

  for (const invalidGold of ['100', -1, NaN, Infinity]) {
    state.game.player.dailyQuests = {
      date: now,
      list: [
        { id: 'q-kill-goblin', current: 5, completed: true, claimed: false },
        { id: 'q-kill-any', current: 0, completed: false, claimed: false },
        { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
      ]
    };
    getDailyQuests();
    state.game.player.gold = invalidGold;
    assert.equal(claimQuestReward('q-kill-goblin'), false, 'daily reward must reject invalid gold balances');
    assert.equal(state.game.player.gold, invalidGold, 'invalid gold balance must remain untouched');
    assert.equal(state.game.player.dailyQuests.list[0].claimed, false, 'invalid balance must not consume the reward');
  }

  state.game.player.dailyQuests = {
    date: now + 3 * 24 * 60 * 60 * 1000,
    list: [
      { id: 'q-kill-goblin', current: 4, completed: false, claimed: false },
      { id: 'q-kill-any', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  getDailyQuests();
  assert.ok(state.game.player.dailyQuests.date <= Date.now(), 'future quest timestamps must be repaired');
  assert.ok(state.game.player.dailyQuests.list.every(quest => quest.current === 0), 'future-dated quests must refresh instead of freezing daily rotation');

  state.game.player.dailyQuests = {
    date: now,
    list: [
      { id: 'q-kill-any', current: 0, completed: false, claimed: false },
      { id: 'q-kill-goblin', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  getDailyQuests();
  const before = state.game.player.dailyQuests.list[0].current;
  updateQuestProgress('kill', 'any', -5);
  assert.equal(state.game.player.dailyQuests.list[0].current, before, 'negative progress must be ignored');
  updateQuestProgress('kill', 'any', Infinity);
  assert.equal(state.game.player.dailyQuests.list[0].current, before, 'non-finite progress must be ignored');
  assert.ok(saved.has('magic-rpg-save-1'), 'normalized quests and rewards should be saved');

  state.game.player.dailyQuests = {
    date: Date.now(),
    list: [
      { id: 'q-kill-goblin', current: 0, completed: false, claimed: false },
      { id: 'q-kill-any', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  getDailyQuests();
  const beforeFailedProgress = JSON.parse(JSON.stringify(state.game.player.dailyQuests));
  const originalSetItem = globalThis.localStorage.setItem;
  let completionToasts = 0;
  const onToast = message => {
    if (String(message).includes('Квест выполнен')) completionToasts += 1;
  };
  on('toast', onToast);
  globalThis.localStorage.setItem = () => { throw new Error('simulated quota failure'); };
  try {
    updateQuestProgress('kill', 'goblin', 5);
    assert.deepEqual(state.game.player.dailyQuests, beforeFailedProgress,
      'failed persistence must roll back daily quest progress and completion');
    assert.equal(completionToasts, 0,
      'completion feedback must not appear for an unpersisted quest');
  } finally {
    off('toast', onToast);
    globalThis.localStorage.setItem = originalSetItem;
  }

  state.game.player.dailyQuests = {
    date: Date.now(),
    list: [
      { id: 'q-kill-goblin', current: 5, completed: true, claimed: false },
      { id: 'q-kill-any', current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', current: 0, completed: false, claimed: false }
    ]
  };
  getDailyQuests();
  state.game.player.gold = 10;
  state.game.player.exp = 0;
  state.game.player.level = 1;
  const beforeFailedReward = JSON.parse(JSON.stringify(state.game.player));
  const originalRewardSetItem = globalThis.localStorage.setItem;
  let rewardToasts = 0;
  let rewardLogs = 0;
  const onRewardToast = message => {
    if (String(message).includes('Награда')) rewardToasts += 1;
  };
  const onRewardLog = entry => {
    if (String(entry?.msg).includes('Квест')) rewardLogs += 1;
  };
  on('toast', onRewardToast);
  on('log', onRewardLog);
  globalThis.localStorage.setItem = () => { throw new Error('simulated quota failure'); };
  try {
    assert.equal(claimQuestReward('q-kill-goblin'), false,
      'a reward must not be claimed when its save fails');
    assert.deepEqual(state.game.player, beforeFailedReward,
      'failed reward persistence must roll back gold, experience and claimed state');
    assert.equal(rewardToasts, 0, 'failed reward must not show success feedback');
    assert.equal(rewardLogs, 0, 'failed reward must not append a success log');
  } finally {
    off('toast', onRewardToast);
    off('log', onRewardLog);
    globalThis.localStorage.setItem = originalRewardSetItem;
  }

  // A daily chest is one transaction: a failed write must not grant gold/items or consume the cooldown.
  const { openDailyChest } = await import('../ui/village.js');
  const chestPlayer = {
    level: 3, gold: 25, inventory: [], pendingLoot: [],
    stats: { kills: {}, deaths: 0, goldEarned: 0, chestsOpened: 0, dailyChestAt: 0, dailyChestsOpened: 0 }
  };
  state.game = { version: 17, player: chestPlayer };
  const beforeFailedChest = JSON.parse(JSON.stringify(chestPlayer));
  const originalChestSetItem = globalThis.localStorage.setItem;
  let chestSuccessLogs = 0;
  let chestSuccessToasts = 0;
  let chestUpdates = 0;
  const onChestLog = entry => { if (String(entry?.msg).includes('Ежедневный сундук')) chestSuccessLogs += 1; };
  const onChestToast = message => {
    if (String(message).includes('🎁 +8💰')) chestSuccessToasts += 1;
  };
  const onChestUpdate = () => { chestUpdates += 1; };
  on('log', onChestLog);
  on('toast', onChestToast);
  on('game:update', onChestUpdate);
  globalThis.localStorage.setItem = () => { throw new Error('simulated daily chest storage failure'); };
  try {
    openDailyChest();
    assert.deepEqual(chestPlayer, beforeFailedChest,
      'failed daily chest persistence must restore gold, item reward and cooldown');
    assert.equal(chestSuccessLogs, 0, 'failed daily chest must not append a success log');
    assert.equal(chestSuccessToasts, 0, 'failed daily chest must not show success feedback');
    assert.equal(chestUpdates, 0, 'failed daily chest must not broadcast a successful update');
  } finally {
    off('log', onChestLog);
    off('toast', onChestToast);
    off('game:update', onChestUpdate);
    globalThis.localStorage.setItem = originalChestSetItem;
  }

  console.log('check-daily-quests: PASS (normalization, canonical rewards, forged completion, future dates, progress and reward rollback guards)');
} finally {
  state.game = null;
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
}
