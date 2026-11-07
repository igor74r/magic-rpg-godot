import { getFactionLootBonus } from './factions.js';

/**
 * Shared loot modifiers for enemy drops and rarity rolls.
 * Luck contributes +0.5% per point (maximum +50% at 100 Luck).
 * Reputation is an optional multiplier supplied by the reputation system.
 */
export function getLootLuck(player) {
  const level = Math.max(1, Math.floor(Number(player?.level) || 1));
  const fallback = 5 + (level - 1) * 0.5;
  const raw = Number.isFinite(player?.luck) ? player.luck : fallback;
  return Math.max(0, Math.min(100, raw));
}

export function getLootReputationModifier(player) {
  const raw = Number.isFinite(player?.reputationModifier)
    ? player.reputationModifier
    : Number.isFinite(player?.reputation?.lootModifier)
      ? player.reputation.lootModifier
      : 0;
  return Math.max(-0.9, Math.min(1, raw));
}

export function getLootDropChance(baseChance, player, game = null) {
  const base = Number.isFinite(baseChance)
    ? Math.max(0, Math.min(1, baseChance))
    : 0;
  const luckMultiplier = 1 + getLootLuck(player) * 0.005;
  const reputationMultiplier = 1 + getLootReputationModifier(player);
  const factionMultiplier = 1 + getFactionLootBonus(game);
  return Math.max(0, Math.min(1, base * luckMultiplier * reputationMultiplier * factionMultiplier));
}

export function getRiftLootTierBonus(player) {
  const cleared = Array.isArray(player?.riftClearedLocations)
    ? new Set(player.riftClearedLocations).size
    : 0;
  return Math.min(0.30, Math.max(0, cleared) * 0.10);
}
