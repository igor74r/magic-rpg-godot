import { state } from './state.js';
import { ITEMS, RARITIES, rollRarity, rollItemAffixes } from '../data/items.js';
import { FORGE_BONUS } from '../data/npcs.js';

export const EQUIPMENT_SLOTS = [
  'weapon', 'head', 'shoulders', 'chest', 'gloves', 'legs',
  'boots', 'shield', 'ring1', 'ring2', 'amulet', 'cloak'
];

export const SLOT_TYPES = {
  weapon: ['weapon'],
  head: ['head', 'helmet'],
  shoulders: ['shoulders'],
  chest: ['chest', 'armor'],
  gloves: ['gloves', 'bracers', 'wrists'],
  legs: ['legs', 'greaves'],
  boots: ['boots'],
  shield: ['shield', 'offhand'],
  ring1: ['ring'],
  ring2: ['ring'],
  amulet: ['amulet', 'seal'],
  cloak: ['cloak', 'back']
};

export const EQUIPMENT_TYPES = new Set(
  Object.values(SLOT_TYPES).flat()
);

export const STACKABLE_TYPES = new Set([
  'consumable', 'scroll', 'quest', 'material', 'rune'
]);

export function normalizeEquipment(player) {
  if (!player) return;
  if (!Array.isArray(player.inventory)) player.inventory = [];
  const equipped = player.equipped && typeof player.equipped === 'object'
    ? player.equipped
    : {};
  const legacySlots = {
    armor: 'chest',
    helmet: 'head',
    back: 'cloak',
    wrists: 'gloves',
    hands: 'gloves',
    seal: 'amulet'
  };

  if (equipped.legs) {
    const legId = typeof equipped.legs === 'string' ? equipped.legs : equipped.legs.id;
    if (legId === 'windstep-boots' && !equipped.boots) {
      equipped.boots = equipped.legs;
      equipped.legs = null;
    }
  }

  for (const [oldSlot, newSlot] of Object.entries(legacySlots)) {
    if (!equipped[oldSlot]) continue;
    const instance = equipped[oldSlot];
    const id = typeof instance === 'string' ? instance : instance.id;
    const destination = oldSlot === 'hands' && id === 'tower-shield' ? 'shield'
      : oldSlot === 'legs' && id === 'windstep-boots' ? 'boots'
      : newSlot;
    if (!equipped[destination]) equipped[destination] = instance;
    else player.inventory.push(instance);
    delete equipped[oldSlot];
  }

  for (const slot of EQUIPMENT_SLOTS) {
    if (equipped[slot] === undefined) equipped[slot] = null;
    const value = equipped[slot];
    if (typeof value === 'string') {
      equipped[slot] = {
        id: value, qty: 1, runes: [],
        sockets: ITEMS[value]?.sockets || 0
      };
    } else if (value && typeof value === 'object') {
      if (!Array.isArray(value.runes)) value.runes = [];
      if (value.sockets === undefined) value.sockets = ITEMS[value.id]?.sockets || 0;
    }
  }
  player.equipped = equipped;
}

function getItemBySlot(item, slot) {
  if (!item || !slot) return false;
  return (SLOT_TYPES[slot] || []).includes(item.type);
}

