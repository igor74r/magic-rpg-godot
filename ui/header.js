import { state } from '../systems/state.js';
import { CLASSES } from '../data/classes.js';
import { LOCATIONS } from '../data/locations.js';
import { countStoryShards } from '../systems/campaign.js';
import { EFFECTS } from '../systems/status.js';
import { getEffStats, getTotalKills } from '../systems/stats.js';
import { saveGame } from '../systems/save.js';
import { toast, escapeHtml } from './screens.js';
import { renderInventory } from './inventory.js';
import { renderSpells } from './spells.js';
import {
  renderQuests,
  renderAchievements,
  renderStatistics,
  renderBestiary
} from './quests.js';
import { renderPassives } from './passives.js';
import { renderChronicles } from './chronicles.js';
import { renderHeroOverview, renderDashboardContext } from './dashboard.js';
import { renderWorldOverview } from './world.js';
import { setPaused } from './overworld/render.js';

let overhaulCssLoaded = false;

function ensureOverhaulCss() {
  if (
    overhaulCssLoaded ||
    document.getElementById('rpg-overhaul-css')
  ) {
    return;
  }

  const link = document.createElement('link');

  link.id = 'rpg-overhaul-css';
  link.rel = 'stylesheet';
  link.href = 'css/rpg-overhaul.css';

  document.head.appendChild(link);

  overhaulCssLoaded = true;
}

function syncDashboardTabSelection(tab) {
  let activeTab = null;
  document.querySelectorAll?.('.dashboard-tablist .tab[role="tab"]')?.forEach(element => {
    const active = element.dataset.tab === tab;
    element.classList.toggle('active', active);
    element.setAttribute('aria-selected', String(active));
    element.tabIndex = active ? 0 : -1;
    if (active) activeTab = element;
  });
  if (activeTab) {
    document.getElementById('tab-content')?.setAttribute('aria-labelledby', activeTab.id);
  }
}

export function renderGame() {
  ensureOverhaulCss();

  if (!state.game) return;

  syncDashboardTabSelection(state.currentTab);
  renderHeader();
  syncMapFocusedLayout(state.currentTab);
  renderLocation();
  renderDashboardContext();
  // The old tab panel sits before the live overworld in the central column.
  // Never render a navigation page there during gameplay: it pushes the scene
  // below the fold and makes movement appear lost. Tabs render in modal only.
  const legacyTabPanel = document.getElementById('tab-content');
  if (legacyTabPanel) legacyTabPanel.innerHTML = '';
}

