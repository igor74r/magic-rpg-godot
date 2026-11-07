import { state } from '../systems/state.js';
import {
  tryMovePlayer, updateOverworld, exitOverworld, enterOverworld,
  combatFlee
} from '../systems/overworld.js';
import { saveGame } from '../systems/save.js';
import { addItem } from '../systems/inventory.js';
import { saveAndMenu } from './menu.js';
import { LOCATIONS } from '../data/locations.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { emit, on } from '../systems/events.js';
import { escapeHtml } from './screens.js';
import { getSecretWallCount } from '../systems/overworld/secrets.js';
import { createRegionRandom } from '../systems/world-state.js';
import { ensureRegionRecord, recordRegionSecretDiscovered, recordRegionSecretLayout } from '../systems/region-state.js';
import { drawPlayerByClass, drawEnemyByType, drawStatic, EFFECTS_DATA, MODIFIERS_LABEL } from './overworld/models.js';
import { 
  renderCombatPanel, getSubPanel, setSubPanel, 
  owOpenSpells, owOpenItems, owOpenAbilities, owCloseSub, 
  owAttack, owCast, owUseItem, owBlock, owUseAbility, owFlee 
} from './overworld/combat-panel.js';
import { closePauseMenu, hideMapTooltip, initWeather, isPaused, onCanvasMouseMove, openPauseMenu, renderNpcPanel, setLastNpcKey, setPaused, start, startAutosave } from './overworld/render.js';



let overworldInputBound = false;

// ==================== СЕКРЕТНЫЕ КОМНАТЫ (2) ====================
function generateSecrets(ow) {
  const secrets = [];
  const loc = LOCATIONS[ow.locationId];
  if (!loc) return secrets;
  if (ow.locationId === 'village') return secrets; // в деревне нет секретов

  // В каждой боевой локации есть хотя бы одна секретная стена;
  // в 20% случаев появляется вторая. Добыча остаётся случайной.
  const regionId = ow.sourceLocationId || ow.locationId;
  const world = state.game?.world;
  const regionRecord = world ? ensureRegionRecord(world, regionId) : null;
  const generationVisit = regionRecord?.generationVisit || 1;
  const discovered = new Set(regionRecord?.discoveredSecrets || []);
  if (regionRecord?.secretLayoutGenerated) {
    return regionRecord.secretWalls.filter(wall => !discovered.has(wall.id)).map(wall => ({ ...wall, opened: false, startedAt: performance.now() }));
  }
  const random = world ? createRegionRandom(world, regionId, generationVisit) : Math.random;
  const count = getSecretWallCount(random);

  // Ищем кандидатов — «стены» (камни 4 или деревья 2), рядом с которыми проходимый тайл
  const candidates = [];
  for (let y = 1; y < ow.rows - 1; y++) {
    if (!ow.map[y]) continue;
    for (let x = 1; x < ow.cols - 1; x++) {
      const t = ow.map[y][x];
      if (t !== 4 && t !== 2) continue;
      let access = null;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nt = ow.map[y+dy]?.[x+dx];
        if (nt === 0 || nt === 1) { access = { ax: x+dx, ay: y+dy }; break; }
      }
      if (access) candidates.push({ x, y, ax: access.ax, ay: access.ay });
    }
  }
  if (!candidates.length) return secrets;

  for (let i = 0; i < count && candidates.length; i++) {
    const idx = Math.floor(random() * candidates.length);
    const c = candidates.splice(idx, 1)[0];
    const typeRoll = random();
    const rewardType = typeRoll < 0.60 ? 'chest' : typeRoll < 0.90 ? 'elite' : 'loot';
    const id = `secret-${c.x}-${c.y}`;
    if (discovered.has(id)) continue;
    secrets.push({
      id,
      tx: c.x, ty: c.y,
      wx: c.x * ow.tile + ow.tile / 2,
      wy: c.y * ow.tile + ow.tile / 2,
      ax: c.ax * ow.tile + ow.tile / 2,
      ay: c.ay * ow.tile + ow.tile / 2,
      rewardType,
      opened: false,
      startedAt: performance.now()
    });
  }
  if (world && recordRegionSecretLayout(world, regionId, secrets)) saveGame();
  return secrets;
}

