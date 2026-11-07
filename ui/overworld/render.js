import { state } from '../../systems/state.js';
import { tryMovePlayer, updateOverworld } from '../../systems/overworld.js';
import { getEffStats } from '../../systems/stats.js';
import { saveGame } from '../../systems/save.js';
import { LOCATIONS } from '../../data/locations.js';
import { ENEMIES } from '../../data/enemies.js';
import { drawPlayerByClass, drawEnemyByType, drawStatic } from './models.js';
import { buildDepthItems } from './depth-order.js';
import { drawAtlasTile, drawAtlasProp, drawAuroraGroundTile, drawAuroraGroundTransitions } from './tile-atlas.js';
import { getTileDanger } from '../../systems/overworld/hazards.js';
import { getActiveCampaignMission } from '../../systems/campaign.js';
import { renderCombatPanel } from './combat-panel.js';
import { escapeHtml } from '../screens.js';
import {
  VIEW_W, VIEW_H, getTheme, MOD_LABEL,
  initWeather as initWeatherFx,
  updateWeather, updateFireflies, updateFog, updateLightning, getLightningFlash,
  drawWeather, drawFireflies, drawFogLayers, drawBloom
} from './effects.js';

// Состояние canvas-цикла и визуальных эффектов (погода живёт в effects.js)
let rafId = null, lastTs = 0, lastNpcKey = '', autosaveTimer = null, autosaveAt = 0;
let autosaveSavedAt = 0, autosaveErrorAt = 0;
let fpsNow = 0, fpsFrames = 0, fpsSampleAt = 0;
let paused = false, nearNpc = null;
let lastTickErrorMessage = '', lastTickErrorAt = 0;
let footprints = [], lastFootprintPos = { x: 0, y: 0 }, hurtFlash = 0, worldTime = 0;
let deathParticles = [], bloodSplats = [], lowHpPulse = 0, corpses = [];
let lastTileKey = null, tileDamageTimer = 0, _weatherEffectApplied = null;
let mapTooltipEl = null, pauseReturnFocus = null;

// Reuse the darkness/light-mask surface instead of allocating a full canvas every frame.
let darknessCanvas = null, darknessCtx = null;

const EVENT_PROP_COLUMN = Object.freeze({ mimic: 0, crystal: 1, altar: 2 });

function getEventPropIndex(eventType, themeName) {
  const column = EVENT_PROP_COLUMN[eventType];
  if (!Number.isInteger(column)) return -1;
  const row = ['volcano', 'obsidian-fields', 'dragon', 'void-crater'].includes(themeName) ? 3
    : ['shadow', 'sunken-necropolis', 'library'].includes(themeName) ? 2
      : ['ice', 'frost-citadel', 'ice-peaks'].includes(themeName) ? 1
        : 0;
  return row * 8 + column;
}

function edgeSpawn() {
  const side = Math.floor(Math.random() * 4);
  const band = 70 + Math.random() * 50;
  if (side === 0) return { x: Math.random() * band, y: Math.random() * VIEW_H };
  if (side === 1) return { x: VIEW_W - Math.random() * band, y: Math.random() * VIEW_H };
  if (side === 2) return { x: Math.random() * VIEW_W, y: Math.random() * band };
  return { x: Math.random() * VIEW_W, y: VIEW_H - Math.random() * band };
}

export function startAutosave() {
  if (autosaveTimer) return;
  autosaveAt = performance.now();
  autosaveSavedAt = 0;
  autosaveErrorAt = 0;
  autosaveTimer = setInterval(() => {
    const ow = state.overworld;
    if (!ow || !ow.active) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
      return;
    }
    const now = performance.now();
    const interval = Math.max(15, Math.min(60, Number(state.settings?.autoSaveInterval) || 30)) * 1000;
    if (ow && ow.active && !ow.combat && !ow.defeated && !paused &&
        state.settings?.autoSave !== false && now - autosaveAt >= interval) {
      // Throttle retries after storage errors; never announce a failed write as saved.
      autosaveAt = now;
      try {
        if (saveGame()) {
          autosaveSavedAt = now;
          autosaveErrorAt = 0;
        }
      } catch (error) {
        autosaveErrorAt = now;
        console.error('[autosave] Не удалось сохранить игру:', error);
      }
    }
  }, 1000);
}

function tick(ts) {
  try {
  if (!state.overworld?.active) {
    rafId = null;
    return;
  }
  const dt = Math.min(50, ts - lastTs) / 16.67; lastTs = ts;
  fpsFrames++;
  if (!fpsSampleAt) fpsSampleAt = ts;
  if (ts - fpsSampleAt >= 1000) {
    fpsNow = Math.round(fpsFrames * 1000 / (ts - fpsSampleAt));
    fpsFrames = 0;
    fpsSampleAt = ts;
  }
  if (state.overworld && state.overworld.active) {
    if (!paused) {
      worldTime += dt * 0.005;

      const ow = state.overworld;
      const p = state.game.player;
      const theme = getTheme(ow.theme || ow.locationId);

      // Погодные эффекты в бою
      if (ow.combat) {
        if (theme.weather === 'rain' && _weatherEffectApplied !== 'def') {
          p.effects = (Array.isArray(p.effects) ? p.effects : []).filter(e => e?._weatherEffect !== true);
          p.effects.push({ id: 'defBuff', duration: 999, _weatherEffect: true });
          _weatherEffectApplied = 'def';
        } else if (['shadow', 'void-crater'].includes(ow.locationId) && _weatherEffectApplied !== 'atk') {
          p.effects = (Array.isArray(p.effects) ? p.effects : []).filter(e => e?._weatherEffect !== true);
          p.effects.push({ id: 'atkBuff', duration: 999, _weatherEffect: true });
          _weatherEffectApplied = 'atk';
        }
      } else {
        if (_weatherEffectApplied) {
          p.effects = (Array.isArray(p.effects) ? p.effects : []).filter(e => e?._weatherEffect !== true);
          _weatherEffectApplied = null;
        }
      }

      // Движение (с замедлением на снегу)
      if (!ow.combat && !ow.defeated) {
        const k = ow.keys; let dx = 0, dy = 0;
        if (k['w'] || k['arrowup']) dy -= 1; if (k['s'] || k['arrowdown']) dy += 1;
        if (k['a'] || k['arrowleft']) dx -= 1; if (k['d'] || k['arrowright']) dx += 1;
        
        if (dx || dy) {
          const movementScale = theme.weather === 'snow' ? 0.84 : 1;
          tryMovePlayer(dx, dy, dt * movementScale);
            
            const pp = ow.player;
            if (Math.hypot(pp.x - lastFootprintPos.x, pp.y - lastFootprintPos.y) > 15) {
              footprints.push({ x: pp.x, y: pp.y + 10, life: 1.0, angle: Math.atan2(dy, dx) });
              lastFootprintPos = { x: pp.x, y: pp.y };
              if (footprints.length > 30) footprints.shift();
            }
        } 
      }

      // Опасные тайлы
      if (!ow.combat && !ow.defeated && state.game) {
        const tileX = Math.floor(ow.player.x / ow.tile);
        const tileY = Math.floor(ow.player.y / ow.tile);
        const tileType = ow.map[tileY]?.[tileX];
        const danger = getTileDanger(tileType, ow.locationId);
        const tileKey = `${tileX},${tileY}`;

        if (danger) {
          if (danger.type === 'spike') {
            if (tileKey !== lastTileKey) {
              p.hp = Math.max(1, p.hp - danger.dmg);
              ow.player.hp = p.hp;
              (ow.floatingNumbers ||= []).push({
                x: ow.player.x, y: ow.player.y - 30,
                text: `-${danger.dmg}`, life: 1.0, type: 'damage'
              });
              hurtFlash = 1.0;
            }
          } else {
            tileDamageTimer += dt;
            if (tileDamageTimer >= danger.every) {
              tileDamageTimer = 0;
              p.hp = Math.max(1, p.hp - danger.dmg);
              ow.player.hp = p.hp;
              (ow.floatingNumbers ||= []).push({
                x: ow.player.x + (Math.random() * 20 - 10),
                y: ow.player.y - 30,
                text: `-${danger.dmg}`, life: 1.0, type: 'damage'
              });
              hurtFlash = 0.5;
            }
          }
        } else {
          tileDamageTimer = 0;
        }
        lastTileKey = tileKey;
      }

      updateOverworld(dt);
      updateWeather(dt);
      updateFireflies(dt, worldTime);
      updateFog(dt);
      updateLightning(dt);

      for (let i = footprints.length - 1; i >= 0; i--) {
        footprints[i].life -= dt * 0.02;
        if (footprints[i].life <= 0) footprints.splice(i, 1);
      }

      if (hurtFlash > 0) hurtFlash -= dt * 0.1;

      for (let i = bloodSplats.length - 1; i >= 0; i--) {
        bloodSplats[i].life -= dt * 0.03;
        if (bloodSplats[i].life <= 0) bloodSplats.splice(i, 1);
      }

      for (let i = corpses.length - 1; i >= 0; i--) {
        corpses[i].life -= dt * 0.002;
        if (corpses[i].life <= 0) corpses.splice(i, 1);
      }

      if (p.hp / p.maxHp < 0.25) lowHpPulse += dt * 0.1;
      else lowHpPulse = 0;

      for (let i = deathParticles.length - 1; i >= 0; i--) {
        let dp = deathParticles[i];
        dp.x += dp.vx * dt; dp.y += dp.vy * dt;
        dp.vy += 0.2 * dt;
        dp.life -= dt * 0.03;
        if (dp.life <= 0) deathParticles.splice(i, 1);
      }
    }
    render(); renderCombatPanel(); renderNpcPanel();
  }
  } catch (error) {
    // A single rendering/update exception must not permanently kill the
    // animation loop. Keep the scene recoverable and avoid flooding console.
    const message = error?.stack || error?.message || String(error);
    const now = Number.isFinite(ts) ? ts : performance.now();
    if (message !== lastTickErrorMessage || now - lastTickErrorAt > 5000) {
      console.error('[overworld] Ошибка игрового кадра; цикл будет продолжен:', error);
      lastTickErrorMessage = message;
      lastTickErrorAt = now;
    }
  } finally {
    if (state.overworld?.active) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }
}