function scaleBonusesToTier(baseBonus, rarity, random = Math.random) {
  const bonus = { ...(baseBonus || {}) };
  const range = RARITIES[rarity]?.statRange;
  if (!range) return bonus;

  const keys = Object.keys(bonus).filter(key =>
    ['attack', 'magic', 'defense', 'armor', 'dex', 'armorPen'].includes(key) &&
    Number.isFinite(bonus[key]) && bonus[key] > 0
  );
  const total = keys.reduce((sum, key) => sum + bonus[key], 0);
  if (!total || !keys.length) return bonus;

  const rawSample = random();
  const sample = Number.isFinite(rawSample) ? rawSample : Math.random();
  const normalized = Math.max(0, Math.min(1 - Number.EPSILON, sample));
  const target = range[0] + Math.floor(normalized * (range[1] - range[0] + 1));
  const parts = keys.map(key => {
    const exact = bonus[key] / total * target;
    return { key, value: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  let remainder = target - parts.reduce((sum, part) => sum + part.value, 0);
  parts.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < parts.length && remainder > 0; i++, remainder--) {
    parts[i].value++;
  }
  for (const part of parts) bonus[part.key] = part.value;
  return bonus;
}

function getItemUnitWeight(item) {
  if (Number.isFinite(item?.weight)) return Math.max(0, item.weight);
  if (item?.type === 'quest') return 0;
  if (EQUIPMENT_TYPES.has(item?.type)) return 5;
  if (item?.type === 'material') return 0.5;
  if (item?.type === 'consumable') return 0.5;
  if (item?.type === 'rune' || item?.type === 'scroll') return 0.2;
  return 1;
}

export function getInventoryWeight(player = state.game?.player) {
  return (Array.isArray(player?.inventory) ? player.inventory : []).reduce((total, inst) => {
    const item = ITEMS[inst?.id];
    // Invalid stack counts must not reduce weight or poison capacity with NaN.
    const quantity = Number.isSafeInteger(inst?.qty) && inst.qty > 0 ? inst.qty : 1;
    const unitWeight = getItemUnitWeight(item);
    const addedWeight = unitWeight * quantity;
    return Number.isFinite(addedWeight) && addedWeight >= 0
      ? total + addedWeight
      : total;
  }, 0);
}

export function getInventoryCapacity(player = state.game?.player) {
  const strength = Number.isFinite(player?.str) ? player.str : 10;
  const capacity = strength * 5;
  // Overflowing/corrupt strength must not grant infinite carrying capacity.
  return Number.isFinite(capacity) ? Math.max(10, capacity) : 10;
}

export function getInventorySlotCount(player = state.game?.player) {
  return (player?.inventory || []).filter(inst => !['quest', 'material'].includes(ITEMS[inst.id]?.type)).length;
}

export function canAddItem(id, qty = 1, player = state.game?.player) {
  const item = ITEMS[id];
  if (!item || !player || !Number.isSafeInteger(qty) || qty < 1) return { ok: false, reason: 'invalid' };
  if (item.type === 'quest') return { ok: true, weight: getInventoryWeight(player), capacity: getInventoryCapacity(player) };
  const amount = qty;
  const nextWeight = getInventoryWeight(player) + getItemUnitWeight(item) * amount;
  const stackable = STACKABLE_TYPES.has(item.type);
  const existing = stackable
    ? (player.inventory || []).find(inst => inst.id === id && !inst.rarity)
    : null;
  const currentStackQty = existing
    ? (Number.isSafeInteger(existing.qty) && existing.qty > 0 ? existing.qty : 1)
    : 0;
  if (existing && !Number.isSafeInteger(currentStackQty + amount)) {
    return { ok: false, reason: 'quantity' };
  }
  const addedSlots = ['quest', 'material'].includes(item.type) || existing ? 0 : stackable ? 1 : amount;
  const nextSlots = getInventorySlotCount(player) + addedSlots;
  if (nextSlots > 30) return { ok: false, reason: 'slots', slots: nextSlots, maxSlots: 30 };
  if (nextWeight > getInventoryCapacity(player) + 1e-9) {
    return { ok: false, reason: 'weight', weight: nextWeight, capacity: getInventoryCapacity(player) };
  }
  return { ok: true, weight: nextWeight, capacity: getInventoryCapacity(player), slots: nextSlots };
}

export function addItem(id, qty = 1, opts = {}) {
  const inv = state.game.player.inventory;
  const item = ITEMS[id];
  if (!item || !Number.isSafeInteger(qty) || qty <= 0) return [];

  const amount = qty;
  if (!canAddItem(id, amount, state.game.player).ok) return [];

  if (STACKABLE_TYPES.has(item.type)) {
    const existing = inv.find(i => i.id === id && !i.rarity);
    if (existing) {
      const currentQty = Number.isSafeInteger(existing.qty) && existing.qty > 0
        ? existing.qty
        : 1;
      existing.qty = currentQty + amount;
    } else {
      inv.push({ id, qty: amount });
    }
    return [{ id, qty: amount }];
  }

  const created = [];
  const random = typeof opts.random === 'function' ? opts.random : Math.random;
  for (let i = 0; i < amount; i++) {
    const rarity = opts.rarity === undefined
      ? rollRarity(random, {
          allowMythic: opts.allowMythic === true,
          player: state.game.player,
          isRift: !!state.overworld?.rifMode
        })
      : opts.rarity;
    if (!RARITIES[rarity] || (RARITIES[rarity].bossOnly && opts.allowMythic !== true)) continue;
    const bonus = scaleBonusesToTier(item.bonus || {}, rarity, random);
    const affixes = rollItemAffixes(item, rarity, random);
    for (const affix of affixes) {
      for (const [key, value] of Object.entries(affix.bonus)) {
        bonus[key] = (bonus[key] || 0) + value;
      }
    }
    const inst = {
      id, qty: 1, rarity, bonus,
      affixes,
      runes: [], sockets: item.sockets || 0
    };
    inv.push(inst);
    created.push(inst);
  }
  return created;
}

function createSeededRandom(seed) {
  let value = Math.floor(Math.max(0, Math.min(1, Number(seed) || 0)) * 0xffffffff) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}

export function addItemOrStore(id, qty = 1, opts = {}) {
  if (!opts || typeof opts !== 'object' || Array.isArray(opts)) return { created: [], stored: false };
  if (opts.rarity !== undefined && (!RARITIES[opts.rarity] || (RARITIES[opts.rarity].bossOnly && opts.allowMythic !== true))) {
    return { created: [], stored: false };
  }
  const created = addItem(id, qty, opts);
  if (created.length) return { created, stored: false };

  const item = ITEMS[id];
  const player = state.game?.player;
  const amount = Number.isSafeInteger(qty) ? qty : 0;
  if (!item || !player || amount < 1) return { created: [], stored: false };

  if (!Array.isArray(player.pendingLoot)) player.pendingLoot = [];
  player.pendingLoot.push({
    id,
    qty: amount,
    allowMythic: opts.allowMythic === true,
    seed: Math.random(),
    ...(opts.rarity ? { rarity: opts.rarity } : {})
  });
  return { created: [], stored: true };
}

export function claimPendingLoot(index) {
  const player = state.game?.player;
  if (!player || !Array.isArray(player.pendingLoot)) return { ok: false, reason: 'empty' };
  const entry = player.pendingLoot[index];
  if (!entry || !ITEMS[entry.id]) return { ok: false, reason: 'invalid' };

  const created = addItem(entry.id, entry.qty, {
    allowMythic: entry.allowMythic === true,
    random: Number.isFinite(entry.seed) ? createSeededRandom(entry.seed) : Math.random,
    ...(entry.rarity ? { rarity: entry.rarity } : {})
  });
  if (!created.length) return { ok: false, reason: 'capacity' };

  player.pendingLoot.splice(index, 1);
  return { ok: true, created, entry };
}

export function countItem(id) {
  const inv = state.game.player.inventory;
  return inv.reduce((total, it) => total + (it.id === id ? (it.qty || 1) : 0), 0);
}

export function removeItem(id, qty = 1) {
  const inv = state.game?.player?.inventory;
  if (!Array.isArray(inv) || !Number.isSafeInteger(qty) || qty <= 0) return false;
  if (countItem(id) < qty) return false;

  let remaining = qty;
  for (let i = inv.length - 1; i >= 0 && remaining > 0; i--) {
    const inst = inv[i];
    if (inst.id !== id) continue;
    const stackQty = Number.isSafeInteger(inst.qty) && inst.qty > 0 ? inst.qty : 1;
    const taken = Math.min(stackQty, remaining);
    remaining -= taken;
    if (taken === stackQty) inv.splice(i, 1);
    else inst.qty = stackQty - taken;
  }
  return remaining === 0;
}

function scoreInst(inst) {
  if (!inst) return 0;
  const obj = typeof inst === 'string' ? { id: inst, qty: 1 } : inst;
  const item = ITEMS[obj.id];
  if (!item) return 0;

  const bonus = {
    ...(item.bonus || {}),
    ...(obj.bonus || {})
  };
  for (const runeId of (obj.runes || [])) {
    const runeBonus = ITEMS[runeId]?.runeBonus || {};
    for (const [key, value] of Object.entries(runeBonus)) {
      bonus[key] = (bonus[key] || 0) + value;
    }
  }

  let score = (bonus.attack || 0) + (bonus.magic || 0);
  score += (bonus.defense || bonus.armor || 0) + (bonus.dex || 0);
  score += (bonus.armorPen || 0) * 2;
  score += (bonus.dodgeChance || 0) * 100;
  score += (bonus.critChance || 0) * 100;
  score += (bonus.blockChance || 0) * 80;
  score += (bonus.blockPower || 0) * 60;

  const forgeBonus = FORGE_BONUS[obj.forgeLevel || 0] || 0;
  if (forgeBonus > 0) {
    if (item.type === 'weapon') {
      score += forgeBonus;
    } else if (item.type === 'chest' || item.type === 'armor') {
      score += forgeBonus;
    }
  }

  return score;
}

function getEquipmentSlot(item, equipped) {
  if (!item || !EQUIPMENT_TYPES.has(item.type)) return null;
  if (item.type === 'ring') {
    if (!equipped.ring1) return 'ring1';
    if (!equipped.ring2) return 'ring2';
    return scoreInst(equipped.ring1) <= scoreInst(equipped.ring2)
      ? 'ring1'
      : 'ring2';
  }
  return EQUIPMENT_SLOTS.find(slot =>
    slot !== 'ring1' && slot !== 'ring2' && getItemBySlot(item, slot)
  ) || null;
}

export function equipItemByIndex(idx) {
  const p = state.game.player;
  normalizeEquipment(p);
  const inst = p.inventory[idx];
  if (!inst) return null;
  const item = ITEMS[inst.id];
  const slot = getEquipmentSlot(item, p.equipped);
  if (!slot) return null;

  if (inst.sockets === undefined) inst.sockets = item.sockets || 0;
  if (!Array.isArray(inst.runes)) inst.runes = [];

  const previous = p.equipped[slot];
  p.inventory.splice(idx, 1);
  if (previous) {
    const previousId = typeof previous === 'string' ? previous : previous.id;
    if (!canAddItem(previousId, 1, p).ok) {
      p.inventory.splice(idx, 0, inst);
      return null;
    }
    p.inventory.push(previous);
  }
  p.equipped[slot] = inst;
  return slot;
}

export function unequipItemBySlot(slot) {
  const p = state.game.player;
  normalizeEquipment(p);
  const inst = p.equipped?.[slot];
  if (!inst) return false;
  const itemId = typeof inst === 'string' ? inst : inst.id;
  if (!canAddItem(itemId, 1, p).ok) return false;
  p.inventory.push(inst);
  p.equipped[slot] = null;
  return true;
}

export function useItem(id) {
  const player = state.game?.player;
  const item = ITEMS[id];
  if (!player || !Array.isArray(player.inventory) || countItem(id) < 1) return false;
  if (!item || !['consumable', 'scroll'].includes(item.type)) return false;
  if (item.combatOnly) return false;
  if (item.type === 'scroll') {
    if (!Array.isArray(player.spells) || (item.spellId && player.spells.includes(item.spellId))) return false;
  }
  if (typeof item.use !== 'function') return false;
  item.use(player);
  return removeItem(id, 1);
}

export function equipBest() {
  const p = state.game.player;
  normalizeEquipment(p);
  const inv = p.inventory;
  let anyChange = false;

  for (const slot of EQUIPMENT_SLOTS) {
    let bestIdx = -1;
    let bestScore = scoreInst(p.equipped?.[slot]);

    for (let i = 0; i < inv.length; i++) {
      const item = ITEMS[inv[i].id];
      if (!getItemBySlot(item, slot)) continue;
      const score = scoreInst(inv[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      const inst = inv[bestIdx];
      const previous = p.equipped?.[slot];
      if (previous) {
        const previousId = typeof previous === 'string' ? previous : previous.id;
        const projectedInventory = inv.filter((_, index) => index !== bestIdx);
        if (!canAddItem(previousId, 1, { ...p, inventory: projectedInventory }).ok) continue;
      }
      inv.splice(bestIdx, 1);
      if (previous) inv.push(previous);
      p.equipped[slot] = inst;
      anyChange = true;
    }
  }
  return anyChange;
}

export function socketRune(inventoryIndex, equipmentSlot) {
  const p = state.game.player;
  normalizeEquipment(p);
  const runeInst = p.inventory?.[inventoryIndex];
  const rune = ITEMS[runeInst?.id];
  const gear = p.equipped?.[equipmentSlot];
  if (!runeInst || rune?.type !== 'rune' || !gear) return false;

  const gearObj = typeof gear === 'string'
    ? { id: gear, qty: 1, runes: [], sockets: ITEMS[gear]?.sockets || 0 }
    : gear;
  const gearDef = ITEMS[gearObj.id];
  if (!gearDef || (gearObj.sockets || gearDef.sockets || 0) <= (gearObj.runes || []).length) return false;

  if (!Array.isArray(gearObj.runes)) gearObj.runes = [];
  gearObj.runes.push(runeInst.id);
  p.equipped[equipmentSlot] = gearObj;
  removeItem(runeInst.id, 1);
  return true;
}
