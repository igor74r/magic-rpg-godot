import { state } from './state.js';
import { ITEMS, RARITIES } from '../data/items.js';
import { NPCS, FORGE_BONUS } from '../data/npcs.js';
import { addItem, removeItem, countItem, EQUIPMENT_TYPES } from './inventory.js';
import { saveGame } from './save.js';
import { emit } from './events.js';
import { getCurrentActIndex } from './economy.js';

export function getEquipmentForgeLevel(slot) {
  const inst = state.game?.player?.equipped?.[slot];
  if (!inst) return 0;
  if (typeof inst === 'string') return 0;
  const level = inst.forgeLevel;
  return Number.isSafeInteger(level) && level >= 0 ? level : 0;
}

export function canUpgrade(slot) {
  const p = state.game?.player;
  if (!p || !p.equipped || !Object.prototype.hasOwnProperty.call(p.equipped, slot)) {
    return { ok: false, msg: 'Слот экипировки не найден' };
  }
  const inst = p.equipped[slot];
  if (!inst) return { ok: false, msg: 'Сначала экипируйте предмет в этот слот' };
  if (typeof inst !== 'object' || !ITEMS[inst.id]) return { ok: false, msg: 'Ошибка формата предмета' };

  const level = Number.isSafeInteger(inst.forgeLevel) && inst.forgeLevel >= 0
    ? inst.forgeLevel
    : 0;
  const maxLevel = NPCS.blacksmith.maxLevel;
  if (level >= maxLevel) return { ok: false, msg: 'Максимальный уровень улучшения' };

  const upgrade = NPCS.blacksmith.upgrades[level];
  if (!upgrade || !Number.isSafeInteger(upgrade.cost) || upgrade.cost < 0) {
    return { ok: false, msg: 'Улучшение недоступно' };
  }
  if (!Number.isSafeInteger(p.gold) || p.gold < 0 || p.gold < upgrade.cost) {
    return { ok: false, msg: `Не хватает золота (нужно ${upgrade.cost})` };
  }

  return { ok: true, nextLevel: level + 1, cost: upgrade.cost, bonus: upgrade.forgeBonus, statPercent: upgrade.statPercent || 0.05 };
}
export function upgradeEquipment(slot) {
  const check = canUpgrade(slot);
  if (!check.ok) return check;

  const p = state.game.player;
  const inst = p.equipped[slot];
  const previousGold = p.gold;
  const previousBonus = inst.bonus ? { ...inst.bonus } : inst.bonus;
  const previousUpgradePercent = inst.upgradePercent;
  const previousForgeLevel = inst.forgeLevel;
  p.gold -= check.cost;
  if (!inst.bonus || typeof inst.bonus !== 'object') inst.bonus = { ...(ITEMS[inst.id].bonus || {}) };
  for (const [key, value] of Object.entries(inst.bonus)) {
    if (typeof value !== 'number') continue;
    const scaled = value * (1 + check.statPercent);
    inst.bonus[key] = ['dodgeChance', 'blockChance', 'blockPower', 'critChance'].includes(key)
      ? Number(scaled.toFixed(4))
      : Math.round(scaled);
  }
  const previousPercent = Number.isFinite(inst.upgradePercent) && inst.upgradePercent >= 0
    ? Math.min(1, inst.upgradePercent)
    : 0;
  inst.upgradePercent = Math.min(1, previousPercent + check.statPercent);
  inst.forgeLevel = check.nextLevel;

  if (!saveGame()) {
    p.gold = previousGold;
    inst.bonus = previousBonus;
    inst.upgradePercent = previousUpgradePercent;
    inst.forgeLevel = previousForgeLevel;
    return { ok: false, msg: 'Не удалось сохранить улучшение; золото и экипировка восстановлены' };
  }
  emit('toast', `⚒️ Улучшено до +${inst.forgeLevel} (−${check.cost}💰)`);
  emit('game:update');
  return { ok: true };
}

