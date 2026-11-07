import { state } from '../systems/state.js';
import { showScreen, toast, escapeHtml } from './screens.js';
import {
  loadGameData, saveSettings, deleteSave, getSlotInfo, getMaxSlot, saveGame, migrateGame, validateCurrentSaveShape
} from '../systems/save.js';
import { renderClassSelection } from './character.js';
import { emit } from '../systems/events.js';
import { updateVolume, stopBGM, playBGM } from '../systems/audio.js';
import { CLASSES } from '../data/classes.js';
import { LOCATIONS } from '../data/locations.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { ENEMIES } from '../data/enemies.js';
import { enterOverworld } from '../systems/overworld.js';

let currentSettingsTab = 'sound';

export function updateMainMenu() {
  renderSlots();
}

export function startNewGame() {
  for (let slot = 1; slot <= getMaxSlot(); slot++) {
    if (!getSlotInfo(slot)) {
      newGameSlot(slot);
      return true;
    }
  }
  toast('Все три слота заняты. Удали или освободи слот, чтобы начать новое приключение.');
  return false;
}

export function renderSlots() {
  const grid = document.getElementById('slots-grid');
  if (!grid) return;
  const max = getMaxSlot();
  let html = '';

  for (let slot = 1; slot <= max; slot++) {
    const info = getSlotInfo(slot);
    if (info) {
      const cls = CLASSES[info.class] || { emoji: '❓', name: '???' };
      const loc = LOCATIONS[info.location] || { emoji: '❓', name: '???' };
      const ng = info.ngPlus > 0 ? ` · <span class="slot-ng">NG+${info.ngPlus}</span>` : '';
      html += `<div class="slot-card">
        <div class="slot-num">Слот ${slot}</div>
        <div class="slot-body">
          <div class="slot-name">${cls.emoji} ${escapeHtml(info.name)}</div>
          <div class="slot-info">${cls.name}, Ур. ${info.level}${ng}</div>
          <div class="slot-info">${loc.emoji} ${loc.name}</div>
        </div>
        <div class="slot-actions">
          <button type="button" onclick="GameAPI.loadSlot(${slot})" class="slot-play">▶️ Продолжить</button>
          <button type="button" onclick="GameAPI.deleteSlot(${slot})" class="slot-delete" title="Удалить слот" aria-label="Удалить сохранение в слоте ${slot}">🗑️</button>
        </div>
      </div>`;
    } else {
      html += `<div class="slot-card empty">
        <div class="slot-num">Слот ${slot}</div>
        <div class="slot-body">
          <div class="slot-info" style="color:#6a5a3a;font-style:italic;">Пустой слот</div>
        </div>
        <div class="slot-actions">
          <button type="button" onclick="GameAPI.newGameSlot(${slot})" class="slot-new">⚔️ Новая игра</button>
        </div>
      </div>`;
    }
  }

  grid.innerHTML = html;
}

// ============ НАСТРОЙКИ ============

export function openSettings() {
  currentSettingsTab = 'sound';
  showScreen('screen-settings');
  switchSettingsTab('sound');
}

const SETTINGS_TABS = ['sound', 'game', 'graphics', 'accessibility', 'data'];

export function switchSettingsTab(tab) {
  if (!SETTINGS_TABS.includes(tab)) return;
  currentSettingsTab = tab;
  let activeTab = null;
  document.querySelectorAll('.settings-tab[role="tab"]').forEach(element => {
    const active = element.dataset.tab === tab;
    element.classList.toggle('active', active);
    element.setAttribute('aria-selected', String(active));
    element.tabIndex = active ? 0 : -1;
    if (active) activeTab = element;
  });
  if (activeTab) document.getElementById('settings-content')?.setAttribute('aria-labelledby', activeTab.id);
  renderSettingsTab(tab);
}

export function handleSettingsTabKey(event) {
  const index = SETTINGS_TABS.indexOf(event.currentTarget?.dataset?.tab);
  if (index < 0) return;
  let next = index;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % SETTINGS_TABS.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = SETTINGS_TABS.length - 1;
  else return;
  event.preventDefault();
  const tab = SETTINGS_TABS[next];
  switchSettingsTab(tab);
  document.getElementById('settings-tab-' + tab)?.focus();
}