// Pixel-stepped contact shadows anchor Aurora scenery to the ground.
// Visual only: no collision, navigation, or interaction coordinates are changed.
function drawAuroraContactShadow(ctx, item, x, y) {
  const buildingWidths = { hall: 112, forge: 88, healer: 88, alchemy: 88, market: 92, tavern: 104, home: 78 };
  const natureWidths = { oak: 76, pine: 68, bush: 52, rock: 46, stump: 42, hedge: 64, fence: 72, flowerbed: 52 };
  const width = item.buildingStyle ? (buildingWidths[item.buildingStyle] || 84)
    : item.natureStyle ? (natureWidths[item.natureStyle] || 36) : 30;
  const depth = item.buildingStyle ? 22 : item.natureStyle ? 14 : 9;
  const left = Math.round(x - width / 2);
  const top = Math.round(y - depth / 2 + 5);
  ctx.save();
  ctx.fillStyle = 'rgba(18, 24, 19, 0.30)';
  ctx.fillRect(left + 7, top, width - 14, depth);
  ctx.fillRect(left + 3, top + 3, width - 6, depth - 6);
  ctx.fillRect(left, top + 6, width, Math.max(2, depth - 12));
  ctx.restore();
}

function drawAuroraFallbackTile(ctx, type, x, y, size, tileX, tileY) {
  const previousSmoothing = ctx.imageSmoothingEnabled;
  let seed = Math.imul(tileX + 43, 374761393) ^ Math.imul(tileY + 71, 668265263);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
  const pick = (n) => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
    return seed % n;
  };
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    if (type === 1) {
      ctx.fillStyle = '#756b56';
      ctx.fillRect(x, y, size, size);
      const stones = ['#8a806a', '#a3977c', '#5b594a', '#77735f'];
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 ? 8 : 0;
        for (let col = -1; col < 4; col++) {
          const px = x + offset + col * 16 + 1;
          const py = y + row * 12 + 2;
          ctx.fillStyle = stones[pick(stones.length)];
          ctx.fillRect(px, py, 13, 8);
          ctx.fillStyle = '#514d40';
          ctx.fillRect(px + 2, py + 7, 8, 1);
        }
      }
    } else {
      ctx.fillStyle = '#526b3f';
      ctx.fillRect(x, y, size, size);
      const grass = ['#71864a', '#849653', '#425c35', '#a2a55d'];
      for (let i = 0; i < 18; i++) {
        const px = x + 3 + pick(42);
        const py = y + 3 + pick(42);
        ctx.fillStyle = grass[pick(grass.length)];
        ctx.fillRect(px, py, 2, 1);
        if (pick(4) === 0) ctx.fillRect(px + 1, py - 1, 1, 1);
      }
    }
  } finally {
    ctx.restore();
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}

function drawAuroraGardenBedTile(ctx, x, y, size, tileX, tileY, map) {
  const previousSmoothing = ctx.imageSmoothingEnabled;
  let seed = Math.imul(tileX + 61, 374761393) ^ Math.imul(tileY + 29, 668265263);
  seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) >>> 0;
  const pick = (n) => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
    return seed % n;
  };
  const inset = {
    left: map?.[tileY]?.[tileX - 1] === 4 ? 0 : 4,
    right: map?.[tileY]?.[tileX + 1] === 4 ? 0 : 4,
    top: map?.[tileY - 1]?.[tileX] === 4 ? 0 : 4,
    bottom: map?.[tileY + 1]?.[tileX] === 4 ? 0 : 4
  };
  const bedX = x + inset.left, bedY = y + inset.top;
  const bedW = size - inset.left - inset.right, bedH = size - inset.top - inset.bottom;
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#526b3f';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#684b32';
    ctx.fillRect(bedX, bedY, bedW, bedH);
    ctx.fillStyle = '#a77a4b';
    if (inset.top) ctx.fillRect(bedX, bedY, bedW, 2);
    if (inset.bottom) ctx.fillRect(bedX, bedY + bedH - 2, bedW, 2);
    if (inset.left) ctx.fillRect(bedX, bedY, 2, bedH);
    if (inset.right) ctx.fillRect(bedX + bedW - 2, bedY, 2, bedH);
    for (let i = 0; i < 9; i++) {
      const px = bedX + 5 + pick(Math.max(1, bedW - 12));
      const py = bedY + 5 + pick(Math.max(1, bedH - 12));
      ctx.fillStyle = '#315d3b';
      ctx.fillRect(px, py, 4, 3);
      ctx.fillRect(px + 1, py - 2, 2, 2);
      if (pick(3) === 0) {
        ctx.fillStyle = pick(2) ? '#e6c77b' : '#d7a5b8';
        ctx.fillRect(px + 1, py - 3, 2, 2);
      }
    }
  } finally {
    ctx.restore();
    ctx.imageSmoothingEnabled = previousSmoothing;
  }
}