export function healAtHealer() {
  const p = state.game.player;
  const cost = NPCS.healer.cost;

  if (p.hp >= p.maxHp && p.mp >= p.maxMp) {
    return { ok: false, msg: 'Вы полностью здоровы' };
  }
  if (!Number.isSafeInteger(p.gold) || p.gold < 0) {
    return { ok: false, msg: 'Некорректный баланс золота' };
  }
  if (p.gold < cost) {
    return { ok: false, msg: `Не хватает золота (нужно ${cost})` };
  }

  const previous = { gold: p.gold, hp: p.hp, mp: p.mp };
  p.gold -= cost;
  p.hp = p.maxHp;
  if (p.class !== 'warrior') p.mp = p.maxMp;

  if (!saveGame()) {
    p.gold = previous.gold;
    p.hp = previous.hp;
    p.mp = previous.mp;
    return { ok: false, msg: 'Не удалось сохранить лечение; состояние и золото восстановлены' };
  }
  emit('toast', `💚 Полное исцеление (−${cost}💰)`);
  emit('game:update');
  return { ok: true };
}

function cloneInventoryForRollback(inventory) {
  return (Array.isArray(inventory) ? inventory : []).map(item => {
    const clone = { ...item };
    if (item.bonus && typeof item.bonus === 'object') clone.bonus = { ...item.bonus };
    if (Array.isArray(item.affixes)) clone.affixes = item.affixes.map(affix => ({
      ...affix,
      ...(affix.bonus && typeof affix.bonus === 'object' ? { bonus: { ...affix.bonus } } : {})
    }));
    if (Array.isArray(item.runes)) clone.runes = [...item.runes];
    return clone;
  });
}

function findCraftRecipe(recipeId) {
  return [
    ...(NPCS.alchemist.recipes || []),
    ...(NPCS.blacksmith.recipes || [])
  ].find(recipe => recipe.id === recipeId) || null;
}

function getRecipeTier(recipe) {
  return recipe.craftTier || RARITIES[recipe.rarity]?.tier || 1;
}

function isCampCrafting() {
  return state.game?.location === 'camp' ||
    state.overworld?.locationId === 'camp' ||
    state.overworld?.sourceLocationId === 'camp';
}

export function canCraftRecipe(recipeId) {
  const p = state.game?.player;
  const recipe = findCraftRecipe(recipeId);
  if (!p || !recipe || !Array.isArray(recipe.ingredients) || !ITEMS[recipe.result] ||
      !Number.isSafeInteger(recipe.qty) || recipe.qty < 1) {
    return { ok: false, msg: 'Рецепт повреждён или не найден' };
  }
  if (ITEMS[recipe.result].storyShard || recipe.rarity === 'mythic' || recipe.craftTier === 6) {
    return { ok: false, msg: 'Сюжетные осколки и T6 нельзя создавать в мастерской' };
  }

  const tier = getRecipeTier(recipe);
  const actIndex = getCurrentActIndex(p);
  if (Number.isSafeInteger(recipe.requiredAct) && recipe.requiredAct > actIndex + 1) {
    return { ok: false, msg: `Этот рецепт откроется в ${recipe.requiredAct}-м акте` };
  }
  if (tier >= 4) {
    const crafted = p.craftedHighTierByAct || {};
    if ((crafted[actIndex] || 0) >= 1) {
      return { ok: false, msg: 'В этом акте уже создан один предмет T4 или выше' };
    }
  }
  if (tier === 5 && (actIndex !== 4 || recipe.station !== 'final-forge')) {
    return { ok: false, msg: 'T5 можно создавать только в кузнице пятого акта' };
  }
  if (recipe.station === 'final-forge' && actIndex !== 4) {
    return { ok: false, msg: 'Кузница последнего акта пока недоступна' };
  }

  const requirements = new Map();
  for (const ing of recipe.ingredients) {
    if (!ing || !ITEMS[ing.id] || !Number.isSafeInteger(ing.qty) || ing.qty < 1) {
      return { ok: false, msg: 'В рецепте указаны неверные ингредиенты' };
    }
    if (ITEMS[ing.id].storyShard || ITEMS[ing.id].type === 'quest') {
      return { ok: false, msg: 'Квестовые предметы и сюжетные осколки нельзя использовать в рецептах' };
    }
    requirements.set(ing.id, (requirements.get(ing.id) || 0) + ing.qty);
  }

  for (const [id, qty] of requirements) {
    const have = countItem(id);
    if (have < qty) {
      const itemName = ITEMS[id]?.name || id;
      return { ok: false, msg: `Не хватает: ${itemName} (${have}/${qty})` };
    }
  }
  return { ok: true, recipe, tier, actIndex, requirements };
}

