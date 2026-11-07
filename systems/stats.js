import { state } from './state.js';
import { ITEMS } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { FORGE_BONUS } from '../data/npcs.js';
import { EFFECTS } from './status.js';
import { getTalentBonus } from './talents.js';

export function resolveCriticalChance(stats, extraBonus = 0) {
  const baseChance = Number.isFinite(stats?.critChance) ? stats.critChance : 0.1;
  const bonus = Number.isFinite(extraBonus) ? extraBonus : 0;
  return Math.max(0, Math.min(0.75, baseChance + bonus));
}

export function getEffStats() {
  const p = state.game?.player;

  if (!p) {
    return {
      atk: 0,
      mag: 0,
      def: 0,
      dex: 0,
      dodgeChance: 0,
      blockChance: 0,
      blockPower: 0.4,
      critChance: 0.05,
      armorPen: 0
    };
  }

  let atk = p.str || 0;
  let mag = p.int || 0;
  let def = Math.floor((p.con || 0) / 2);
  let dex = p.dex || 0;

  const classCombat = CLASSES[p.class]?.combat || {};

  let dodgeChance = classCombat.dodgeChance || 0;
  let blockChance = classCombat.blockChance || 0;
  let blockPower = classCombat.blockPower || 0.4;
  let critChance = classCombat.critChance || 0.05;
  let armorPen = classCombat.armorPen || 0;

  for (const [slot, rawInstance] of Object.entries(p.equipped || {})) {
    if (!rawInstance) continue;
    const instance = typeof rawInstance === 'string'
      ? { id: rawInstance, qty: 1 }
      : rawInstance;
    const item = ITEMS[instance.id];
    if (!item) continue;

    const bonus = {
      ...(item.bonus || {}),
      ...(instance.bonus || {})
    };

    for (const runeId of (instance.runes || [])) {
      const runeBonus = ITEMS[runeId]?.runeBonus || {};
      for (const [key, value] of Object.entries(runeBonus)) {
        bonus[key] = (bonus[key] || 0) + value;
      }
    }

    atk += bonus.attack || 0;
    mag += bonus.magic || 0;
    def += bonus.defense || bonus.armor || 0;
    dex += bonus.dex || 0;
    dodgeChance += bonus.dodgeChance || 0;
    blockChance += bonus.blockChance || 0;
    blockPower += bonus.blockPower || 0;
    critChance += bonus.critChance || 0;
    armorPen += bonus.armorPen || 0;

    const forgeBonus = FORGE_BONUS[instance.forgeLevel || 0] || 0;
    if (forgeBonus > 0 && slot === 'weapon') {
      if (item.bonus && item.bonus.magic !== undefined) mag += forgeBonus;
      else atk += forgeBonus;
    } else if (forgeBonus > 0 && slot === 'chest') {
      def += forgeBonus;
    }
  }

  if (Array.isArray(p.effects)) {
    for (const effect of p.effects) {
      const data = EFFECTS[effect?.id];
      if (!data) continue;

      atk += data.atkFlat || 0;
      mag += data.magFlat || 0;
      def += data.defFlat || 0;
    }
  }

  const talent = getTalentBonus(p);

  atk += talent.atkFlat;
  mag += talent.magFlat;
  def += talent.defFlat;
  dex += talent.dexFlat;

  def = Math.floor(def * talent.defMult);

  dodgeChance = Math.max(
    0,
    Math.min(
      0.65,
      dodgeChance + dex * 0.002 + talent.dodgeChance
    )
  );

  blockChance = Math.max(
    0,
    Math.min(0.6, blockChance + talent.blockChance)
  );

  blockPower = Math.max(
    0.3,
    Math.min(0.9, blockPower + talent.blockPower)
  );

  critChance = Math.max(
    0.01,
    Math.min(
      0.75,
      critChance + dex * 0.001 + talent.critChance
    )
  );

  armorPen = Math.max(
    0,
    armorPen + talent.armorPen
  );

  return {
    atk,
    mag,
    def,
    dex,
    dodgeChance,
    blockChance,
    blockPower,
    critChance,
    armorPen
  };
}
export function getSafeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function incrementSafeCount(value) {
  const count = getSafeCount(value);
  return count >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : count + 1;
}

export function getTotalKills(kills) {
  if (!kills || typeof kills !== 'object' || Array.isArray(kills)) return 0;
  return Object.values(kills).reduce((sum, value) => {
    return Math.min(Number.MAX_SAFE_INTEGER, sum + getSafeCount(value));
  }, 0);
}