function tryOpenSecret() {
  const ow = state.overworld;
  if (!ow || !ow.secretWalls) return;
  if (ow.combat || ow.defeated) return;
  const p = ow.player;
  for (const sw of ow.secretWalls) {
    if (sw.opened) continue;
    const dist = Math.hypot(sw.wx - p.x, sw.wy - p.y);
    if (dist < ow.tile * 1.6) {
      openSecret(sw);
      return;
    }
  }
}

function openSecret(sw) {
  const ow = state.overworld;
  const p = state.game.player;
  const previousGame = JSON.parse(JSON.stringify(state.game));
  const previousChestCount = ow.chests?.length || 0;
  const previousEnemyCount = ow.enemies?.length || 0;
  const previousParticleCount = ow.particles?.length || 0;
  sw.opened = true;
  let toastMessage = '';
  let logMessage = '';
  let logClass = 'success';

  // Эффект: взрыв искр
  for (let i = 0; i < 30; i++) {
    (ow.particles ||= []).push({
      x: sw.wx, y: sw.wy,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1, maxLife: 1,
      size: 2 + Math.random() * 3,
      color: i % 2 === 0 ? '#c9a227' : '#ffe060'
    });
  }

  if (sw.rewardType === 'chest') {
    (ow.chests ||= []).push({
      id: `${sw.id}-chest`,
      x: sw.ax, y: sw.ay,
      opened: false,
      _secret: true
    });
    toastMessage = '🪙 Найден древний сундук!';
    logMessage = '✨ Вы обнаружили скрытую нишу с сундуком.';
  } else if (sw.rewardType === 'elite') {
    const pool = (LOCATIONS[ow.locationId]?.enemies) || ['goblin', 'skeleton', 'wolf'];
    const enemyId = pool[Math.floor(Math.random() * pool.length)];
    const def = ENEMIES[enemyId];
    if (def) {
      (ow.enemies ||= []).push({
        x: sw.ax, y: sw.ay,
        enemyId,
        hp: Math.round((def.hp || 30) * 1.5),
        maxHp: Math.round((def.hp || 30) * 1.5),
        boss: false, elite: true, dead: false,
        state: 'idle',
        modifier: null,
        homeX: sw.ax, homeY: sw.ay,
        wanderTimer: 0, chaseCooldown: 0
      });
    }
    toastMessage = '⚠️ Пробуждён древний страж!';
    logMessage = '👁️ Из тьмы вышел страж.';
    logClass = 'danger';
  } else {
    // Лут — золото и зелья
    const gold = 5 + Math.floor(Math.random() * 9);
    p.gold = (p.gold || 0) + gold;
    addItem('health-potion', 1);
    addItem('mana-potion', 1);
    toastMessage = `💰 +${gold} золота, +2 зелья`;
    logMessage = `✨ Скрытая ниша: +${gold}💰, +2 зелья.`;
  }

  const regionId = ow.sourceLocationId || ow.locationId;
  const secretChest = sw.rewardType === 'chest' ? { id: `${sw.id}-chest`, x: sw.ax, y: sw.ay } : null;
  if (!recordRegionSecretDiscovered(state.game.world, regionId, sw.id, secretChest) || !saveGame()) {
    state.game = previousGame;
    if (ow.chests) ow.chests.length = previousChestCount;
    if (ow.enemies) ow.enemies.length = previousEnemyCount;
    if (ow.particles) ow.particles.length = previousParticleCount;
    sw.opened = false;
    emit('toast', '⚠️ Тайник не сохранён. Попробуйте открыть его ещё раз.');
    return;
  }
  if (toastMessage) emit('toast', toastMessage);
  if (logMessage) emit('log', { channel: 'game', msg: logMessage, cls: logClass });
}


let lastPortalPointerActivation = -Infinity;

