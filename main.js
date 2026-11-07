import { state } from './systems/state.js';
import { WORLD_CONNECTIONS, WORLD_REGION_IDS, getWorldRouteKey } from './data/world.js';
import { ensureWorldState, getAccessibleWorldRegions, canTravelToRegion, discoverWorldRegion } from './systems/world-state.js';
import { acceptWorldEvent, claimWorldEventReward, recordWorldEventDiscovery } from './systems/world-events.js';
import { recordRegionEventResolved } from './systems/region-state.js';
import { LOCATIONS } from './data/locations.js?v=20261102-fix1';
import { on, emit } from './systems/events.js';
import { saveGame, loadSettings, migrateLegacySave } from './systems/save.js';
import { addItemOrStore } from './systems/inventory.js';
import { ITEMS } from './data/items.js?v=20261102-fix4';
import { addExp } from './systems/progression.js';
import { getGoldRewardTotals } from './systems/economy.js';
import {
  updateMainMenu, startNewGame, openSettings, backFromSettings, saveAndMenu,
  loadSlot, newGameSlot, deleteSlot, renderSlots,
  switchSettingsTab, handleSettingsTabKey, applySettings, applyFontScale, resetAllSettings, deleteAllSaves,
  openAchievementsMenu, openHelp,
  exportSave, importSave
} from './ui/menu.js';
import { selectClass, reviewClassSelection, cancelClassReview, confirmClassSelection } from './ui/character.js';
import {
  renderGame, switchTab, useItemOutside,
  equipItemByIndexUI, unequipItemUI, openShop, buyItemUI,
  showInvTooltip, showEqTooltip, hideTooltip,
  spendStat, sellItemByIndexUI,
  setInvFilter, setInvSort, invSlotClick, claimPendingLootUI, openSaleUI, toggleSaleItem, selectSaleTiersUI, selectSaleFilterUI, confirmSaleUI, cancelSaleUI,
  openBlacksmith, openHealer, openAlchemist, backToVillage,
  openMerchant, openElder, openWell, closeNpcAndResumeUI,
  takeElderBlessingUI, useWellUI, acceptElderQuestUI, turnInElderQuestUI,
  openBard, openGuard, openCat, openKids, openHerald, openQuestBoard,
  payBardUI, petCatUI, claimQuestUI,
  upgradeEquipmentUI, healAtHealerUI, craftRecipeUI, reforgeItemUI, setShopPreset, buybackItemUI,
  showShopTooltip, equipBestUI, sellJunkUI, socketRuneUI,
  allocatePassiveUI, resetPassivesUI, passiveTreePointerDown, passiveTreePointerMove, passiveTreePointerUp,
  passiveTreeZoom, passiveTreeResetView, passiveTreeKeyDown
} from './ui/game.js';
import {
  initOverworld, resumeOverworld, owOpenSpells, owOpenItems, owOpenAbilities, owCloseSub,
  owAttack, owCast, owUseItem, owBlock, owUseAbility, owFlee,
  owPauseResume, owPauseSaveVillage, owPauseExit
} from './ui/overworld.js';
import { openDailyChest } from './ui/village.js';
import { exitOverworld, enterOverworld } from './systems/overworld.js';
import { isRiftReady, getRiftLocations, getRiftClearedCount } from './systems/rift.js';
import { getStoryLocationProgression, countStoryShards } from './systems/campaign.js';
import { getTotalKills, getSafeCount } from './systems/stats.js';
import { getTowerBest, getTowerStartFloor, TOWER_MAX_FLOOR } from './systems/tower.js';
import { startNGPlus } from './systems/ngplus.js';
import { showScreen, toast, logTo, escapeHtml } from './ui/screens.js';
import {
  initAudio, playSound, playBGM, updateVolume, resumeContext
} from './systems/audio.js';
import {
  speak as speakVoice, stop as stopVoice,
  isVoiceSupported, initVoices
} from './systems/voice.js';

const ALWAYS_SHOW_PROLOGUE = false;

// Lightweight runtime diagnostics: capture uncaught errors, rejected promises,
// and failed resource loads without interrupting the game.
const RUNTIME_DIAGNOSTICS_LIMIT = 50;
const runtimeDiagnostics = [];
function recordRuntimeDiagnostic(type, message, details = {}) {
  const entry = {
    type,
    message: String(message || 'Unknown runtime error').slice(0, 500),
    timestamp: new Date().toISOString(),
    ...details
  };
  runtimeDiagnostics.push(entry);
  if (runtimeDiagnostics.length > RUNTIME_DIAGNOSTICS_LIMIT) {
    runtimeDiagnostics.splice(0, runtimeDiagnostics.length - RUNTIME_DIAGNOSTICS_LIMIT);
  }
  try {
    console.warn('[Game diagnostics]', entry);
  } catch {}
  return entry;
}

function readLocalStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    recordRuntimeDiagnostic('storage-read', error?.message || 'Storage read failed', { resource: key });
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    recordRuntimeDiagnostic('storage-write', error?.message || 'Storage write failed', { resource: key });
    return false;
  }
}

function removeLocalStorage(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    recordRuntimeDiagnostic('storage-remove', error?.message || 'Storage remove failed', { resource: key });
    return false;
  }
}

// Transfer errors that occurred while HTML was parsing and modules were loading.
const earlyDiagnostics = Array.isArray(window.__GAME_DIAGNOSTICS_EARLY__)
  ? window.__GAME_DIAGNOSTICS_EARLY__.splice(0)
  : [];
earlyDiagnostics.forEach(entry => recordRuntimeDiagnostic(entry.type, entry.message, {
  source: entry.source || '',
  line: entry.line || 0,
  column: entry.column || 0,
  resource: entry.resource || ''
}));

window.addEventListener('error', (event) => {
  const target = event.target;
  // Resource errors do not bubble; capture-phase listener receives them.
  if (target && target !== window) {
    const tag = target.tagName ? target.tagName.toLowerCase() : 'resource';
    const url = target.src || target.href || '';
    recordRuntimeDiagnostic('resource-load', `Не удалось загрузить ресурс <${tag}>`, {
      resource: String(url).slice(0, 1000)
    });
    showErrorToast(`Не удалось загрузить ресурс: ${tag}`);
    return;
  }
  const message = event.message || 'Uncaught error';
  recordRuntimeDiagnostic('uncaught-error', message, {
    source: event.filename || '',
    line: event.lineno || 0,
    column: event.colno || 0
  });
  showErrorToast(message);
}, true);

window.__GAME_DIAGNOSTICS_READY__ = true;

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason && reason.stack
    ? reason.stack
    : (reason && reason.message) || String(reason);
  recordRuntimeDiagnostic('unhandled-rejection', message);
  showErrorToast(message);
});


on('toast', toast);
on('log', ({ channel, msg, cls }) => logTo('game-log', msg, cls));

function showHeroArrivalTransition() {
  const body = document.body;
  if (!body || typeof document.createElement !== 'function') return;
  document.getElementById('hero-arrival-transition')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'hero-arrival-transition';
  overlay.className = 'hero-arrival-transition';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-label', 'Герой создан. Приключение начинается.');
  overlay.innerHTML = `
    <div class="hero-arrival-content">
      <span class="hero-arrival-rune" aria-hidden="true">✦</span>
      <span class="hero-arrival-kicker">ЛЕТОПИСЬ РАЗЛОМА · ГЛАВА ПЕРВАЯ</span>
      <h1>Путь начинается</h1>
      <p>Мир ждёт твоего решения</p>
      <span class="hero-arrival-line" aria-hidden="true"></span>
    </div>
  `;

  const duration = state.settings?.reducedMotion ? 520 : 1450;
  if (typeof overlay.style?.setProperty === 'function') {
    overlay.style.setProperty('--arrival-duration', `${duration}ms`);
  } else if (overlay.style) {
    overlay.style['--arrival-duration'] = `${duration}ms`;
  }
  body.appendChild(overlay);
  (window.setTimeout || globalThis.setTimeout)(() => overlay.remove(), duration + 100);
}

on('game:started', () => {
  stopVoice();
  // A new hero always enters the village scene, never the legacy full-screen world map.
  state.currentTab = 'quests';
  const log = document.getElementById('game-log');
  if (log) log.innerHTML = '';
  showScreen('screen-game');
  renderGame();
  showHeroArrivalTransition();
  initAudio();
  updateVolume();
  playBGM('village');
  enterOverworld('village');
});
on('game:update', renderGame);

on('overworld:start', () => {
  showScreen('screen-game');
  document.getElementById('screen-game')?.classList.remove('map-focused');
  document.getElementById('screen-game')?.classList.add('overworld-active');
  initOverworld();
  if (state.overworld.locationId === 'village') playBGM('village');
  else playBGM('explore');
});
on('overworld:end', () => {
  document.getElementById('screen-game')?.classList.remove('overworld-active');
  showScreen('screen-game');
  renderGame();
  playBGM('village');
});
on('overworld:defeat', () => {
  showScreen('screen-death');
});

on('combat:start', () => playBGM('combat'));
on('combat:end', () => playBGM('explore'));