function renderSettingsTab(tab) {
  const content = document.getElementById('settings-content');
  if (!content) return;
  const s = state.settings;

  if (tab === 'sound') {
    content.innerHTML = `
      <div class="settings-row">
        <label for="set-music-volume">🎵 Музыка</label>
        <input type="range" id="set-music-volume" min="0" max="100" value="${s.musicVolume ?? 60}" aria-describedby="set-music-volume-val" oninput="GameAPI.applySettings()">
        <span id="set-music-volume-val">${s.musicVolume ?? 60}%</span>
      </div>
      <div class="settings-row">
        <label for="set-sfx-volume">🔊 Эффекты</label>
        <input type="range" id="set-sfx-volume" min="0" max="100" value="${s.sfxVolume ?? 80}" aria-describedby="set-sfx-volume-val" oninput="GameAPI.applySettings()">
        <span id="set-sfx-volume-val">${s.sfxVolume ?? 80}%</span>
      </div>
      <div class="settings-row">
        <label for="set-sound">🔇 Общий звук</label>
        <select id="set-sound" onchange="GameAPI.applySettings()">
          <option value="on" ${s.soundEnabled !== false ? 'selected' : ''}>Включён</option>
          <option value="off" ${s.soundEnabled === false ? 'selected' : ''}>Выключен</option>
        </select><span></span>
      </div>
      <p class="settings-note">Громкость музыки и эффектов регулируется отдельно. Общий переключатель отключает весь звук.</p>
    `;
  } else if (tab === 'game') {
    content.innerHTML = `
      <div class="settings-row">
        <label for="set-difficulty">⚔️ Сложность</label>
        <select id="set-difficulty" onchange="GameAPI.applySettings()">
          <option value="easy" ${s.difficulty === 'easy' ? 'selected' : ''}>Лёгкая</option>
          <option value="normal" ${s.difficulty === 'normal' ? 'selected' : ''}>Обычная</option>
          <option value="hard" ${s.difficulty === 'hard' ? 'selected' : ''}>Сложная</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-autosave">💾 Автосохранение</label>
        <select id="set-autosave" onchange="GameAPI.applySettings()">
          <option value="on" ${s.autoSave !== false ? 'selected' : ''}>Включено</option>
          <option value="off" ${s.autoSave === false ? 'selected' : ''}>Выключено</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-autosave-interval">⏱ Интервал сохранения</label>
        <select id="set-autosave-interval" onchange="GameAPI.applySettings()">
          <option value="15" ${(s.autoSaveInterval ?? 30) === 15 ? 'selected' : ''}>15 секунд</option>
          <option value="30" ${(s.autoSaveInterval ?? 30) === 30 ? 'selected' : ''}>30 секунд</option>
          <option value="60" ${(s.autoSaveInterval ?? 30) === 60 ? 'selected' : ''}>60 секунд</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-hotkeys">💡 Подсказки клавиш</label>
        <select id="set-hotkeys" onchange="GameAPI.applySettings()">
          <option value="on" ${s.showHotkeys !== false ? 'selected' : ''}>Показывать</option>
          <option value="off" ${s.showHotkeys === false ? 'selected' : ''}>Скрывать</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-fps">📊 Счётчик FPS</label>
        <select id="set-fps" onchange="GameAPI.applySettings()">
          <option value="off" ${s.showFps !== true ? 'selected' : ''}>Скрыт</option>
          <option value="on" ${s.showFps === true ? 'selected' : ''}>Показывать</option>
        </select><span></span>
      </div>
      <p class="settings-note">Сложность влияет на игровой баланс. Автосохранение выполняется в безопасные моменты исследования, вне боя.</p>
    `;
  } else if (tab === 'graphics') {
    content.innerHTML = `
      <div class="settings-row">
        <label for="set-graphics-quality">🎨 Качество графики</label>
        <select id="set-graphics-quality" onchange="GameAPI.applySettings()">
          <option value="low" ${s.graphicsQuality === 'low' ? 'selected' : ''}>Низкое — для слабых ПК</option>
          <option value="balanced" ${s.graphicsQuality === 'balanced' ? 'selected' : ''}>Сбалансированное</option>
          <option value="high" ${s.graphicsQuality !== 'low' && s.graphicsQuality !== 'balanced' ? 'selected' : ''}>Высокое — все эффекты</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-weather-effects">🌧️ Погодные эффекты</label>
        <select id="set-weather-effects" onchange="GameAPI.applySettings()">
          <option value="on" ${s.weatherEffects !== false ? 'selected' : ''}>Включены</option>
          <option value="off" ${s.weatherEffects === false ? 'selected' : ''}>Выключены</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-ambient-fog">🌫️ Атмосферный туман</label>
        <select id="set-ambient-fog" onchange="GameAPI.applySettings()">
          <option value="on" ${s.ambientFog !== false ? 'selected' : ''}>Включён</option>
          <option value="off" ${s.ambientFog === false ? 'selected' : ''}>Выключен</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-bloom-effects">✨ Свечение (Bloom)</label>
        <select id="set-bloom-effects" onchange="GameAPI.applySettings()">
          <option value="on" ${s.bloomEffects !== false ? 'selected' : ''}>Включено</option>
          <option value="off" ${s.bloomEffects === false ? 'selected' : ''}>Выключено</option>
        </select><span></span>
      </div>
      <p class="settings-note">Настройки сохраняются автоматически. Низкое качество отключает тяжёлые декоративные эффекты; сбалансированное сохраняет основную атмосферу с меньшей нагрузкой. Изменения не затрагивают камеру, управление и игровую механику.</p>
    `;
  } else if (tab === 'accessibility') {
    content.innerHTML = `
      <div class="settings-row settings-font-scale-row">
        <label for="set-font-scale">🔎 Размер текста и интерфейса</label>
        <input type="range" id="set-font-scale" min="85" max="130" step="5" value="${Math.round((s.fontScale ?? 1) * 100)}" aria-describedby="set-font-scale-val" oninput="GameAPI.applySettings()">
        <span id="set-font-scale-val">${Math.round((s.fontScale ?? 1) * 100)}%</span>
      </div>
      <div class="settings-row">
        <label for="set-damage-numbers">🔢 Числа урона и лечения</label>
        <select id="set-damage-numbers" onchange="GameAPI.applySettings()">
          <option value="on" ${s.damageNumbers !== false ? 'selected' : ''}>Показывать</option>
          <option value="off" ${s.damageNumbers === false ? 'selected' : ''}>Скрывать</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-screen-shake">📳 Тряска экрана</label>
        <select id="set-screen-shake" onchange="GameAPI.applySettings()">
          <option value="on" ${s.screenShake !== false ? 'selected' : ''}>Включена</option>
          <option value="off" ${s.screenShake === false ? 'selected' : ''}>Выключена</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-low-health">❤️ Эффекты низкого здоровья</label>
        <select id="set-low-health" onchange="GameAPI.applySettings()">
          <option value="on" ${s.lowHealthEffects !== false ? 'selected' : ''}>Показывать</option>
          <option value="off" ${s.lowHealthEffects === false ? 'selected' : ''}>Скрывать</option>
        </select><span></span>
      </div>
      <div class="settings-row">
        <label for="set-reduced-motion">🌿 Уменьшить анимацию</label>
        <select id="set-reduced-motion" onchange="GameAPI.applySettings()">
          <option value="off" ${s.reducedMotion !== true ? 'selected' : ''}>Обычная</option>
          <option value="on" ${s.reducedMotion === true ? 'selected' : ''}>Уменьшенная</option>
        </select><span></span>
      </div>
      <p class="settings-note">Эти параметры уменьшают визуальную нагрузку и помогают настроить эффекты под себя. Они не меняют сложность и характеристики персонажа.</p>
    `;
  } else if (tab === 'data') {
    content.innerHTML = `
      <p style="color:#a89060;margin-bottom:16px;line-height:1.7;font-size:13px;">
        <b style="color:#60ff60;">💾 Резервная копия:</b> экспортируйте сохранение перед очисткой данных браузера или переносом на другое устройство.
      </p>
      <button type="button" onclick="GameAPI.exportSave()" style="width:100%;border-color:#60ff60;background:linear-gradient(180deg,#2a5a3a,#1a3a2a);margin-bottom:10px;">💾 Экспортировать сейв (.json)</button>
      <label style="display:block;width:100%;margin-bottom:16px;">
        <input type="file" id="import-save-input" accept=".json" style="display:none;" data-import-save-input>
        <button type="button" data-import-save-trigger style="width:100%;border-color:#60a0ff;background:linear-gradient(180deg,#1a3a6a,#0a1a3a);">📂 Импортировать сейв</button>
      </label>
      <div class="divider"></div>
      <p style="color:#ffb0a0;margin-bottom:16px;line-height:1.7;font-size:13px;"><b>⚠️ Опасные действия:</b> удаление сохранений необратимо.</p>
      <button type="button" onclick="GameAPI.deleteAllSaves()" style="width:100%;border-color:#8b1a1a;background:linear-gradient(180deg,#5a1a1a,#2a0a0a);margin-bottom:10px;">🗑️ Удалить ВСЕ сохранения</button>
      <button type="button" onclick="GameAPI.resetAllSettings()" style="width:100%;">🔄 Сбросить настройки</button>
    `;
  }

  if (tab === 'data') {
    const importInput = content.querySelector('[data-import-save-input]');
    content.querySelector('[data-import-save-trigger]')?.addEventListener('click', () => importInput?.click());
    importInput?.addEventListener('change', event => importSave(event));
  }
}