function drawTile(ctx, type, x, y, size, themeName, colors, tileX = 0, tileY = 0, map = null) {
  if (themeName === 'village') {
    if (type === 4) {
      drawAuroraGardenBedTile(ctx, x, y, size, tileX, tileY, map);
      return;
    }
    if (drawAuroraGroundTile(ctx, type, x, y, size, tileX, tileY)) {
      drawAuroraGroundTransitions(ctx, type, x, y, size, tileX, tileY, map);
      return;
    }
    drawAuroraFallbackTile(ctx, type, x, y, size, tileX, tileY);
    return;
  }
  if (drawAtlasTile(ctx, type, x, y, size, themeName)) {
    const hazard = getTileDanger(type, themeName);
    if (hazard) {
      const pulse = 0.35 + 0.45 * Math.abs(Math.sin(performance.now() / 400 + x * 0.01 + y * 0.01));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hazard.type === 'lava'
        ? `rgba(255, 85, 0, ${pulse})`
        : hazard.type === 'poison'
          ? `rgba(100, 220, 80, ${pulse * 0.6})`
          : `rgba(210, 55, 55, ${pulse * 0.45})`;
      ctx.fillRect(x, y, size, size);
      if (hazard.type === 'spike') {
        ctx.strokeStyle = `rgba(255, 170, 150, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 13); ctx.lineTo(x + 18, y + 28); ctx.lineTo(x + 26, y + 13);
        ctx.moveTo(x + 25, y + 27); ctx.lineTo(x + 33, y + 39);
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  const half = size / 2;
  ctx.fillStyle = colors[type] || '#1a4a3e';
  ctx.fillRect(x, y, size, size);

  // The generic terrain edge strip is useful in other biomes, but it reads
  // as repeated dark scanlines across Aurora's grass when its authored atlas
  // is still loading or unavailable. Keep Aurora's fallback ground seamless.
  if ((type === 0 || type === 1) && themeName !== 'village') {
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, y + size - 4, size, 4);
  }

  if (type === 0) {
    const wind = Math.sin(worldTime * 2 + x * 0.05) * 3;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(x + 10, y + 30); ctx.quadraticCurveTo(x + 15 + wind, y + 25, x + 15 + wind, y + 20); ctx.lineTo(x + 18, y + 30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 30, y + 40); ctx.quadraticCurveTo(x + 35 + wind, y + 35, x + 35 + wind, y + 30); ctx.lineTo(x + 38, y + 40); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 25, y + 10, 3, 2); ctx.fillRect(x + 5, y + 45, 2, 2);
  } else if (type === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(x + 10, y + 10, 4, 3); ctx.fillRect(x + 30, y + 25, 5, 4); ctx.fillRect(x + 15, y + 40, 3, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x + 20, y + 15, 2, 2);
  } else if (type === 2) {
    const wind = Math.sin(worldTime * 1.5 + x * 0.02) * 2;
    ctx.fillStyle = '#241a12'; ctx.fillRect(x + half - 4, y + 32, 8, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(x + half, y + 28, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b2a24'; ctx.beginPath(); ctx.arc(x + half + wind, y + 24, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#123a30'; ctx.beginPath(); ctx.arc(x + half - 4 + wind, y + 20, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a4a3e'; ctx.beginPath(); ctx.arc(x + half + 2 + wind, y + 18, 10, 0, Math.PI * 2); ctx.fill();
  } else if (type === 3) {
    const isLava = ['volcano', 'dragon', 'obsidian-fields'].includes(themeName);
    const isPoison = ['swamp', 'briar-hollow'].includes(themeName);
    const isTrapWater = ['ruins', 'sunken-necropolis'].includes(themeName);

    if (isLava || isPoison || isTrapWater) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 400 + x * 0.01 + y * 0.01));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (isLava) ctx.fillStyle = `rgba(255, 80, 0, ${0.3 + pulse * 0.3})`;
      else if (isPoison) ctx.fillStyle = `rgba(100, 200, 80, ${0.15 + pulse * 0.15})`;
      else ctx.fillStyle = `rgba(200, 55, 55, ${0.12 + pulse * 0.2})`;
      ctx.fillRect(x, y, size, size);
      ctx.restore();
    }

    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    const offset = (performance.now() / 20) % 20;
    ctx.beginPath(); ctx.moveTo(x + offset, y + 12); ctx.quadraticCurveTo(x + 10 + offset, y + 8, x + 20 + offset, y + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10 - offset, y + 32); ctx.quadraticCurveTo(x + 20 - offset, y + 28, x + 30 - offset, y + 32); ctx.stroke();
  } else if (type === 4) {
    if (themeName === 'ruins') {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 500 + x * 0.02 + y * 0.02);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(180, 40, 40, ${0.1 + pulse * 0.15})`;
      ctx.fillRect(x, y, size, size);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x + 20, y + 34, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3e4a5a'; ctx.beginPath(); ctx.moveTo(x + 8, y + 32); ctx.lineTo(x + 18, y + 10); ctx.lineTo(x + 40, y + 14); ctx.lineTo(x + 36, y + 36); ctx.fill();
    ctx.fillStyle = '#5a6a7a'; ctx.beginPath(); ctx.moveTo(x + 18, y + 10); ctx.lineTo(x + 40, y + 14); ctx.lineTo(x + 30, y + 18); ctx.fill();
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 26, y + 16); ctx.lineTo(x + 22, y + 26); ctx.lineTo(x + 28, y + 32); ctx.stroke();
  }
}


function render() {
  const canvas = document.getElementById('overworld-canvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); const ow = state.overworld; const cam = ow.camera; const theme = getTheme(ow.theme);
  ctx.imageSmoothingEnabled = false;

  const player = state.game.player;
  const isLowHp = player.hp / player.maxHp < 0.25;
  const settings = state.settings || {};
  const reduceMotion = settings.reducedMotion === true;
  const graphicsQuality = settings.graphicsQuality || 'high';
  const allowWeather = settings.weatherEffects !== false && graphicsQuality !== 'low' && !settings.reducedMotion;
  const allowAmbientFog = settings.ambientFog !== false && graphicsQuality !== 'low' && !settings.reducedMotion;
  const allowShake = settings.screenShake !== false && !reduceMotion;
  const showLowHealth = settings.lowHealthEffects !== false && !reduceMotion;
  let shakeX = 0, shakeY = 0;
  if (isLowHp && showLowHealth && allowShake) {
    shakeX = (Math.random() - 0.5) * 1.5 * Math.sin(lowHpPulse * 5);
    shakeY = (Math.random() - 0.5) * 1.5 * Math.sin(lowHpPulse * 5);
  }

  ctx.save();
  if (allowShake && ow.shake && ow.shake.t > 0) ctx.translate((Math.random() * 2 - 1) * ow.shake.mag, (Math.random() * 2 - 1) * ow.shake.mag);
  ctx.translate(shakeX, shakeY);
  
  ctx.fillStyle = theme.colors[0] || '#2a4a2a'; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);

  const time = performance.now() * 0.001; ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.arc((i * 137 + Math.sin(time + i) * 20) % VIEW_W, (i * 73 + Math.cos(time * 0.5 + i) * 15) % VIEW_H, 1.5, 0, Math.PI * 2); ctx.fill(); }

  // Aurora and every other region share the authored 2x terrain atlas.
  // Nearest-neighbour sampling preserves crisp 16-bit pixel edges.
  const startCol = Math.max(0, Math.floor(cam.x / ow.tile)), startRow = Math.max(0, Math.floor(cam.y / ow.tile));
  const endCol = Math.min(ow.cols, startCol + Math.ceil(VIEW_W / ow.tile) + 2), endRow = Math.min(ow.rows, startRow + Math.ceil(VIEW_H / ow.tile) + 2);
  ctx.imageSmoothingEnabled = false;
  for (let y = startRow; y < endRow; y++) {
    if (!ow.map[y]) continue;
    for (let x = startCol; x < endCol; x++) {
      const tile = ow.map[y][x];
      if (tile !== undefined) {
        const screenX = x * ow.tile - cam.x;
        const screenY = y * ow.tile - cam.y;
        drawTile(ctx, tile, screenX, screenY, ow.tile, ow.locationId, theme.colors, x, y, ow.map);
      }
    }
  }
  ctx.imageSmoothingEnabled = false;

  // ============= СЕКРЕТНЫЕ СТЕНЫ: МЕРЦАНИЕ =============
  if (!ow.combat && ow.secretWalls) {
    for (const sw of ow.secretWalls) {
      if (sw.opened) continue;
      const sx = sw.tx * ow.tile - cam.x;
      const sy = sw.ty * ow.tile - cam.y;
      if (sx < -60 || sx > VIEW_W + 60 || sy < -60 || sy > VIEW_H + 60) continue;
      const pulse = 0.5 + 0.5 * Math.sin((performance.now() - sw.startedAt) / 400);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(200, 200, 255, ${0.08 + pulse * 0.1})`;
      ctx.fillRect(sx, sy, ow.tile, ow.tile);
      // Внутренний контур
      ctx.strokeStyle = `rgba(255, 240, 180, ${0.15 + pulse * 0.15})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + 6, sy + 6, ow.tile - 12, ow.tile - 12);
      ctx.restore();
    }
  }

  // Трупы
  for (let c of corpses) {
    const sx = c.x - cam.x, sy = c.y - cam.y;
    if (sx < -50 || sx > VIEW_W + 50 || sy < -50 || sy > VIEW_H + 50) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.life * 1.2);
    ctx.fillStyle = 'rgba(60, 10, 10, 0.5)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 5, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200, 190, 170, 0.6)';
    ctx.fillRect(sx - 8, sy, 4, 1.5);
    ctx.fillRect(sx - 2, sy - 1, 4, 1.5);
    ctx.fillRect(sx + 5, sy + 1, 4, 1.5);
    ctx.fillStyle = 'rgba(80, 40, 40, 0.5)';
    ctx.beginPath(); ctx.arc(sx - 3, sy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  for (let f of footprints) {
    const sx = f.x - cam.x, sy = f.y - cam.y;
    if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) continue;
    ctx.save(); 
    ctx.globalAlpha = f.life * 0.4; 
    ctx.fillStyle = isLowHp ? '#8b0000' : '#000';
    ctx.beginPath(); ctx.ellipse(sx, sy, 4, 2, f.angle, 0, Math.PI * 2); ctx.fill(); 
    ctx.restore();
  }

  const p = ow.player; nearNpc = null;
  const now = performance.now();
  let pLungeX = 0, pLungeY = 0;
  if (ow.combat && ow.combat.turn === 'player' && ow.combat.lastPlayerAction) {
    const pulse = Math.sin(now / 50);
    if (pulse > 0) pLungeX = 5;
  }
  const heroKeys = ow.keys || {};
  const heroMoving = !ow.combat && !ow.defeated && !!(heroKeys.w || heroKeys.a || heroKeys.s || heroKeys.d || heroKeys.arrowup || heroKeys.arrowdown || heroKeys.arrowleft || heroKeys.arrowright);

  const activeMission = getActiveCampaignMission(state.game.player);
  const missionLocationId = activeMission?.mission.locationId || activeMission?.act.locationId;
  const questEnemyId = activeMission && missionLocationId === (ow.sourceLocationId || ow.locationId)
    ? activeMission.mission.enemyId
    : null;
  const depthItems = buildDepthItems(ow);

  for (const entry of depthItems) {
    const item = entry.item;
    const sx = item.x - cam.x, sy = item.y - cam.y;
    if (sx < -90 || sx > VIEW_W + 90 || sy < -90 || sy > VIEW_H + 90) continue;
    if (entry.kind === 'chest') {
      if (item.opened) continue;
      ctx.fillStyle = theme.shadow; ctx.beginPath(); ctx.ellipse(sx, sy + 8, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
      if (!drawAtlasProp(ctx, 0, sx - 24, sy - 24, 48, 48)) {
        ctx.fillStyle = '#3a2010'; ctx.fillRect(sx - 14, sy - 4, 28, 16); ctx.strokeRect(sx - 14, sy - 4, 28, 16);
        ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.arc(sx, sy - 4, 14, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffcc00'; ctx.fillRect(sx - 3, sy + 2, 6, 6);
      }
      ctx.shadowBlur = 10; ctx.shadowColor = '#ffcc00'; ctx.fillStyle = 'rgba(255, 204, 0, 0.4)'; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    } else if (entry.kind === 'static' || entry.kind === 'npc') {
      const dist = Math.hypot(item.x - p.x, item.y - p.y);
      if (!item.decorative && dist < (item.interactionRadius || 60) && !ow.combat) {
        nearNpc = item;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.beginPath(); ctx.arc(sx, sy, 32, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (ow.locationId === 'village' && (item.buildingStyle || item.natureStyle || item.propStyle)) {
        drawAuroraContactShadow(ctx, item, sx, sy);
      }
      drawStatic(ctx, item, sx, sy, theme.shadow);
      if (entry.kind === 'npc' || !item.decorative) {
        ctx.font = 'bold 11px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3; ctx.strokeStyle = '#000';
        ctx.strokeText(item.name, sx, sy - 30);
        ctx.fillStyle = '#d4c8a8'; ctx.fillText(item.name, sx, sy - 30);
      }
    } else if (entry.kind === 'event') {
      const dist = Math.hypot(item.x - p.x, item.y - p.y);
      if (dist < item.interactionRadius && !ow.combat) {
        nearNpc = item;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.beginPath(); ctx.arc(sx, sy, 32, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)'; ctx.lineWidth = 2; ctx.stroke();
      }
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
      ctx.fillStyle = `rgba(255, 215, 0, ${0.1 + pulse * 0.15})`;
      ctx.beginPath(); ctx.arc(sx, sy, 24 + pulse * 4, 0, Math.PI * 2); ctx.fill();
      const eventPropIndex = getEventPropIndex(item.eventType, ow.theme || ow.locationId);
      if (eventPropIndex < 0 || !drawAtlasProp(ctx, eventPropIndex, sx - 24, sy - 24, 48, 48)) {
        drawStatic(ctx, item, sx, sy, theme.shadow);
      }
      ctx.font = 'bold 11px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(item.name, sx, sy - 24);
      ctx.fillStyle = '#ffd060'; ctx.fillText(item.name, sx, sy - 24);
    } else if (entry.kind === 'enemy') {
      const enemyDef = ENEMIES[item.enemyId];
      const distToPlayer = Math.hypot(item.x - p.x, item.y - p.y);
      if (questEnemyId && item.enemyId === questEnemyId) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 300);
        ctx.fillStyle = `rgba(180,60,255,${0.15 + pulse * 0.2})`;
        ctx.beginPath(); ctx.arc(sx, sy, 34 + pulse * 5, 0, Math.PI * 2); ctx.fill();
      }
      if (item.state === 'chase') {
        ctx.fillStyle = 'rgba(255,60,60,0.1)';
        ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
      }
      let enemyLungeX = 0;
      if (ow.combat && ow.combat.enemy === item && ow.combat.turn === 'enemy') {
        enemyLungeX = Math.cos(now / 50) * 5;
      }
      drawEnemyByType(ctx, item, sx + enemyLungeX, sy, theme.shadow);
      if (enemyDef) {
        const hpPct = item.hp / item.maxHp;
        ctx.fillStyle = '#330000'; ctx.fillRect(sx - 20, sy - 40, 40, 5);
        ctx.fillStyle = hpPct > 0.5 ? '#30cc30' : hpPct > 0.25 ? '#ccaa00' : '#cc3030';
        ctx.fillRect(sx - 20, sy - 40, 40 * hpPct, 5);
        ctx.font = '10px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#ddd';
        ctx.fillText(enemyDef.name, sx, sy - 43);
        if (distToPlayer < 300) {
          const label = item.boss ? '☠ ' + enemyDef.name : item.elite ? '★ ' + enemyDef.name : enemyDef.name;
          const labelY = sy - (item.boss ? 55 : item.elite ? 45 : 32);
          ctx.font = 'bold 11px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.lineWidth = 3; ctx.strokeStyle = '#000';
          ctx.strokeText(label, sx, labelY);
          ctx.fillStyle = item.boss ? '#b060ff' : item.elite ? '#ffd060' : '#d4c8a8';
          ctx.fillText(label, sx, labelY);
        }
      }
    } else if (entry.kind === 'player') {
      drawPlayerByClass(ctx, sx + pLungeX, sy + pLungeY, state.game.player.class, theme.shadow, heroMoving);
    }
  }

  for (const e of ow.enemies) {
    if (e.dead) {
      if (!e._hasExploded) {
        e._hasExploded = true;
        const isBoss = e.boss;
        const count = isBoss ? 30 : 15;
        const color = isBoss ? '#b060ff' : e.elite ? '#ffa500' : '#d63030';
        for (let i = 0; i < count; i++) {
          deathParticles.push({
            x: e.x, y: e.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 2,
            size: Math.random() * 4 + 2,
            color: color, life: 1.0
          });
        }
        if (corpses.length < 20) {
          corpses.push({ x: e.x, y: e.y, life: 1.0, boss: isBoss, elite: e.elite, enemyId: e.enemyId });
        }
      }
      continue;
    }
    
    const sx = e.x - cam.x, sy = e.y - cam.y;
    if (sx < -50 || sx > VIEW_W + 50 || sy < -50 || sy > VIEW_H + 50) continue;

  }

  for (let p of deathParticles) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8; ctx.shadowColor = p.color;
    ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const px = p.x - cam.x, py = p.y - cam.y;
  const bw = 50;
  ctx.fillStyle = '#05020a'; ctx.fillRect(px - bw / 2, py - 42, bw, 4); ctx.fillRect(px - bw / 2, py - 36, bw, 3);
  ctx.fillStyle = isLowHp ? `rgba(220, 40, 40, ${0.75 + 0.25 * Math.sin(performance.now() / 200)})` : '#d63030'; 
  ctx.fillRect(px - bw / 2, py - 42, bw * (p.hp / p.maxHp), 4);
  ctx.fillStyle = state.game.player.class === 'warrior' ? '#d000ff' : '#3060d6';
  ctx.fillRect(px - bw / 2, py - 36, bw * (p.mp / p.maxMp), 3);

  // Подсказка про E
  if (!ow.combat && ow.secretWalls) {
    for (const sw of ow.secretWalls) {
      if (sw.opened) continue;
      const dist = Math.hypot(sw.wx - p.x, sw.wy - p.y);
      if (dist < ow.tile * 1.6) {
        const hx = sw.wx - cam.x, hy = sw.wy - cam.y;
        ctx.font = 'bold 13px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        const txt = '[E] Открыть';
        ctx.strokeText(txt, hx, hy - 46);
        ctx.fillStyle = '#ffd060';
        ctx.fillText(txt, hx, hy - 46);
      }
    }
  }

  for (const part of ow.particles || []) {
    const sx = part.x - cam.x, sy = part.y - cam.y;
    if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + 20) continue;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, part.life / part.maxLife)); ctx.fillStyle = part.color;
    ctx.shadowBlur = 8; ctx.shadowColor = part.color; ctx.beginPath(); ctx.arc(sx, sy, part.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  for (const fn of (settings.damageNumbers === false ? [] : (ow.floatingNumbers || []))) {
    const sx = fn.x - cam.x, sy = fn.y - cam.y;
    const bounce = Math.sin(fn.life * Math.PI) * 15;
    ctx.save(); 
    ctx.globalAlpha = Math.max(0, Math.min(1, fn.life)); 
    ctx.font = 'bold 22px Montserrat, sans-serif'; 
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
    ctx.fillStyle = fn.type === 'heal' ? '#60ff60' : fn.type === 'crit' ? '#ffd060' : '#ff4040'; 
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; 
    ctx.strokeText(fn.text, sx, sy - bounce); 
    ctx.fillText(fn.text, sx, sy - bounce); 
    ctx.restore();
    
    if (fn.type === 'damage' || fn.text.startsWith('-')) {
      hurtFlash = 1.0;
      if (bloodSplats.length < 8) {
        for (let i = 0; i < 2; i++) {
          const pos = edgeSpawn();
          bloodSplats.push({
            x: pos.x, y: pos.y,
            size: 3 + Math.random() * 4,
            life: 0.5 + Math.random() * 0.3,
            rotation: Math.random() * Math.PI * 2
          });
        }
      }
    }
  }

  if (ow.combat) {
    const e = ow.combat.enemy; const ex = e.x - cam.x, ey = e.y - cam.y;
    ctx.strokeStyle = 'rgba(201,162,39,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
  }

  if (!reduceMotion && settings.bloomEffects !== false && graphicsQuality === 'high' && ow.locationId !== 'village') drawBloom(ctx);

  const dayPhase = (worldTime % 120) / 120;
  let nightAlpha = 0;
  let nightColor = 'rgba(10, 20, 50, ';

  if (dayPhase > 0.3 && dayPhase < 0.5) {
    const t = (dayPhase - 0.3) / 0.2;
    nightAlpha = t * 0.4;
    nightColor = `rgba(80, 20, 0, `;
  } else if (dayPhase >= 0.5 && dayPhase < 0.8) {
    nightAlpha = 0.5;
    nightColor = `rgba(10, 20, 50, `;
  } else if (dayPhase >= 0.8 && dayPhase < 1.0) {
    const t = (dayPhase - 0.8) / 0.2;
    nightAlpha = (1 - t) * 0.5;
    nightColor = `rgba(50, 20, 50, `;
  }

  if (nightAlpha > 0 && ow.locationId !== 'library') {
    const villageNightAlpha = ow.locationId === 'village' ? nightAlpha * 0.2 : nightAlpha;
    ctx.fillStyle = nightColor + villageNightAlpha + ')';
    ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  }

  const villageFogScale = ow.locationId === 'village' ? 0.38 : (graphicsQuality === 'balanced' ? 0.72 : 1);
  const fogIntensity = !allowAmbientFog || ow.locationId === 'village' ? 0 : (ow.combat ? 0.2 : theme.fog * villageFogScale);
  if (fogIntensity > 0) {
    if (!darknessCanvas) {
      darknessCanvas = document.createElement('canvas');
      darknessCanvas.width = VIEW_W; darknessCanvas.height = VIEW_H;
      darknessCtx = darknessCanvas.getContext('2d', { alpha: true });
    }
    const fogCanvas = darknessCanvas;
    const fctx = darknessCtx;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
    fctx.globalAlpha = 1;
    fctx.clearRect(0, 0, VIEW_W, VIEW_H);
    fctx.fillStyle = `rgba(0,0,0,${fogIntensity})`;
    fctx.fillRect(0, 0, VIEW_W, VIEW_H);

    fctx.globalCompositeOperation = 'destination-out';
    let lightGrad = fctx.createRadialGradient(px, py, 12, px, py, 190);
    lightGrad.addColorStop(0, 'rgba(0,0,0,1)');
    lightGrad.addColorStop(0.42, 'rgba(0,0,0,0.82)');
    lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = lightGrad; fctx.beginPath(); fctx.arc(px, py, 180, 0, Math.PI * 2); fctx.fill();

    // Aurora's street lanterns and braziers cast compact, pixel-stepped pools.
    // The cut-outs are made from flat rectangles (no blur or gradients), and
    // remain limited to the village so other biome lighting is untouched.
    if (ow.locationId === 'village') {
      for (const source of ow.statics || []) {
        const style = source.propStyle;
        if (style !== 'lantern' && style !== 'brazier') continue;
        const lx = Math.round(source.x - cam.x);
        const ly = Math.round(source.y - cam.y);
        if (lx < -100 || lx > VIEW_W + 100 || ly < -100 || ly > VIEW_H + 100) continue;
        const radius = style === 'brazier' ? 58 : 46;
        fctx.fillStyle = '#fff';
        fctx.globalAlpha = 0.12;
        fctx.fillRect(lx - radius, ly - 18, radius * 2, 36);
        fctx.fillRect(lx - radius + 10, ly - 28, radius * 2 - 20, 56);
        fctx.globalAlpha = 0.18;
        fctx.fillRect(lx - 26, ly - 22, 52, 44);
        fctx.globalAlpha = 0.24;
        fctx.fillRect(lx - 14, ly - 14, 28, 28);
        fctx.globalAlpha = 0.34;
        fctx.fillRect(lx - 6, ly - 6, 12, 12);
        fctx.globalAlpha = 1;
      }
    }

    // Секретные стены подсвечивают вокруг себя маленькую зону (только когда близко)
    if (!ow.combat && ow.secretWalls) {
      for (const sw of ow.secretWalls) {
        if (sw.opened) continue;
        const dist = Math.hypot(sw.wx - p.x, sw.wy - p.y);
        if (dist < ow.tile * 3) {
          const cx = sw.wx - cam.x, cy = sw.wy - cam.y;
          const grad2 = fctx.createRadialGradient(cx, cy, 5, cx, cy, 50);
          grad2.addColorStop(0, 'rgba(0,0,0,0.6)');
          grad2.addColorStop(1, 'rgba(0,0,0,0)');
          fctx.fillStyle = grad2; fctx.beginPath(); fctx.arc(cx, cy, 50, 0, Math.PI * 2); fctx.fill();
        }
      }
    }

    for (const c of ow.chests) {
      if (c.opened) continue;
      const cx = c.x - cam.x, cy = c.y - cam.y;
      if (cx < -200 || cx > VIEW_W + 200 || cy < -200 || cy > VIEW_H + 200) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now / 300);
      lightGrad = fctx.createRadialGradient(cx, cy, 10, cx, cy, 80 + pulse * 20);
      lightGrad.addColorStop(0, 'rgba(0,0,0,0.8)'); lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = lightGrad; fctx.beginPath(); fctx.arc(cx, cy, 100, 0, Math.PI * 2); fctx.fill();
    }

    for (const ev of ow.events || []) {
      const ex = ev.x - cam.x, ey = ev.y - cam.y;
      if (ex < -200 || ex > VIEW_W + 200 || ey < -200 || ey > VIEW_H + 200) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now / 200);
      lightGrad = fctx.createRadialGradient(ex, ey, 20, ex, ey, 120 + pulse * 30);
      lightGrad.addColorStop(0, 'rgba(0,0,0,0.9)'); lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = lightGrad; fctx.beginPath(); fctx.arc(ex, ey, 150, 0, Math.PI * 2); fctx.fill();
    }
    ctx.drawImage(fogCanvas, 0, 0);

    // Subtle warm/cool bounce at the edge of the hero light keeps the scene readable.
    const glowColor = state.game.player.class === 'mage' ? '100, 185, 255' : '220, 164, 92';
    const edgeGlow = ctx.createRadialGradient(px, py, 42, px, py, 150);
    edgeGlow.addColorStop(0, `rgba(${glowColor}, 0)`);
    edgeGlow.addColorStop(0.72, `rgba(${glowColor}, 0.035)`);
    edgeGlow.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = edgeGlow;
    ctx.fillRect(px - 150, py - 150, 300, 300);
  }

  // Aurora uses flat, stepped light pools instead of radial fog/bloom so
  // its 16-bit scenery stays crisp and readable at every display scale.
  if (ow.locationId === 'village' && allowAmbientFog) {
    for (const source of ow.statics || []) {
      if (source.propStyle !== 'lantern' && source.propStyle !== 'brazier') continue;
      const lx = Math.round(source.x - cam.x);
      const ly = Math.round(source.y - cam.y);
      if (lx < -100 || lx > VIEW_W + 100 || ly < -100 || ly > VIEW_H + 100) continue;
      const radius = source.propStyle === 'brazier' ? 58 : 46;
      ctx.save();
      ctx.fillStyle = '#f4cf83';
      ctx.globalAlpha = 0.055;
      ctx.fillRect(lx - radius, ly - 8, radius * 2, 16);
      ctx.globalAlpha = 0.075;
      ctx.fillRect(lx - radius + 8, ly - 15, radius * 2 - 16, 30);
      ctx.globalAlpha = 0.11;
      ctx.fillRect(lx - 12, ly - 22, 24, 44);
      ctx.restore();
    }
  }

  if (!reduceMotion) {
    if (allowWeather) drawWeather(ctx);
    if (allowAmbientFog) {
      drawFireflies(ctx, worldTime);
      // Aurora keeps a clean pixel-art silhouette; drifting soft fog belongs to other biomes.
      if (ow.locationId !== 'village') drawFogLayers(ctx);
    }
  }

  if (getLightningFlash() > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${getLightningFlash() * 0.5})`;
    ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  }

  if (theme.tint) {
    ctx.fillStyle = theme.tint;
    ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  }

  if (ow.locationId !== 'village') {
    const gradient = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 150, VIEW_W / 2, VIEW_H / 2, 500);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${theme.vignette || 0.4})`);
    ctx.fillStyle = gradient; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  }

  if (isLowHp && showLowHealth) {
    const pulse = 0.06 + 0.04 * Math.sin(lowHpPulse * 2);
    const hurtGrad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 200, VIEW_W / 2, VIEW_H / 2, 450);
    hurtGrad.addColorStop(0, 'rgba(255,0,0,0)');
    hurtGrad.addColorStop(1, `rgba(200,0,0,${pulse})`);
    ctx.fillStyle = hurtGrad; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  }

  if (hurtFlash > 0) {
    const hurtGrad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 250, VIEW_W / 2, VIEW_H / 2, 450);
    hurtGrad.addColorStop(0, 'rgba(255,0,0,0)');
    hurtGrad.addColorStop(1, `rgba(200,0,0,${hurtFlash * 0.12})`);
    ctx.fillStyle = hurtGrad; ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  }

  if (allowShake && ow.shake && ow.shake.t > 0 && ow.combat) {
    let targetX, targetY, color;
    if (ow.shake.mag === 8) { targetX = ow.combat.enemy.x - cam.x; targetY = ow.combat.enemy.y - cam.y; color = '#ffd060'; }
    else if (ow.shake.mag === 5) { targetX = ow.player.x - cam.x; targetY = ow.player.y - cam.y; color = '#ff4040'; }
    if (color) {
      const radius = 60 * (1 - (ow.shake.t / 0.3)); const flashGrad = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, radius + 20);
      flashGrad.addColorStop(0, color); flashGrad.addColorStop(0.5, color + '80'); flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = flashGrad; ctx.beginPath(); ctx.arc(targetX, targetY, radius + 20, 0, Math.PI * 2); ctx.fill();
    }
  }

  for (let b of bloodSplats) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, b.life);
    ctx.fillStyle = '#6a0000';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.size * 0.9, b.y + b.size * 0.5, b.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const stats = getEffStats();
  drawHud(ctx, p, stats, state.game.player.class);
  ctx.restore();

  drawMinimap(ctx, ow);
  if (settings.showFps === true) {
    ctx.save();
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(8,12,18,0.78)';
    ctx.fillRect(VIEW_W - 76, VIEW_H - 28, 64, 20);
    ctx.fillStyle = fpsNow >= 50 ? '#8ee6a1' : fpsNow >= 30 ? '#f0d27b' : '#ff8e8e';
    ctx.fillText(`${fpsNow} FPS`, VIEW_W - 18, VIEW_H - 24);
    ctx.restore();
  }
  const autosaveNow = performance.now();
  const autosaveLabel = autosaveErrorAt && autosaveNow - autosaveErrorAt < 2500
    ? '⚠ ошибка сохранения'
    : autosaveSavedAt && autosaveNow - autosaveSavedAt < 1500
      ? '💾 сохранено'
      : '';
  if (autosaveLabel) {
    ctx.font = 'bold 12px Montserrat, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    ctx.strokeText(autosaveLabel, 12, VIEW_H - 12);
    ctx.fillStyle = autosaveLabel.startsWith('⚠') ? 'rgba(255,110,110,0.95)' : 'rgba(96,255,96,0.9)';
    ctx.fillText(autosaveLabel, 12, VIEW_H - 12);
  }
}