export function renderHeader() {
  const p = state.game.player;

  const points = p.statPoints || 0;
  const passivePoints = p.passivePoints || 0;

  const stats = getEffStats();

  const statBlock = points > 0
    ? `
      <div class="stat-points-panel">
        <span class="stat-points-label">
          🎯 Очков характеристик: ${points}
        </span>

        <div class="stat-buttons">
          <button type="button" data-spend-stat="str">+1 СИЛ</button>
          <button type="button" data-spend-stat="int">+1 ИНТ</button>
          <button type="button" data-spend-stat="wis">+1 МДР</button>
          <button type="button" data-spend-stat="con">+1 ТЕЛ</button>
          <button type="button" data-spend-stat="dex">+1 ЛОВ</button>
        </div>
      </div>
    `
    : '';

  const effectsHtml = renderActiveEffectsInline(p.effects);
  const endgameHtml = renderEndgameHint(p);

  const mpLabel = p.class === 'warrior'
    ? '🔥 Ярость'
    : p.class === 'archer'
      ? '🎯 Концентрация'
      : '🔵 Мана';

  const mpClass = p.class === 'warrior'
    ? 'bar-rage'
    : p.class === 'archer'
      ? 'bar-focus'
      : 'bar-mp';

  const dodge = Math.round(stats.dodgeChance * 100);
  const block = Math.round(stats.blockChance * 100);
  const crit = Math.round(stats.critChance * 100);

  const playerClass = CLASSES[p.class] || CLASSES.mage;

  document.getElementById('game-header').innerHTML = `
    <div class="rpg-header-main">
      <div class="rpg-identity">
        <span class="rpg-player-name">
          ${playerClass.emoji} ${escapeHtml(p.name)}
        </span>

        <span class="rpg-player-class">
          ${playerClass.name}, Ур. ${p.level}
        </span>
      </div>

      <div class="rpg-gold">
        💰 ${p.gold}
      </div>
    </div>

    <div class="hud-overview-columns">
      <section class="hud-overview-vitals" aria-label="Ресурсы героя">
    <div class="hud-panel-kicker"><span aria-hidden="true">✦</span> РЕСУРСЫ И ПРОГРЕСС</div>
    <div class="hud-resource hud-health" role="group" aria-label="Здоровье">
      <div class="hud-resource-top"><span>❤ Здоровье</span><b>${p.hp} <i>/ ${p.maxHp}</i></b></div>
      <div class="bar hud-track" role="progressbar" aria-label="Здоровье героя" aria-valuemin="0" aria-valuemax="${p.maxHp}" aria-valuenow="${p.hp}">
        <div class="bar-fill bar-hp" style="width:${p.maxHp > 0 ? Math.max(0, Math.min(100, p.hp / p.maxHp * 100)) : 0}%" aria-hidden="true"></div>
      </div>
    </div>

    <div class="hud-resource hud-energy" role="group" aria-label="${mpLabel}">
      <div class="hud-resource-top"><span>${mpLabel}</span><b>${p.mp} <i>/ ${p.maxMp}</i></b></div>
      <div class="bar hud-track" role="progressbar" aria-label="${mpLabel}" aria-valuemin="0" aria-valuemax="${p.maxMp}" aria-valuenow="${p.mp}">
        <div class="bar-fill ${mpClass}" style="width:${p.maxMp > 0 ? Math.max(0, Math.min(100, p.mp / p.maxMp * 100)) : 0}%" aria-hidden="true"></div>
      </div>
    </div>

    <div class="hud-resource hud-experience" role="group" aria-label="Опыт">
      <div class="hud-resource-top"><span>✦ Опыт</span><b>${p.exp} <i>/ ${p.expNext}</i></b></div>
      <div class="bar hud-track" role="progressbar" aria-label="Опыт до следующего уровня" aria-valuemin="0" aria-valuemax="${p.expNext}" aria-valuenow="${p.exp}">
        <div class="bar-fill bar-exp" style="width:${p.expNext > 0 ? Math.max(0, Math.min(100, p.exp / p.expNext * 100)) : 0}%" aria-hidden="true"></div>
      </div>
      <div class="hud-exp-caption">До уровня осталось: ${Math.max(0, p.expNext - p.exp)} EXP</div>
    </div>
      </section>
      <section class="hud-overview-details" aria-label="Боевые характеристики">
    <button type="button" class="hud-details-toggle" data-hud-toggle aria-expanded="false" aria-controls="game-header-combat-details">
      <span><span aria-hidden="true">⚔️</span> ХАРАКТЕРИСТИКИ И БОЙ</span><span class="hud-toggle-chevron" aria-hidden="true">⌄</span>
    </button>
    <div id="game-header-combat-details" class="header-combat-stats hud-details-panel" data-hud-details hidden>
      <div class="hud-stat-group-label">ОСНОВНЫЕ</div>
      <span><i aria-hidden="true">💪</i> СИЛ <b>${p.str}</b></span>
      <span><i aria-hidden="true">🧠</i> ИНТ <b>${p.int}</b></span>
      <span><i aria-hidden="true">✨</i> МДР <b>${p.wis}</b></span>
      <span><i aria-hidden="true">❤️</i> ТЕЛ <b>${p.con}</b></span>
      <span><i aria-hidden="true">🏹</i> ЛОВ <b>${p.dex || 0}</b></span>
      <div class="hud-stat-group-label">БОЕВЫЕ</div>
      <span><i aria-hidden="true">💨</i> Уклон <b>${dodge}%</b></span>
      <span><i aria-hidden="true">🛡️</i> Блок <b>${block}%</b></span>
      <span><i aria-hidden="true">🎯</i> Крит <b>${crit}%</b></span>
      <span><i aria-hidden="true">⚔️</i> Убийств <b>${getTotalKills(state.game.player.stats?.kills)}</b></span>

      ${
        passivePoints > 0
          ? `<b class="header-passive-points">✦ ${passivePoints} очк. древа</b>`
          : ''
      }
    </div>
      </section>
    </div>

    ${effectsHtml}

    <div class="rpg-endgame-area">
      ${endgameHtml}
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">
      <button type="button" data-header-action="rift" style="padding:6px 12px;font-size:12px">🌀 Разлом</button>
    </div>

    ${statBlock}
    </div>
  `;

  const header = document.getElementById('game-header');
  const detailsToggle = header.querySelector('[data-hud-toggle]');
  const detailsPanel = header.querySelector('[data-hud-details]');
  detailsToggle?.addEventListener('click', () => {
    const expanded = detailsToggle.getAttribute('aria-expanded') === 'true';
    detailsToggle.setAttribute('aria-expanded', String(!expanded));
    if (detailsPanel) detailsPanel.hidden = expanded;
    detailsToggle.querySelector('span:last-child').textContent = expanded ? '⌄' : '⌃';
  });
  header.querySelectorAll('[data-spend-stat]').forEach(button => {
    button.addEventListener('click', () => spendStat(button.dataset.spendStat));
  });
  header.querySelector('[data-header-action="rift"]')
    ?.addEventListener('click', () => window.GameAPI?.enterRift?.());
}

