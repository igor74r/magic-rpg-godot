import { state } from '../systems/state.js';
import { ITEMS, RARITIES } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { SPELLS } from '../data/spells.js';
import { FORGE_BONUS } from '../data/npcs.js';
import {
  useItem, equipItemByIndex, unequipItemBySlot, equipBest,
  EQUIPMENT_SLOTS, EQUIPMENT_TYPES, SLOT_TYPES, socketRune,
  getInventoryWeight, getInventoryCapacity, getInventorySlotCount, claimPendingLoot
} from '../systems/inventory.js';
import { sellItemsByIndices, getSellPrice } from '../systems/shop.js';
import { saveGame } from '../systems/save.js';
import { toast, escapeHtml } from './screens.js';
import { renderGame } from './header.js';

let invFilter = 'bag';
let invSort = 'default';
let invSearch = '';
let invRarityFilter = 'all';
let saleSelection = [];
let saleConfirmState = false;
let saleReturnFocus = null;

function capturePlayerState() {
  const player = state.game?.player;
  if (!player) return null;
  try {
    return { player, snapshot: JSON.parse(JSON.stringify(player)) };
  } catch {
    toast('Не удалось подготовить изменение. Состояние героя не изменено.');
    return null;
  }
}

function persistPlayerChange(captured, message = 'Не удалось сохранить изменение. Все изменения отменены.') {
  if (saveGame()) return true;
  const { player, snapshot } = captured;
  for (const key of Object.keys(player)) delete player[key];
  Object.assign(player, snapshot);
  toast(message);
  return false;
}

const FILTER_TYPES = {
  equipment: [...EQUIPMENT_TYPES],
  weapon: ['weapon'],
  armor: ['armor', 'chest', 'head', 'helmet', 'shoulders', 'cloak', 'back', 'gloves', 'bracers', 'wrists', 'legs', 'boots', 'shield'],
  accessory: ['amulet', 'ring'],
  shield: ['shield'],
  cloak: ['cloak'],
  gloves: ['gloves'],
  boots: ['boots'],
  legs: ['legs'],
  consumable: ['consumable'],
  material: ['material'],
  rune: ['rune'],
  scroll: ['scroll'],
  quest: ['quest']
};
const SLOT_INFO = [
  ['head', 'Голова', '⛑️'],
  ['shoulders', 'Плечи', '🛡️'],
  ['chest', 'Грудь', '🥋'],
  ['gloves', 'Перчатки и наручи', '🧤'],
  ['legs', 'Поножи', '🥾'],
  ['boots', 'Сапоги', '👢'],
  ['weapon', 'Оружие', '⚔️'],
  ['shield', 'Щит', '🛡️'],
  ['ring1', 'Палец 1', '💍'],
  ['ring2', 'Палец 2', '💍'],
  ['amulet', 'Амулет / реликвия', '🔮'],
  ['cloak', 'Плащ', '🧥']
];
const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

function getItemValue(inst) {
  const item = ITEMS[inst.id];
  const tierPrice = inst.rarity && RARITIES[inst.rarity]?.price
    ? RARITIES[inst.rarity].price
    : (item?.price || 0) * (inst.rarity ? (RARITIES[inst.rarity]?.multiplier || 1) : 1);
  return tierPrice * (inst.qty || 1);
}

function itemScore(inst) {
  if (!inst) return 0;
  const obj = typeof inst === 'string' ? { id: inst, qty: 1 } : inst;
  const item = ITEMS[obj.id];
  if (!item) return 0;
  const b = { ...(item.bonus || {}), ...(obj.bonus || {}) };
  let score = (b.attack || 0) + (b.magic || 0) + (b.defense || 0);
  score += (b.dex || 0) + (b.armorPen || 0) * 2;
  score += (b.dodgeChance || 0) * 100 + (b.critChance || 0) * 100;
  score += (b.blockChance || 0) * 80 + (b.blockPower || 0) * 60;
  for (const id of (obj.runes || [])) {
    const rune = ITEMS[id]?.runeBonus || {};
    score += (rune.attack || 0) + (rune.magic || 0) + (rune.defense || 0);
    score += (rune.dex || 0) + (rune.armorPen || 0) * 2;
    score += (rune.critChance || 0) * 100 + (rune.dodgeChance || 0) * 100;
    score += (rune.blockChance || 0) * 80 + (rune.blockPower || 0) * 60;
  }
  score += FORGE_BONUS[obj.forgeLevel || 0] || 0;
  return score;
}

function hasBetterEquipment(p) {
  const inv = p.inventory || [];
  return EQUIPMENT_SLOTS.some(slot => {
    const types = SLOT_TYPES[slot] || [];
    const current = itemScore(p.equipped?.[slot]);
    return inv.some(inst => types.includes(ITEMS[inst.id]?.type) && itemScore(inst) > current);
  });
}

function getJunkCount() {
  const p = state.game.player;
  let count = 0;
  for (const inst of p.inventory || []) {
    const item = ITEMS[inst.id];
    if (!item || !EQUIPMENT_TYPES.has(item.type)) continue;
    if (inst.rarity && inst.rarity !== 'common') continue;

    const slots = EQUIPMENT_SLOTS.filter(slot => (SLOT_TYPES[slot] || []).includes(item.type));
    const weakest = Math.min(...slots.map(slot => itemScore(p.equipped?.[slot])));
    if (itemScore(inst) > weakest) continue;
    count++;
  }
  return count;
}