export function renderNpcPanel() {
  const panel = document.getElementById('npc-panel');
  if (!panel) return;
  const ow = state.overworld;
  if (!ow || ow.combat || !nearNpc || paused) { panel.style.display = 'none'; lastNpcKey = ''; return; }
  const key = nearNpc.id;
  if (key === lastNpcKey) return;
  lastNpcKey = key;
  panel.style.display = 'block';

  const isEvent = !!nearNpc.isEvent;
  const safeName = escapeHtml(nearNpc.name);
  const safeDescription = isEvent ? escapeHtml(nearNpc.description || '') : '';
  const infoText = isEvent
    ? `<b style="color:#ffd060;">✨ ${safeName}</b> — вы нашли что-то интересное.${safeDescription ? `<div style="margin-top:6px;color:#d8c9a8;">${safeDescription}</div>` : ''}`
    : `<b style="color:#c9a227;">${safeName}</b> — вы подошли к объекту. Выберите действие:`;
  const info = document.getElementById('npc-panel-info');
  if (info) info.innerHTML = infoText;

  const actions = document.getElementById('npc-panel-actions');
  if (!actions) return;
  const btnStyle = isEvent ? 'background:linear-gradient(180deg,#8a6a1a,#4a2a0a);border-color:#ffd060;' : 'background:linear-gradient(180deg,#2a5a3a,#1b3a2a);border-color:#60ff60;';
  const btnLabel = isEvent ? '✨ Исследовать' : '💬 Взаимодействовать';
  actions.innerHTML = `<button type="button" style="${btnStyle}">${btnLabel}</button>`;
  const button = actions.querySelector('button');
  if (button) button.addEventListener('click', () => GameAPI.interactNpc(nearNpc.id));
}

