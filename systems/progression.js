import { state } from './state.js';
import { emit } from './events.js';
import { playSound } from './audio.js';

export const MAX_LEVEL = 100;

// Campaign XP is deliberately tiered by act. The 25 main missions and their
// required kills should carry a normally played character through levels 1–50;
// post-campaign activities continue the curve toward the level-100 cap.
const CAMPAIGN_XP_BANDS = [
  { maxLevel: 10, exp: 125 },
  { maxLevel: 20, exp: 259 },
  { maxLevel: 30, exp: 269 },
  { maxLevel: 40, exp: 369 },
  { maxLevel: 50, exp: 535 }
];

export function getExpNext(level) {
  if (!Number.isSafeInteger(level) || level < 1) return 125;
  if (level >= MAX_LEVEL) return Infinity;
  const band = CAMPAIGN_XP_BANDS.find(item => level <= item.maxLevel);
  if (band) return band.exp;
  return Math.floor(535 * Math.pow(level / 50, 1.5));
}

export function addExp(amount) {
  const p = state.game?.player;
  if (!p || !Number.isSafeInteger(amount) || amount <= 0 ||
      !Number.isSafeInteger(p.level) || p.level < 1 || p.level >= MAX_LEVEL) return;

  // Keep malformed progress from poisoning the level-up loop or the save.
  if (!Number.isSafeInteger(p.exp) || p.exp < 0) p.exp = 0;
  // Normalize reward counters before level-up to prevent malformed imports
  // from concatenating strings or propagating Infinity into progression.
  if (!Number.isSafeInteger(p.statPoints) || p.statPoints < 0) p.statPoints = 0;
  if (!Number.isSafeInteger(p.passivePoints) || p.passivePoints < 0) p.passivePoints = 0;
  const requiredExp = getExpNext(p.level);
  if (!Number.isSafeInteger(p.expNext) || p.expNext !== requiredExp) {
    p.expNext = requiredExp;
  }
  const nextExp = p.exp + amount;
  if (!Number.isSafeInteger(nextExp)) return;
  p.exp = nextExp;

  while (p.level < MAX_LEVEL && p.exp >= p.expNext) {
    p.exp -= p.expNext;
    p.level++;
    p.luck = Math.min(100, (Number.isFinite(p.luck) ? p.luck : 5) + 0.5);
    p.expNext = getExpNext(p.level);

    // Прирост специализируется под выбранный класс.
    if (p.class === 'warrior') {
      p.maxHp += 14;
      p.maxMp += 5;
      p.str += 2;
      p.con += 1;
      p.dex += 1;
    } else if (p.class === 'mage' || p.class === 'priest') {
      p.maxHp += 8;
      p.maxMp += 13;
      p.int += 2;
      p.wis += 1;
      p.con += 1;
    } else if (p.class === 'archer') {
      p.maxHp += 10;
      p.maxMp += 7;
      p.dex += 2;
      p.str += 1;
      p.con += 1;
    }

    p.statPoints++;
    p.passivePoints++;

    p.hp = p.maxHp;

    if (p.class === 'mage' || p.class === 'priest') {
      p.mp = p.maxMp;
    }

    emit('log', {
      channel: 'game',
      msg: `⬆️ Уровень ${p.level}! +1 очко характеристик и +1 очко пассивного древа.`,
      cls: 'success'
    });

    emit('toast', `Уровень ${p.level}! Новое очко древа доступно.`);
    playSound('levelup');
  }
}