function filterAndSort(entries) {
  let list = entries;
  const query = invSearch.trim().toLocaleLowerCase('ru');
  if (query) list = list.filter(({ inst }) => {
    const item = ITEMS[inst.id];
    return [item?.name, item?.desc, item?.type, TYPE_LABELS[item?.type], RARITIES[inst.rarity || 'common']?.name, inst.id,
      ...(Array.isArray(inst.affixes) ? inst.affixes.map(affix => affix?.name) : [])]
      .filter(Boolean).some(value => String(value).toLocaleLowerCase('ru').includes(query));
  });
  if (invRarityFilter !== 'all') {
    list = list.filter(({ inst }) => (inst.rarity || 'common') === invRarityFilter);
  }
  if (invFilter === 'bag') {
    list = list.filter(({ inst }) => !['quest', 'material'].includes(ITEMS[inst.id]?.type));
  } else if (invFilter === 'quest') {
    list = list.filter(({ inst }) => ITEMS[inst.id]?.type === 'quest' && !ITEMS[inst.id]?.storyShard);
  } else if (invFilter === 'rift-shards') {
    list = list.filter(({ inst }) => !!ITEMS[inst.id]?.storyShard);
  } else if (invFilter !== 'all') {
    const types = FILTER_TYPES[invFilter] || [invFilter];
    list = list.filter(({ inst }) => types.includes(ITEMS[inst.id]?.type));
  }
  if (invSort === 'rarity') {
    list = list.slice().sort((a, b) =>
      (RARITY_ORDER[b.inst.rarity || 'common'] || 0) -
      (RARITY_ORDER[a.inst.rarity || 'common'] || 0)
    );
  } else if (invSort === 'price') {
    list = list.slice().sort((a, b) => getItemValue(b.inst) - getItemValue(a.inst));
  } else if (invSort === 'type') {
    list = list.slice().sort((a, b) =>
      (ITEMS[a.inst.id]?.type || '').localeCompare(ITEMS[b.inst.id]?.type || '')
    );
  } else if (invSort === 'power') {
    list = list.slice().sort((a, b) => itemScore(b.inst) - itemScore(a.inst));
  } else if (invSort === 'name') {
    list = list.slice().sort((a, b) =>
      (ITEMS[a.inst.id]?.name || '').localeCompare(ITEMS[b.inst.id]?.name || '', 'ru')
    );
  }
  return list;
}

export function setInvFilter(filter) {
  invFilter = filter;
  if (state.currentTab === 'inventory') {
    const el = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));
    if (el) el.innerHTML = renderInventory();
  }
}

export function setInvSort(sort) {
  invSort = sort;
  if (state.currentTab === 'inventory') {
    const el = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));
    if (el) el.innerHTML = renderInventory();
  }
}

function renderSaleModal() {
  const overlay = document.getElementById('inventory-sale-overlay');
  if (!overlay) return;
  const active = overlay.contains?.(document.activeElement) ? document.activeElement : null;
  const activeAction = active?.dataset.saleAction;
  const activeIndex = active?.dataset.index;
  const p = state.game.player;
  const valid = p.inventory.map((inst, index) => ({ inst, index, item: ITEMS[inst.id] }))
    .filter(entry => entry.item && entry.item.type !== 'quest' && !entry.item.storyShard && !RARITIES[entry.inst.rarity]?.bossOnly);
  saleSelection = saleSelection.filter(index => valid.some(entry => entry.index === index));
  const selected = valid.filter(entry => saleSelection.includes(entry.index));
  const total = selected.reduce((sum, entry) => sum + getSellPrice(entry.inst, p), 0);
  const hasHighTier = selected.some(entry => (RARITIES[entry.inst.rarity]?.tier || 1) >= 4);
  const needsConfirm = hasHighTier || total > 500;
  const left = valid.map(entry => {
    const rarity = RARITIES[entry.inst.rarity || 'common'];
    const checked = saleSelection.includes(entry.index);
    return '<button type="button" class="sale-item ' + (checked ? 'selected' : '') + '" data-sale-action="toggle" data-index="' + entry.index + '" aria-pressed="' + checked + '"><span>' + entry.item.icon + ' ' + escapeHtml(entry.item.name) + '</span><small>' + escapeHtml(rarity?.name || 'Обычный') + ' · ' + getSellPrice(entry.inst, p) + ' зол.</small></button>';
  }).join('');
  const right = selected.length ? selected.map(entry => '<div class="sale-summary-row"><span>' + entry.item.name + '</span><b>' + getSellPrice(entry.inst, p) + '💰</b></div>').join('') : '<small>Выбери предметы слева.</small>';
  const warning = saleConfirmState && needsConfirm
    ? '<p class="sale-warning">Внимание: выбраны предметы T4+ или сумма выше 500 золота. Подтверди продажу ещё раз.</p>'
    : needsConfirm ? '<p class="sale-warning">Для продажи T4+ или на сумму свыше 500 золота потребуется дополнительное подтверждение.</p>' : '';
  overlay.innerHTML = '<div class="sale-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-sale-title" tabindex="-1"><div class="sale-heading"><h3 id="inventory-sale-title">Продажа предметов</h3><button type="button" data-sale-action="cancel" aria-label="Закрыть окно продажи">×</button></div><div class="sale-columns"><section class="sale-inventory"><b>Инвентарь</b><div class="sale-item-list">' + (left || '<small>Нет предметов для продажи.</small>') + '</div></section><section class="sale-display"><b>К продаже: ' + selected.length + '</b><div class="sale-summary-list">' + right + '</div><div class="sale-total">Итого: ' + total + '💰</div>' + warning + '</section></div><div class="sale-actions"><button type="button" data-sale-action="tiers">Продать все T1–T2</button><button type="button" data-sale-action="filter">Выбрать по фильтру</button><button type="button" class="sell-btn" data-sale-action="confirm">' + (saleConfirmState && needsConfirm ? 'Подтвердить продажу' : 'Продать выбранное') + '</button><button type="button" data-sale-action="cancel">Отмена</button></div></div>';
  const focusTarget = activeAction
    ? [...overlay.querySelectorAll('[data-sale-action]')].find(button =>
        button.dataset.saleAction === activeAction && (activeIndex === undefined || button.dataset.index === activeIndex))
    : null;
  (focusTarget || overlay.querySelector('[data-sale-action="cancel"]') || overlay.querySelector('.sale-dialog'))?.focus();
}