function drawMinimap(ctx, ow) {
  const size = 140, pad = 8, x0 = VIEW_W - size - pad, y0 = pad;
  const mapW = ow.cols * ow.tile, mapH = ow.rows * ow.tile; const scaleX = size / mapW, scaleY = size / mapH;
  ctx.fillStyle = 'rgba(10,6,18,0.82)'; ctx.fillRect(x0, y0, size, size);
  const theme = getTheme(ow.theme);
  ctx.fillStyle = theme.colors[0] || '#2a4a2a'; ctx.globalAlpha = 0.3; ctx.fillRect(x0, y0, size, size); ctx.globalAlpha = 1.0;
  for (const e of ow.enemies) { if (e.dead) continue; const sx = x0 + e.x * scaleX, sy = y0 + e.y * scaleY; ctx.fillStyle = e.boss ? '#b060ff' : e.elite ? '#ffa500' : '#ff4040'; const s = e.boss ? 5 : e.elite ? 4 : 2; ctx.fillRect(sx - s / 2, sy - s / 2, s, s); }
  for (const c of ow.chests) { if (c.opened) continue; const sx = x0 + c.x * scaleX, sy = y0 + c.y * scaleY; ctx.fillStyle = '#ffd060'; ctx.fillRect(sx - 1, sy - 1, 2, 2); }
  for (const n of ow.npcs || []) { const sx = x0 + n.x * scaleX, sy = y0 + n.y * scaleY; ctx.fillStyle = '#60ff60'; ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); }
  for (const o of ow.statics || []) { const sx = x0 + o.x * scaleX, sy = y0 + o.y * scaleY; ctx.fillStyle = '#ffa500'; ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); }
  for (const ev of ow.events || []) { const sx = x0 + ev.x * scaleX, sy = y0 + ev.y * scaleY; ctx.fillStyle = '#ffd060'; ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); }
  // Секретные стены на миникарте НЕ отображаются
  const camSx = x0 + ow.camera.x * scaleX, camSy = y0 + ow.camera.y * scaleY; const camW = VIEW_W * scaleX, camH = VIEW_H * scaleY;
  ctx.strokeStyle = 'rgba(201,162,39,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(camSx, camSy, camW, camH);
  const px = x0 + ow.player.x * scaleX, py = y0 + ow.player.y * scaleY; ctx.fillStyle = '#60ff60'; ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, size, size);
}

