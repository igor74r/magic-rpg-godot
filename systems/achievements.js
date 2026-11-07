import { state } from './state.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { emit } from './events.js';
import { saveGame } from './save.js';
import { playSound } from './audio.js';

export function checkAchievements() {
  const g = state.game;
  if (!g || !g.player) return;
  const p = g.player;
  const originalAchievements = p.achievements;
  const previousAchievements = Array.isArray(originalAchievements)
    ? [...originalAchievements]
    : originalAchievements;
  const knownAchievements = Array.isArray(originalAchievements) ? originalAchievements : [];
  const previousGold = p.gold;

  let any = false;
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (knownAchievements.includes(a.id)) continue;
    let ok = false;
    try { ok = !!a.check(g); } catch (e) { console.warn('[achievements]', a.id, e); }
    if (!ok) continue;
    if (a.reward) {
      if (!Number.isSafeInteger(p.gold) || p.gold < 0 || !Number.isSafeInteger(p.gold + a.reward)) continue;
      p.gold += a.reward;
    }
    if (!Array.isArray(p.achievements)) p.achievements = [];
    p.achievements.push(a.id);
    unlocked.push(a);
    any = true;
  }

  if (any) {
    // Rewards are applied above; restore both unlocks and currency if persistence fails.
    if (!saveGame()) {
      p.achievements = previousAchievements;
      p.gold = previousGold;
      return;
    }
    for (const a of unlocked) {
      emit('log', { channel: 'game', msg: `🏆 Достижение: «${a.name}»${a.reward ? ` (+${a.reward}💰)` : ''}`, cls: 'success' });
      emit('toast', `🏆 ${a.name}${a.reward ? `! +${a.reward}💰` : '!'}`);
      emit('achievement', { id: a.id, name: a.name, desc: a.desc, icon: a.icon, reward: a.reward });
      playSound('levelup');
    }
    emit('game:update');
  }
}

export function getUnlockedAchievementIds(player = state.game?.player) {
  const knownIds = new Set(ACHIEVEMENTS.map(achievement => achievement.id));
  const values = Array.isArray(player?.achievements) ? player.achievements : [];
  return new Set(values.filter(id => typeof id === 'string' && knownIds.has(id)));
}

export function unlockedCount() {
  return getUnlockedAchievementIds().size;
}