export function openSaleUI(initialSelection = []) {
  saleSelection = Array.isArray(initialSelection) ? [...initialSelection] : [];
  saleConfirmState = false;
  saleReturnFocus = document.activeElement?.nodeType === 1 ? document.activeElement : null;
  document.getElementById('inventory-sale-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'inventory-sale-overlay';
  overlay.className = 'inventory-sale-overlay';
  document.body.appendChild(overlay);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); cancelSaleUI(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) { cancelSaleUI(); return; }
    const button = event.target.closest('[data-sale-action]');
    if (!button || !overlay.contains(button) || button.disabled) return;
    switch (button.dataset.saleAction) {
      case 'toggle': toggleSaleItem(Number(button.dataset.index)); break;
      case 'tiers': selectSaleTiersUI(); break;
      case 'filter': selectSaleFilterUI(); break;
      case 'confirm': confirmSaleUI(); break;
      case 'cancel': cancelSaleUI(); break;
    }
  });
  renderSaleModal();
}

export function toggleSaleItem(index) {
  saleSelection = saleSelection.includes(index) ? saleSelection.filter(value => value !== index) : [...saleSelection, index];
  saleConfirmState = false;
  renderSaleModal();
}

export function selectSaleTiersUI() {
  saleSelection = state.game.player.inventory.map((inst, index) => ({ inst, index, item: ITEMS[inst.id] }))
    .filter(({ inst, item }) => item && EQUIPMENT_TYPES.has(item.type) && (RARITIES[inst.rarity || 'common']?.tier || 1) <= 2 && !RARITIES[inst.rarity]?.bossOnly)
    .map(entry => entry.index);
  saleConfirmState = false;
  renderSaleModal();
}

export function selectSaleFilterUI() {
  saleSelection = filterAndSort(state.game.player.inventory.map((inst, index) => ({ inst, idx: index })))
    .filter(({ inst }) => ITEMS[inst.id] && ITEMS[inst.id].type !== 'quest' && !ITEMS[inst.id].storyShard && !RARITIES[inst.rarity]?.bossOnly)
    .map(entry => entry.idx);
  saleConfirmState = false;
  renderSaleModal();
}

export function confirmSaleUI() {
  const result = sellItemsByIndices(saleSelection, { confirmed: saleConfirmState });
  if (result.requiresConfirmation) {
    saleConfirmState = true;
    renderSaleModal();
    return;
  }
  if (!result.ok) { toast('Нет выбранных предметов для продажи.'); return; }
  cancelSaleUI();
  renderGame();
}

export function cancelSaleUI() {
  saleSelection = [];
  saleConfirmState = false;
  document.getElementById('inventory-sale-overlay')?.remove();
  if (saleReturnFocus?.isConnected) saleReturnFocus.focus();
  saleReturnFocus = null;
}
function filterBarHTML(counts, rarityCounts) {
  const rarities = [
    ['all', 'Все редкости', counts.filtered],
    ['common', 'Обычные', rarityCounts.common || 0],
    ['uncommon', 'Необычные', rarityCounts.uncommon || 0],
    ['rare', 'Редкие', rarityCounts.rare || 0],
    ['epic', 'Эпические', rarityCounts.epic || 0],
    ['legendary', 'Легендарные', rarityCounts.legendary || 0],
    ['mythic', 'Мифические', rarityCounts.mythic || 0]
  ];
  const rarityButtons = rarities.map(([key, label, count]) =>
    `<button type="button" class="inv-rarity-chip ${invRarityFilter === key ? 'active' : ''}" data-inv-rarity="${key}" aria-pressed="${invRarityFilter === key}" ${key !== 'all' && !count ? 'disabled' : ''}><span class="rarity-chip-dot rarity-dot-${key}" aria-hidden="true"></span>${label}<span class="inv-filter-count">${count}</span></button>`
  ).join('');
  const filters = [
    ['bag', '🎒 Сумка', counts.bag], ['equipment', '⚔️ Экипировка', counts.equipment],
    ['material', '🌿 Материалы', counts.materials], ['quest', '📜 Квесты', counts.quests],
    ['rift-shards', '💎 Осколки', counts.shards]
  ];
  const f = ([key, label, count]) =>
    `<button type="button" class="inv-filter-btn ${invFilter === key ? 'active' : ''}" data-inv-filter="${key}" aria-pressed="${invFilter === key}">${label}<span class="inv-filter-count">${count}</span></button>`;
  const s = (key, label) =>
    `<button type="button" class="inv-filter-btn ${invSort === key ? 'active' : ''}" data-inv-sort="${key}" aria-pressed="${invSort === key}">${label}</button>`;
  return `
    <div class="inv-controls">
      <div class="inv-filter-row">${filters.map(f).join('')}</div>
      <div class="inv-rarity-row" aria-label="Фильтр по редкости">${rarityButtons}</div>
      <div class="inv-sort-group">
        <span class="inv-sort-label">Сортировка предметов</span>
        <div class="inv-filter-row">
        ${s('default', 'Порядок получения')}
        ${s('rarity', 'Редкость ↓')}
        ${s('price', 'Цена ↓')}
        ${s('type', 'Тип')}
        ${s('power', 'Сила ↓')}
        ${s('name', 'Название ↑')}
        </div>
      </div>
      <label class="inv-search-wrap"><span aria-hidden="true">⌕</span><input type="search" data-inv-search value="${escapeHtml(invSearch)}" placeholder="Поиск предмета, типа или редкости…" aria-label="Поиск предметов в инвентаре"><button type="button" data-inv-search-clear aria-label="Очистить поиск" ${invSearch ? '' : 'hidden'}>×</button></label>
    </div>
  `;
}