export function onCanvasMouseMove(e) {
  const ow = state.overworld;
  if (!ow || !ow.active || paused || ow.combat || ow.defeated) { hideMapTooltip(); return; }
  const canvas = e.currentTarget; const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX + ow.camera.x, my = (e.clientY - rect.top) * scaleY + ow.camera.y;
  let hovered = null;
  for (const en of ow.enemies) { if (en.dead) continue; if (Math.hypot(en.x - mx, en.y - my) < 28) { hovered = en; break; } }
  if (!hovered) { hideMapTooltip(); return; }
  showMapTooltip(e.clientX, e.clientY, hovered);
}

function showMapTooltip(cx, cy, enemy) {
  const def = ENEMIES[enemy?.enemyId];
  if (!def) { hideMapTooltip(); return; }
  const modName = enemy.modifier ? ` (${escapeHtml(MOD_LABEL[enemy.modifier] || enemy.modifier)})` : '';
  const nameColor = enemy.boss ? '#b060ff' : enemy.elite ? '#ffd060' : '#c9a227';
  const prefix = enemy.boss ? '☠ ' : enemy.elite ? '★ ' : '';
  let html = `<div class="map-tt-name" style="color:${nameColor};">${prefix}${escapeHtml(def.name)}${modName}</div>`;
  html += `<div class="map-tt-row">❤️ HP: ${escapeHtml(enemy.hp)}/${escapeHtml(enemy.maxHp)}</div><div class="map-tt-row">⚔️ Атака: ${escapeHtml(def.attack)}</div><div class="map-tt-row">🛡️ Защита: ${escapeHtml(def.defense)}</div>`;
  if (enemy.elite) html += `<div class="map-tt-row" style="color:#ffd060;">★ Элитный (HP×1.5, атака×1.3)</div>`;
  if (enemy.boss) html += `<div class="map-tt-row" style="color:#b060ff;">☠ Мини-босс</div>`;
  if (def.special) html += `<div class="map-tt-row" style="color:#ffa500;">⚠️ ${escapeHtml(def.special.name)} (кажд. ${escapeHtml(def.special.every)} х.)</div>`;
  if (!mapTooltipEl) { mapTooltipEl = document.createElement('div'); mapTooltipEl.id = 'map-tooltip'; mapTooltipEl.className = 'map-tooltip'; document.body.appendChild(mapTooltipEl); }
  mapTooltipEl.innerHTML = html;
  const pad = 16; let x = cx + pad, y = cy + pad; const rect = mapTooltipEl.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 10) x = cx - rect.width - pad; if (y + rect.height > window.innerHeight - 10) y = cy - rect.height - pad; if (x < 10) x = 10; if (y < 10) y = 10;
  mapTooltipEl.style.left = x + 'px'; mapTooltipEl.style.top = y + 'px';
}