const REFORGE_COSTS = {
  1: { id: 'root-fiber', qty: 1 },
  2: { id: 'grave-salt', qty: 1 },
  3: { id: 'ember-core', qty: 1 },
  4: { id: 'frost-essence', qty: 2 },
  5: { id: 'void-dust', qty: 2 }
};

export function canReforgeItem(index) {
  const p = state.game?.player;
  const inst = p?.inventory?.[index];
  const item = ITEMS[inst?.id];
  if (!inst || !item || !EQUIPMENT_TYPES.has(item.type)) return { ok: false, msg: 'Перековать можно только экипировку из сумки' };
  if (item.storyShard || item.type === 'quest' || inst.rarity === 'mythic') return { ok: false, msg: 'Этот предмет нельзя перековать' };
  const tier = RARITIES[inst.rarity || 'common']?.tier || 1;
  const cost = REFORGE_COSTS[tier] || REFORGE_COSTS[1];
  const have = countItem(cost.id);
  if (have < cost.qty) return { ok: false, msg: 'Для перековки нужно: ' + ITEMS[cost.id].name + ' ×' + cost.qty + ' (есть ' + have + ')' };
  return { ok: true, cost, tier };
}

export function reforgeItemByIndex(index) {
  const check = canReforgeItem(index);
  if (!check.ok) return check;
  const p = state.game.player;
  const originalInventory = cloneInventoryForRollback(p.inventory);
  const old = p.inventory[index];
  const preserved = {
    sockets: old.sockets,
    runes: Array.isArray(old.runes) ? [...old.runes] : [],
    forgeLevel: old.forgeLevel || 0,
    upgradePercent: old.upgradePercent || 0
  };
  if (!removeItem(check.cost.id, check.cost.qty)) return { ok: false, msg: 'Не удалось списать эссенцию' };
  const oldIndex = p.inventory.indexOf(old);
  if (oldIndex < 0) { p.inventory = originalInventory; return { ok: false, msg: 'Предмет не найден; материалы возвращены' }; }
  p.inventory.splice(oldIndex, 1);
  const created = addItem(old.id, 1, { rarity: old.rarity || 'common' });
  if (!created.length) {
    p.inventory = originalInventory;
    return { ok: false, msg: 'Перековка не удалась; материалы возвращены' };
  }
  const reforged = created[0];
  reforged.sockets = preserved.sockets ?? ITEMS[old.id].sockets ?? 0;
  reforged.runes = preserved.runes;
  reforged.forgeLevel = preserved.forgeLevel;
  reforged.upgradePercent = preserved.upgradePercent;
  if (preserved.upgradePercent > 0) {
    for (const [key, value] of Object.entries(reforged.bonus || {})) {
      if (typeof value !== 'number') continue;
      const scaled = value * (1 + preserved.upgradePercent);
      reforged.bonus[key] = ['dodgeChance', 'blockChance', 'blockPower', 'critChance'].includes(key)
        ? Number(scaled.toFixed(4))
        : Math.round(scaled);
    }
  }
  const currentIndex = p.inventory.indexOf(reforged);
  if (currentIndex >= 0) {
    p.inventory.splice(currentIndex, 1);
    p.inventory.splice(Math.min(oldIndex, p.inventory.length), 0, reforged);
  }
  if (!saveGame()) {
    p.inventory = originalInventory;
    return { ok: false, msg: 'Не удалось сохранить перековку; предмет и материалы восстановлены' };
  }
  emit('toast', '⚒️ Перековано: ' + ITEMS[old.id].name);
  emit('game:update');
  return { ok: true };
}
export function getCraftingJobs() {
  return [...(state.game?.player?.craftingJobs || [])];
}