function onOverworldCanvasClick(event) {
  // Pointerdown gives touch/mouse immediate response; suppress its synthetic click
  // so one physical tap cannot interact with the same portal twice.
  if (event.type === 'pointerdown') lastPortalPointerActivation = performance.now();
  else if (event.type === 'click' && event.detail > 0 && performance.now() - lastPortalPointerActivation < 700) return;
  const ow = state.overworld;
  if (!ow || !ow.active || ow.combat || ow.defeated) return;
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const screenX = (event.clientX - rect.left) * (canvas.width / rect.width);
  const screenY = (event.clientY - rect.top) * (canvas.height / rect.height);
  const worldX = screenX + ow.camera.x;
  const worldY = screenY + ow.camera.y;
  const portals = (ow.statics || []).filter(item =>
    ['world-portal', 'tower-portal', 'world-waystone', 'tower-gate'].includes(item.id)
  );
  let nearest = null, nearestDistance = Infinity;
  for (const portal of portals) {
    const distance = Math.hypot(portal.x - worldX, portal.y - worldY);
    const hitRadius = Math.max(70, Number(portal.interactionRadius) || 0);
    if (distance <= hitRadius && distance < nearestDistance) {
      nearest = portal;
      nearestDistance = distance;
    }
  }
  if (!nearest) return;
  event.preventDefault();
  window.GameAPI?.interactNpc?.(nearest.id);
}

export function resumeOverworld() {
  if (!state.overworld) return false;
  state.overworld.active = true;
  state.overworld.paused = false;
  setPaused(false);
  startAutosave();
  start();
  return true;
}

export function initOverworld() {
  if (!overworldInputBound) {
    // Capture movement before UI widgets can consume arrow/WASD events.
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('blur', clearMovementKeys);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearMovementKeys(); });
    overworldInputBound = true;
    const canvas = document.getElementById('overworld-canvas');
    if (canvas) { canvas.addEventListener('mousemove', onCanvasMouseMove); canvas.addEventListener('mouseleave', hideMapTooltip); canvas.addEventListener('pointerdown', onOverworldCanvasClick); canvas.addEventListener('click', onOverworldCanvasClick); }
  }
  setSubPanel(null); setLastNpcKey(''); setPaused(false);
  initWeather(state.overworld ? (state.overworld.theme || state.overworld.locationId) : 'default');

  // Генерируем секреты для текущей локации
  if (state.overworld) {
    state.overworld.secretWalls = generateSecrets(state.overworld);
    const regionId = state.overworld.sourceLocationId || state.overworld.locationId;
    const regionRecord = state.game?.world?.regions?.[regionId];
    const openedChests = new Set(regionRecord?.openedChests || []);
    for (const chest of regionRecord?.secretChests || []) {
      if (!openedChests.has(chest.id) && !state.overworld.chests.some(item => item.id === chest.id)) {
        state.overworld.chests.push({ ...chest, opened: false, _secret: true });
      }
    }
    if (state.overworld.secretWalls.length > 0) {
      console.log('[secrets] на карте спрятано:', state.overworld.secretWalls.length);
    }
  }

  closePauseMenu(); startAutosave();
  start();
  renderCombatPanel(); renderNpcPanel();
  initMobileDpad();
}

function initMobileDpad() {
  const dpad = document.getElementById('mobile-dpad');
  if (!dpad) return;

  // Desktop/laptop users control the character with WASD or arrow keys.
  // Do not mount pointer handlers or show a floating pad on a mouse/trackpad.
  const isTouchDevice = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches === true;
  if (!isTouchDevice) {
    dpad.hidden = true;
    dpad.style.display = 'none';
    return;
  }

  if (dpad.dataset.bound) {
    dpad.hidden = false;
    dpad.style.display = 'block';
    return;
  }
  dpad.hidden = false;
  dpad.style.display = 'block';
  dpad.dataset.bound = '1';
  dpad.querySelectorAll('.dpad-btn').forEach(btn => {
    const key = btn.dataset.key;
    const setKey = (val) => { if (state.overworld) state.overworld.keys[key] = val; };
    btn.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      setKey(true);
      btn.setPointerCapture?.(event.pointerId);
    });
    const releasePointer = event => {
      event.preventDefault();
      setKey(false);
    };
    btn.addEventListener('pointerup', releasePointer);
    btn.addEventListener('pointercancel', releasePointer);
    btn.addEventListener('lostpointercapture', () => setKey(false));
    btn.addEventListener('keydown', event => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) setKey(true);
    });
    btn.addEventListener('keyup', event => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        setKey(false);
      }
    });
    btn.addEventListener('blur', () => setKey(false));
  });
}