on('rift:opened', showRiftOpeningCutscene);

on('victory', () => {
  if (state.game && state.game.player) {
    state.game.player.victoryAchieved = true;
    saveGame();
  }
  playSound('victory');
  showScreen('screen-victory');
  updateEndingChoiceUI();
});

function updateEndingChoiceUI() {
  const status = document.getElementById('ending-choice-status');
  if (!status || !state.game) return;
  status.textContent = state.game.riftEnding === 'closed'
    ? 'Разлом закрыт навсегда. Мир больше не соприкоснётся с тем, что лежит за гранью.'
    : state.game.riftEnding === 'open'
      ? 'Разлом оставлен открытым. Его края стабилизированы тремя осколками.'
      : 'Выберите судьбу Разлома.';
}

function chooseRiftEnding(choice) {
  if (!state.game?.player?.victoryAchieved || !['closed', 'open'].includes(choice)) return;
  state.game.riftEnding = choice;
  saveGame();
  updateEndingChoiceUI();
  toast(choice === 'closed' ? '🔒 Разлом запечатан навсегда.' : '🌀 Разлом оставлен открытым и стабилизирован.');
}

function showErrorToast(msg) {
  const el = document.createElement('div');
  el.className = 'error-toast';
  el.textContent = '⚠️ Ошибка: ' + msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

let audioBooted = false;
let dashboardLogFilter = 'all';
let dashboardLogQuery = '';

function applyDashboardNavigationSearch(value) {
  const query = String(value || '').trim().toLocaleLowerCase('ru');
  const list = document.querySelector('.dashboard-tablist');
  if (!list) return;
  list.querySelectorAll('.tab[role="tab"]').forEach(tab => {
    const matches = !query || (tab.textContent || '').toLocaleLowerCase('ru').includes(query);
    tab.hidden = !matches;
  });
  list.querySelectorAll('.dashboard-nav-caption').forEach(caption => {
    let next = caption.nextElementSibling;
    let hasVisibleTab = false;
    while (next && !next.classList.contains('dashboard-nav-caption')) {
      if (next.matches('.tab[role="tab"]:not([hidden])')) hasVisibleTab = true;
      next = next.nextElementSibling;
    }
    caption.hidden = Boolean(query) && !hasVisibleTab;
  });
}

function applyDashboardLogFilters() {
  const log = document.getElementById('game-log');
  if (!log) return;
  const query = dashboardLogQuery.trim().toLocaleLowerCase('ru');
  log.querySelectorAll(':scope > div').forEach(line => {
    const text = (line.textContent || '').toLocaleLowerCase('ru');
    const matchesQuery = !query || text.includes(query);
    const matchesCategory = dashboardLogFilter === 'all'
      || (dashboardLogFilter === 'combat' && /(урон|атак|удар|блок|крит|побед|враг|бой|здоров)/i.test(text))
      || (dashboardLogFilter === 'loot' && /(получ|добыч|предмет|золото|ресурс|осколок|экипировк|сундук)/i.test(text))
      || (dashboardLogFilter === 'story' && /(задан|акт|сюжет|дракон|разлом|мисси|старейшин|локац)/i.test(text));
    line.hidden = !(matchesQuery && matchesCategory);
  });
}

document.addEventListener('input', event => {
  if (event.target?.id === 'dashboard-nav-search') {
    applyDashboardNavigationSearch(event.target.value);
    return;
  }
  if (event.target?.id !== 'game-log-search') return;
  dashboardLogQuery = event.target.value || '';
  applyDashboardLogFilters();
});

document.addEventListener('click', (e) => {
  if (!audioBooted) {
    audioBooted = true;
    initAudio();
    resumeContext();
    initVoices();
  }
  resumeContext();
  const btn = e.target.closest('button');
  if (btn && !btn.closest('#combat-panel') && !btn.closest('#npc-panel') && !btn.closest('.stat-buttons')) playSound('click');

  if (e.target.closest('.mm-btn-prologue')) {
    e.preventDefault();
    openPrologue();
    return;
  }

  const logFilter = e.target.closest('[data-log-filter]');
  if (logFilter) {
    dashboardLogFilter = logFilter.dataset.logFilter || 'all';
    document.querySelectorAll('[data-log-filter]').forEach(button => {
      const active = button === logFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    applyDashboardLogFilters();
    return;
  }

  const action = e.target.closest('[data-game-action]');
  if (!action) return;
  if (action.dataset.gameAction === 'claim-quest') {
    const questId = action.dataset.questId;
    if (questId) window.GameAPI?.claimQuest?.(questId);
  } else if (action.dataset.gameAction === 'close-npc') {
    window.GameAPI?.closeNpcAndResume?.();
  }
});

// Tab-like navigation remains fully usable without a pointer.
document.addEventListener('keydown', (event) => {
  // The How-to overlay can always be dismissed with Escape, even when focus is inside it.
  if (event.key === 'Escape' && document.getElementById('screen-help')?.classList.contains('active')) {
    event.preventDefault();
    event.stopPropagation();
    showScreen('screen-main');
    updateMainMenu();
    return;
  }
  if (event.key === 'Escape' && document.getElementById('screen-prologue')?.classList.contains('active')) {
    event.preventDefault();
    stopPrologueAnimation();
    stopPrologueVoice();
    showScreen('screen-main');
    updateMainMenu();
    return;
  }
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
      && !/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || '')
      && document.getElementById('screen-game')?.classList.contains('active')) {
    event.preventDefault();
    document.getElementById('dashboard-nav-search')?.focus();
    return;
  }
  if (event.key === 'Escape' && event.target?.id === 'dashboard-nav-search') {
    event.target.value = '';
    applyDashboardNavigationSearch('');
    event.target.blur();
    return;
  }
  const tab = event.target.closest?.('[role="tab"]');
  if (!tab) return;
  const tabs = Array.from(tab.parentElement?.querySelectorAll('[role="tab"]:not([hidden]):not([disabled])') || []);
  if (!tabs.length) return;

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    tab.click();
    return;
  }

  let nextIndex = tabs.indexOf(tab);
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (nextIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (nextIndex - 1 + tabs.length) % tabs.length;
  else return;

  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
});

function persistBeforeLeaving() {
  stopVoice();
  if (state.game) saveGame();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hideTooltip();
    persistBeforeLeaving();
  }
});
window.addEventListener('pagehide', persistBeforeLeaving);
window.addEventListener('scroll', () => hideTooltip(), true);

function respawnInVillage() {
  if (!state.game) return;
  const p = state.game.player;
  p.hp = Math.ceil(p.maxHp / 2);
  p.mp = p.class === 'warrior' ? 0 : Math.ceil(p.maxMp / 2);
  p.effects = [];
  p.cooldowns = {};
  // Clear the defeated map before creating a fresh, safe village scene.
  // Merely showing the dashboard leaves the overworld canvas uninitialized
  // and was the cause of the post-death freeze.
  state.game.location = 'village';
  state.overworld = null;
  saveGame();

  const entered = enterOverworld('village');
  if (!entered) {
    // Defensive fallback: never strand the player on the death screen.
    showScreen('screen-game');
    renderGame();
  }
  playBGM('village');
  toast('Вы возродились в деревне');
}

function deathToMenu() {
  if (!state.game) return;
  const p = state.game.player;
  p.hp = Math.ceil(p.maxHp / 2);
  p.mp = p.class === 'warrior' ? 0 : Math.ceil(p.maxMp / 2);
  p.effects = [];
  p.cooldowns = {};
  state.overworld = null;
  saveGame();
  showScreen('screen-main');
  updateMainMenu();
}

function enterRift() {
  if (!state.game) return;
  if (!isRiftReady()) {
    const message = state.game.riftEnding === 'closed'
      ? 'Разлом запечатан навсегда вашим решением.'
      : 'Разлом закрыт. Печать держится, пока живы три дракона';
    toast(message);
    return;
  }
  openRiftMap();
}