function renderEndgameHint(p) {
  const shardCount = countStoryShards(state.game.storyShards);
  const riftBest = p.riftBest || 0;
  const towerBest = p.towerBest || 0;
  const riftOpen = state.game.storyDragons?.['blood-crown'] === true && state.game.riftEnding !== 'closed';
  const riftSealedForever = state.game.riftEnding === 'closed';
  return `
    <div class="endgame-hint ${riftOpen ? 'rift' : ''}">
      ${riftSealedForever ? '🔒 Разлом запечатан навсегда' : riftOpen ? '🌀 Разлом открыт' : '🔒 Разлом закрыт — пока живы три дракона'}
      · Осколки: <b>${shardCount}/3</b>
      ${riftBest > 0 ? `· Рекорд Разлома: ${riftBest}` : ''}
      ${towerBest > 0 ? `· Башня: ${towerBest}/40` : ''}
    </div>
  `;
}

function renderActiveEffectsInline(effects) {
  if (!Array.isArray(effects) || !effects.length) {
    return '';
  }

  const badges = effects.map(effect => {
    const data = EFFECTS[effect.id];

    if (!data) return '';

    return `
      <span
        class="fx-badge"
        style="border-color:${escapeHtml(data.color)};color:${escapeHtml(data.color)};"
        title="${escapeHtml(data.name)}${data.desc ? ': ' + escapeHtml(data.desc) : ''} (${escapeHtml(effect.duration)} ход.)"
      >
        ${data.icon}${effect.duration}
      </span>
    `;
  }).join('');

  return `
    <div class="effects-inline">
      <span class="effects-inline-label">Эффекты:</span>
      ${badges}
    </div>
  `;
}

const STAT_NAMES = {
  str: 'Силе',
  int: 'Интеллекту',
  wis: 'Мудрости',
  con: 'Телосложению',
  dex: 'Ловкости'
};

export function spendStat(stat) {
  const p = state.game?.player;

  if (
    !p ||
    !Number.isSafeInteger(p.statPoints) ||
    p.statPoints <= 0 ||
    !Object.prototype.hasOwnProperty.call(STAT_NAMES, stat) ||
    !Number.isSafeInteger(p[stat]) ||
    p[stat] >= Number.MAX_SAFE_INTEGER
  ) {
    return false;
  }

  if (stat === 'con' && (!Number.isSafeInteger(p.maxHp) || p.maxHp > Number.MAX_SAFE_INTEGER - 10)) return false;
  if (stat === 'int' && (!Number.isSafeInteger(p.maxMp) || p.maxMp > Number.MAX_SAFE_INTEGER - 5)) return false;

  const previous = {
    value: p[stat],
    statPoints: p.statPoints,
    maxHp: p.maxHp,
    maxMp: p.maxMp
  };

  p[stat] += 1;
  p.statPoints -= 1;

  if (stat === 'con') p.maxHp += 10;
  if (stat === 'int') p.maxMp += 5;

  if (!saveGame()) {
    p[stat] = previous.value;
    p.statPoints = previous.statPoints;
    p.maxHp = previous.maxHp;
    p.maxMp = previous.maxMp;
    renderHeader();
    toast('Не удалось сохранить характеристику. Изменения отменены.');
    return false;
  }

  renderHeader();
  toast(`+1 к ${STAT_NAMES[stat]}`);
  return true;
}