export function hideMapTooltip() { if (mapTooltipEl) { mapTooltipEl.remove(); mapTooltipEl = null; } }

export function openPauseMenu() {
  if (document.getElementById('pause-overlay')) return;
  paused = true; hideMapTooltip();
  pauseReturnFocus = document.activeElement?.nodeType === 1 ? document.activeElement : null;
  const div = document.createElement('div');
  div.id = 'pause-overlay';
  div.className = 'pause-overlay';
  div.innerHTML = `<div class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title" tabindex="-1"><h2 id="pause-title">⏸️ Пауза</h2><button type="button" data-pause-action="owPauseResume">▶️ Продолжить</button><button type="button" data-pause-action="owPauseSaveVillage">💾 Сохранить и в деревню</button><button type="button" data-pause-action="owPauseExit">🚪 Сохранить и в меню</button></div>`;
  div.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...div.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !div.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  div.addEventListener('click', event => {
    const button = event.target.closest('[data-pause-action]');
    if (!button || !div.contains(button)) return;
    const action = button.dataset.pauseAction;
    if (!['owPauseResume', 'owPauseSaveVillage', 'owPauseExit'].includes(action)) return;
    globalThis.GameAPI?.[action]?.();
  });
  document.body.appendChild(div);
  (div.querySelector('button:not(:disabled)') || div.querySelector('[role="dialog"]'))?.focus();
}