function openRiftMap() {
  if (!state.game || !isRiftReady()) return;
  document.getElementById('rift-map-overlay')?.remove();
  const player = state.game.player;
  const level = player.level || 1;
  const locations = getRiftLocations(level);
  const kills = getTotalKills(player.stats?.kills);
  const deaths = getSafeCount(player.stats?.deaths);
  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
  const cleared = getRiftClearedCount(player);
  const shards = countStoryShards(state.game.storyShards);
  const crystalStatus = shards === 3 && state.game.storyDragons?.['blood-crown'] === true ? 'Стабилизирован' : 'Нестабилен';
  const overlay = document.createElement('div');
  overlay.id = 'rift-map-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(7,5,13,.96);color:#f4e9e9;padding:24px;overflow:auto;font-family:inherit;';
  overlay.innerHTML = `
    <div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div><div style="color:#c66b79;letter-spacing:.18em;font-size:12px">ПОСЛЕСЮЖЕТНОЕ ИСПЫТАНИЕ</div><h1 style="margin:6px 0">Карта Разлома</h1><p style="color:#c7b8c0">30 областей · 10 областей требуют 50 уровень · Ваш уровень: ${level}</p></div>
        <button type="button" data-rift-close style="padding:10px 18px">Закрыть</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:18px 0">
        <div style="background:#1c1721;border:1px solid #45303e;border-radius:8px;padding:10px"><small style="color:#bd9aa8">Убийства</small><div style="font-size:22px">${kills}</div></div>
        <div style="background:#1c1721;border:1px solid #45303e;border-radius:8px;padding:10px"><small style="color:#bd9aa8">Смерти</small><div style="font-size:22px">${deaths}</div></div>
        <div style="background:#1c1721;border:1px solid #45303e;border-radius:8px;padding:10px"><small style="color:#bd9aa8">K/D</small><div style="font-size:22px">${kd}</div></div>
        <div style="background:#1c1721;border:1px solid #45303e;border-radius:8px;padding:10px"><small style="color:#bd9aa8">Очищено</small><div style="font-size:22px">${cleared}/30</div></div>
        <div style="background:#1c1721;border:1px solid #45303e;border-radius:8px;padding:10px"><small style="color:#bd9aa8">Осколки</small><div style="font-size:22px">${shards}/3</div></div>
        <div style="background:#1c1721;border:1px solid #45303e;border-radius:8px;padding:10px"><small style="color:#bd9aa8">Кристалл</small><div style="font-size:16px;margin-top:5px">${crystalStatus}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:22px">
        ${locations.map((loc,index)=>`<button type="button" data-rift-id="${loc.id}" ${loc.unlocked?'':'disabled'} style="text-align:left;padding:14px;border:1px solid ${loc.unlocked?'#75434f':'#39323c'};background:${loc.unlocked?'linear-gradient(135deg,#261923,#121019)':'#17151b'};color:${loc.unlocked?'#f3e5e7':'#77717b'};border-radius:10px;min-height:82px;opacity:${loc.unlocked?1:.7}"><strong>${String(index+1).padStart(2,'0')}. ${loc.name}</strong><div style="font-size:12px;margin-top:8px">${loc.unlocked?'Доступна · Войти в область':`Требуется уровень ${loc.minLevel}`}</div></button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-rift-close]')?.addEventListener('click',()=>overlay.remove());
  overlay.querySelectorAll('[data-rift-id]:not(:disabled)').forEach(button=>button.addEventListener('click',()=>{
    const id=button.getAttribute('data-rift-id');
    overlay.remove();
    enterOverworld(id,{rifMode:true,rifFloor:1});
  }));
}