function renderLocation() {
  const element = document.getElementById('location-info');

  if (element) {
    element.innerHTML = '';
  }
}

function syncMapFocusedLayout(tab) {
  document.getElementById('screen-game')?.classList.toggle('map-focused', tab === 'locations');
}

let dashboardModal = null;
let dashboardModalResumeWorld = false;
let dashboardModalTrigger = null;
let dashboardPreviousGameInert = false;
let dashboardPreviousPaused = false;
let dashboardPreviousActive = false;

function getDashboardTabTitle(tab) {
  const element = document.querySelector(`.dashboard-tablist .tab[data-tab="${tab}"] .tab-text`);
  return element?.textContent?.trim() || ({
    inventory: 'Экипировка', spells: 'Магия и навыки', quests: 'Журнал заданий',
    hero: 'Мой герой', talents: 'Древо талантов', bestiary: 'Бестиарий',
    achievements: 'Достижения', statistics: 'Статистика', chronicles: 'Хроники мира', world: 'Мир и фракции'
  }[tab] || 'Раздел игры');
}

function closeDashboardModal({ resumeWorld = true, restoreFocus = true } = {}) {
  // Recover even if an earlier UI transition detached the JS reference but
  // left the modal DOM behind. Such an orphan can cover the game and keep
  // the entire dashboard inert, making every control appear frozen.
  const modal = dashboardModal || document.getElementById('dashboard-tab-modal');
  const hadModal = !!modal;
  dashboardModal = null;
  document.querySelectorAll('#dashboard-tab-modal').forEach(element => element.remove());
  document.body.classList.remove('dashboard-modal-open');

  const gameScreen = document.getElementById('screen-game');
  if (gameScreen) gameScreen.inert = false;
  dashboardPreviousGameInert = false;
  if (!hadModal) {
    dashboardModalResumeWorld = false;
    dashboardPreviousPaused = false;
    dashboardPreviousActive = false;
    return;
  }

  document.querySelectorAll('.dashboard-tablist [role="tab"]').forEach(tab => {
    tab.setAttribute('aria-controls', 'tab-content');
    tab.removeAttribute('aria-expanded');
  });

  // The modal owns section rendering. Do not repaint the legacy #tab-content
  // on close; the persistent game shell remains mounted beneath the overlay.
  // Resume exactly the scene that was running before the overlay opened.
  // Do not rely on a second render or sidebar click to unfreeze the game.
  if (state.overworld) {
    if (resumeWorld && dashboardModalResumeWorld) {
      window.GameAPI?.resumeOverworld?.();
    } else {
      state.overworld.active = dashboardPreviousActive;
      state.overworld.paused = dashboardPreviousPaused;
      setPaused(dashboardPreviousPaused);
    }
  }
  dashboardModalResumeWorld = false;
  dashboardPreviousPaused = false;
  dashboardPreviousActive = false;

  const trigger = dashboardModalTrigger;
  dashboardModalTrigger = null;
  if (restoreFocus) {
    const activeTrigger = trigger?.isConnected ? trigger : document.getElementById(`game-tab-${state.currentTab}`);
    activeTrigger?.focus({ preventScroll: true });
  }
}