function getLogicalKey(e) {
  const code = e.code || '';
  const key = String(e.key || '').toLowerCase();
  const keyCode = e.keyCode || e.which;
  if (keyCode === 87) return 'w';
  if (keyCode === 65) return 'a';
  if (keyCode === 83) return 's';
  if (keyCode === 68) return 'd';
  if (keyCode === 38) return 'w';
  if (keyCode === 37) return 'a';
  if (keyCode === 40) return 's';
  if (keyCode === 39) return 'd';
  if (code === 'KeyW' || code === 'ArrowUp') return 'w';
  if (code === 'KeyS' || code === 'ArrowDown') return 's';
  if (code === 'KeyA' || code === 'ArrowLeft') return 'a';
  if (code === 'KeyD' || code === 'ArrowRight') return 'd';
  if (code === 'Space') return ' ';
  if (code === 'Escape') return 'escape';
  if (code === 'KeyE') return 'e';
  if (code === 'Digit1' || code === 'Numpad1') return '1';
  if (code === 'Digit2' || code === 'Numpad2') return '2';
  if (code === 'Digit3' || code === 'Numpad3') return '3';
  if (code === 'Digit4' || code === 'Numpad4') return '4';
  if (code === 'Digit5' || code === 'Numpad5') return '5';
  if (code === 'Digit6' || code === 'Numpad6') return '6';
  if (['w', 'a', 's', 'd'].includes(key)) return key;
  if (key === 'arrowup') return 'w';
  if (key === 'arrowleft') return 'a';
  if (key === 'arrowdown') return 's';
  if (key === 'arrowright') return 'd';
  return key;
}

function onKeyDown(e) {
  if (!state.overworld || !state.overworld.active) return;
  state.overworld.keys ||= {};
  const k = getLogicalKey(e);
  if (isPaused()) { if (k === 'escape') { e.preventDefault(); closePauseMenu(); } return; }
  if (k === 'escape') {
    e.preventDefault(); if (state.overworld.defeated) return;
    if (getSubPanel()) { setSubPanel(null); renderCombatPanel(); }
    else if (state.overworld.combat) { if (confirm('Сбежать из боя? Это считается побегом.')) combatFlee(false); }
    else openPauseMenu();
    return;
  }
  if (state.overworld.defeated) return;

  // Открытие секретной стены по E
  if (k === 'e' && !state.overworld.combat) {
    e.preventDefault();
    tryOpenSecret();
    return;
  }

  if (state.overworld.combat) {
    const c = state.overworld.combat;
    if (getSubPanel()) {
      const n = parseInt(k, 10);
      if (!isNaN(n) && n >= 1) {
        e.preventDefault();
        if (getSubPanel() === 'spells') { const id = state.game.player.spells[n - 1]; if (id) owCast(id); }
        else if (getSubPanel() === 'items') { const items = state.game.player.inventory.filter(it => ITEMS[it.id]?.type === 'consumable'); const it = items[n - 1]; if (it) owUseItem(it.id); }
        else if (getSubPanel() === 'abilities') { const cls = CLASSES[state.game.player.class]; const abs = (cls.abilities || []).filter(a => !a.passive); const ab = abs[n - 1]; if (ab) owUseAbility(ab.id); }
      }
      return;
    }
    if (c.turn !== 'player') return;
    if (k === ' ' || k === '1') { e.preventDefault(); owAttack(); return; }
    if (k === '2') { e.preventDefault(); owOpenSpells(); return; }
    if (k === '3') { e.preventDefault(); owOpenItems(); return; }
    if (k === '4') { e.preventDefault(); owFlee(); return; }
    if (k === '5') { e.preventDefault(); owBlock(); return; }
    if (k === '6') { e.preventDefault(); owOpenAbilities(); return; }
    return;
  }
  if (['w', 'a', 's', 'd'].includes(k)) { e.preventDefault(); state.overworld.keys[k] = true; }
}

function onKeyUp(e) {
  if (!state.overworld) return;
  state.overworld.keys ||= {};
  const k = getLogicalKey(e);
  state.overworld.keys[k] = false;
}