function openTowerMenu() {
  if (!state.game) return;
  document.getElementById('tower-map-overlay')?.remove();
  const best = getTowerBest();
  const startFloor = getTowerStartFloor();
  const overlay = document.createElement('div');
  overlay.id = 'tower-map-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10040;background:rgba(8,7,12,.97);color:#f4e9e9;padding:24px;overflow:auto;';
  overlay.innerHTML = `<div style="max-width:1000px;margin:0 auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><small style="color:#d2a66c;letter-spacing:.18em">ОДИНОЧНОЕ ИСПЫТАНИЕ</small><h1 style="margin:6px 0">Башня · 40 этажей</h1><p style="color:#c7b8c0">Лучший результат: ${best}/40 · Следующий старт: ${startFloor} этаж</p></div><button type="button" data-tower-close>Закрыть</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;margin:22px 0">${Array.from({length:TOWER_MAX_FLOOR},(_,i)=>{const floor=i+1;const reached=floor<=best;const guardian=floor%5===0;return `<div style="padding:12px 8px;text-align:center;border:1px solid ${reached?'#94714b':'#39323c'};border-radius:8px;background:${reached?'#2a2119':'#17151b'}"><strong>${String(floor).padStart(2,'0')}</strong><div style="font-size:11px;margin-top:5px;color:${guardian?'#d99a78':'#9b929d'}">${guardian?'СТРАЖ':'ЭТАЖ'}</div><div style="font-size:11px;margin-top:4px">${reached?'Пройден':'Впереди'}</div></div>`}).join('')}</div><button type="button" data-tower-start style="display:block;width:100%;padding:15px;border:1px solid #bd8d58;background:linear-gradient(135deg,#3b2a1b,#211810);color:#fff;border-radius:9px;font-size:16px">${best>=40?'Начать заново с 1 этажа':`Продолжить с ${startFloor} этажа`}</button></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-tower-close]')?.addEventListener('click',()=>overlay.remove());
  overlay.querySelector('[data-tower-start]')?.addEventListener('click',()=>{
    overlay.remove();
    enterOverworld(`tower-floor-${String(startFloor).padStart(2,'0')}`,{towerMode:true,towerFloor:startFloor});
  });
}

function showRiftOpeningCutscene() {
  if (!state.game || state.game.riftOpeningSeen) return;
  state.game.riftOpeningSeen = true;
  saveGame();
  if (state.overworld) {
    state.overworld.riftCutsceneWasActive = state.overworld.active;
    state.overworld.active = false;
  }
  const overlay = document.createElement('div');
  overlay.id = 'rift-opening-cutscene';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;text-align:center;padding:28px;background:radial-gradient(circle at center,#51202c 0%,#160d19 45%,#030207 100%);color:#f8e9ec;overflow:hidden;';
  overlay.innerHTML = `<div style="max-width:760px;animation:riftAwaken 12s ease both"><div style="font-size:64px;filter:drop-shadow(0 0 22px #d43c61)">🌀</div><div style="letter-spacing:.28em;color:#e58b9a;font-size:12px;margin:18px 0">ПОСЛЕДНЯЯ ПЕЧАТЬ РАЗРУШЕНА</div><h1 style="font-size:clamp(32px,6vw,64px);margin:0 0 20px">Разлом открыт</h1><p style="font-size:18px;line-height:1.8;color:#e5d3d9">Кровавая Корона пал. Три осколка отозвались друг другу — и граница между мирами вспыхнула алым светом. То, что было заперто за гранью, теперь может быть услышано.</p><p style="color:#c77c8b;letter-spacing:.12em">МИР УЖЕ НЕ БУДЕТ ПРЕЖНИМ</p><button type="button" data-rift-continue style="margin-top:24px;padding:12px 28px;border:1px solid #c66b79;background:#301722;color:#fff;border-radius:8px">Продолжить</button></div><style>@keyframes riftAwaken{0%{opacity:0;transform:scale(.88);filter:blur(12px)}18%{opacity:1;transform:scale(1);filter:blur(0)}82%{opacity:1}100%{opacity:1}}</style>`;
  document.body.appendChild(overlay);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    if (state.overworld) {
      state.overworld.active = state.overworld.riftCutsceneWasActive !== false;
      delete state.overworld.riftCutsceneWasActive;
    }
    toast('🌀 Разлом открыт. На карте доступно 30 областей.');
  };
  overlay.querySelector('[data-rift-continue]')?.addEventListener('click',finish);
  setTimeout(finish,12000);
}

function drawPortalPixelMap(canvas, points, routePoints) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  canvas.width = 250;
  canvas.height = 155;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b1b24';
  ctx.fillRect(0, 0, 250, 155);

  for (let y = 5; y < 155; y += 10) {
    for (let x = 5; x < 250; x += 10) {
      if ((x + y) % 30 === 0) {
        ctx.fillStyle = '#17313a';
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  const islands = [
    [12, 42, 46, 24], [34, 25, 42, 22], [68, 33, 46, 22],
    [112, 22, 52, 25], [160, 42, 60, 32], [145, 80, 60, 26],
    [83, 88, 54, 29], [28, 100, 38, 18]
  ];
  for (const [x, y, width, height] of islands) {
    ctx.fillStyle = '#294a40';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#42644a';
    ctx.fillRect(x + 4, y + 3, Math.max(4, width - 12), 3);
    ctx.fillStyle = '#1c3836';
    ctx.fillRect(x + 7, y + height - 5, Math.max(4, width - 15), 3);
    ctx.fillStyle = '#557252';
    ctx.fillRect(x + 10, y + 8, 4, 4);
    ctx.fillRect(x + width - 13, y + 6, 3, 3);
  }

  for (const route of routePoints || []) {
    if (!route.from || !route.to) continue;
    ctx.beginPath();
    ctx.moveTo(route.from.x / 4, route.from.y / 4);
    ctx.lineTo(route.to.x / 4, route.to.y / 4);
    ctx.strokeStyle = route.unlocked ? '#d2b16d' : '#36534e';
    ctx.lineWidth = route.unlocked ? 1.5 : 1;
    ctx.setLineDash(route.unlocked ? [3, 2] : [1, 3]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const point of points) {
    const x = Math.round(point.x / 4);
    const y = Math.round(point.y / 4);
    ctx.fillStyle = point.id === 'village' ? '#e6c783' : point.story ? '#8ec9ae' : '#b7c9c1';
    ctx.fillRect(x - 2, y - 2, point.id === 'village' ? 6 : 4, point.id === 'village' ? 6 : 4);
    ctx.fillStyle = '#10231f';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function openWorldPortalMenu() {
  let ow = state.overworld;
  if (!ow && state.game) {
    enterOverworld(state.game.location || 'village');
    ow = state.overworld;
  }
  if (!ow || ow.combat || ow.defeated) return;
  ow.active = false;
  const currentId = ow.sourceLocationId || ow.locationId;
  const world = ensureWorldState(state.game, { legacy: false });
  const destinations = WORLD_REGION_IDS
    .filter(id => id !== 'village' && LOCATIONS[id])
    .map(id => [id, LOCATIONS[id]]);
  const storyOrder = new Map(getStoryLocationProgression().map(item => [item.id, item]));
  destinations.sort(([a], [b]) =>
    (storyOrder.get(a)?.sequence ?? Number.MAX_SAFE_INTEGER) -
    (storyOrder.get(b)?.sequence ?? Number.MAX_SAFE_INTEGER)
  );
  if (isRiftReady() && LOCATIONS.rift) destinations.push(['rift', LOCATIONS.rift]);
  document.getElementById('aurora-world-portal')?.remove();

  const points = [['village', LOCATIONS.village], ...destinations].map(([id, loc], index) => {
    const story = storyOrder.get(id);
    const angle = -Math.PI / 2 + (index - 1) * (Math.PI * 2 / Math.max(1, destinations.length));
    const x = id === 'village' ? 500 : 500 + Math.cos(angle) * 360;
    const y = id === 'village' ? 310 : 310 + Math.sin(angle) * 220;
    return {
      id, loc, story, x, y, index,
      discovered: id === 'rift' || world.discoveredRegions.includes(id)
    };
  });
  const pointsById = new Map(points.map(point => [point.id, point]));
  const unlockedRoutes = new Set(world.unlockedRoutes || []);
  const routeLines = Object.entries(WORLD_CONNECTIONS).flatMap(([fromId, neighbors]) =>
    neighbors.filter(toId => fromId < toId).map(toId => {
      const from = pointsById.get(fromId);
      const to = pointsById.get(toId);
      return from && to ? {
        from, to,
        unlocked: unlockedRoutes.has(getWorldRouteKey(fromId, toId))
      } : null;
    }).filter(Boolean)
  );
  const accessible = new Set(getAccessibleWorldRegions(world, currentId));
  const nodeMarkup = points.map(point => {
    const here = point.id === currentId;
    const canTravel = point.id === 'rift' ? isRiftReady() : accessible.has(point.id);
    const classes = [
      'portal-map-node',
      point.id === 'village' ? 'portal-map-village-node' : '',
      !canTravel && !here ? 'is-locked' : '',
      canTravel && !here ? 'is-available' : '',
      point.discovered ? 'is-discovered' : 'is-undiscovered',
      here ? 'is-current' : ''
    ].filter(Boolean).join(' ');
    const label = point.story ? '#' + point.story.sequence + ' · ' + point.loc.name : point.loc.name;
    return '<button type="button" class="' + classes + '" data-portal-node="' + escapeHtml(point.id) +
      '" data-x="' + point.x.toFixed(1) + '" data-y="' + point.y.toFixed(1) +
      '" style="left:' + (point.x / 10) + '%;top:' + (point.y / 6.2) + '%" aria-pressed="false" aria-label="' +
      escapeHtml(label) + '"><span class="portal-map-node-icon">' + (point.loc.emoji || '✦') +
      '</span><span class="portal-map-node-label">' + escapeHtml(label) + '</span></button>';
  }).join('');

  const overlay = document.createElement('div');
  overlay.id = 'aurora-world-portal';
  overlay.className = 'portal-atlas-overlay';
  overlay.innerHTML =
    '<style>' +
    '#aurora-world-portal{position:fixed;inset:0;z-index:10070;display:flex;align-items:center;justify-content:center;padding:clamp(8px,2vw,24px);background:#07111a;color:#f2eadb;font-family:inherit;}' +
    '#aurora-world-portal *{box-sizing:border-box}#aurora-world-portal .portal-atlas{width:min(1500px,100%);height:min(920px,96vh);min-height:540px;display:flex;flex-direction:column;overflow:hidden;border:1px solid #72b9b2;border-radius:0;background:#152831;box-shadow:none}' +
    '#aurora-world-portal .portal-atlas-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 22px;border-bottom:1px solid rgba(114,185,178,.22)}' +
    '#aurora-world-portal .portal-atlas-head small{color:#8bd7ce;letter-spacing:.2em;font-size:10px;font-weight:800}#aurora-world-portal h1{margin:5px 0 0;font-size:clamp(22px,3vw,34px)}' +
    '#aurora-world-portal .portal-close{border:1px solid #719b9b;border-radius:0;background:#182a32;color:#e9ffff;padding:9px 13px;font:inherit;cursor:pointer}' +
    '#aurora-world-portal .portal-atlas-body{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:14px;min-height:0;flex:1;padding:14px}' +
    '#aurora-world-portal .portal-map-stage{position:relative;min-width:0;min-height:0;overflow:hidden;border:1px solid #52766b;border-radius:0;background:#0d1d26}' +
    '#aurora-world-portal .portal-map-stage:before{display:none}#aurora-world-portal .portal-map-art{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}' +
    '#aurora-world-portal .portal-map-node{position:absolute;z-index:2;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:3px;min-width:58px;max-width:130px;padding:5px 7px;border:1px solid rgba(125,191,177,.5);border-radius:0;background:#0a161e;color:#edf4e8;cursor:pointer;font:inherit;box-shadow:none;transition:none}' +
    '#aurora-world-portal .portal-map-node:hover,#aurora-world-portal .portal-map-node:focus-visible{z-index:4;transform:translate(-50%,-50%);outline:2px solid #a8ded0;outline-offset:2px}' +
    '#aurora-world-portal .portal-map-node[aria-pressed="true"]{border:2px solid #e6c783;background:#42351f;box-shadow:none}' +
    '#aurora-world-portal .portal-map-node.is-locked{border-color:#815c66;background:#241822;opacity:.68}#aurora-world-portal .portal-map-node.is-available{border-color:#8ec9ae}' +
    '#aurora-world-portal .portal-map-node.is-current{border-color:#e6c783}#aurora-world-portal .portal-map-node.is-undiscovered .portal-map-node-icon{opacity:.72}' +
    '#aurora-world-portal .portal-map-node-icon{font-size:clamp(17px,2vw,25px);line-height:1.2}#aurora-world-portal .portal-map-node-label{max-width:118px;font-size:9px;line-height:1.2;text-align:center;color:#d6e4dc;pointer-events:none;user-select:none}' +
    '#aurora-world-portal .portal-map-village-node{width:82px;min-width:82px;max-width:none;height:82px;border:2px solid #e6c783;border-radius:0;background:#66512c;box-shadow:none}#aurora-world-portal .portal-map-village-node .portal-map-node-icon{font-size:31px}#aurora-world-portal .portal-map-village-node .portal-map-node-label{position:absolute;top:84px;max-width:150px;white-space:nowrap;color:#f3dba5;font-size:11px;font-weight:800}' +
    '#aurora-world-portal .portal-map-legend{position:absolute;left:12px;bottom:10px;display:flex;gap:12px;flex-wrap:wrap;color:#b7c9c1;font-size:10px;background:#07121a;border:1px solid #29464a;padding:7px 10px;border-radius:0}' +
    '#aurora-world-portal .portal-map-legend span{display:flex;align-items:center;gap:5px}#aurora-world-portal .portal-map-legend i{width:8px;height:8px;border-radius:0;background:#8ec9ae}#aurora-world-portal .portal-map-legend .locked{background:#a87580}#aurora-world-portal .portal-map-legend .here{background:#e6c783}' +
    '#aurora-world-portal .portal-destination{min-width:0;overflow:auto;border:1px solid rgba(114,185,178,.25);border-radius:0;background:#07151c;padding:18px;display:flex;flex-direction:column;gap:12px}' +
    '#aurora-world-portal .portal-destination-kicker{color:#8bd7ce;font-size:10px;font-weight:800;letter-spacing:.15em}#aurora-world-portal .portal-destination h2{font-size:22px;line-height:1.2;margin:0}#aurora-world-portal .portal-destination p{color:#b5c6c5;font-size:13px;line-height:1.6;margin:0}' +
    '#aurora-world-portal .portal-destination-meta{display:grid;gap:8px;padding:11px;border-radius:0;background:#1b3034;color:#c7d9cf;font-size:12px}#aurora-world-portal .portal-destination-status{font-size:12px;font-weight:800;line-height:1.5;color:#8bd7ce}#aurora-world-portal .portal-destination-status.locked{color:#e0a0a9}' +
    '#aurora-world-portal .portal-travel{margin-top:auto;padding:13px 16px;border:1px solid #b99b61;border-radius:0;background:#765b2d;color:#fff5dd;font:inherit;font-weight:800;cursor:pointer}#aurora-world-portal .portal-travel:disabled{border-color:#596269;background:#29333a;color:#89969a;cursor:not-allowed}' +
    '#aurora-world-portal .portal-atlas-foot{padding:10px 18px;border-top:1px solid rgba(114,185,178,.18);color:#91aaa9;font-size:11px;text-align:center}' +
    '@media(max-width:850px){#aurora-world-portal .portal-atlas{height:96vh}#aurora-world-portal .portal-atlas-body{grid-template-columns:minmax(0,1fr) 260px}}' +
    '@media(max-width:650px){#aurora-world-portal .portal-atlas{height:96vh;min-height:0}#aurora-world-portal .portal-atlas-head{padding:12px 14px}#aurora-world-portal .portal-atlas-body{grid-template-columns:1fr;grid-template-rows:minmax(260px,1fr) auto;gap:9px;padding:9px}#aurora-world-portal .portal-map-stage{min-height:260px}#aurora-world-portal .portal-destination{max-height:205px;padding:12px;gap:7px}#aurora-world-portal .portal-destination h2{font-size:18px}#aurora-world-portal .portal-destination p{font-size:11px}#aurora-world-portal .portal-travel{padding:10px}#aurora-world-portal .portal-map-node{min-width:42px;padding:4px}#aurora-world-portal .portal-map-node-label{font-size:8px;max-width:82px}#aurora-world-portal .portal-map-village-node{width:58px;min-width:58px;height:58px}#aurora-world-portal .portal-map-village-node .portal-map-node-icon{font-size:24px}#aurora-world-portal .portal-map-village-node .portal-map-node-label{top:59px;font-size:9px}}' +
    '</style>' +
    '<section class="portal-atlas" role="dialog" aria-modal="true" aria-labelledby="aurora-world-portal-title">' +
      '<header class="portal-atlas-head"><div><small>ОТКРЫТЫЙ МИР · СЕТЬ ПУТЕЙ</small><h1 id="aurora-world-portal-title">Карта земель Разлома</h1></div><button type="button" class="portal-close" data-world-close aria-label="Закрыть карту">✕</button></header>' +
      '<div class="portal-atlas-body">' +
        '<div class="portal-map-stage" role="group" aria-label="Интерактивная карта регионов">' +
          '<canvas class="portal-map-art" id="portal-map-art" width="250" height="155" aria-hidden="true"></canvas>' +
          nodeMarkup +
          '<div class="portal-map-legend"><span><i></i>Доступный путь</span><span><i class="locked"></i>Закрытый путь</span><span><i class="here"></i>Вы здесь</span></div>' +
        '</div>' +
        '<aside class="portal-destination" id="portal-destination" aria-live="polite"></aside>' +
      '</div>' +
      '<footer class="portal-atlas-foot">Исследуйте соседние земли, открывайте новые маршруты и возвращайтесь в уже посещённые регионы. Уровень опасности — рекомендация, а не запрет.</footer>' +
    '</section>';
  document.body.appendChild(overlay);
  drawPortalPixelMap(overlay.querySelector('#portal-map-art'), points, routeLines);

  const nodeButtons = [...overlay.querySelectorAll('[data-portal-node]')];
  const detail = overlay.querySelector('#portal-destination');
  const resume = () => {
    overlay.remove();
    if (state.overworld) {
      resumeOverworld();
      document.getElementById('screen-game')?.classList.add('overworld-active');
    }
  };
  const selectDestination = id => {
    const point = points.find(item => item.id === id);
    if (!point) return;
    const latestWorld = ensureWorldState(state.game, { legacy: false });
    const here = id === currentId;
    const discovered = id === 'rift' || latestWorld.discoveredRegions.includes(id);
    const allowed = id === 'rift' ? isRiftReady() : canTravelToRegion(latestWorld, currentId, id);
    nodeButtons.forEach(button => {
      const active = button.dataset.portalNode === id;
      const buttonId = button.dataset.portalNode;
      const buttonHere = buttonId === currentId;
      const buttonAllowed = buttonId === 'rift' ? isRiftReady() : canTravelToRegion(latestWorld, currentId, buttonId);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-locked', !buttonAllowed && !buttonHere);
      button.classList.toggle('is-available', buttonAllowed && !buttonHere);
      button.classList.toggle('is-discovered', buttonId === 'rift' || latestWorld.discoveredRegions.includes(buttonId));
      button.classList.toggle('is-undiscovered', buttonId !== 'rift' && !latestWorld.discoveredRegions.includes(buttonId));
      button.classList.toggle('is-current', buttonHere);
      if (active) button.focus({ preventScroll: true });
    });
    const story = point.story;
    const status = here ? 'Вы уже находитесь в этом регионе.' : !allowed
      ? 'Маршрут пока закрыт. Сначала исследуйте соседнюю область.'
      : !discovered
        ? 'Новый регион. Переход откроет его и покажет следующие пути.'
        : 'Регион открыт. Вы можете вернуться сюда по доступному маршруту.';
    const level = story
      ? '<div><b>Рекомендуемый уровень:</b> ' + story.recommendedLevel + '</div>'
      : '<div><b>Тип области:</b> свободное исследование</div>';
    const chapter = story
      ? '<div><b>Глава:</b> ' + story.actNumber + ' · <b>Сюжетная отметка:</b> ' + story.sequence + '</div>'
      : '';
    detail.innerHTML =
      '<div class="portal-destination-kicker">' + (story ? 'СЮЖЕТНАЯ ОБЛАСТЬ · ' + story.actNumber + ' АКТ' : 'РЕГИОН ОТКРЫТОГО МИРА') + '</div>' +
      '<h2>' + escapeHtml(point.loc.emoji || '✦') + ' ' + escapeHtml(point.loc.name) + '</h2>' +
      '<p>' + escapeHtml(point.loc.desc || 'Неизведанная область мира.') + '</p>' +
      '<div class="portal-destination-meta">' + level + chapter + '<div><b>Опасность:</b> ' +
        (point.loc.safe ? 'безопасная зона' : 'враждебная территория') + '</div></div>' +
      '<div class="portal-destination-status' + (!allowed && !here ? ' locked' : '') + '" role="status">' + status + '</div>' +
      '<button type="button" class="portal-travel" data-portal-travel ' + (here || !allowed ? 'disabled' : '') + '>' +
        (here ? 'Вы здесь' : !allowed ? 'Маршрут закрыт' : discovered ? 'Перейти в регион' : 'Исследовать регион') + '</button>';
    detail.querySelector('[data-portal-travel]')?.addEventListener('click', () => {
      const latest = ensureWorldState(state.game, { legacy: false });
      const latestAllowed = id === 'rift' ? isRiftReady() : canTravelToRegion(latest, currentId, id);
      if (!latestAllowed) {
        selectDestination(id);
        toast('Сначала откройте путь из соседнего региона.');
        return;
      }
      overlay.remove();
      exitOverworld();
      if (id === 'rift') { enterRift(); return; }
      discoverWorldRegion(latest, id, currentId);
      const discoveryCompletions = recordWorldEventDiscovery(state.game, id);
      for (const event of discoveryCompletions) toast(`Задание выполнено: ${event.name}`);
      state.game.location = id;
      saveGame();
      if (!enterOverworld(id)) {
        state.game.location = currentId;
        saveGame();
        return;
      }
    });
  };
  nodeButtons.forEach(button => button.addEventListener('click', () => selectDestination(button.dataset.portalNode)));
  overlay.querySelector('[data-world-close]')?.addEventListener('click', resume);
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); resume(); }
  });
  overlay.addEventListener('click', event => { if (event.target === overlay) resume(); });
  const initial = points.some(point => point.id === currentId) ? currentId : 'village';
  selectDestination(initial);
}
function interactNpc(npcId) {
  if (!state.overworld) return;
  state.overworld.paused = true;

  if (npcId === 'world-portal' || npcId === 'world-waystone') { openWorldPortalMenu(); return; }
  if (npcId === 'tower-portal' || npcId === 'tower-gate') { exitOverworld(); openTowerMenu(); return; }
  if (npcId.startsWith('event-')) { handleWorldEvent(npcId); return; }

  if (npcId === 'blacksmith') openBlacksmith()
  else if (npcId === 'healer') openHealer()
  else if (npcId === 'alchemist') openAlchemist()
  else if (npcId === 'merchant') openMerchant()
  else if (npcId === 'elder') openElder()
  else if (npcId === 'well') openWell();
  else if (npcId === 'bard') openBard()
  else if (npcId === 'guard') openGuard();
  else if (npcId === 'cat') openCat();
  else if (npcId === 'kids') openKids();
  else if (npcId === 'herald') openHerald();
  else if (npcId === 'questBoard') openQuestBoard();
}

function handlePersistentWorldEvent(marker) {
  const eventId = marker.worldEventId;
  const game = state.game;
  const active = game?.world?.events?.active?.find(event => event.id === eventId);
  const completed = game?.world?.events?.history?.find(event => event.id === eventId && event.status === 'completed' && event.rewardClaimed !== true);
  const close = () => import('./ui/overworld.js').then(module => module.closeDialogAndResume());

  if (active) {
    if (active.accepted) {
      toast(active.name + ': ' + active.progress + '/' + active.targetCount + '. ' + active.objectiveText);
      close();
      return;
    }
    let snapshot;
    try { snapshot = JSON.stringify(game); } catch {
      toast('Не удалось подготовить сохранение события. Попробуйте ещё раз.');
      close();
      return;
    }
    if (!acceptWorldEvent(game, eventId) || !saveGame()) {
      try { state.game = JSON.parse(snapshot); } catch {}
      toast('Не удалось принять событие: прогресс не сохранён.');
      close();
      return;
    }
    emit('log', { channel: 'game', msg: 'Принято мировое событие: ' + active.name, cls: 'success' });
    toast('Событие принято: ' + active.name + '. ' + active.objectiveText);
    close();
    return;
  }

  if (!completed) {
    toast('Это событие уже завершилось.');
    close();
    return;
  }

  let snapshot;
  try { snapshot = JSON.stringify(game); } catch {
    toast('Не удалось подготовить награду события.');
    close();
    return;
  }
  const reward = claimWorldEventReward(game, eventId);
  if (!reward) {
    toast('Награда за это событие уже получена.');
    close();
    return;
  }
  const totals = getGoldRewardTotals(game.player, reward.gold);
  if (!totals) {
    try { state.game = JSON.parse(snapshot); } catch {}
    toast('Награда не помещается в безопасный лимит золота.');
    close();
    return;
  }
  game.player.gold = totals.gold;
  if (!game.player.stats || typeof game.player.stats !== 'object' || Array.isArray(game.player.stats)) game.player.stats = {};
  game.player.stats.goldEarned = totals.goldEarned;
  if (!saveGame()) {
    try { state.game = JSON.parse(snapshot); } catch {}
    toast('Не удалось сохранить награду. Событие осталось доступным.');
    close();
    return;
  }
  state.overworld.events = state.overworld.events.filter(item => item.worldEventId !== eventId);
  emit('log', { channel: 'game', msg: 'Получена награда за событие: ' + completed.name + ' (+' + reward.gold + ' золота)', cls: 'success' });
  toast('Награда получена: +' + reward.gold + ' золота. Репутация фракции уже обновлена.');
  close();
}

function handleWorldEvent(eventId) {
  const ow = state.overworld;
  if (!ow) return;
  const ev = (ow.events || []).find(e => e.id === eventId);
  if (!ev) return;

  if (ev.resolved) return;
  if (ev.worldEventId) { handlePersistentWorldEvent(ev); return; }
  let previousGame;
  try {
    previousGame = JSON.parse(JSON.stringify(state.game));
  } catch {
    toast('⚠️ Не удалось подготовить событие. Попробуйте ещё раз.');
    return;
  }
  ev.resolved = true;
  const p = state.game.player;
  if (!Array.isArray(p.effects)) p.effects = [];

  let logMsg = '';
  let toastMsg = '';
  let logClass = 'success';

  if (ev.eventType === 'altar') {
    const buffs = ['atkBuff', 'defBuff', 'lifesteal'];
    const buff = buffs[Math.floor(Math.random() * buffs.length)];
    const buffNames = { atkBuff: 'Боевой клич (+30% атаки)', defBuff: 'Щит (+50% защиты)', lifesteal: 'Кровожадность (50% вампиризм)' };
    p.effects.push({ id: buff, duration: 3 });
    logMsg = `⛩️ Алтарь дарует ${buffNames[buff]} на 3 боя`;
    toastMsg = `⛩️ ${buffNames[buff]}!`;
  } else if (ev.eventType === 'mimic') {
    if (Math.random() < 0.5) {
      const totals = getGoldRewardTotals(p, 12);
      if (!totals) {
        state.game = previousGame;
        ev.resolved = false;
        toast('Невозможно начислить золото: проверьте баланс и статистику.');
        return;
      }
      p.gold = totals.gold;
      if (!p.stats || typeof p.stats !== 'object' || Array.isArray(p.stats)) p.stats = {};
      p.stats.goldEarned = totals.goldEarned;
      logMsg = `🎁 Сундук: +12💰`;
      toastMsg = `🎁 +12💰!`;
    } else {
      p.hp = Math.max(1, p.hp - 20);
      ow.player.hp = p.hp;
      logMsg = `🎁 Мимик! −20 HP`;
      toastMsg = `🎁 Мимик! −20 HP`;
    }
  } else if (ev.eventType === 'crystal') {
    const totals = getGoldRewardTotals(p, 8);
    if (!totals) {
      state.game = previousGame;
      ev.resolved = false;
      toast('Невозможно начислить золото: проверьте баланс и статистику.');
      return;
    }
    p.gold = totals.gold;
    if (!p.stats || typeof p.stats !== 'object' || Array.isArray(p.stats)) p.stats = {};
    p.stats.goldEarned = totals.goldEarned;
    addExp(30);
    logMsg = `💎 Кристалл сырой магии: +8💰, +30 EXP`;
    toastMsg = `💎 +8💰, +30 EXP`;
  } else if (ev.eventType === 'traveler') {
    const items = ['health-potion', 'mana-potion', 'herb-life', 'herb-moon'];
    const itemId = items[Math.floor(Math.random() * items.length)];
    const reward = addItemOrStore(itemId, 1);
    logMsg = reward.stored
      ? `🧙 ${ITEMS[itemId].name} отправлено в хранилище добычи — в сумке нет места.`
      : `🧙 Странник дарит: ${ITEMS[itemId].name}`;
    toastMsg = reward.stored
      ? '🧙 Подарок сохранён в хранилище добычи.'
      : '🧙 Подарок странника!';
    if (reward.stored) logClass = 'warning';
  }

  recordRegionEventResolved(state.game.world, ow.sourceLocationId || ow.locationId, ev.id);
  ow.events = ow.events.filter(e => e.id !== eventId);
  if (!saveGame()) {
    state.game = previousGame;
    ow.player.hp = state.game.player.hp;
    const restoredEvent = ow.events.find(e => e.id === eventId);
    if (restoredEvent) restoredEvent.resolved = false;
    else ow.events.push({ ...ev, resolved: false });
    ow.paused = false;
    toast('⚠️ Награда не сохранена. Событие восстановлено — попробуйте снова.');
    import('./ui/overworld.js').then(m => m.closeDialogAndResume());
    return;
  }
  emit('log', { channel: 'game', msg: logMsg, cls: logClass });
  toast(toastMsg);
  ow.paused = false;

  import('./ui/overworld.js').then(m => m.closeDialogAndResume());
}

function skipPrologue() {
  stopPrologueAnimation();
  stopPrologueVoice();
  if (!writeLocalStorage('magic-rpg-prologue-seen', '1')) {
    toast('Не удалось сохранить отметку пролога. При следующем запуске он может показаться снова.');
  }
  showScreen('screen-main');
  updateMainMenu();
}

// ==== КИНЕМАТОГРАФИЧЕСКИЙ ПРОЛОГ И РАССКАЗЧИК ====
const PROLOGUE_SCENES = [
  {
    chapter: 'Глава I · Золотой век, который плохо кончился',
    caption: 'КОГДА ДРАКОНЫ БЫЛИ БОГАЧЕ ВСЕХ',
    text: 'Задолго до появления королевств, налогов и людей, которые называют себя великими стратегами, мир принадлежал драконам. Их города сияли над облаками, леса помнили древние заклинания, а реки текли так, будто знали, куда направляются. Магия была повсюду. Её не покупали за золото — хотя, будь у тогдашних торговцев такая возможность, они наверняка придумали бы абонентскую плату. Казалось, этот порядок простоит вечность. И вот тут мир совершил классическую ошибку: поверил в слово «вечность».'
  },
  {
    chapter: 'Глава II · Трещина, которой не должно было быть',
    caption: 'РЕАЛЬНОСТЬ ДАЛА СБОЙ',
    text: 'Однажды под самой древней землёй раздался звук, похожий на раскалывающееся небо. В воздухе появилась тонкая чёрная линия. Сначала её приняли за дурное предзнаменование. Потом из неё вышел безликий ужас и стёр с карты целый город. После этого спорить о природе явления стало некому. Разлом рос, пожирая поселения, память и саму ткань мира. Законы магии перестали работать. Некоторые люди просыпались в собственных могилах. Другие предпочитали не просыпаться вовсе. У мира, как выяснилось, началась очень плохая неделя. И это была только первая.'
  },
  {
    chapter: 'Глава III · Сделка с вечностью',
    caption: 'ЦЕНА СПАСЕНИЯ',
    text: 'Чтобы остановить Разлом, маги крови создали Кристалл Разлома. Для ритуала они отдали всё: силу, имена и собственные жизни. Красиво, трагично, совершенно непрактично — никто даже не оставил инструкции по эксплуатации. Кристалл запечатал рану, но не выдержал напряжения и раскололся на три осколка. Три древних дракона приняли их в себя и стали живыми печатями. С тех пор их сердца удерживают границу между миром и тем, что ждёт за ней. Если тебе кажется, что это слишком большая ответственность для одного сердца, представь, каково трём драконам.'
  },
  {
    chapter: 'Глава IV · Победа, которая не очень похожа на победу',
    caption: 'МИР ПОСЛЕ КАТАСТРОФЫ',
    text: 'Разлом отступил, но прежний мир не вернулся. Империи исчезли, столицы превратились в каменные скелеты, а пять земель разделили руины древней цивилизации. Люди научились жить среди обломков и называть это миром. Историю переписывали столько раз, что теперь даже учёные спорят, кто именно проиграл. Драконы замолчали. Их имена стали легендами, легенды — сказками, а сказки — скучными уроками, на которых дети засыпают быстрее, чем от заклинания усыпления. Но печати слабели. И кое-кто в темноте уже заметил это.'
  },
  {
    chapter: 'Глава V · Рассказчик замечает тебя',
    caption: 'ЭЙ. ДА, ТЫ. ЗА ЭКРАНОМ.',
    text: 'Стоп. Прежде чем продолжим, давай кое-что проясним. Ты ведь понимаешь, что я вижу тебя? Ну, не буквально. У меня нет доступа к твоей комнате, камере или списку покупок — и, поверь, некоторым тайнам лучше оставаться тайнами. Но я знаю, что ты смотришь на этот экран. Обычно герои не замечают рассказчика. Обычно рассказчик не замечает игрока. У нас, как видишь, уже с самого начала проблемы с правилами. Можешь нажать «Пропустить», если тебе не терпится броситься спасать мир. Я не осуждаю. Ладно, немного осуждаю. Мы тут веками ждали избранного, а он торопится промотать вступление.'
  },
  {
    chapter: 'Глава VI · Кандидатура без собеседования',
    caption: 'ДЕРЕВНЯ АВРОРА',
    text: 'На краю одной из пяти земель стоит деревня Аврора. Здесь знают цену тёплому очагу, крепкой двери и человеку, который умеет держать меч правильным концом. Старейшина Эдвин обнаружил в Глухой чаще след древней печати. Ночью над лесом вспыхнул свет, а утром пропали несколько путников. Эдвин ищет героя. Сильного, смелого, желательно с минимальным количеством вредных привычек. И тут появляешься ты. Без резюме, без рекомендаций, без единого подтверждённого подвига. Собеседование отменено: кадровый отдел погиб ещё в эпоху драконов. Поздравляю, должность спасителя мира твоя. Зарплата — опыт. Медицинская страховка — сомнительная.'
  },
  {
    chapter: 'Глава VII · Маленькая просьба перед концом света',
    caption: 'ТВОЯ ИСТОРИЯ НАЧИНАЕТСЯ',
    text: 'Тебе предстоит пройти пять земель, найти следы трёх драконов, собрать правду по осколкам и узнать, кто или что скрывается за Разломом. Ты встретишь тех, кто поможет, и тех, кто улыбнётся тебе перед тем, как попытаться убить. Не доверяй каждому шёпоту. Не верь каждой легенде. И особенно не верь человеку, который говорит: «Это последний босс». Обычно после этих слов появляется ещё три фазы. А теперь самое важное: я не могу пройти этот путь вместо тебя. Я могу подсказывать, язвить и иногда делать вид, что всё было частью плана. Но выбор — твой. Так что выпрями спину, проверь снаряжение и не нажимай все кнопки подряд. Хотя… ладно, нажимай. Мне давно хотелось посмотреть, что будет. Добро пожаловать в историю. Постарайся оставить после себя что-нибудь, кроме счёта за ремонт.'
  }
];

let prologueSceneIndex = 0;
let prologueAnimationFrame = 0;
let prologueVoiceCheck = 0;

function drawPrologueIllustration(canvas, sceneIndex, tick = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const ink = '#171717';
  const mid = '#777';
  const pale = '#dedede';
  const light = '#f4f4f4';
  ctx.fillStyle = pale;
  ctx.fillRect(0, 0, 320, 180);
  ctx.fillStyle = '#bcbcbc';
  ctx.fillRect(0, 0, 320, 96);
  // Engraved cloud bands and distant mountains.
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i % 2 ? '#aaa' : '#c8c8c8';
    ctx.fillRect((i * 53 + 17) % 320, 18 + (i % 3) * 13, 42, 3);
  }
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.moveTo(0, 116); ctx.lineTo(48, 67); ctx.lineTo(86, 105);
  ctx.lineTo(137, 51); ctx.lineTo(190, 111); ctx.lineTo(244, 63);
  ctx.lineTo(320, 119); ctx.lineTo(320, 180); ctx.lineTo(0, 180); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ink;
  ctx.fillRect(0, 143, 320, 37);
  // Scene-specific silhouettes, built from crisp flat pixel blocks.
  if (sceneIndex === 0) {
    ctx.fillStyle = light; ctx.fillRect(238, 20, 35, 35);
    ctx.fillStyle = ink;
    for (let d = 0; d < 3; d++) {
      const x = 48 + d * 104;
      ctx.fillRect(x, 66 + d * 4, 44, 8);
      ctx.fillRect(x + 13, 54 + d * 4, 20, 12);
      ctx.fillRect(x + 19, 43 + d * 4, 8, 12);
      ctx.fillRect(x - 13, 60 + d * 4, 18, 5);
      ctx.fillRect(x + 38, 56 + d * 4, 18, 5);
      ctx.fillRect(x + 21, 74 + d * 4, 5, 20);
      ctx.fillRect(x + 8, 90 + d * 4, 30, 5);
    }
    ctx.fillStyle = '#555'; ctx.fillRect(0, 128, 320, 8);
    ctx.fillStyle = ink; ctx.fillRect(22, 119, 18, 24); ctx.fillRect(280, 112, 18, 31);
  } else if (sceneIndex === 1) {
    ctx.fillStyle = light; ctx.fillRect(132, 22, 56, 56);
    ctx.fillStyle = ink; ctx.fillRect(151, 22, 18, 56);
    ctx.fillRect(132, 41, 56, 18);
    ctx.fillStyle = '#555'; ctx.fillRect(155, 78, 10, 74);
    ctx.fillStyle = ink;
    for (let i = 0; i < 6; i++) ctx.fillRect(30 + i * 48, 118 + (i % 2) * 8, 3, 38);
    ctx.fillRect(0, 156, 320, 5);
    ctx.fillStyle = light; ctx.fillRect(145, 35, 8, 8); ctx.fillRect(169, 55, 8, 8);
  } else if (sceneIndex === 2) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 8; i++) {
      const x = i * 43;
      ctx.fillRect(x, 103 - (i % 3) * 9, 26, 54);
      ctx.fillRect(x - 4, 97 - (i % 3) * 9, 34, 8);
      ctx.fillRect(x + 7, 83 - (i % 3) * 9, 4, 14);
      ctx.fillStyle = light; ctx.fillRect(x + 7, 118 - (i % 3) * 9, 4, 7); ctx.fillStyle = ink;
    }
    ctx.fillStyle = '#eee'; ctx.fillRect(148, 18, 24, 24);
    ctx.fillStyle = ink; ctx.fillRect(158, 18, 5, 24);
    for (let i = 0; i < 18; i++) ctx.fillRect((i * 37 + 13) % 320, 90 + (i * 19) % 74, 2, 2);
  } else if (sceneIndex === 3) {
    ctx.fillStyle = '#eee'; ctx.fillRect(20, 28, 78, 52);
    ctx.fillStyle = ink; ctx.fillRect(20, 28, 78, 5); ctx.fillRect(20, 75, 78, 5);
    ctx.fillRect(20, 28, 5, 52); ctx.fillRect(93, 28, 5, 52);
    ctx.fillStyle = mid; ctx.fillRect(34, 42, 50, 3);
    ctx.fillStyle = ink; ctx.fillRect(152, 104, 16, 38); ctx.fillRect(145, 98, 30, 9);
    ctx.fillRect(147, 139, 7, 18); ctx.fillRect(165, 139, 7, 18);
    ctx.fillStyle = light; ctx.fillRect(157, 110, 5, 5);
    ctx.fillStyle = ink; ctx.fillRect(230, 116, 52, 4); ctx.fillRect(244, 104, 24, 12);
    ctx.fillRect(239, 120, 7, 25); ctx.fillRect(267, 120, 7, 25);
  } else {
    ctx.fillStyle = ink;
    ctx.fillRect(0, 133, 320, 7);
    ctx.fillRect(40, 103, 7, 39); ctx.fillRect(32, 97, 24, 8);
    ctx.fillRect(273, 96, 8, 46); ctx.fillRect(265, 90, 24, 8);
    ctx.fillStyle = '#eee'; ctx.fillRect(143, 23, 34, 34);
    ctx.fillStyle = ink; ctx.fillRect(151, 31, 18, 18);
    ctx.fillStyle = '#555'; ctx.fillRect(157, 57, 6, 31);
    ctx.fillStyle = ink; ctx.fillRect(143, 84, 34, 6); ctx.fillRect(136, 91, 48, 7);
    ctx.fillRect(148, 98, 9, 37); ctx.fillRect(164, 98, 9, 37);
    ctx.fillRect(137, 105, 10, 6); ctx.fillRect(174, 105, 10, 6);
    ctx.fillStyle = '#eee'; ctx.fillRect(145, 38, 5, 5); ctx.fillRect(170, 38, 5, 5);
    ctx.fillStyle = mid; ctx.fillRect(20, 154, 280, 3);
  }
  // Moving ash / ink flecks add restrained life without blur or gradients.
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 24; i++) {
    const x = (i * 47 + Math.floor(tick * (0.35 + (i % 3) * 0.12))) % 320;
    const y = (i * 29 + Math.floor(tick * (0.18 + (i % 4) * 0.05))) % 175;
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, 1);
  }
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, 320, 2);
  ctx.fillRect(0, 178, 320, 2);
}

function renderPrologueScene() {
  const scene = PROLOGUE_SCENES[prologueSceneIndex];
  if (!scene) return;
  const screen = document.getElementById('screen-prologue');
  const canvas = document.getElementById('prologue-art');
  const chapter = document.getElementById('prologue-chapter');
  const caption = document.getElementById('prologue-art-caption');
  const counter = document.getElementById('prologue-frame-counter');
  const narration = document.getElementById('prologue-narration');
  const previous = document.getElementById('prologue-prev-btn');
  const next = document.getElementById('prologue-next-btn');
  const progress = document.getElementById('prologue-progress-fill');
  if (!screen || !canvas || !narration) return;
  chapter.textContent = scene.chapter;
  caption.textContent = scene.caption;
  counter.textContent = String(prologueSceneIndex + 1).padStart(2, '0') + ' / ' + String(PROLOGUE_SCENES.length).padStart(2, '0');
  narration.textContent = scene.text;
  previous.disabled = prologueSceneIndex === 0;
  next.textContent = prologueSceneIndex === PROLOGUE_SCENES.length - 1 ? 'Начать путь ⚔' : 'Далее →';
  progress.style.width = ((prologueSceneIndex + 1) / PROLOGUE_SCENES.length * 100) + '%';
  drawPrologueIllustration(canvas, prologueSceneIndex);
}

function stopPrologueAnimation() {
  if (prologueAnimationFrame) cancelAnimationFrame(prologueAnimationFrame);
  prologueAnimationFrame = 0;
}

function animatePrologue() {
  stopPrologueAnimation();
  const screen = document.getElementById('screen-prologue');
  const canvas = document.getElementById('prologue-art');
  if (!screen || !canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  let tick = 0;
  const frame = () => {
    if (!screen.classList.contains('active')) {
      stopPrologueAnimation();
      return;
    }
    drawPrologueIllustration(canvas, prologueSceneIndex, tick++);
    prologueAnimationFrame = requestAnimationFrame(frame);
  };
  prologueAnimationFrame = requestAnimationFrame(frame);
}

function stopPrologueVoice() {
  stopVoice();
  if (prologueVoiceCheck) window.clearInterval(prologueVoiceCheck);
  prologueVoiceCheck = 0;
  const button = document.getElementById('prologue-voice-btn');
  if (button) button.textContent = '🔊 Озвучить';
}

function playPrologueVoice() {
  const button = document.getElementById('prologue-voice-btn');
  if (!button) return;
  if (!isVoiceSupported()) {
    button.textContent = '🔇 Голос недоступен';
    return;
  }
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    stopPrologueVoice();
    return;
  }
  const text = PROLOGUE_SCENES[prologueSceneIndex]?.text || '';
  const ok = speakVoice(text, { rate: 0.94, pitch: 1.04, volume: 1 });
  if (!ok) {
    button.textContent = '🔇 Голос недоступен';
    return;
  }
  button.textContent = '⏹ Остановить';
  prologueVoiceCheck = window.setInterval(() => {
    if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) stopPrologueVoice();
  }, 350);
}

function openPrologue() {
  stopPrologueVoice();
  prologueSceneIndex = 0;
  showScreen('screen-prologue');
  setupPrologueVoice();
  renderPrologueScene();
  animatePrologue();
}

function setupPrologueVoice() {
  const screen = document.getElementById('screen-prologue');
  if (!screen || screen.dataset.cinematicReady === '1') return;
  screen.dataset.cinematicReady = '1';
  document.getElementById('prologue-voice-btn')?.addEventListener('click', playPrologueVoice);
  document.getElementById('prologue-prev-btn')?.addEventListener('click', () => {
    stopPrologueVoice();
    prologueSceneIndex = Math.max(0, prologueSceneIndex - 1);
    renderPrologueScene();
  });
  document.getElementById('prologue-next-btn')?.addEventListener('click', () => {
    stopPrologueVoice();
    if (prologueSceneIndex >= PROLOGUE_SCENES.length - 1) {
      skipPrologue();
      return;
    }
    prologueSceneIndex++;
    renderPrologueScene();
  });
  document.getElementById('prologue-skip-btn')?.addEventListener('click', stopPrologueVoice);
  renderPrologueScene();
  animatePrologue();
}

window.GameAPI = {
  getRuntimeDiagnostics: () => runtimeDiagnostics.map(entry => ({ ...entry })),
  clearRuntimeDiagnostics: () => { runtimeDiagnostics.length = 0; },
  updateMainMenu,
  startNewGame,
  openSettings, switchSettingsTab, handleSettingsTabKey, applySettings, backFromSettings,
  resetAllSettings, deleteAllSaves,
  openAchievementsMenu, openHelp,
  saveAndMenu,
  loadSlot, newGameSlot, deleteSlot, renderSlots,
  selectClass, reviewClassSelection, cancelClassReview, confirmClassSelection,
  switchTab, useItemOutside,
  equipByIndex: equipItemByIndexUI, unequip: unequipItemUI,
  sellByIndex: sellItemByIndexUI,
  sellJunk: sellJunkUI,
  openShop, buy: buyItemUI, setShopPreset, buybackItem: buybackItemUI,
  openWorldPortalMenu,
  enterOverworld: () => enterOverworld(state.game?.location || 'village'),
  resumeOverworld,
  exitOverworld,
  owAttack, owCast, owUseItem, owBlock, owUseAbility, owFlee,
  owOpenSpells, owOpenItems, owOpenAbilities, owCloseSub,
  owPauseResume, owPauseSaveVillage, owPauseExit,
  showInvTooltip, showEqTooltip, hideTooltip,
  spendStat,
  setInvFilter, setInvSort,
  invSlotClick,
  claimPendingLoot: claimPendingLootUI,
  openSaleUI,
  toggleSaleItem,
  selectSaleTiers: selectSaleTiersUI,
  selectSaleFilter: selectSaleFilterUI,
  confirmSale: confirmSaleUI,
  cancelSale: cancelSaleUI,
  respawnInVillage, deathToMenu,
  openDailyChest,
  openBlacksmith, openHealer, openAlchemist, backToVillage,
  openMerchant, openElder, openWell,
  closeNpcAndResume: closeNpcAndResumeUI,
  takeElderBlessing: takeElderBlessingUI,
  acceptElderQuest: acceptElderQuestUI,
  turnInElderQuest: turnInElderQuestUI,
  useWell: useWellUI,
  payBard: payBardUI,
  petCat: petCatUI,
  claimQuest: claimQuestUI,
  interactNpc,
  upgradeEquipment: upgradeEquipmentUI,
  healAtHealer: healAtHealerUI,
  craftRecipe: craftRecipeUI,
  reforgeItem: reforgeItemUI,
  showShopTooltip,
  equipBest: equipBestUI,
  socketRune: socketRuneUI,
  allocatePassive: allocatePassiveUI,
  resetPassives: resetPassivesUI,
  passiveTreePointerDown, passiveTreePointerMove, passiveTreePointerUp,
  passiveTreeZoom, passiveTreeResetView, passiveTreeKeyDown,
  startNGPlus,
  enterRift,
  openRiftMap,
  enterTower: openTowerMenu,
  chooseRiftEnding,
  showScreen,
  skipPrologue,
  exportSave,
  importSave,
  stopVoice,
  resetPrologue: () => {
    if (!removeLocalStorage('magic-rpg-prologue-seen')) {
      toast('Не удалось сбросить пролог: браузер заблокировал хранилище.');
      return;
    }
    location.reload();
  },
  voiceInfo: () => {
    if (!window.speechSynthesis) return 'Web Speech API не поддерживается';
    const voices = window.speechSynthesis.getVoices();
    console.table(voices.map(v => ({ name: v.name, lang: v.lang, default: v.default })));
    return { count: voices.length, speaking: window.speechSynthesis.speaking };
  },
};

migrateLegacySave();
loadSettings();
applyFontScale();

const prologueSeen = readLocalStorage('magic-rpg-prologue-seen');
const hasAnySave = [1, 2, 3].some(slot => !!readLocalStorage(`magic-rpg-save-${slot}`));
const prologueEl = document.getElementById('screen-prologue');

const showPrologue = ALWAYS_SHOW_PROLOGUE || (!prologueSeen && !hasAnySave);

if (showPrologue && prologueEl) {
  showScreen('screen-prologue');
  setupPrologueVoice();
} else {
  showScreen('screen-main');
  updateMainMenu();
}

window.addEventListener('beforeunload', persistBeforeLeaving);