function formatBonus(inst, item) {
  const bonus = { ...(item.bonus || {}), ...(inst.bonus || {}) };
  for (const runeId of (inst.runes || [])) {
    for (const [key, value] of Object.entries(ITEMS[runeId]?.runeBonus || {})) {
      bonus[key] = (bonus[key] || 0) + value;
    }
  }
  const labels = {
    attack: 'атака', magic: 'магия', defense: 'защита',
    dex: 'ловкость', armorPen: 'пробитие брони'
  };
  const percent = {
    dodgeChance: 'уклонение', blockChance: 'шанс блока',
    blockPower: 'сила блока', critChance: 'крит'
  };
  const parts = [];
  for (const [key, label] of Object.entries(labels)) {
    const value = Number(bonus[key]);
    if (Number.isFinite(value) && value !== 0) parts.push(`+${value} ${label}`);
  }
  for (const [key, label] of Object.entries(percent)) {
    const value = Number(bonus[key]);
    if (Number.isFinite(value) && value !== 0) parts.push(`+${Math.round(value * 100)}% ${label}`);
  }
  return parts.join(' · ');
}

function renderPaperdoll(p) {
  const eq = p.equipped || {};
  const slots = SLOT_INFO.map(([slot, label, icon]) => {
    const inst = eq[slot];
    if (!inst) {
      return `
        <div class="gear-slot empty">
          <span class="gear-slot-icon">${icon}</span>
          <span class="gear-slot-label">${label}</span>
          <span class="gear-slot-name">Пусто</span>
        </div>`;
    }
    const obj = typeof inst === 'string' ? { id: inst, qty: 1 } : inst;
    const item = ITEMS[obj.id];
    if (!item) return '';
    const color = RARITIES[obj.rarity]?.color || '#c9a227';
    const affixes = Array.isArray(obj.affixes) ? obj.affixes : [];
    const runeList = Array.isArray(obj.runes) ? obj.runes : [];
    const runes = runeList.length;
    const rawSockets = Number(obj.sockets ?? item.sockets ?? 0);
    const sockets = Number.isSafeInteger(rawSockets) && rawSockets > 0 ? Math.min(rawSockets, 12) : 0;
    const forgeLevel = Number.isSafeInteger(obj.forgeLevel) && obj.forgeLevel > 0 ? obj.forgeLevel : 0;
    return `
      <div class="gear-slot filled ${obj.rarity || 'common'}" style="--gear-color:${color}"
        data-eq-tooltip="${slot}" data-equipment-card="true">
        <span class="gear-slot-icon">${item.icon}</span>
        <span class="gear-slot-label">${label}</span>
        <span class="gear-slot-name">${affixes.length ? affixes.map(affix => escapeHtml(affix?.name ?? '')).join(' ') + ' ' : ''}${item.name}${forgeLevel ? ` +${forgeLevel}` : ''}</span>
        <span class="gear-slot-meta">
          <span class="gear-rarity-label">${RARITIES[obj.rarity]?.name || 'Обычный'}</span>
          <span class="gear-slot-sockets">${sockets ? `◈ ${runes}/${sockets}` : ''}</span>
        </span>
        <button type="button" class="gear-slot-remove" data-inv-action="unequip" data-slot="${slot}" title="Снять" aria-label="Снять: ${escapeHtml(label)}">×</button>
      </div>`;
  }).join('');

  return `
    <section class="paperdoll-panel rpg-paperdoll">
      <div class="paperdoll-hero">
        <div class="paperdoll-silhouette">${CLASSES[p.class]?.emoji || '🧙'}</div>
        <b>${escapeHtml(p.name || 'Герой')}</b>
        <small>Уровень ${p.level || 1}</small>
      </div>
      <div class="equipment-slots">${slots}</div>
      <div class="paperdoll-combat-summary" aria-label="Сводка бонусов экипировки">
        <b>Бонусы экипировки</b>
        <div class="paperdoll-stat-grid">
          ${[['attack','⚔ Атака'],['magic','✦ Магия'],['defense','🛡 Защита'],['dex','◇ Ловкость'],['critChance','✹ Крит'],['dodgeChance','↝ Уворот'],['blockChance','▣ Блок']].map(([key,label]) => {
            const total = Object.values(eq).filter(Boolean).reduce((sum, raw) => {
              const obj = typeof raw === 'string' ? { id: raw } : raw;
              const item = ITEMS[obj.id];
              return sum + (item?.bonus?.[key] || 0) + (obj.bonus?.[key] || 0);
            }, 0);
            return `<span>${label}<strong>${total.toFixed(key.endsWith('Chance') ? 1 : 0)}${key.endsWith('Chance') ? '%' : ''}</strong></span>`;
          }).join('')}
        </div>
        <small>Суммарные базовые бонусы и бонусы предметов</small>
      </div>
    </section>
  `;
}

let inventoryEventsBound = false;