export function applyFontScale() {
  if (typeof document === 'undefined' || !document.documentElement?.style?.setProperty) return;
  const scale = Math.max(0.85, Math.min(1.3, Number(state.settings.fontScale) || 1));
  document.documentElement.style.setProperty('--ui-font-scale', String(scale));
}

export function applySettings() {
  const s = state.settings;
  const value = id => document.getElementById(id)?.value;
  const music = value('set-music-volume');
  const sfx = value('set-sfx-volume');
  if (music !== undefined) {
    s.musicVolume = Math.max(0, Math.min(100, Number(music) || 0));
    const label = document.getElementById('set-music-volume-val');
    if (label) label.textContent = s.musicVolume + '%';
  }
  if (sfx !== undefined) {
    s.sfxVolume = Math.max(0, Math.min(100, Number(sfx) || 0));
    const label = document.getElementById('set-sfx-volume-val');
    if (label) label.textContent = s.sfxVolume + '%';
  }
  const fontScale = value('set-font-scale');
  if (fontScale !== undefined) {
    s.fontScale = Math.max(0.85, Math.min(1.3, Number(fontScale) / 100));
    const label = document.getElementById('set-font-scale-val');
    if (label) label.textContent = Math.round(s.fontScale * 100) + '%';
  }
  applyFontScale();
  const setBool = (id, key) => { const v = value(id); if (v !== undefined) s[key] = v === 'on'; };
  const difficulty = value('set-difficulty');
  if (difficulty && ['easy', 'normal', 'hard'].includes(difficulty)) s.difficulty = difficulty;
  setBool('set-sound', 'soundEnabled');
  setBool('set-autosave', 'autoSave');
  setBool('set-hotkeys', 'showHotkeys');
  setBool('set-fps', 'showFps');
  setBool('set-damage-numbers', 'damageNumbers');
  setBool('set-screen-shake', 'screenShake');
  setBool('set-low-health', 'lowHealthEffects');
  setBool('set-reduced-motion', 'reducedMotion');
  const quality = value('set-graphics-quality');
  if (quality && ['low', 'balanced', 'high'].includes(quality)) s.graphicsQuality = quality;
  setBool('set-weather-effects', 'weatherEffects');
  setBool('set-ambient-fog', 'ambientFog');
  setBool('set-bloom-effects', 'bloomEffects');
  const interval = Number(value('set-autosave-interval'));
  if ([15, 30, 60].includes(interval)) s.autoSaveInterval = interval;

  updateVolume();
  saveSettings();
}

