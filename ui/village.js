import { state } from '../systems/state.js';
import { saveGame } from '../systems/save.js';
import { addItemOrStore } from '../systems/inventory.js';
import { checkAchievements } from '../systems/achievements.js';
import { emit } from '../systems/events.js';
import { playSound } from '../systems/audio.js';
import { ITEMS } from '../data/items.js';

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function canOpenDaily() {
  const p = state.game?.player;
  if (!p) return false;
  const last = p.stats?.dailyChestAt || 0;
  return Date.now() - last >= DAILY_COOLDOWN_MS;
}

export function timeUntilDaily() {
  const p = state.game?.player;
  if (!p) return 0;
  const last = p.stats?.dailyChestAt || 0;
  const remaining = DAILY_COOLDOWN_MS - (Date.now() - last);
  return Math.max(0, remaining);
}

export function formatRemaining(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

export function openDailyChest() {
  if (!canOpenDaily()) {
    emit('toast', 'Ежедневный сундук ещё не готов');
    return;
  }
  const p = state.game.player;
  if (!Number.isSafeInteger(p.gold) || p.gold < 0 || !Number.isSafeInteger(p.gold + 8)) {
    emit('toast', '❌ Не удалось выдать награду: проверьте баланс золота.');
    return;
  }

  let snapshot;
  try {
    snapshot = JSON.parse(JSON.stringify(p));
  } catch {
    emit('toast', '❌ Не удалось подготовить ежедневную награду. Попробуйте ещё раз.');
    return;
  }

  if (!p.stats || typeof p.stats !== 'object' || Array.isArray(p.stats)) {
    p.stats = { kills: {}, deaths: 0, goldEarned: 0, chestsOpened: 0, dailyChestAt: 0, dailyChestsOpened: 0 };
  }
  const previousDailyCount = Number.isSafeInteger(p.stats.dailyChestsOpened) && p.stats.dailyChestsOpened >= 0
    ? p.stats.dailyChestsOpened
    : 0;
  const previousGoldEarned = Number.isSafeInteger(p.stats.goldEarned) && p.stats.goldEarned >= 0
    ? p.stats.goldEarned
    : 0;
  if (!Number.isSafeInteger(previousDailyCount + 1) || !Number.isSafeInteger(previousGoldEarned + 8)) {
    emit('toast', '❌ Не удалось выдать награду: счётчик сундуков или золота переполнен.');
    return;
  }

  p.gold += 8;
  p.stats.goldEarned = previousGoldEarned + 8;
  p.stats.dailyChestAt = Date.now();
  p.stats.dailyChestsOpened = previousDailyCount + 1;

  const pool = ['health-potion', 'mana-potion', 'strong-health-potion', 'strong-mana-potion'];
  const id = pool[Math.floor(Math.random() * pool.length)];
  const reward = addItemOrStore(id, 1);

  if (!saveGame()) {
    for (const key of Object.keys(p)) delete p[key];
    Object.assign(p, snapshot);
    emit('toast', '❌ Не удалось сохранить ежедневный сундук. Награда не выдана; попробуйте ещё раз.');
    return;
  }

  playSound('chest');
  const rewardText = reward.stored
    ? `${ITEMS[id].name} отправлено в хранилище добычи — в сумке нет места`
    : ITEMS[id].name;
  emit('log', { channel: 'game', msg: `🎁 Ежедневный сундук: +8💰, ${rewardText}`, cls: reward.stored ? 'warning' : 'success' });
  emit('toast', reward.stored ? `🎁 +8💰. ${ITEMS[id].name} сохранено в хранилище добычи.` : `🎁 +8💰 и ${ITEMS[id].name}`);

  checkAchievements();
  emit('game:update');
}