// Не оставляем движение зажатым, если вкладка теряет фокус до события keyup.
function clearMovementKeys() {
  const keys = state.overworld?.keys;
  if (!keys) return;
  for (const key of ['w', 'a', 's', 'd']) keys[key] = false;
}

export function closeDialogAndResume() { 
  setPaused(false); 
  setLastNpcKey(''); 
  renderNpcPanel(); 
  const modal = document.getElementById('npc-dialog-modal');
  if (modal) modal.style.display = 'none';
}

// ==================== УВЕДОМЛЕНИЯ О ДОСТИЖЕНИЯХ ====================
let _achCount = 0;
export function showAchievementNotification(data) {
  if (!data) return;
  const name = data.name || data.title || 'Открыто';
  const desc = data.desc || data.description || '';
  const icon = data.icon || '🏆';

  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; right: 20px; top: ${20 + (_achCount * 92)}px;
    z-index: 10000; display: flex; align-items: center; gap: 12px;
    background: linear-gradient(135deg, #2a1a0a 0%, #0a0500 100%);
    border: 2px solid #c9a227; border-radius: 8px;
    padding: 12px 18px; color: #e8dac8;
    box-shadow: 0 0 30px rgba(201, 162, 39, 0.6), inset 0 0 15px rgba(201, 162, 39, 0.1);
    transform: translateX(140%); opacity: 0;
    transition: transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.3s;
    max-width: 320px; font-family: Georgia, serif;
  `;
  el.innerHTML = `
    <div style="font-size: 32px; filter: drop-shadow(0 0 8px #ffd060);">${escapeHtml(icon)}</div>
    <div style="flex: 1;">
      <div style="font-size: 10px; letter-spacing: 2px; color: #c9a227; text-transform: uppercase;">Достижение</div>
      <div style="font-size: 16px; font-weight: bold; color: #ffd060; margin: 2px 0;">${escapeHtml(name)}</div>
      <div style="font-size: 12px; color: #a89878;">${escapeHtml(desc)}</div>
    </div>
  `;
  document.body.appendChild(el);
  _achCount++;

  requestAnimationFrame(() => {
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
  });

  setTimeout(() => {
    el.style.transform = 'translateX(140%)';
    el.style.opacity = '0';
    setTimeout(() => {
      el.remove();
      _achCount = Math.max(0, _achCount - 1);
    }, 500);
  }, 4000);
}

on('achievement', showAchievementNotification);
on('achievement:unlocked', showAchievementNotification);
on('achievements:unlocked', showAchievementNotification);



export function owPauseResume() { closePauseMenu(); }
export function owPauseSaveVillage() {
  if (!state.overworld || !state.game) {
    closePauseMenu();
    return false;
  }

  // Persist the current run before leaving the location. If the write fails,
  // keep the player in the current world instead of dropping their progress.
  if (!saveGame()) {
    emit('toast', '❌ Не удалось сохранить игру. Вы остались в текущей локации.');
    return false;
  }

  const previousOverworld = state.overworld;
  const previousLocation = state.game.location || previousOverworld.locationId || 'village';
  exitOverworld();

  // exitOverworld() can be cancelled by the combat escape confirmation.
  if (state.overworld === previousOverworld) {
    closePauseMenu();
    return false;
  }

  state.game.location = 'village';
  if (!saveGame()) {
    // The first save above still protects the current progress. Keep the
    // in-memory destination correct and let the next autosave persist it.
    emit('toast', '⚠️ Вы вернулись в деревню, но переход не удалось записать в сохранение.');
  }

  closePauseMenu();
  if (!enterOverworld('village')) {
    state.game.location = previousLocation;
    emit('toast', '❌ Не удалось открыть деревню. Попробуйте продолжить игру из меню.');
    return false;
  }
  return true;
}
export function owPauseExit() { saveGame(); closePauseMenu(); state.overworld = null; emit('overworld:end'); saveAndMenu(); }

export { 
  owOpenSpells, owOpenItems, owOpenAbilities, owCloseSub, 
  owAttack, owCast, owUseItem, owBlock, owUseAbility, owFlee 
};