export function backFromSettings() {
  applySettings();
  if (state.settings.soundEnabled === false) stopBGM();
  else if (state.game && state.overworld) playBGM('explore');
  showScreen('screen-main');
  updateMainMenu();
}

export function resetAllSettings() {
  if (!confirm('Сбросить ВСЕ настройки на стандартные?')) return;
  state.settings = {
    musicVolume: 60, sfxVolume: 80, difficulty: 'normal',
    soundEnabled: true, autoSave: true, autoSaveInterval: 30,
    showHotkeys: true, showFps: false, screenShake: true,
    damageNumbers: true, lowHealthEffects: true, reducedMotion: false, fontScale: 1,
    graphicsQuality: 'high', weatherEffects: true, ambientFog: true, bloomEffects: true,
    settingsVersion: 6
  };
  saveSettings();
  updateVolume();
  switchSettingsTab(currentSettingsTab);
  toast('Настройки сброшены');
}

// ============ ДОСТИЖЕНИЯ (в меню) ============

export function openAchievementsMenu() {
  showScreen('screen-achievements-menu');
  renderMenuAchievements();
}

function renderMenuAchievements() {
  const content = document.getElementById('menu-achievements-content');
  if (!content) return;

  if (!state.game) {
    content.innerHTML = `
      <p style="text-align:center;color:#a89060;padding:20px;font-style:italic;">
        Загрузите игру, чтобы увидеть прогресс достижений.<br>
        <small>Показаны все ${ACHIEVEMENTS.length} достижений, но статус скрыт.</small>
      </p>
      <div class="achievement-list">
        ${ACHIEVEMENTS.map(a => `
          <div class="achievement">
            <div class="achievement-icon">🔒</div>
            <div class="achievement-body">
              <div class="achievement-name">???</div>
              <div class="achievement-desc">${a.desc}</div>
              <div class="achievement-reward">🎁 ${a.reward}💰</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  const unlocked = state.game.player.achievements || [];
  const total = ACHIEVEMENTS.length;
  const got = unlocked.length;

  const items = ACHIEVEMENTS.map(a => {
    const done = unlocked.includes(a.id);
    let progressText = '';
    if (!done && a.progress && a.target !== undefined) {
      let cur = 0;
      try { cur = a.progress(state.game); } catch (e) { cur = 0; }
      cur = Math.min(cur, a.target);
      progressText = ` <span style="color:#60ff60;">(${cur}/${a.target})</span>`;
    }
    return `<div class="achievement ${done ? 'done' : ''}">
      <div class="achievement-icon">${done ? a.icon : '🔒'}</div>
      <div class="achievement-body">
        <div class="achievement-name">${done ? a.name : '???'}</div>
        <div class="achievement-desc">${a.desc}${progressText}</div>
        <div class="achievement-reward">${done ? `✅ Получено (+${a.reward}💰)` : `🎁 ${a.reward}💰`}</div>
      </div>
    </div>`;
  }).join('');

  const pct = total > 0 ? Math.round((got / total) * 100) : 0;

  content.innerHTML = `
    <h3>${escapeHtml(state.game.player.name)} · ${got}/${total} <span style="color:#a89060;font-size:14px;">(${pct}%)</span></h3>
    <div class="achievement-list">${items}</div>
  `;
}

// ============ ПОМОЩЬ ============

export function openHelp() {
  showScreen('screen-help');
}

// ============ СЛОТЫ ============

function clearOverworldRuntime() {
  const overworld = state.overworld;
  if (!overworld) return;

  // Stop the RAF/autosave loops before hiding or replacing the game screen.
  overworld.active = false;
  overworld.paused = true;
  state.overworld = null;
  emit('overworld:end');
}


export function loadSlot(slot) {
  // A previous session may have left a hidden overworld loop running behind
  // the main menu. Tear it down before replacing the active character.
  clearOverworldRuntime();
  if (loadGameData(slot)) {
    const log = document.getElementById('game-log');
    if (log) log.innerHTML = '';
    showScreen('screen-game');
    emit('log', { channel: 'game', msg: `С возвращением, ${state.game.player.name}!`, cls: 'success' });
    emit('game:update');
    // Loading data alone only rebuilds the dashboard. The saved world scene
    // must also be started; otherwise Continue opens an empty game screen.
    const savedLocation = state.game.location || 'village';
    if (!enterOverworld(savedLocation)) {
      state.game.location = 'village';
      enterOverworld('village');
    }
    playBGM('village');
  } else {
    toast('Не удалось загрузить слот');
  }
}

export function newGameSlot(slot) {
  if (!Number.isSafeInteger(slot) || slot < 1 || slot > 3) return;
  // Defer the active-slot switch until the new character is actually created.
  // This prevents pagehide/autosave from copying the previous hero into this slot.
  state.pendingSlot = slot;
  state.selectedClass = null;
  renderClassSelection();
  showScreen('screen-char');
}

export function deleteSlot(slot) {
  if (!confirm(`Удалить слот ${slot}? Это необратимо.`)) return false;
  const deletingActiveSlot = slot === state.currentSlot;
  if (!deleteSave(slot, { preserveActiveState: deletingActiveSlot })) {
    toast(`❌ Не удалось удалить слот ${slot}. Сохранение не удалено.`);
    renderSlots();
    return false;
  }
  if (deletingActiveSlot) {
    clearOverworldRuntime();
    state.game = null;
  }
  toast(`Слот ${slot} удалён`);
  renderSlots();
  return true;
}

export function deleteAllSaves() {
  if (!confirm('Удалить ВСЕ сохранения во всех 3 слотах?\n\nЭто необратимо. Прогресс будет потерян.')) return false;
  const max = getMaxSlot();
  const backups = new Map();
  try {
    for (let i = 1; i <= max; i++) {
      backups.set(i, globalThis.localStorage.getItem(`magic-rpg-save-${i}`));
    }
  } catch (error) {
    console.error('[save] Не удалось подготовить массовое удаление:', error);
    toast('❌ Не удалось проверить сохранения. Ни один слот не удалён.');
    return false;
  }

  const failedSlots = [];
  for (let i = 1; i <= max; i++) {
    if (!deleteSave(i, { preserveActiveState: true })) {
      failedSlots.push(i);
      break;
    }
  }
  if (failedSlots.length) {
    let rollbackSucceeded = true;
    for (const [slot, backup] of backups) {
      try {
        if (backup === null) globalThis.localStorage.removeItem(`magic-rpg-save-${slot}`);
        else globalThis.localStorage.setItem(`magic-rpg-save-${slot}`, backup);
      } catch (rollbackError) {
        rollbackSucceeded = false;
        console.error(`[save] Не удалось восстановить слот ${slot} после массового удаления:`, rollbackError);
      }
    }
    toast(rollbackSucceeded
      ? `❌ Не удалось удалить слоты: ${failedSlots.join(', ')}. Предыдущие сохранения восстановлены.`
      : `❌ Не удалось удалить слоты: ${failedSlots.join(', ')}. Восстановление не подтверждено; проверьте резервные копии.`);
    renderSlots();
    return false;
  }

  clearOverworldRuntime();
  state.game = null;
  state.currentSlot = 1;
  toast('Все сохранения удалены');
  renderSlots();
  return true;
}

export function saveAndMenu() {
  if (!saveGame()) {
    toast('❌ Не удалось сохранить игру. Проверьте свободное место в хранилище браузера.');
    return false;
  }
  // The dashboard can be opened while the 2D overworld is active. Leaving
  // its RAF/autosave loop alive behind the menu can consume CPU and freeze
  // the page; clear runtime state only after the save succeeded.
  clearOverworldRuntime();
  toast('Игра сохранена');
  stopBGM();
  showScreen('screen-main');
  updateMainMenu();
  return true;
}

// ============ ЭКСПОРТ / ИМПОРТ ============

function prepareImportedSave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      !raw.player || typeof raw.player !== 'object' || Array.isArray(raw.player) ||
      typeof raw.player.name !== 'string' || !raw.player.name.trim()) {
    throw new Error('Invalid save structure');
  }

  validateCurrentSaveShape(raw);
  const candidate = JSON.parse(JSON.stringify(raw));
  migrateGame(candidate);
  // Validate the fully migrated schema too: legacy files can pass the
  // version-aware precheck yet still contain invalid core player values.
  validateCurrentSaveShape(candidate);
  const player = candidate.player;
  if (candidate.version !== 18 ||
      !Array.isArray(player.inventory) ||
      !player.inventory.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string' && item.id.trim() && (item.qty == null || (Number.isSafeInteger(item.qty) && item.qty > 0))) ||
      !Array.isArray(player.spells) ||
      !player.equipped || typeof player.equipped !== 'object' || Array.isArray(player.equipped) ||
      !player.stats || typeof player.stats !== 'object' || Array.isArray(player.stats) ||
      !candidate.storyShards || typeof candidate.storyShards !== 'object' || Array.isArray(candidate.storyShards) ||
      !candidate.storyDragons || typeof candidate.storyDragons !== 'object' || Array.isArray(candidate.storyDragons)) {
    throw new Error('Incomplete save structure');
  }
  return candidate;
}