function bindInventoryEvents() {
  if (inventoryEventsBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  inventoryEventsBound = true;
  document.addEventListener('input', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.matches('[data-inv-search]')) return;
    invSearch = target.value;
    const el = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));
    if (el) {
      const pos = target.selectionStart;
      el.innerHTML = renderInventory();
      const next = el.querySelector('[data-inv-search]');
      next?.focus();
      next?.setSelectionRange(pos, pos);
    }
  });
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('[data-inv-action], [data-inv-filter], [data-inv-rarity], [data-inv-sort]');
    if (!control) return;
    if (control.hasAttribute('data-inv-search-clear')) { invSearch = ''; const el = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content')); if (el) el.innerHTML = renderInventory(); return; }
    if (control.hasAttribute('data-inv-filter')) { setInvFilter(control.dataset.invFilter); return; }
    if (control.hasAttribute('data-inv-rarity')) {
      invRarityFilter = control.dataset.invRarity || 'all';
      const el = (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));
      if (el) el.innerHTML = renderInventory();
      return;
    }
    if (control.hasAttribute('data-inv-sort')) { setInvSort(control.dataset.invSort); return; }
    const index = Number(control.dataset.index);
    switch (control.dataset.invAction) {
      case 'equip-best': equipBestUI(); break;
      case 'sell-junk': sellJunkUI(); break;
      case 'open-sale': openSaleUI(); break;
      case 'unequip': unequipItemUI(control.dataset.slot); break;
      case 'slot': invSlotClick(index); break;
      case 'claim-loot': claimPendingLootUI(index); break;
      case 'socket-rune': socketRuneUI(index, control.dataset.slot); break;
      case 'close-rune': document.getElementById('rune-socket-overlay')?.remove(); break;
    }
  });
  document.addEventListener('mouseover', event => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('[data-inv-tooltip], [data-eq-tooltip]');
    if (!control || control.contains(event.relatedTarget)) return;
    if (control.hasAttribute('data-inv-tooltip')) showInvTooltip(event, Number(control.dataset.invTooltip));
    else showEqTooltip(event, control.dataset.eqTooltip);
  });
  document.addEventListener('mouseout', event => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest('[data-inv-tooltip], [data-eq-tooltip]');
    if (control && !control.contains(event.relatedTarget)) hideTooltip();
  });
}