function openDashboardModal(tab) {
  // A stale tab overlay must never survive into another dashboard action.
  // Remove orphaned copies and release inert state before mounting a fresh one.
  if (!dashboardModal) {
    document.querySelectorAll('#dashboard-tab-modal').forEach(element => element.remove());
    document.body.classList.remove('dashboard-modal-open');
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) gameScreen.inert = false;
  }

  // Headless boot tests and lightweight embedded shells have no dashboard UI;
  // preserve the legacy render target there while the real game uses overlays.
  if (!document.getElementById('screen-game') || !document.querySelector('.dashboard-tablist')) {
    if (dashboardModal) {
      dashboardModal.remove();
      dashboardModal = null;
    }
    renderTab(tab);
    return;
  }
  if (tab === 'locations') {
    window.GameAPI?.openWorldPortalMenu?.();
    return;
  }
  const preserveWorldResume = dashboardModal
    ? dashboardModalResumeWorld
    : !!(state.overworld?.active && !state.overworld?.paused);
  // The legacy central panel is never used in the live game. Do not erase
  // its DOM here; only mount the overlay and leave the persistent scene intact.
  if (dashboardModal) closeDashboardModal({ resumeWorld: false, restoreFocus: false });

  dashboardModalTrigger = document.getElementById(`game-tab-${tab}`);
  dashboardModalResumeWorld = preserveWorldResume;
  dashboardPreviousPaused = !!state.overworld?.paused;
  dashboardPreviousActive = !!state.overworld?.active;
  if (state.overworld) {
    // Pause the update loop without deactivating the overworld. Setting
    // active=false can strand the loop in a state that sidebar actions cannot resume.
    state.overworld.active = true;
    state.overworld.paused = true;
    setPaused(true);
    document.getElementById('screen-game')?.classList.add('overworld-active');
  }

  const overlay = document.createElement('div');
  overlay.id = 'dashboard-tab-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'dashboard-tab-modal-title');
  overlay.setAttribute('tabindex', '-1');
  overlay.setAttribute('data-dashboard-tab', tab);
  const gameScreen = document.getElementById('screen-game');
  dashboardPreviousGameInert = !!gameScreen?.inert;
  if (gameScreen) gameScreen.inert = true;
  overlay.innerHTML = `
    <section class="dashboard-tab-dialog">
      <header class="dashboard-tab-dialog-header">
        <h2 class="dashboard-tab-dialog-title" id="dashboard-tab-modal-title"></h2>
        <button type="button" class="dashboard-tab-dialog-close" data-dashboard-modal-close aria-label="Закрыть раздел (Escape)">×</button>
      </header>
      <div class="dashboard-tab-dialog-body" id="dashboard-tab-modal-body"></div>
    </section>`;
  document.body.appendChild(overlay);
  dashboardModal = overlay;
  document.body.classList.add('dashboard-modal-open');
  overlay.querySelector('#dashboard-tab-modal-title').textContent = getDashboardTabTitle(tab);
  if (dashboardModalTrigger) {
    dashboardModalTrigger.setAttribute('aria-controls', 'dashboard-tab-modal-body');
    dashboardModalTrigger.setAttribute('aria-expanded', 'true');
  }
  overlay.querySelector('[data-dashboard-modal-close]')?.addEventListener('click', () => closeDashboardModal());
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeDashboardModal();
  });
  overlay.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0);
    if (!focusable.length) {
      event.preventDefault();
      overlay.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === overlay)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  renderTab(tab);
  overlay.querySelector('[data-dashboard-modal-close]')?.focus();
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', event => {
    const nestedModalOpen = !!document.querySelector(
      '#inventory-sale-overlay [role="dialog"], #npc-dialog-modal[style*="display: flex"], #aurora-world-portal[role="dialog"], #tower-map-overlay[role="dialog"], #rift-map-overlay[role="dialog"]'
    );
    if (event.key === 'Escape' && dashboardModal && !nestedModalOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDashboardModal();
    }
  }, true);
}

export function switchTab(tab) {
  if (tab === 'locations') {
    openDashboardModal(tab);
    return;
  }
  state.currentTab = tab;
  syncMapFocusedLayout(tab);

  syncDashboardTabSelection(tab);

  openDashboardModal(tab);
}

function renderTab(tab) {
  const element = dashboardModal?.querySelector('#dashboard-tab-modal-body')
    || document.getElementById('tab-content');
  if (!element) return;

  if (
    tab === 'spells' &&
    state.game.player.class === 'warrior'
  ) {
    element.innerHTML = `
      <div class="rpg-empty-state">
        <div>⚔️</div>
        <h3>Воин не использует заклинания</h3>
        <p>Его сила — оружие, стойка, ярость и боевые умения.</p>
      </div>
    `;

    return;
  }

  if (tab === 'inventory') {
    element.innerHTML = renderInventory();
  } else if (tab === 'spells') {
    element.innerHTML = renderSpells();
  } else if (tab === 'quests') {
    element.innerHTML = renderQuests();
  } else if (tab === 'achievements') {
    element.innerHTML = renderAchievements();
  } else if (tab === 'statistics') {
    element.innerHTML = renderStatistics();
  } else if (tab === 'talents') {
    element.innerHTML = renderPassives();
  } else if (tab === 'bestiary') {
    element.innerHTML = renderBestiary();
  } else if (tab === 'chronicles') {
    element.innerHTML = renderChronicles();
  } else if (tab === 'world') {
    element.innerHTML = renderWorldOverview();
  } else if (tab === 'hero') {
    element.innerHTML = renderHeroOverview();
  }
}