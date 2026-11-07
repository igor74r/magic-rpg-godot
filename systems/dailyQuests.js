import { state } from './state.js';
import { saveGame } from './save.js';
import { emit } from './events.js';
import { addExp } from './progression.js';
import { checkAchievements } from './achievements.js';

const POOL = [
  { id: 'q-kill-any', type: 'kill', text: 'Убей 10 врагов', target: 'any', max: 10, gold: 8, exp: 50 },
  { id: 'q-kill-goblin', type: 'kill', text: 'Убей 5 гоблинов', target: 'goblin', max: 5, gold: 6, exp: 30 },
  { id: 'q-kill-skeleton', type: 'kill', text: 'Убей 5 скелетов', target: 'skeleton', max: 5, gold: 6, exp: 30 },
  { id: 'q-kill-wolf', type: 'kill', text: 'Убей 3 волков', target: 'wolf', max: 3, gold: 5, exp: 20 },
  { id: 'q-rift-floor', type: 'rift', text: 'Достигни 3 этажа Разлома', target: 'floor', max: 3, gold: 16, exp: 100 },
  { id: 'q-chest', type: 'chest', text: 'Открой 3 сундука', target: 'chest', max: 3, gold: 6, exp: 25 },
];

export function getDailyQuests() {
  const p = state.game?.player;
  if (!p) return [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const saved = p.dailyQuests && typeof p.dailyQuests === 'object' && !Array.isArray(p.dailyQuests)
    ? p.dailyQuests
    : { date: 0, list: [] };
  const lastDate = Number.isSafeInteger(saved.date) && saved.date >= 0 && saved.date <= now ? saved.date : 0;
  const savedList = Array.isArray(saved.list) ? saved.list : [];
  const seen = new Set();
  const normalized = savedList.map(entry => {
    const definition = POOL.find(quest => quest.id === entry?.id);
    if (!definition || seen.has(definition.id)) return null;
    seen.add(definition.id);
    const rawCurrent = entry.current;
    const current = Number.isSafeInteger(rawCurrent) && rawCurrent >= 0
      ? Math.min(definition.max, rawCurrent)
      : 0;
    // Completion is derived from normalized progress, never trusted from a save file.
    const completed = current >= definition.max;
    return { ...definition, current, completed, claimed: completed && entry.claimed === true };
  }).filter(Boolean);
  const expired = now - lastDate > dayMs;
  let safeFallback = null;

  if (expired || normalized.length !== 3) {
    const shuffled = [...POOL].sort(() => 0.5 - Math.random());
    p.dailyQuests = {
      date: now,
      list: shuffled.slice(0, 3).map(quest => ({ ...quest, current: 0, completed: false, claimed: false }))
    };
    if (!saveGame()) {
      p.dailyQuests = saved;
      safeFallback = [];
    }
  } else if (p.dailyQuests !== saved || JSON.stringify(saved.list) !== JSON.stringify(normalized)) {
    p.dailyQuests = { date: lastDate, list: normalized };
    if (!saveGame()) {
      p.dailyQuests = saved;
      safeFallback = normalized;
    }
  }
  return Array.isArray(safeFallback)
    ? safeFallback
    : (Array.isArray(p.dailyQuests?.list) ? p.dailyQuests.list : []);
}

export function updateQuestProgress(type, target, amount = 1, options = {}) {
  const p = state.game?.player;
  const increment = amount;
  if (!p || !Number.isSafeInteger(increment) || increment <= 0) {
    return { changed: false, completedTexts: [] };
  }
  const quests = getDailyQuests();
  if (quests !== p.dailyQuests?.list) {
    return { changed: false, completedTexts: [] };
  }

  let previousQuests;
  try {
    previousQuests = JSON.parse(JSON.stringify(p.dailyQuests));
  } catch {
    return;
  }

  let changed = false;
  const completedTexts = [];
  for (const q of quests) {
    if (q.completed || q.claimed || q.type !== type) continue;
    if (q.target !== 'any' && q.target !== target) continue;

    q.current += increment;
    if (q.current >= q.max) {
      q.current = q.max;
      q.completed = true;
      completedTexts.push(q.text);
    }
    changed = true;
  }
  if (changed && options?.persist !== false && !saveGame()) {
    p.dailyQuests = previousQuests;
    return { changed: false, completedTexts: [] };
  }
  if (changed && options?.notify !== false) {
    for (const questText of completedTexts) {
      emit('toast', `📜 Квест выполнен: ${questText}!`);
    }
  }
  return { changed, completedTexts };
}

export function claimQuestReward(questId) {
  const p = state.game?.player;
  if (!p) return false;
  const quests = getDailyQuests();
  if (quests !== p.dailyQuests?.list) return false;
  const q = quests.find(entry => entry.id === questId);
  const definition = POOL.find(entry => entry.id === questId);
  if (!q || !definition || q.completed !== true || q.claimed === true) return false;

  // Never replace an invalid balance with zero: a reward must not erase save data.
  if (!Number.isSafeInteger(p.gold) || p.gold < 0) return false;
  const nextGold = p.gold + definition.gold;
  if (!Number.isSafeInteger(nextGold)) return false;
  const previousGoldEarned = Number.isSafeInteger(p.stats?.goldEarned) && p.stats.goldEarned >= 0
    ? p.stats.goldEarned
    : 0;
  const nextGoldEarned = previousGoldEarned + definition.gold;
  if (!Number.isSafeInteger(nextGoldEarned)) return false;

  let previousPlayer;
  try {
    previousPlayer = JSON.parse(JSON.stringify(p));
  } catch {
    return false;
  }
  q.claimed = true;
  p.gold = nextGold;
  if (!p.stats || typeof p.stats !== 'object' || Array.isArray(p.stats)) p.stats = {};
  p.stats.goldEarned = nextGoldEarned;
  if (definition.exp) addExp(definition.exp);

  const parts = [`+${definition.gold}💰`];
  if (definition.exp) parts.push(`+${definition.exp} EXP`);
  if (!saveGame()) {
    for (const key of Object.keys(p)) delete p[key];
    Object.assign(p, previousPlayer);
    return false;
  }
  emit('toast', `📜 Награда: ${parts.join(', ')}`);
  emit('log', {
    channel: 'game',
    msg: `📜 Квест «${q.text}» — ${parts.join(', ')}`,
    cls: 'success'
  });
  checkAchievements();
  return true;
}