export function exportSave() {
  if (!state.game) { toast('Нет активной игры для экспорта. Загрузите слот.'); return; }
  const slot = state.currentSlot || 1;
  if (!saveGame()) {
    toast('❌ Не удалось сохранить текущий прогресс; экспорт отменён.');
    return;
  }
  let data;
  try {
    data = globalThis.localStorage.getItem(`magic-rpg-save-${slot}`);
  } catch (error) {
    console.error('[save] Не удалось прочитать слот для экспорта:', error);
    toast('❌ Не удалось прочитать слот: хранилище браузера недоступно');
    return;
  }
  if (!data) { toast('Слот пустой'); return; }

  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const pName = (state.game.player?.name || 'hero').replace(/[^a-zа-яё0-9]/gi, '_');
  a.href = url;
  a.download = `magic-rpg-${pName}-slot${slot}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('💾 Сейв скачан');
}

export function importSave(event) {
  const file = event.target.files[0];
  if (!file) return;
  const maxImportBytes = 5 * 1024 * 1024;
  if (Number.isFinite(file.size) && file.size > maxImportBytes) {
    toast('❌ Файл сохранения слишком большой (максимум 5 МБ)');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = prepareImportedSave(JSON.parse(e.target.result));
      const slot = state.currentSlot || 1;
      const pName = data.player.name;
      const pLvl = data.player.level || 1;
      if (!confirm(`Импортировать сейв «${pName}» (Ур. ${pLvl}) в слот ${slot}?\n\nТекущий слот будет перезаписан.`)) {
        event.target.value = '';
        return;
      }
      const saveKey = `magic-rpg-save-${slot}`;
      const previousSave = localStorage.getItem(saveKey);
      const serialized = JSON.stringify(data);
      try {
        localStorage.setItem(saveKey, serialized);
        if (localStorage.getItem(saveKey) !== serialized) {
          throw new Error('Imported save verification failed');
        }
      } catch (writeError) {
        // A storage implementation may write partially and then throw. Attempt
        // rollback, then verify the stored value before claiming it succeeded.
        try {
          if (previousSave === null) localStorage.removeItem(saveKey);
          else localStorage.setItem(saveKey, previousSave);
        } catch (rollbackError) {
          console.error('[save] Не удалось восстановить слот после неудачного импорта:', rollbackError);
        }
        let rollbackSucceeded = false;
        try {
          rollbackSucceeded = localStorage.getItem(saveKey) === previousSave;
        } catch (verifyError) {
          console.error('[save] Не удалось проверить восстановление слота:', verifyError);
        }
        toast(rollbackSucceeded
          ? '❌ Не удалось записать импорт: прежнее сохранение восстановлено'
          : '❌ Не удалось записать импорт и подтвердить восстановление прежнего слота. Проверьте резервную копию.');
        event.target.value = '';
        return;
      }
      toast('✅ Сейв импортирован! Перезагрузка...');
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toast('❌ Ошибка чтения файла');
      event.target.value = '';
    }
  };
  reader.onerror = () => {
    toast('❌ Не удалось прочитать файл сохранения');
    event.target.value = '';
  };
  reader.onabort = () => {
    toast('❌ Чтение файла сохранения отменено');
    event.target.value = '';
  };
  try {
    reader.readAsText(file);
  } catch (error) {
    console.error('[save] Не удалось запустить чтение файла:', error);
    reader.onerror(error);
  }
}