export function collectCraftingJobs(now = Date.now()) {
  const p = state.game?.player;
  if (!p || !Array.isArray(p.craftingJobs)) return [];
  const ready = p.craftingJobs.filter(job => Number(job.readyAt) <= now);
  if (!ready.length) return [];
  // Snapshot before granting outputs: a failed save must leave both the
  // completed order and its unclaimed reward available for a safe retry.
  const previousInventory = cloneInventoryForRollback(p.inventory);
  const previousJobs = [...p.craftingJobs];
  const claimed = [];
  for (const job of ready) {
    const created = addItem(job.result, job.qty, { rarity: job.rarity });
    if (created.length) claimed.push(job);
  }
  p.craftingJobs = p.craftingJobs.filter(job => !claimed.includes(job));
  if (claimed.length) {
    if (!saveGame()) {
      p.inventory = previousInventory;
      p.craftingJobs = previousJobs;
      return [];
    }
    emit('toast', `⚗️ Готово предметов: ${claimed.length}`);
    emit('game:update');
  }
  return claimed;
}

export function craftRecipe(recipeId) {
  const check = canCraftRecipe(recipeId);
  if (!check.ok) return check;
  const { recipe, tier, actIndex, requirements } = check;
  const p = state.game.player;
  const rarity = recipe.rarity || (tier === 5 ? 'legendary' : tier === 4 ? 'epic' : undefined);

  // Ingredients are validated together, then consumed as one synchronous transaction.
  const originalInventory = cloneInventoryForRollback(p.inventory);
  const originalJobs = Array.isArray(p.craftingJobs) ? [...p.craftingJobs] : p.craftingJobs;
  const originalHighTier = p.craftedHighTierByAct
    ? { ...p.craftedHighTierByAct }
    : p.craftedHighTierByAct;
  for (const [id, qty] of requirements) {
    if (!removeItem(id, qty)) {
      p.inventory = originalInventory;
      return { ok: false, msg: 'Не удалось списать ингредиенты; операция отменена' };
    }
  }

  if (isCampCrafting()) {
    const hours = Math.max(1, Math.min(3, Math.floor(recipe.craftHours || (1 + Math.random() * 3))));
    if (!Array.isArray(p.craftingJobs)) p.craftingJobs = [];
    p.craftingJobs.push({
      id: `${recipe.id}-${Date.now()}`,
      result: recipe.result,
      qty: recipe.qty,
      rarity,
      readyAt: Date.now() + hours * 60 * 60 * 1000
    });
    if (tier >= 4) {
      if (!p.craftedHighTierByAct) p.craftedHighTierByAct = {};
      p.craftedHighTierByAct[actIndex] = (p.craftedHighTierByAct[actIndex] || 0) + 1;
    }
    if (!saveGame()) {
      p.inventory = originalInventory;
      p.craftingJobs = originalJobs;
      p.craftedHighTierByAct = originalHighTier;
      return { ok: false, msg: 'Не удалось сохранить заказ; ресурсы возвращены' };
    }
    emit('toast', `⚗️ Заказ принят. Готово через ${hours} ч.`);
    emit('game:update');
    return { ok: true, queued: true, hours };
  }

  const created = addItem(recipe.result, recipe.qty, { rarity });
  if (!created.length) {
    p.inventory = originalInventory;
    return { ok: false, msg: 'Не удалось создать предмет; ингредиенты возвращены' };
  }
  if (tier >= 4) {
    if (!p.craftedHighTierByAct) p.craftedHighTierByAct = {};
    p.craftedHighTierByAct[actIndex] = (p.craftedHighTierByAct[actIndex] || 0) + 1;
  }

  if (!saveGame()) {
    p.inventory = originalInventory;
    p.craftedHighTierByAct = originalHighTier;
    return { ok: false, msg: 'Не удалось сохранить результат; ингредиенты возвращены' };
  }
  emit('toast', `⚗️ Скрафчено: ${ITEMS[recipe.result].name} ×${recipe.qty}`);
  emit('game:update');
  return { ok: true };
}
