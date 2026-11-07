import { state } from '../systems/state.js';
import { SHOP_ITEMS } from '../data/shop.js';
import { ITEMS, RARITIES } from '../data/items.js';
import { buyItem, getBuybackItems, buybackItem } from '../systems/shop.js';
import { EQUIPMENT_TYPES } from '../systems/inventory.js';
import { getBuyPrice } from '../systems/economy.js';
import { upgradeEquipment, healAtHealer, craftRecipe, reforgeItemByIndex } from '../systems/crafting.js';
import { toast, escapeHtml } from './screens.js';
import { renderHeader, switchTab } from './header.js';
import { openBlacksmith, openHealer, openAlchemist } from './npcs.js';
import { renderTooltip } from './inventory.js';

let shopPreset = 'all';

function getPresetItems() {
  return SHOP_ITEMS.filter(id => {
    const item = ITEMS[id];
    if (!item) return false;
    if (shopPreset === 'cheap') return (item.price || 0) <= 30;
    if (shopPreset === 'build') return EQUIPMENT_TYPES.has(item.type);
    if (shopPreset === 'craft') return item.type === 'material';
    if (shopPreset === 'rare') return (item.price || 0) >= 100;
    return true;
  });
}

export function setShopPreset(preset) {
  if (!['cheap', 'build', 'craft', 'rare', 'all'].includes(preset)) return;
  shopPreset = preset;
  openShop();
}

export function openShop() {
  const p = state.game.player;
  const filters = [['cheap', 'Дешёвое'], ['build', 'Сборка'], ['craft', 'Материалы крафта'], ['rare', 'Редкое'], ['all', 'Всё']];
  const filterHtml = filters.map(([id, label]) =>
    `<button class="inv-filter-btn ${shopPreset === id ? 'active' : ''}" type="button" data-shop-preset="${escapeHtml(id)}" aria-pressed="${shopPreset === id}">${escapeHtml(label)}</button>`
  ).join('');
  const html = getPresetItems().map(id => {
    const item = ITEMS[id];
    if (!item) return '';
    const price = getBuyPrice(id, p, state.game);
    return `<div class="item" data-shop-item="${escapeHtml(id)}"><div class="item-info"><div class="item-name">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</div><div class="item-desc">${escapeHtml(item.desc)} · 💰 ${escapeHtml(price)}</div></div><button type="button" data-shop-buy="${escapeHtml(id)}" ${p.gold < price || price <= 0 ? 'disabled' : ''} style="font-size:12px;padding:6px 12px;">Купить</button></div>`;
  }).join('');
  const buyback = getBuybackItems();
  const buybackHtml = buyback.length ? '<h3>↩️ Обратный выкуп (сегодня)</h3><div class="item-list">' + buyback.map((record, index) => {
    const item = ITEMS[record.item.id];
    const name = item ? item.name : record.item.id;
    const rarity = RARITIES[record.item.rarity]?.name || 'Обычный';
    return `<div class="item"><div class="item-info"><div class="item-name">${escapeHtml(item?.icon || '📦')} ${escapeHtml(name)}</div><div class="item-desc">${escapeHtml(rarity)} · выкуп ${escapeHtml(record.price)}💰</div></div><button type="button" data-shop-buyback="${index}" ${p.gold < record.price ? 'disabled' : ''}>Выкупить</button></div>`;
  }).join('') + '</div>' : '';
  const root = document.getElementById('tab-content');
  if (!root) return;
  root.innerHTML = '<h3>🛒 Магазин</h3><div class="inv-filter-row shop-filter-row">' + filterHtml + '</div><div class="item-list">' + (html || '<small>В этой категории товаров нет.</small>') + '</div>' + buybackHtml + '<button type="button" data-shop-back style="width:100%;margin-top:15px;">← Назад</button>';

  root.onclick = (event) => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || button.disabled) return;
    if (button.dataset.shopPreset) setShopPreset(button.dataset.shopPreset);
    else if (button.dataset.shopBuy && ITEMS[button.dataset.shopBuy]) buyItemUI(button.dataset.shopBuy);
    else if (button.dataset.shopBuyback !== undefined) {
      const index = Number(button.dataset.shopBuyback);
      if (Number.isInteger(index) && index >= 0) buybackItemUI(index);
    } else if (button.hasAttribute('data-shop-back')) backToVillage();
  };
  root.onmouseover = (event) => {
    const card = event.target.closest('[data-shop-item]');
    if (!card || !root.contains(card) || card.contains(event.relatedTarget)) return;
    showShopTooltip(event, card.dataset.shopItem);
  };
  root.onmouseout = (event) => {
    const card = event.target.closest('[data-shop-item]');
    if (!card || !root.contains(card) || card.contains(event.relatedTarget)) return;
    import('./inventory.js').then(({ hideTooltip }) => hideTooltip());
  };
}
export function showShopTooltip(e, id) { const inst = { id, qty: 1, rarity: 'common' }; renderTooltip(e, inst); }
export function buyItemUI(id) { if (buyItem(id)) { renderHeader(); openShop(); } }
export function buybackItemUI(index) { const result = buybackItem(index); if (!result.ok && result.msg) toast(result.msg); renderHeader(); openShop(); }
export function backToVillage() { switchTab('locations'); }
export function upgradeEquipmentUI(slot) { const res = upgradeEquipment(slot); if (!res.ok && res.msg) toast(res.msg); renderHeader(); openBlacksmith(); }
export function healAtHealerUI() { const res = healAtHealer(); if (!res.ok && res.msg) toast(res.msg); renderHeader(); openHealer(); }
export function craftRecipeUI(recipeId) { const res = craftRecipe(recipeId); if (!res.ok && res.msg) toast(res.msg); renderHeader(); if (recipeId.startsWith('r5-')) openBlacksmith(); else openAlchemist(); }
export function reforgeItemUI(index) { const res = reforgeItemByIndex(index); if (!res.ok && res.msg) toast(res.msg); renderHeader(); openAlchemist(); }
