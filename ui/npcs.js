import { state } from '../systems/state.js';
import { NPCS, FORGE_BONUS } from '../data/npcs.js';
import { ITEMS, RARITIES } from '../data/items.js';
import { countItem, EQUIPMENT_TYPES, EQUIPMENT_SLOTS } from '../systems/inventory.js';
import { saveGame } from '../systems/save.js';
import { emit } from '../systems/events.js';
import { showScreen, toast, escapeHtml } from './screens.js';
import { STORY } from '../data/story.js';
import { LOCATIONS } from '../data/locations.js';
import { addItemOrStore } from '../systems/inventory.js';
import { canCraftRecipe, canReforgeItem, collectCraftingJobs, getCraftingJobs } from '../systems/crafting.js';
import { getCurrentActIndex, getGoldRewardTotals } from '../systems/economy.js';
import { addExp } from '../systems/progression.js';
import {
  getActiveCampaignMission, getNextCampaignMission, getMissionProgress,
  getMissionReward, acceptCampaignMission, claimCampaignMission, canCompleteMainQuest
} from '../systems/campaign.js';

let npcDialogReturnFocus = null;
let npcDialogKeydownBound = false;

function showNpcUI(html) {
  const root = state.overworld && state.overworld.active
    ? document.getElementById('npc-dialog-content')
    : (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content'));
  if (!root) return;
  root.innerHTML = html;
  root.onclick = (event) => {
    const button = event.target.closest('[data-npc-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.npcAction;
    const value = button.dataset.npcValue;
    switch (action) {
      case 'craft': window.GameAPI?.craftRecipe?.(value); break;
      case 'upgrade': window.GameAPI?.upgradeEquipment?.(value); break;
      case 'close': window.GameAPI?.closeNpcAndResume?.(); break;
      case 'heal': window.GameAPI?.healAtHealer?.(); break;
      case 'reforge': window.GameAPI?.reforgeItem?.(Number(value)); break;
      case 'buy': window.GameAPI?.buy?.(value); break;
      case 'accept-quest': window.GameAPI?.acceptElderQuest?.(); break;
      case 'turn-in-quest': window.GameAPI?.turnInElderQuest?.(); break;
      case 'blessing': window.GameAPI?.takeElderBlessing?.(); break;
      case 'well': window.GameAPI?.useWell?.(); break;
      case 'bard': window.GameAPI?.payBard?.(); break;
      case 'pet-cat': window.GameAPI?.petCat?.(); break;
      default: return;
    }
  };
  root.onmouseover = (event) => {
    const item = event.target.closest('[data-npc-tooltip]');
    if (item && root.contains(item)) window.GameAPI?.showShopTooltip?.(event, item.dataset.npcTooltip);
  };
  root.onmouseout = (event) => {
    if (event.target.closest('[data-npc-tooltip]')) window.GameAPI?.hideTooltip?.();
  };
  if (root.id === 'npc-dialog-content') {
    const modal = document.getElementById('npc-dialog-modal');
    if (!modal) return;
    if (modal.style.display !== 'flex') {
      npcDialogReturnFocus = document.activeElement?.nodeType === 1 ? document.activeElement : null;
    }
    modal.style.display = 'flex';
    if (!npcDialogKeydownBound) {
      npcDialogKeydownBound = true;
      modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeNpcAndResumeUI();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...modal.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
          .filter(element => element.getClientRects().length > 0);
        if (!focusable.length) { event.preventDefault(); modal.focus(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }
    (modal.querySelector('.npc-modal-close') || modal.querySelector('#npc-dialog-content button:not(:disabled)') || modal).focus();
  } else {
    showScreen('screen-game');
  }
}

function getGreeting(npcId) { const npc = NPCS[npcId]; if (!npc || !npc.greetings) return '...'; return npc.greetings[Math.floor(Math.random() * npc.greetings.length)]; }

function hasActiveEntry(entries, id) {
  return Array.isArray(entries) && entries.some(entry => entry?.id === id && Number(entry.duration) > 0);
}

function cloneNpcPlayer(player) {
  try { return JSON.parse(JSON.stringify(player)); }
  catch { return null; }
}

function restoreNpcPlayer(player, snapshot) {
  for (const key of Object.keys(player)) delete player[key];
  Object.assign(player, snapshot);
}

function persistNpcPlayerMutation(player, snapshot, failureMessage) {
  if (saveGame()) return true;
  restoreNpcPlayer(player, snapshot);
  toast(failureMessage);
  return false;
}

function canUseWell(player, now = Date.now()) {
  const lastUse = Number(player?.stats?.lastWellUse) || 0;
  return now - lastUse > 24 * 60 * 60 * 1000;
}

export function openBlacksmith() {
  collectCraftingJobs();
  const npc = NPCS.blacksmith; const p = state.game.player;
  const finalForgeRecipes = getCurrentActIndex(p) === 4 ? npc.recipes.map(recipe => {
    const check = canCraftRecipe(recipe.id);
    const ingList = recipe.ingredients.map(ing => `<span style="color:${countItem(ing.id) >= ing.qty ? '#60ff60' : '#ff6060'};">${ITEMS[ing.id].icon} ${ITEMS[ing.id].name} (${countItem(ing.id)}/${ing.qty})</span>`).join(' + ');
    return `<div class="recipe"><div class="recipe-result" style="color:${RARITIES.legendary.color};">✦ ${ITEMS[recipe.result].name} · T5</div><div class="recipe-ingredients">${ingList}</div><button type="button" data-npc-action="craft" data-npc-value="${escapeHtml(recipe.id)}" ${check.ok ? '' : 'disabled'} class="sell-btn">⚒️ Создать в финальной кузнице</button>${!check.ok ? `<small>${check.msg}</small>` : ''}</div>`;
  }).join('') : '';
  const pendingJobs = getCraftingJobs();
  const jobsHTML = pendingJobs.length ? `<div class="recipe"><b>Заказы в работе: ${pendingJobs.length}</b>${pendingJobs.map(job => `<div>${escapeHtml(ITEMS[job.result]?.name || job.result)} — готовность ${new Date(job.readyAt).toLocaleString('ru-RU')}</div>`).join('')}</div>` : '';
  const renderSlot = (slot, label) => {
    const inst = p.equipped[slot]; if (!inst) return `<div class="npc-slot"><div class="npc-slot-title">${label}</div><div class="npc-slot-empty">Слот пуст</div></div>`;
    const obj = typeof inst === 'string' ? { id: inst, qty: 1 } : inst; const item = ITEMS[obj.id]; if (!item) return '';
    const rar = obj.rarity ? RARITIES[obj.rarity] : null; const color = rar ? rar.color : '#c9a227'; const rawLevel = obj.forgeLevel; const lvl = Number.isSafeInteger(rawLevel) && rawLevel >= 0 ? Math.min(npc.maxLevel, rawLevel) : 0; const maxLvl = npc.maxLevel; const forgeBonus = FORGE_BONUS[lvl] || 0;
    let upgradeBlock = '';
    if (lvl >= maxLvl) upgradeBlock = `<div style="color:#60ff60;">Максимальный уровень: +${maxLvl}</div>`;
    else { const next = npc.upgrades[lvl]; const can = p.gold >= next.cost; upgradeBlock = `<div style="color:#a89060;font-size:12px;margin-bottom:6px;">Следующий уровень: <b style="color:#c9a227;">+${lvl + 1}</b> — <b style="color:#60ff60;">+5% к характеристикам</b> и +${next.forgeBonus} к ковке</div><button type="button" data-npc-action="upgrade" data-npc-value="${escapeHtml(slot)}" ${can ? '' : 'disabled'} class="sell-btn">⚒️ Улучшить за ${next.cost}💰</button>`; }
    return `<div class="npc-slot"><div class="npc-slot-title">${label}</div><div class="npc-slot-item" style="border-color:${color};"><div style="color:${color};font-weight:bold;">${item.icon} ${item.name}${lvl > 0 ? ` <span style="color:#ffd060;">+${lvl}</span>` : ''}</div><div style="color:#a89060;font-size:12px;margin-top:2px;">Бонус ковки: +${forgeBonus}</div></div>${upgradeBlock}</div>`;
  };
  const slotLabels = { weapon: '⚔️ Оружие', head: '⛑️ Голова', shoulders: '🛡️ Плечи', chest: '🥋 Броня', gloves: '🧤 Перчатки', legs: '🥾 Поножи', boots: '👢 Сапоги', shield: '🛡️ Щит', ring1: '💍 Кольцо 1', ring2: '💍 Кольцо 2', amulet: '🔮 Амулет', cloak: '🧥 Плащ' };
  const equipmentHtml = EQUIPMENT_SLOTS.filter(slot => p.equipped?.[slot]).map(slot => renderSlot(slot, slotLabels[slot] || slot)).join('') || '<p>Сначала экипируйте предметы, чтобы улучшить их у кузнеца.</p>';
  showNpcUI(`<div class="npc-header"><div class="npc-emoji">${npc.emoji}</div><div><h3 style="margin:0;">${npc.name}</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('blacksmith')}»</p></div></div><div class="npc-gold">💰 Ваше золото: <b style="color:#ffd060;">${p.gold}</b></div><h3>Экипировка</h3><div class="recipes-list">${equipmentHtml}</div>${jobsHTML}${finalForgeRecipes ? `<h3>🔥 Кузница пятого акта</h3><div class="recipes-list">${finalForgeRecipes}</div>` : ''}<button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`);
}

export function openHealer() {
  const npc = NPCS.healer; const p = state.game.player; const cost = npc.cost; const healthy = p.hp >= p.maxHp && p.mp >= p.maxMp; const canPay = p.gold >= cost;
  showNpcUI(`<div class="npc-header"><div class="npc-emoji">${npc.emoji}</div><div><h3 style="margin:0;">${npc.name}</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('healer')}»</p></div></div><div class="npc-gold">💰 Ваше золото: <b style="color:#ffd060;">${p.gold}</b></div><div class="npc-stats"><div>HP: <b style="color:${p.hp < p.maxHp ? '#ff6060' : '#60ff60'};">${p.hp}/${p.maxHp}</b></div><div>${p.class === 'warrior' ? '🔥 Ярость' : 'MP'}: <b style="color:${p.mp < p.maxMp ? '#60a0ff' : '#60ff60'};">${p.mp}/${p.maxMp}</b></div></div>${healthy ? `<div style="color:#60ff60;text-align:center;padding:15px;">✨ Вы полностью здоровы</div>` : `<button type="button" data-npc-action="heal" ${canPay ? '' : 'disabled'} class="sell-btn" style="width:100%;padding:14px;">💚 Полное исцеление за ${cost}💰</button>`}<button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`);
}

export function openAlchemist() {
  collectCraftingJobs();
  const npc = NPCS.alchemist;
  const pendingJobs = getCraftingJobs();
  const jobsHTML = pendingJobs.length ? `<div class="recipe"><b>Заказы в работе: ${pendingJobs.length}</b>${pendingJobs.map(job => `<div>${escapeHtml(ITEMS[job.result]?.name || job.result)} — готовность ${new Date(job.readyAt).toLocaleString('ru-RU')}</div>`).join('')}</div>` : '';
  const herbsList = ['herb-life', 'herb-moon'].map(id => { const count = countItem(id); const it = ITEMS[id]; return `<div class="herb-item ${count > 0 ? '' : 'empty'}"><span class="herb-icon">${it.icon}</span><span class="herb-name">${it.name}</span><span class="herb-count">×${count}</span></div>`; }).join('');
  const recipesHTML = npc.recipes.map(r => { const result = ITEMS[r.result]; const canCraft = r.ingredients.every(ing => countItem(ing.id) >= ing.qty); const ingList = r.ingredients.map(ing => `<span style="color:${countItem(ing.id) >= ing.qty ? '#60ff60' : '#ff6060'};">${ITEMS[ing.id].icon} ${ITEMS[ing.id].name} (${countItem(ing.id)}/${ing.qty})</span>`).join(' + '); return `<div class="recipe"><div class="recipe-result">${result.icon} ${result.name}</div><div class="recipe-ingredients">${ingList}</div><button type="button" data-npc-action="craft" data-npc-value="${escapeHtml(r.id)}" ${canCraft ? '' : 'disabled'} class="sell-btn">⚗️ Скрафтить</button></div>`; }).join('');
  const reforgeHTML = state.game.player.inventory.map((inst, index) => { const item = ITEMS[inst.id]; if (!item || !EQUIPMENT_TYPES.has(item.type)) return ''; const check = canReforgeItem(index); const rarity = RARITIES[inst.rarity || 'common']; return `<div class="recipe"><div class="recipe-result" style="color:${rarity?.color || '#c9a227'};">${item.icon} ${item.name} · ${rarity?.name || 'Обычный'}</div><button type="button" data-npc-action="reforge" data-npc-value="${index}" ${check.ok ? '' : 'disabled'} class="sell-btn">⚒️ Перековать за эссенцию</button>${!check.ok ? `<small>${check.msg}</small>` : ''}</div>`; }).join('');
  showNpcUI(`<div class="npc-header"><div class="npc-emoji">${npc.emoji}</div><div><h3 style="margin:0;">${npc.name}</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('alchemist')}»</p></div></div>${jobsHTML}<h3 style="margin-top:15px;">🌿 Ваши травы</h3><div class="herbs-list">${herbsList}</div><h3 style="margin-top:15px;">⚗️ Рецепты</h3><div class="recipes-list">${recipesHTML}</div><h3 style="margin-top:15px;">⚒️ Перековка экипировки</h3><div class="recipes-list">${reforgeHTML || '<small>В сумке пока нет экипировки для перековки.</small>'}</div><button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`);
}

export function openMerchant(isWandering = false) {
  const p = state.game.player;
  const commonPool = [...NPCS.merchant.stock];
  const rarePool = [...(NPCS.merchant.rareStock || [])].filter(id => ITEMS[id] &&
    !ITEMS[id].storyShard && !ITEMS[id].bossOnly && ITEMS[id].type !== 'quest');
  const shuffled = pool => pool.sort(() => Math.random() - 0.5);
  const stock = isWandering
    ? [...shuffled(commonPool).slice(0, 3), ...shuffled(rarePool).slice(0, 2)]
    : shuffled(commonPool).slice(0, 5);
  const html = stock.map(id => { const item = ITEMS[id]; return `<div class="item" data-npc-tooltip="${escapeHtml(id)}"><div class="item-info"><div class="item-name">${item.icon} ${item.name}</div><div class="item-desc">${item.desc} · 💰 ${item.price}</div></div><button type="button" data-npc-action="buy" data-npc-value="${escapeHtml(id)}" ${p.gold < item.price ? 'disabled' : ''} style="font-size:12px;padding:6px 12px;">Купить</button></div>`; }).join('');
  showNpcUI(`<div class="npc-header"><div class="npc-emoji">🛒</div><div><h3 style="margin:0;">Странствующий торговец</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('merchant')}»</p></div></div><div class="npc-gold">💰 Ваше золото: <b style="color:#ffd060;">${p.gold}</b></div>${isWandering ? '<p class="item-desc">Путник остановился ненадолго. В запасе — редкие находки из дальних земель.</p>' : ''}<h3>${isWandering ? 'Редкие находки и товары' : 'Товары дня'}</h3><div class="item-list">${html}</div><button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`);
}

export function openElder() {
  const p = state.game.player;
  const hasBlessing = hasActiveEntry(p.effects, 'elderBlessing');
  const isFirstMeet = !p.stats?.metElder;
  const shardsCount = Object.values(state.game.storyShards || {}).filter(Boolean).length;
  const active = getActiveCampaignMission(p);
  const next = active || getNextCampaignMission(p);

  let dialogue = '';
  if (isFirstMeet) {
    dialogue = `<div class="elder-lore"><p>«Я думал, что осколки — единственная беда. Но трещина Кристалла ослабила границу мира. Её удерживают три дракона-печати — каждый хранит один осколок. Их следы ведут в земли, которых нет на старых картах.</p><p>В чаще корни помнят звёзды. Под водой лежит город свидетелей. В обсидиане спит кузница клятв. Лёд хранит признание королевы. А за гранью мира ждёт тот, кого называют Немым.</p><p>Я буду поручать тебе дела по одному. Выполни их и возвращайся ко мне: за каждым ответом откроется следующая часть правды».</p></div>`;
  } else if (shardsCount === 3) {
    dialogue = `<p class="elder-notice">💎 Все три осколка собраны. Последняя печать разрушена, Разлом открыт. Заверши оставшиеся поручения, чтобы определить судьбу мира.</p>`;
  } else if (shardsCount > 0) {
    dialogue = `<p class="elder-notice">Сюжетных осколков собрано: <b>${shardsCount}/3</b>. Каждый из них можно получить только после победы над своим драконом-печатью.</p>`;
  }

  let missionBlock = '';
  if (next) {
    const { act, mission } = next;
    const progress = getMissionProgress(p, mission);
    const missionLocationId = mission.locationId || act.locationId;
    const location = LOCATIONS[missionLocationId]?.name || missionLocationId;
    const reward = getMissionReward(mission);
    const status = active
      ? progress.complete
        ? '<b class="elder-quest-ready">Поручение завершено. Эдвин ждёт твоего возвращения.</b>'
        : '<b class="elder-quest-active">Поручение принято. Продолжай путь.</b>'
      : '<b class="elder-quest-new">Новое поручение доступно.</b>';

    const action = active
      ? progress.complete
        ? '<button type="button" data-npc-action="turn-in-quest" class="sell-btn elder-quest-action">Сдать поручение и получить награду</button>'
        : ''
      : '<button type="button" data-npc-action="accept-quest" class="sell-btn elder-quest-action">Принять поручение</button>';

    missionBlock = `
      <section class="elder-quest-card">
        <small>${escapeHtml(act.subtitle)} · ${act.number} акт</small>
        <h3>${escapeHtml(mission.title)}</h3>
        <p>${escapeHtml(mission.desc)}</p>
        <div class="elder-quest-meta">📍 Регион: <b>${escapeHtml(location)}</b></div>
        <div class="elder-quest-objective">${status}<span>${escapeHtml(mission.objective)}</span></div>
        <div class="campaign-progress"><i style="width:${Math.min(100, progress.current / progress.required * 100)}%"></i></div>
        <div class="elder-quest-count">${progress.current} / ${progress.required}</div>
        <div class="elder-quest-reward">Награда: 💰 ${reward.gold} · ✨ ${reward.exp} EXP · ${ITEMS[reward.itemId]?.icon || '📦'} ${escapeHtml(ITEMS[reward.itemId]?.name || reward.itemId)}</div>
        ${action}
      </section>`;
  } else {
    missionBlock = `<section class="elder-quest-card elder-campaign-finished"><h3>Пять актов завершены</h3><p>«Три дракона повержены, все три осколка собраны, а Разлом открыт. Теперь решение за тобой: закрыть его навсегда или оставить открытым под новым общим договором».</p></section>`;
  }

  showNpcUI(`
    <div class="npc-header"><div class="npc-emoji">👴</div><div><h3 style="margin:0;">Старейшина Эдвин</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('elder')}»</p></div></div>
    ${dialogue}
    ${missionBlock}
    ${hasBlessing ? '<p class="elder-notice">✨ Благословение старейшины уже действует.</p>' : '<div class="elder-blessing"><p>Благословение даёт +20% к получаемому опыту на 10 боёв.</p><button type="button" data-npc-action="blessing" class="sell-btn">Принять благословение</button></div>'}
    <button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>
  `);

  if (isFirstMeet) {
    const snapshot = cloneNpcPlayer(p);
    if (!snapshot) {
      toast('Не удалось подготовить запись встречи со старейшиной.');
      return;
    }
    if (!p.stats) p.stats = {};
    p.stats.metElder = true;
    persistNpcPlayerMutation(p, snapshot, 'Не удалось сохранить первую встречу со старейшиной.');
  }
}

export function acceptElderQuestUI() {
  const p = state.game?.player;
  if (!p) return;
  const next = getNextCampaignMission(p);
  if (!next) {
    toast('Сейчас нет доступного нового поручения.');
    return;
  }
  const snapshot = cloneNpcPlayer(p);
  if (!snapshot) {
    toast('Не удалось подготовить поручение к сохранению.');
    return;
  }
  if (!acceptCampaignMission(p, next.mission.id)) {
    toast('Сейчас нет доступного нового поручения.');
    return;
  }
  if (!persistNpcPlayerMutation(p, snapshot, 'Не удалось сохранить поручение. Изменения отменены.')) {
    openElder();
    return;
  }
  openElder();
  toast(`📜 Принято поручение: ${next.mission.title}`);
}

export function turnInElderQuestUI() {
  const p = state.game?.player;
  if (!p) return;
  const active = getActiveCampaignMission(p);
  if (!active) {
    toast('Нет активного поручения для сдачи.');
    return;
  }
  const reward = getMissionReward(active.mission);
  const goldTotals = getGoldRewardTotals(p, reward.gold);
  if (!goldTotals) {
    toast('Невозможно начислить награду: проверьте баланс золота и статистику.');
    return;
  }
  let previousPlayer;
  try {
    previousPlayer = JSON.parse(JSON.stringify(p));
  } catch {
    toast('Не удалось подготовить награду. Попробуйте ещё раз.');
    return;
  }
  const completed = claimCampaignMission(p);
  if (!completed) {
    toast('Поручение ещё не выполнено.');
    return;
  }

  p.gold = goldTotals.gold;
  addExp(reward.exp);
  const itemReward = reward.itemId ? addItemOrStore(reward.itemId, 1) : null;
  const itemName = reward.itemId ? (ITEMS[reward.itemId]?.name || reward.itemId) : '';
  const itemMessage = itemReward?.stored
    ? ` Материал «${itemName}» отправлен в хранилище добычи.`
    : itemReward?.created?.length ? ` Материал: ${itemName}.` : '';
  if (!p.stats || typeof p.stats !== 'object') p.stats = {};
  p.stats.goldEarned = goldTotals.goldEarned;
  if (!saveGame()) {
    for (const key of Object.keys(p)) delete p[key];
    Object.assign(p, previousPlayer);
    toast('Не удалось сохранить награду. Поручение и ресурсы восстановлены.');
    return;
  }
  openElder();
  toast(`Награда получена: +${reward.gold} золота, +${reward.exp} опыта.${itemMessage}`);
  if (canCompleteMainQuest(state.game)) emit('victory');
}

export function openWell() {
  const p = state.game.player; const canUse = canUseWell(p);
  showNpcUI(`<div class="npc-header"><div class="npc-emoji">⛲</div><div><h3 style="margin:0;">Древний колодец</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('well')}»</p></div></div>${p.hp >= p.maxHp && p.mp >= p.maxMp ? `<p style="text-align:center; padding: 20px; color: #60ff60;">✨ Вы полностью здоровы.</p>` : canUse ? `<div style="text-align:center; margin: 20px 0;"><button type="button" data-npc-action="well" class="sell-btn" style="padding: 15px 30px;">💧 Испить воды (Полный хил)</button></div>` : `<p style="text-align:center; padding: 20px; color: #ff6060;">Колодец исцелит вас снова через 24 часа.</p>`}<button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`);
}

export function openBard() {
  const p = state.game.player; const hasBuff = hasActiveEntry(p.buffs, 'bardBuff'); const cost = NPCS.bard.cost;
  showNpcUI(`<div class="npc-header"><div class="npc-emoji">🎵</div><div><h3 style="margin:0;">Бард Лютик</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('bard')}»</p></div></div><div class="npc-gold">💰 Ваше золото: <b style="color:#ffd060;">${p.gold}</b></div>${hasBuff ? `<p style="text-align:center; padding: 20px; color: #ffd060;">🎵 Музыка барда вдохновляет вас (+10% опыта).</p>` : `<div style="text-align:center; margin: 20px 0;"><p style="margin-bottom: 15px;">Песня барда дает +10% к опыту на 3 боя.</p><button type="button" data-npc-action="bard" ${p.gold < cost ? 'disabled' : ''} class="sell-btn" style="padding: 15px 30px;">Заплатить ${cost}💰</button></div>`}<button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`);
}

export function openGuard() { showNpcUI(`<div class="npc-header"><div class="npc-emoji">🛡️</div><div><h3 style="margin:0;">Стражник</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('guard')}»</p></div></div><div class="item-desc" style="padding:15px; line-height:1.7;"><b>Справка по локациям:</b><br>🌲 Тёмный лес — гоблины и скелеты (легко)<br>🏛️ Руины — нежить (средне)<br>🕳️ Пещера теней — тёмный рыцарь и маг (сложно)<br>🩸 Болото — волки и лучники<br>🪦 Кладбище — призраки и босс<br>🌋 Вулкан — элементали и босс</div><button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`); }
export function openCat() { const p = state.game.player; const hasBuff = hasActiveEntry(p.buffs, 'catLuck'); showNpcUI(`<div class="npc-header"><div class="npc-emoji">🐈</div><div><h3 style="margin:0;">Кошка</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('cat')}»</p></div></div>${hasBuff ? `<p style="text-align:center; padding: 20px; color: #ffd060;">🐈 Кошка мурчит рядом (+5% крита).</p>` : `<div style="text-align:center; margin: 20px 0;"><p style="margin-bottom: 15px;">Если погладить кошку, она принесет удачу (+5% крита на 1 бой).</p><button type="button" data-npc-action="pet-cat" class="sell-btn" style="padding: 15px 30px;">Погладить</button></div>`}<button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`); }
export function openKids() { showNpcUI(`<div class="npc-header"><div class="npc-emoji">👦</div><div><h3 style="margin:0;">Дети</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('kids')}»</p></div></div><div style="text-align:center; padding: 20px; color: #60ff60;">👦 Дети радостно бегают вокруг вас.</div><button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`); }
export function openHerald() { showNpcUI(`<div class="npc-header"><div class="npc-emoji">📢</div><div><h3 style="margin:0;">Глашатай</h3><p style="color:#a89060;font-style:italic;margin-top:4px;">«${getGreeting('herald')}»</p></div></div><div style="text-align:center; padding: 20px; color: #ffd060;">📢 «Слушайте! В лесу замечен элитный гоблин, а в Разломе — сокровища!»</div><button type="button" data-npc-action="close" style="width:100%;margin-top:15px;">← Уйти</button>`); }

export function payBardUI() {
  const p = state.game?.player;
  const cost = NPCS.bard.cost;
  if (!p || hasActiveEntry(p.buffs, 'bardBuff') || !Number.isSafeInteger(p.gold) || p.gold < 0 || p.gold < cost) return false;
  const snapshot = cloneNpcPlayer(p);
  if (!snapshot) { toast('Не удалось подготовить оплату барду.'); return false; }
  if (!Array.isArray(p.buffs)) p.buffs = [];
  p.gold -= cost;
  p.buffs.push({ id: 'bardBuff', duration: 3 });
  if (!persistNpcPlayerMutation(p, snapshot, 'Не удалось сохранить оплату барду. Золото возвращено.')) {
    openBard();
    return false;
  }
  openBard();
  toast(`🎵 Бард вдохновил вас! (+10% опыта, −${cost}💰)`);
  return true;
}

export function petCatUI() {
  const p = state.game?.player;
  if (!p || hasActiveEntry(p.buffs, 'catLuck')) return false;
  const snapshot = cloneNpcPlayer(p);
  if (!snapshot) { toast('Не удалось подготовить кошачью удачу.'); return false; }
  if (!Array.isArray(p.buffs)) p.buffs = [];
  p.buffs.push({ id: 'catLuck', duration: 1 });
  if (!persistNpcPlayerMutation(p, snapshot, 'Не удалось сохранить кошачью удачу. Изменения отменены.')) {
    openCat();
    return false;
  }
  openCat();
  toast('🐈 Кошка мурчит. Удача с вами! (+5% крита)');
  return true;
}
export function closeNpcAndResumeUI() {
  import('./overworld.js').then(m => {
    m.closeDialogAndResume();
    showScreen('screen-overworld');
    if (npcDialogReturnFocus?.isConnected) npcDialogReturnFocus.focus();
    npcDialogReturnFocus = null;
  });
}
export function takeElderBlessingUI() {
  const p = state.game?.player;
  if (!p || hasActiveEntry(p.effects, 'elderBlessing')) return false;
  const snapshot = cloneNpcPlayer(p);
  if (!snapshot) { toast('Не удалось подготовить благословение.'); return false; }
  if (!Array.isArray(p.effects)) p.effects = [];
  p.effects.push({ id: 'elderBlessing', duration: 10 });
  if (!persistNpcPlayerMutation(p, snapshot, 'Не удалось сохранить благословение. Изменения отменены.')) {
    openElder();
    return false;
  }
  openElder();
  toast('✨ Вы получили благословение (+20% опыта)');
  return true;
}

export function useWellUI() {
  const p = state.game?.player;
  const now = Date.now();
  if (!p || !canUseWell(p, now)) return false;
  if (p.hp >= p.maxHp && (p.class === 'warrior' || p.mp >= p.maxMp)) return false;
  const snapshot = cloneNpcPlayer(p);
  if (!snapshot) { toast('Не удалось подготовить исцеление.'); return false; }
  p.hp = p.maxHp;
  if (p.class !== 'warrior') p.mp = p.maxMp;
  if (!p.stats || typeof p.stats !== 'object') p.stats = {};
  p.stats.lastWellUse = now;
  if (!persistNpcPlayerMutation(p, snapshot, 'Не удалось сохранить исцеление. Здоровье и колодец восстановлены.')) {
    openWell();
    return false;
  }
  openWell();
  toast('💧 Вы полностью исцелены!');
  return true;
}