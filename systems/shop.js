import { state } from './state.js';
import { ITEMS, RARITIES } from '../data/items.js';
import { addItem, canAddItem, STACKABLE_TYPES } from './inventory.js';
import { saveGame } from './save.js';
import { emit } from './events.js';
import { getBuyPrice, getSellPrice } from './economy.js';
import { NPCS } from '../data/npcs.js';

export function buyItem(id) {
  const item = ITEMS[id];
  const p = state.game?.player;
  if (!p || !item || !NPCS.merchant.stock.includes(id) || item.type === 'quest' || item.storyShard || item.bossOnly || RARITIES[item.rarity]?.bossOnly) {
    emit('toast', 'Этот предмет не продаётся у торговца');
    return false;
  }
  const price = getBuyPrice(id, p, state.game);
  if (!Number.isSafeInteger(price) || price <= 0) {
    emit('toast', 'Этот предмет нельзя купить');
    return false;
  }
  if (!Number.isSafeInteger(p.gold) || p.gold < 0 || p.gold < price) { emit('toast', 'Недостаточно золота'); return false; }
  const capacity = canAddItem(id, 1, p);
  if (!capacity.ok) { emit('toast', capacity.reason === 'slots' ? 'Сумка заполнена' : 'Превышен лимит переносимого веса'); return false; }
  const previousInventory = p.inventory.map(inst => ({ ...inst, bonus: inst.bonus ? { ...inst.bonus } : inst.bonus }));
  const previousGold = p.gold;
  const created = addItem(id, 1, { rarity: 'common' });
  if (!created.length) return false;
  p.gold -= price;
  if (!saveGame()) {
    p.inventory = previousInventory;
    p.gold = previousGold;
    return false;
  }
  emit('toast', `Куплено: ${item.name} (${price}💰)`);
  return true;
}

export { getSellPrice };

export function sellItemsByIndices(indices, options = {}) {
  const p = state.game?.player;
  if (!p || !Array.isArray(p.inventory) || !Array.isArray(indices)) {
    return { ok: false, count: 0, total: 0 };
  }
  const selected = [...new Set(indices)]
    .filter(index => Number.isInteger(index) && index >= 0 && index < p.inventory.length)
    .sort((a, b) => b - a);
  const candidates = selected.map(index => ({ index, inst: p.inventory[index] }))
    .filter(({ inst }) => {
      const item = ITEMS[inst?.id];
      return item && item.type !== 'quest' && !item.storyShard && !RARITIES[inst.rarity]?.bossOnly &&
        getSellPrice(inst, p) > 0;
    });
  const total = candidates.reduce((sum, entry) => sum + getSellPrice(entry.inst, p), 0);
  const earnedGold = p.stats?.goldEarned ?? 0;
  if (!Number.isSafeInteger(total) || total <= 0 ||
      !Number.isSafeInteger(p.gold) || p.gold < 0 ||
      !Number.isSafeInteger(p.gold + total) ||
      !Number.isSafeInteger(earnedGold) || earnedGold < 0 ||
      !Number.isSafeInteger(earnedGold + total)) {
    return { ok: false, count: 0, total: 0, msg: 'Некорректная стоимость продажи или баланс золота' };
  }
  const hasHighTier = candidates.some(({ inst }) => (RARITIES[inst.rarity]?.tier || 1) >= 4);
  if (hasHighTier || total > 500) {
    if (!options.confirmed) {
      return { ok: false, requiresConfirmation: true, count: candidates.length, total, hasHighTier };
    }
  }
  if (!candidates.length || total <= 0) return { ok: false, count: 0, total: 0 };

  const previousInventory = p.inventory.map(inst => JSON.parse(JSON.stringify(inst)));
  const previousGold = p.gold;
  const previousBuyback = Array.isArray(p.buyback) ? p.buyback.map(record => JSON.parse(JSON.stringify(record))) : p.buyback;
  const previousGoldEarned = p.stats?.goldEarned;
  const hadStats = !!p.stats;
  if (!Array.isArray(p.buyback)) p.buyback = [];
  const soldAt = new Date().toDateString();
  p.buyback = p.buyback.filter(record => record?.soldAt === soldAt);
  for (const entry of candidates) {
    const snapshot = JSON.parse(JSON.stringify(entry.inst));
    const price = getSellPrice(entry.inst, p);
    const buybackPrice = Math.ceil(price * 1.2);
    if (Number.isSafeInteger(buybackPrice) && buybackPrice > 0) {
      p.buyback.push({ id: 'buyback-' + Date.now() + '-' + entry.index, item: snapshot, soldAt, price: buybackPrice });
    }
  }
  for (const { index } of candidates) p.inventory.splice(index, 1);
  p.gold = (p.gold || 0) + total;
  if (!p.stats) p.stats = {};
  p.stats.goldEarned = earnedGold + total;
  if (!saveGame()) {
    p.inventory = previousInventory;
    p.gold = previousGold;
    p.buyback = previousBuyback;
    if (!p.stats) p.stats = {};
    if (previousGoldEarned === undefined) delete p.stats.goldEarned;
    else p.stats.goldEarned = previousGoldEarned;
    if (!hadStats) delete p.stats;
    return { ok: false, count: 0, total: 0, msg: 'Не удалось сохранить продажу; изменения отменены' };
  }
  emit('toast', `Продано предметов: ${candidates.length} (+${total}💰)`);
  emit('game:update');
  return { ok: true, count: candidates.length, total };
}

