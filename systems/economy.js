import { ITEMS, RARITIES } from '../data/items.js';
import { STORY } from '../data/story.js';
import { getFactionTradeDiscount } from './factions.js';

/**
 * Economic progression: prices scale by campaign act, never by player-controlled
 * level. This prevents exploits from leveling/farming outside the campaign.
 * Act multiplier: 1.00, 1.20, 1.40, 1.60, 1.80.
 */
export const ACT_PRICE_MULTIPLIERS = Object.freeze([1, 1.2, 1.4, 1.6, 1.8]);

export function getCurrentActIndex(player) {
  if (!player) return 0;
  let completed = 0;
  for (const act of STORY.acts) {
    const actComplete = act.missions.every(m => player.campaignClaimed?.[m.id] === true);
    if (!actComplete) {
      const index = Number.isInteger(act.number) ? act.number - 1 : completed;
      return Math.max(0, Math.min(index, ACT_PRICE_MULTIPLIERS.length - 1));
    }
    completed++;
  }
  return Math.min(completed, ACT_PRICE_MULTIPLIERS.length - 1);
}

export function getActPriceMultiplier(player) {
  return ACT_PRICE_MULTIPLIERS[getCurrentActIndex(player)] ?? 1;
}

export function getBuyPrice(id, player, game = null) {
  const item = ITEMS[id];
  if (!item || item.type === 'quest' || item.storyShard || item.bossOnly || RARITIES[item.rarity]?.bossOnly || !Number.isFinite(item.price) || item.price <= 0) return 0;
  const campaignPrice = item.price * getActPriceMultiplier(player);
  return Math.max(1, Math.round(campaignPrice * (1 - getFactionTradeDiscount(game))));
}

export function getSellPrice(instance, player) {
  const item = ITEMS[instance?.id];
  if (!item || item.type === 'quest' || item.storyShard || instance?.storyShard || item.bossOnly || !Number.isFinite(item.price) || item.price <= 0) return 0;
  const rarity = instance?.rarity;
  if (RARITIES[rarity]?.bossOnly) return 0;
  const rarityMultiplier = rarity && RARITIES[rarity]?.multiplier
    ? RARITIES[rarity].multiplier
    : 1;
  const stackable = item.type === 'consumable' || item.type === 'material' ||
    item.type === 'rune' || item.type === 'scroll';
  const rawQuantity = instance?.qty;
  const quantity = stackable
    ? (rawQuantity === undefined ? 1 : rawQuantity)
    : 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1) return 0;
  const tierPrice = rarity && RARITIES[rarity]?.price
    ? RARITIES[rarity].price
    : item.price * rarityMultiplier;
  const base = Math.floor(tierPrice * getActPriceMultiplier(player) * 0.35);
  const total = Math.max(1, base) * quantity;
  return Number.isSafeInteger(total) ? total : 0;
}

/**
 * Validate a gold reward against both the spendable balance and the
 * lifetime-earned statistic before either value is mutated.
 */
export function getGoldRewardTotals(player, amount) {
  if (!player || !Number.isSafeInteger(amount) || amount <= 0 ||
      !Number.isSafeInteger(player.gold) || player.gold < 0) return null;
  const earned = player.stats?.goldEarned ?? 0;
  if (!Number.isSafeInteger(earned) || earned < 0) return null;
  const gold = player.gold + amount;
  const goldEarned = earned + amount;
  if (!Number.isSafeInteger(gold) || !Number.isSafeInteger(goldEarned)) return null;
  return { gold, goldEarned };
}