export function closePauseMenu() {
  const el = document.getElementById('pause-overlay');
  if (el) el.remove();
  paused = false;
  if (pauseReturnFocus?.isConnected) pauseReturnFocus.focus();
  pauseReturnFocus = null;
}

// Сброс визуального состояния при входе в локацию
export function initWeather(themeName) {
  footprints = []; deathParticles = []; hurtFlash = 0; worldTime = 0; bloodSplats = []; lowHpPulse = 0;
  corpses = []; lastTileKey = null; tileDamageTimer = 0;
  _weatherEffectApplied = null; nearNpc = null;
  hideMapTooltip();
  initWeatherFx(themeName);
}

export function start() { if (!rafId) { lastTs = performance.now(); rafId = requestAnimationFrame(tick); } }
export function isPaused() { return paused; }
export function setPaused(v) { paused = v; }
export function setLastNpcKey(k) { lastNpcKey = k; }

// HUD в стиле «осколков»: срезанные углы, тонкие бары, пипсы осколков
function drawHud(ctx, p, stats, pClass) {
  const x = 12, y = 12, w = 292, h = 142;
  const clampRatio = (value, max) => max > 0
    ? Math.max(0, Math.min(1, (Number(value) || 0) / max))
    : 0;
  const hpRatio = clampRatio(p.hp, p.maxHp);
  const resourceRatio = clampRatio(p.mp, p.maxMp);
  const expRatio = clampRatio(p.exp, p.expNext);
  const isRage = pClass === 'warrior';
  const resourceLabel = isRage ? 'ЯРОСТЬ' : pClass === 'archer' ? 'ФОКУС' : 'МАНА';
  const classLabels = {
    warrior: 'ВОИН', mage: 'МАГ', archer: 'ЛУЧНИК', priest: 'ЖРЕЦ'
  };
  const name = String(p.name || 'Путник').slice(0, 18);
  const level = Math.max(1, Number(p.level) || 1);
  const gold = Math.max(0, Number(p.gold) || 0);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Compact 16-bit status frame: flat fills, stepped borders, no glow or gradients.
  ctx.fillStyle = '#080d13';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#111b25';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = '#40566a';
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = '#e6c36d';
  ctx.fillRect(x + 5, y + 5, 5, 2);
  ctx.fillRect(x + w - 10, y + 5, 5, 2);
  ctx.fillRect(x + 5, y + h - 7, 5, 2);
  ctx.fillRect(x + w - 10, y + h - 7, 5, 2);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#eee5d0';
  ctx.fillText(name, x + 12, y + 16);
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#e6c36d';
  ctx.fillText(classLabels[pClass] || 'ГЕРОЙ', x + 12, y + 29);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe7a7';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`УР. ${level}`, x + w - 12, y + 15);
  ctx.fillStyle = '#c8b987';
  ctx.font = '9px monospace';
  ctx.fillText(`◆ ${gold.toLocaleString('ru-RU')}`, x + w - 12, y + 29);

  const drawBar = (label, value, max, ratio, top, fill, track) => {
    const bx = x + 12, by = y + top, bw = w - 24, bh = 13;
    ctx.fillStyle = '#080d13';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = track;
    ctx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
    const fillWidth = Math.round((bw - 2) * ratio);
    if (fillWidth > 0) {
      ctx.fillStyle = fill;
      ctx.fillRect(bx + 1, by + 1, fillWidth, bh - 2);
    }
    ctx.fillStyle = '#40566a';
    ctx.strokeStyle = '#40566a';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    // Small pixel divisions make resource levels readable at a glance.
    for (let i = 1; i < 10; i++) {
      const sx = bx + Math.round((bw / 10) * i);
      ctx.fillStyle = 'rgba(8,13,19,0.55)';
      ctx.fillRect(sx, by + 1, 1, bh - 2);
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 8px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff1d2';
    ctx.fillText(label, bx + 5, by + bh / 2);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.max(0, Number(value) || 0)} / ${Math.max(0, Number(max) || 0)}`, bx + bw - 5, by + bh / 2);
  };

  drawBar('ЗДОРОВЬЕ', p.hp, p.maxHp, hpRatio, 39, '#b83b43', '#351820');
  drawBar(resourceLabel, p.mp, p.maxMp, resourceRatio, 56,
    isRage ? '#a34b9b' : pClass === 'archer' ? '#4c9b78' : '#3978b8',
    isRage ? '#30172f' : '#14263a');
  drawBar('ОПЫТ', p.exp, p.expNext, expRatio, 73, '#c7a34e', '#302817');

  const statY = y + 101;
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#e6c36d';
  ctx.fillText(`⚔ ${Math.round(stats.atk || 0)}`, x + 12, statY);
  ctx.fillStyle = '#a8c5d7';
  ctx.fillText(`🛡 ${Math.round(stats.def || 0)}`, x + 82, statY);
  ctx.fillStyle = '#b9a0df';
  ctx.fillText(`✦ ${Math.round(stats.mag || 0)}`, x + 152, statY);

  const shards = state.game?.storyShards || {};
  const shardCount = ['flame', 'ice', 'blood'].filter(id => shards[id] === true).length;
  ctx.textAlign = 'right';
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#c8b987';
  ctx.fillText(`ОСКОЛКИ ${shardCount}/3`, x + w - 12, statY);

  ctx.restore();
}