export function sellItemByIndex(idx) {
  return sellItemsByIndices([idx]).ok;
}

function getValidTodayBuybackRecords(player) {
  if (!Array.isArray(player?.buyback)) return [];
  const today = new Date().toDateString();
  return player.buyback.filter(record => {
    const item = ITEMS[record?.item?.id];
    const rarity = record?.item?.rarity || 'common';
    const qty = record?.item?.qty ?? 1;
    return record?.soldAt === today && item && Number.isSafeInteger(record.price) && record.price > 0 &&
      Number.isSafeInteger(qty) && qty > 0 && (STACKABLE_TYPES.has(item.type) || qty === 1) &&
      item.type !== 'quest' && !item.storyShard && !item.bossOnly &&
      !!RARITIES[rarity] && !RARITIES[rarity].bossOnly;
  });
}

export function getBuybackItems() {
  return getValidTodayBuybackRecords(state.game?.player);
}

export function buybackItem(index) {
  const p = state.game?.player;
  if (!p || !Array.isArray(p.inventory) || !Array.isArray(p.buyback) || !Number.isSafeInteger(index) || index < 0) {
    return { ok: false, msg: 'Предмет больше нельзя выкупить' };
  }
  const record = getValidTodayBuybackRecords(p)[index];
  const item = ITEMS[record?.item?.id];
  const rarity = record?.item?.rarity || 'common';
  const qty = record?.item?.qty ?? 1;
  if (!record || !item || !Number.isSafeInteger(record.price) || record.price <= 0 ||
      !Number.isSafeInteger(qty) || qty < 1 || (!STACKABLE_TYPES.has(item.type) && qty !== 1) || item.type === 'quest' || item.storyShard ||
      item.bossOnly || !RARITIES[rarity] || RARITIES[rarity].bossOnly) {
    return { ok: false, msg: 'Предмет больше нельзя выкупить' };
  }
  if (!Number.isSafeInteger(p.gold) || p.gold < 0 || p.gold < record.price) return { ok: false, msg: 'Не хватает золота для обратного выкупа' };
  const capacity = canAddItem(record.item.id, qty, p);
  if (!capacity.ok) return { ok: false, msg: capacity.reason === 'slots' ? 'Сумка заполнена' : 'Превышен лимит переносимого веса' };
  const previousInventory = p.inventory.map(inst => JSON.parse(JSON.stringify(inst)));
  const previousGold = p.gold;
  const previousBuyback = p.buyback.map(entry => JSON.parse(JSON.stringify(entry)));
  if (STACKABLE_TYPES.has(ITEMS[record.item.id].type)) {
    if (!addItem(record.item.id, qty).length) return { ok: false, msg: 'Не удалось вернуть предмет в сумку' };
  } else {
    p.inventory.push(record.item);
  }
  p.gold -= record.price;
  p.buyback = p.buyback.filter(entry => entry !== record);
  if (!saveGame()) {
    p.inventory = previousInventory;
    p.gold = previousGold;
    p.buyback = previousBuyback;
    return { ok: false, msg: 'Не удалось сохранить обратный выкуп; изменения отменены' };
  }
  emit('toast', 'Предмет выкуплен обратно за ' + record.price + '💰');
  emit('game:update');
  return { ok: true, price: record.price };
}