export function renderInventory() {
  bindInventoryEvents();
  const p = state.game.player;
  if (!Array.isArray(p.inventory)) p.inventory = [];
  const hasBetter = hasBetterEquipment(p);
  const junkCount = getJunkCount();
  const entries = p.inventory.map((inst, idx) => ({ inst, idx }));
  const visible = filterAndSort(entries);
  const rarityCounts = entries.reduce((result, { inst }) => {
    const key = RARITIES[inst.rarity] ? inst.rarity : 'common';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const counts = {
    all: entries.length,
    filtered: entries.filter(({ inst }) => invFilter === 'all' || invFilter === 'bag'
      ? !['quest', 'material'].includes(ITEMS[inst.id]?.type)
      : invFilter === 'equipment' ? EQUIPMENT_TYPES.has(ITEMS[inst.id]?.type)
      : invFilter === 'material' ? ITEMS[inst.id]?.type === 'material'
      : invFilter === 'quest' ? ITEMS[inst.id]?.type === 'quest' && !ITEMS[inst.id]?.storyShard
      : invFilter === 'rift-shards' ? !!ITEMS[inst.id]?.storyShard
      : (FILTER_TYPES[invFilter] || [invFilter]).includes(ITEMS[inst.id]?.type)).length,
    bag: entries.filter(({ inst }) => !['quest', 'material'].includes(ITEMS[inst.id]?.type)).length,
    equipment: entries.filter(({ inst }) => EQUIPMENT_TYPES.has(ITEMS[inst.id]?.type)).length,
    materials: entries.filter(({ inst }) => ITEMS[inst.id]?.type === 'material').length,
    quests: entries.filter(({ inst }) => ITEMS[inst.id]?.type === 'quest' && !ITEMS[inst.id]?.storyShard).length,
    shards: entries.filter(({ inst }) => !!ITEMS[inst.id]?.storyShard).length
  };
  const weight = getInventoryWeight(p);
  const capacity = getInventoryCapacity(p);
  const usedSlots = getInventorySlotCount(p);

  const actions = `
    <div class="inv-top-actions">
      ${hasBetter ? '<button type="button" data-inv-action="equip-best" class="equip-best-btn">⚡ Экипировать лучшее</button>' : ''}
      ${junkCount ? `<button type="button" data-inv-action="sell-junk" class="inv-sell-junk">💰 Продать слабое (${junkCount})</button>` : ''}
      <button type="button" data-inv-action="open-sale" class="inv-sell-junk">💰 Продажа</button>
    </div>`;

  let grid = '';
  const minSlots = invFilter === 'bag' ? 30 : Math.max(6, Math.ceil(visible.length / 6) * 6);
  for (let i = 0; i < minSlots; i++) {
    if (i < visible.length) {
      const { inst, idx } = visible[i];
      const item = ITEMS[inst.id];
      if (!item) {
        grid += '<div class="inv-slot empty"></div>';
        continue;
      }
      const rarity = RARITIES[inst.rarity] ? inst.rarity : 'common';
      const qtyValue = Number.isSafeInteger(inst.qty) && inst.qty > 1 ? inst.qty : 1;
      const qty = qtyValue > 1 ? `<span class="slot-qty">${qtyValue}</span>` : '';
      const socket = EQUIPMENT_TYPES.has(item.type) && (inst.sockets ?? item.sockets)
        ? '<span class="slot-socket">◈</span>' : '';
      grid += `
        <button type="button" class="inv-slot has-item ${rarity} rarity-frame-${rarity}"
          data-rarity="${rarity}" title="${escapeHtml(RARITIES[rarity]?.name || "Обычный")} · ${escapeHtml(item.name)}"
          data-inv-tooltip="${idx}" data-inv-action="slot" data-index="${idx}"
          aria-label="${escapeHtml(item.name)}">
          <span class="slot-icon">${item.icon}</span>${qty}${socket}
          ${rarity !== 'common' ? `<span class="slot-rarity-label rarity-label-${rarity}" aria-hidden="true">${RARITIES[rarity]?.shortName || RARITIES[rarity]?.name || rarity}</span>` : ''}
        </button>`;
    } else {
      grid += '<div class="inv-slot empty"></div>';
    }
  }

  return `
    <div class="inv-layout rpg-inventory-layout">
      ${renderPaperdoll(p)}
      <section class="backpack-panel rpg-backpack">
        ${actions}
        <div class="inv-title-row">
          <div><h3>🎒 Сумка героя</h3><small>${usedSlots}/30 ячеек · ${weight.toFixed(1)}/${capacity} веса · ${counts.equipment} экипировки · ${counts.materials} материалов · ${counts.quests} квестов · ${counts.shards}/3 осколка</small></div>
          <div class="inv-wallet">💰 ${p.gold || 0}</div>
        </div>
        ${filterBarHTML(counts, rarityCounts)}
        ${visible.length ? `<div class="inv-grid rpg-inv-grid">${grid}</div>` : `<div class="inv-empty-state" role="status"><span>🧭</span><b>В этой категории пока пусто</b><small>Смените фильтр или продолжайте исследовать мир — новые предметы появятся в сумке.</small></div>`}
        <p class="inv-hint">Нажми на предмет, чтобы надеть или использовать. Руна устанавливается в свободное гнездо. Наведи курсор для сравнения характеристик.</p>
        ${renderPendingLoot(p)}
      </section>
    </div>
  `;
}

function renderPendingLoot(player) {
  const pending = Array.isArray(player.pendingLoot) ? player.pendingLoot : [];
  if (!pending.length) return '';
  const rows = pending.map((entry, index) => {
    const item = ITEMS[entry.id];
    if (!item) return '';
    const rawQty = Number(entry.qty);
    const qty = Number.isSafeInteger(rawQty) && rawQty > 0 ? rawQty : 1;
    return `<div class="pending-loot-row">
      <span class="pending-loot-item">${item.icon} ${item.name}${qty > 1 ? ` ×${qty}` : ''}</span>
      <button type="button" data-inv-action="claim-loot" data-index="${index}">Забрать</button>
    </div>`;
  }).join('');
  return `<section class="pending-loot-panel">
    <h4>📦 Невостребованная добыча <small>(${pending.length})</small></h4>
    <p>Награды сохранены здесь, потому что в сумке не хватило места. Освободите место и заберите их.</p>
    <div class="pending-loot-list">${rows}</div>
  </section>`;
}

export function claimPendingLootUI(index) {
  const player = state.game?.player;
  if (!player) return;

  let snapshot;
  try {
    snapshot = JSON.parse(JSON.stringify(player));
  } catch {
    toast('❌ Не удалось подготовить получение награды. Она осталась в списке добычи.');
    return;
  }

  const result = claimPendingLoot(index);
  if (!result.ok) {
    toast(result.reason === 'capacity'
      ? 'В сумке всё ещё нет места. Освободите ячейку или вес.'
      : 'Эта награда больше недоступна.');
    return;
  }

  if (!saveGame()) {
    // Keep the reward pending when persistence fails; do not show a false
    // success or leave an uncommitted item in the live inventory.
    for (const key of Object.keys(player)) delete player[key];
    Object.assign(player, snapshot);
    toast('❌ Не удалось сохранить награду. Она осталась в списке добычи.');
    return;
  }

  const item = ITEMS[result.entry.id];
  toast(`Получено: ${item?.name || result.entry.id}`);
  renderGame();
}

export function invSlotClick(idx) {
  const p = state.game.player;
  const inst = p.inventory[idx];
  if (!inst) return;
  const item = ITEMS[inst.id];
  if (!item) return;

  if (EQUIPMENT_TYPES.has(item.type)) {
    const captured = capturePlayerState();
    if (!captured) return;
    const slot = equipItemByIndex(idx);
    if (!slot) { toast('Не хватает места или грузоподъёмности, чтобы снять старую экипировку.'); return; }
    if (!persistPlayerChange(captured)) return;
    toast(`Надето: ${item.name}`);
    renderGame();
  } else if (item.type === 'consumable') {
    useItemOutside(inst.id);
  } else if (item.type === 'scroll') {
    useItemOutside(inst.id);
  } else if (item.type === 'rune') {
    openRuneSocketMenu(idx);
  } else if (item.type === 'quest') {
    toast('Квестовый предмет хранится в сумке и не продаётся.');
  } else {
    toast('Материал можно использовать у ремесленников.');
  }
}

function openRuneSocketMenu(inventoryIndex) {
  const p = state.game.player;
  const runeItem = ITEMS[p.inventory[inventoryIndex]?.id];
  const candidates = SLOT_INFO.map(([slot, label]) => {
    const raw = p.equipped?.[slot];
    if (!raw) return null;
    const inst = typeof raw === 'string' ? { id: raw, sockets: ITEMS[raw]?.sockets || 0, runes: [] } : raw;
    const item = ITEMS[inst.id];
    const sockets = inst.sockets ?? item?.sockets ?? 0;
    const runes = inst.runes || [];
    if (sockets <= runes.length) return null;
    return { slot, label, inst, item, sockets, used: runes.length };
  }).filter(Boolean);

  if (!candidates.length) {
    toast('Нет экипировки со свободным гнездом.');
    return;
  }
  document.getElementById('rune-socket-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'rune-socket-overlay';
  overlay.className = 'rune-socket-overlay';
  overlay.innerHTML = `
    <div class="rune-socket-dialog">
      <h3>${runeItem.icon} ${runeItem.name}</h3>
      <p>${runeItem.desc}</p>
      <b>Выберите предмет для установки:</b>
      <div class="rune-socket-options">
        ${candidates.map(c => `
          <button type="button" data-inv-action="socket-rune" data-index="${inventoryIndex}" data-slot="${c.slot}">
            <span>${c.item.icon} ${c.label}: ${c.item.name}</span>
            <small>Свободно гнёзд: ${c.sockets - c.used}</small>
          </button>`).join('')}
      </div>
      <button type="button" class="rune-socket-cancel" data-inv-action="close-rune">Отмена</button>
    </div>`;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

export function socketRuneUI(inventoryIndex, equipmentSlot) {
  const captured = capturePlayerState();
  if (!captured) return;
  if (!socketRune(inventoryIndex, equipmentSlot)) {
    toast('Не удалось установить руну: проверьте свободное гнездо.');
    return;
  }
  if (!persistPlayerChange(captured)) return;
  document.getElementById('rune-socket-overlay')?.remove();
  toast('ᛉ Руна установлена. Характеристики обновлены.');
  renderGame();
}

export function useItemOutside(id) {
  const item = ITEMS[id];
  if (item?.combatOnly) {
    toast('Этот предмет можно использовать только в бою.');
    return;
  }
  if (item?.type === 'scroll' && state.game.player.spells.includes(item.spellId)) {
    toast('Это заклинание уже изучено.');
    return;
  }
  const captured = capturePlayerState();
  if (!captured || !useItem(id)) return;
  if (!persistPlayerChange(captured)) return;
  if (item.type === 'scroll') toast(`📖 Изучено: ${SPELLS[item.spellId]?.name || item.spellId}`);
  else toast(`Использовано: ${item.name}`);
  renderGame();
}

export function equipItemByIndexUI(idx) {
  const captured = capturePlayerState();
  if (!captured) return;
  const slot = equipItemByIndex(idx);
  if (!slot) { toast('Сумка заполнена или превышен лимит веса.'); return; }
  if (!persistPlayerChange(captured)) return;
  toast('Экипировка обновлена.');
  renderGame();
}

export function equipBestUI() {
  const captured = capturePlayerState();
  if (!captured) return;
  const changed = equipBest();
  if (changed) {
    if (!persistPlayerChange(captured)) return;
    toast('⚡ Лучшие предметы надеты.');
    renderGame();
  } else {
    toast('Сейчас экипированы лучшие доступные предметы.');
  }
}

export function unequipItemUI(slot) {
  const captured = capturePlayerState();
  if (!captured) return;
  if (!unequipItemBySlot(slot)) { toast('Нельзя снять предмет: в сумке нет места или превышен лимит веса.'); return; }
  if (!persistPlayerChange(captured)) return;
  renderGame();
}

export function sellItemByIndexUI(idx) {
  openSaleUI([idx]);
}

export function sellJunkUI() {
  const p = state.game.player;
  const indices = [];
  for (let i = p.inventory.length - 1; i >= 0; i--) {
    const inst = p.inventory[i];
    const item = ITEMS[inst.id];
    if (!item || ['quest', 'scroll', 'consumable', 'material', 'rune'].includes(item.type)) continue;
    if (inst.rarity && inst.rarity !== 'common') continue;
    const slots = EQUIPMENT_SLOTS.filter(slot => (SLOT_TYPES[slot] || []).includes(item.type));
    const weakest = Math.min(...slots.map(slot => itemScore(p.equipped?.[slot])));
    if (itemScore(inst) > weakest) continue;
    if (getSellPrice(inst, p) > 0) indices.push(i);
  }
  if (!indices.length) {
    toast('Нет обычных слабых предметов для продажи.');
    return;
  }
  openSaleUI(indices);
}

const TYPE_LABELS = {
  weapon: 'Оружие', shield: 'Щит', armor: 'Доспех', chest: 'Нагрудник', helmet: 'Головной убор',
  head: 'Головной убор', shoulders: 'Наплечье', back: 'Плащ', cloak: 'Плащ', wrists: 'Наручи',
  bracers: 'Наручи', gloves: 'Перчатки', hands: 'Перчатки', boots: 'Сапоги',
  legs: 'Поножи', amulet: 'Амулет / реликвия', ring: 'Кольцо', seal: 'Печать', consumable: 'Расходник',
  material: 'Материал', rune: 'Руна', scroll: 'Свиток', quest: 'Квестовый предмет'
};

function getSlotForItem(item, p) {
  if (!EQUIPMENT_TYPES.has(item.type)) return null;
  if (item.type === 'ring') {
    if (!p.equipped?.ring1) return 'ring1';
    if (!p.equipped?.ring2) return 'ring2';
    return itemScore(p.equipped.ring1) <= itemScore(p.equipped.ring2) ? 'ring1' : 'ring2';
  }
  return EQUIPMENT_SLOTS.find(slot =>
    slot !== 'ring1' && slot !== 'ring2' &&
    (SLOT_TYPES[slot] || []).includes(item.type)
  ) || null;
}

function buildCompareHTML(inst, item) {
  if (!EQUIPMENT_TYPES.has(item.type)) return '';
  const p = state.game.player;
  const slot = getSlotForItem(item, p);
  const eqInst = p.equipped?.[slot];
  const eqObj = typeof eqInst === 'string' ? { id: eqInst, qty: 1 } : eqInst;
  const mergeItemBonuses = obj => {
    if (!obj) return {};
    const base = ITEMS[obj.id] || {};
    const bonus = { ...(base.bonus || {}), ...(obj.bonus || {}) };
    for (const runeId of (obj.runes || [])) {
      for (const [key, value] of Object.entries(ITEMS[runeId]?.runeBonus || {})) {
        bonus[key] = (bonus[key] || 0) + value;
      }
    }
    return bonus;
  };
  const oldBonus = mergeItemBonuses(eqObj);
  const newBonus = mergeItemBonuses(inst);
  const lines = [];
  const stats = [
    ['attack', 'Атака'], ['magic', 'Магия'], ['defense', 'Защита'],
    ['dex', 'Ловкость'], ['armorPen', 'Пробитие брони']
  ];
  for (const [key, label] of stats) {
    const diff = (newBonus[key] || 0) - (oldBonus[key] || 0);
    if (diff) lines.push(`<div class="${diff > 0 ? 'compare-up' : 'compare-down'}">${label}: ${diff > 0 ? '+' : ''}${diff}</div>`);
  }
  const percents = [
    ['dodgeChance', 'Уклонение'], ['blockChance', 'Шанс блока'],
    ['blockPower', 'Сила блока'], ['critChance', 'Крит']
  ];
  for (const [key, label] of percents) {
    const diff = (newBonus[key] || 0) - (oldBonus[key] || 0);
    if (diff) lines.push(`<div class="${diff > 0 ? 'compare-up' : 'compare-down'}">${label}: ${diff > 0 ? '+' : ''}${Math.round(diff * 100)}%</div>`);
  }
  const oldScore = eqObj ? itemScore(eqObj) : 0;
  const newScore = itemScore(inst);
  const scoreDiff = newScore - oldScore;
  const scoreLine = `<div class="compare-score ${scoreDiff > 0 ? 'compare-up' : scoreDiff < 0 ? 'compare-down' : ''}"><span>Сила предмета</span><b>${oldScore} → ${newScore} (${scoreDiff > 0 ? '+' : ''}${scoreDiff})</b></div>`;
  const slotLabel = SLOT_INFO.find(([id]) => id === slot)?.[1] || 'Слот экипировки';
  const comparisonTitle = eqObj
    ? `Сравнение: ${escapeHtml(ITEMS[eqObj.id]?.name || 'предмет')}`
    : 'Сравнение: пустой слот';
  const equippedRarity = eqObj ? RARITIES[eqObj.rarity]?.name || 'Обычный' : 'Пусто';
  const candidateRarity = RARITIES[inst.rarity]?.name || 'Обычный';
  const statLines = lines.length ? lines.join('') : '<div class="compare-neutral">Характеристики не изменятся</div>';
  const direction = scoreDiff > 0 ? 'Улучшение' : scoreDiff < 0 ? 'Уступает' : 'Равноценно';
  const directionClass = scoreDiff > 0 ? 'compare-up' : scoreDiff < 0 ? 'compare-down' : 'compare-neutral';
  return `<div class="tooltip-compare" data-compare-slot="${slot || ''}">
    <div class="compare-heading"><b>${comparisonTitle}</b><span class="compare-slot-label">${escapeHtml(slotLabel)}</span></div>
    <div class="compare-rarity-row"><span>Сейчас: ${escapeHtml(equippedRarity)}</span><span>Новый: ${escapeHtml(candidateRarity)}</span></div>
    <div class="compare-verdict ${directionClass}">${direction}</div>${scoreLine}${statLines}</div>`;
}

export function buildTooltipHTML(inst) {
  const item = ITEMS[inst.id];
  if (!item) return '';
  const rarity = RARITIES[inst.rarity];
  const color = rarity?.color || '#c9a227';
  const rarityLabel = rarity && inst.rarity !== 'common' ? ` · ${rarity.name}` : '';
  const affixes = Array.isArray(inst.affixes) ? inst.affixes : [];
  const runeList = Array.isArray(inst.runes) ? inst.runes : [];
  const forgeLevel = Number.isSafeInteger(inst.forgeLevel) && inst.forgeLevel > 0 ? inst.forgeLevel : 0;
  const affixLabel = affixes.map(affix => escapeHtml(affix?.name ?? '')).join(' · ');
  const stats = item.runeBonus ? formatBonus({ bonus: item.runeBonus }, { bonus: item.runeBonus }) : formatBonus(inst, item);
  const rawSockets = Number(inst.sockets ?? item.sockets ?? 0);
  const socketCount = Number.isSafeInteger(rawSockets) && rawSockets > 0 ? Math.min(rawSockets, 12) : 0;
  const sockets = EQUIPMENT_TYPES.has(item.type)
    ? `<div class="tooltip-sockets">Гнёзда: ${runeList.length}/${socketCount} ${runeList.map(id => ITEMS[id]?.icon || 'ᛉ').join(' ')}</div>`
    : '';
  return `
    <div class="tooltip-title" style="color:${color}">${item.icon} ${affixes.length ? affixes.map(affix => escapeHtml(affix?.name ?? '')).join(' ') + ' ' : ''}${item.name}${rarityLabel}${forgeLevel ? ` +${forgeLevel}` : ''}</div>
    <div class="tooltip-type">${TYPE_LABELS[item.type] || item.type}</div>
    <div class="tooltip-desc">${item.desc}</div>
    ${affixLabel ? `<div class="tooltip-type">Модификаторы: ${affixLabel}</div>` : ''}
    ${stats ? `<div class="tooltip-stats">${stats}</div>` : ''}
    ${sockets}
    ${buildCompareHTML(inst, item)}
    ${item.price ? `<div class="tooltip-price">Цена: ${item.price}💰</div>` : ''}
    ${(inst.qty || 1) > 1 ? `<div class="tooltip-type">В стопке: ${inst.qty}</div>` : ''}
  `;
}

function positionTooltip(e, div) {
  const rect = div.getBoundingClientRect();
  const pad = 16;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + rect.width > window.innerWidth - 10) x = e.clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight - 10) y = e.clientY - rect.height - pad;
  div.style.left = Math.max(10, x) + 'px';
  div.style.top = Math.max(10, y) + 'px';
}

export function renderTooltip(e, inst) {
  hideTooltip();
  if (!inst) return;
  const div = document.createElement('div');
  div.id = 'item-tooltip';
  div.className = 'item-tooltip';
  div.innerHTML = buildTooltipHTML(inst);
  document.body.appendChild(div);
  positionTooltip(e, div);
}

export function showInvTooltip(e, idx) {
  renderTooltip(e, state.game.player.inventory[idx]);
}

export function showEqTooltip(e, slot) {
  let inst = state.game.player.equipped?.[slot];
  if (!inst) return;
  if (typeof inst === 'string') inst = { id: inst, qty: 1 };
  renderTooltip(e, inst);
}

export function hideTooltip() {
  document.getElementById('item-tooltip')?.remove();
}
