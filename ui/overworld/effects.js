import { state } from '../../systems/state.js';

export const VIEW_W = 800, VIEW_H = 500;

let weatherParticles = [];

let fireflies = [];

let fogLayers = [];
// Reusable pre-rendered fog sprites: radial gradients are expensive to rebuild every frame.
let fogSpriteCache = [];

let lightning = { timer: 0, flash: 0 };

let bloomCanvas = null, bloomCtx = null;

export const THEMES = {
  default:   { colors: { 0: '#0c1a1c', 1: '#22323a', 2: '#071014', 3: '#0c2230', 4: '#22303a' }, vignette: 0.7, shadow: 'rgba(0,0,0,0.55)', fog: 0.88, weather: 'none', tint: 'rgba(30, 90, 100, 0.16)' },
  village:   { colors: { 0: '#1b2b29', 1: '#51483c', 2: '#2a2420', 3: '#1b3a4a', 4: '#3d4a45' }, vignette: 0.26, shadow: 'rgba(0,0,0,0.4)', fog: 0.38, weather: 'ash', tint: 'rgba(190, 150, 112, 0.09)' },
  forest:    { colors: { 0: '#08140f', 1: '#18241a', 2: '#040a08', 3: '#0a2230', 4: '#141f19' }, vignette: 0.75, shadow: 'rgba(0,0,0,0.6)', fog: 0.9, weather: 'rain', tint: 'rgba(20, 80, 60, 0.2)' },
  ruins:     { colors: { 0: '#1c2028', 1: '#2e3440', 2: '#10141c', 3: '#1c2c3c', 4: '#3a404a' }, vignette: 0.68, shadow: 'rgba(0,0,0,0.55)', fog: 0.85, weather: 'none', tint: 'rgba(70, 90, 120, 0.12)' },
  shadow:    { colors: { 0: '#08040e', 1: '#181028', 2: '#040208', 3: '#22103a', 4: '#14101c' }, vignette: 0.95, shadow: 'rgba(0,0,0,0.9)', fog: 0.98, weather: 'ash', tint: 'rgba(90, 40, 120, 0.22)' },
  swamp:     { colors: { 0: '#101a12', 1: '#20281a', 2: '#0a120c', 3: '#16303a', 4: '#1a2018' }, vignette: 0.85, shadow: 'rgba(0,0,0,0.7)', fog: 0.92, weather: 'rain', tint: 'rgba(50, 80, 40, 0.2)' },
  graveyard: { colors: { 0: '#0a0c18', 1: '#262a3e', 2: '#05060e', 3: '#161a2e', 4: '#2e3244' }, vignette: 0.9, shadow: 'rgba(0,0,0,0.8)', fog: 0.95, weather: 'none', tint: 'rgba(50, 50, 110, 0.22)' },
  volcano:   { colors: { 0: '#140806', 1: '#2a140c', 2: '#080202', 3: '#8a2a00', 4: '#1a0e0a' }, vignette: 0.75, shadow: 'rgba(0,0,0,0.6)', fog: 0.85, weather: 'embers', tint: 'rgba(140, 40, 0, 0.22)' },
  ice:       { colors: { 0: '#16283c', 1: '#33465e', 2: '#081420', 3: '#4a8aaa', 4: '#5a7288' }, vignette: 0.6, shadow: 'rgba(0,0,0,0.4)', fog: 0.8, weather: 'snow', tint: 'rgba(40, 100, 160, 0.18)' },
  desert:    { colors: { 0: '#3a3226', 1: '#4a4032', 2: '#241e16', 3: '#22506a', 4: '#332e26' }, vignette: 0.55, shadow: 'rgba(0,0,0,0.35)', fog: 0.7, weather: 'none', tint: 'rgba(190, 140, 60, 0.14)' },
  library:   { colors: { 0: '#120e24', 1: '#2a2050', 2: '#07040f', 3: '#3a1a6a', 4: '#1e1834' }, vignette: 0.85, shadow: 'rgba(0,0,0,0.7)', fog: 0.9, weather: 'none', tint: 'rgba(90, 40, 160, 0.22)' },
  dragon:    { colors: { 0: '#140808', 1: '#2a0e0e', 2: '#080202', 3: '#8a1a00', 4: '#241012' }, vignette: 0.9, shadow: 'rgba(0,0,0,0.8)', fog: 0.9, weather: 'embers', tint: 'rgba(150, 20, 10, 0.24)' },
  'briar-hollow': { colors: { 0: '#14251a', 1: '#344b32', 2: '#09140d', 3: '#536b42', 4: '#263b2a' }, vignette: 0.78, shadow: 'rgba(0,0,0,0.62)', fog: 0.93, weather: 'rain', tint: 'rgba(74, 112, 48, 0.22)' },
  'sunken-necropolis': { colors: { 0: '#17202c', 1: '#4a4a58', 2: '#090d16', 3: '#244d5a', 4: '#303545' }, vignette: 0.94, shadow: 'rgba(0,0,0,0.82)', fog: 0.97, weather: 'ash', tint: 'rgba(54, 85, 115, 0.25)' },
  'obsidian-fields': { colors: { 0: '#321b18', 1: '#665044', 2: '#160a0a', 3: '#a63812', 4: '#332523' }, vignette: 0.86, shadow: 'rgba(0,0,0,0.76)', fog: 0.86, weather: 'embers', tint: 'rgba(198, 62, 22, 0.25)' },
  'frost-citadel': { colors: { 0: '#c1d5df', 1: '#e0edf2', 2: '#35495a', 3: '#78b6d4', 4: '#8faebf' }, vignette: 0.68, shadow: 'rgba(12, 30, 48, 0.62)', fog: 0.88, weather: 'snow', tint: 'rgba(126, 190, 224, 0.24)' },
  'void-crater': { colors: { 0: '#1d132d', 1: '#39264f', 2: '#070510', 3: '#56366f', 4: '#292039' }, vignette: 0.98, shadow: 'rgba(0,0,0,0.9)', fog: 0.99, weather: 'ash', tint: 'rgba(102, 48, 148, 0.28)' }
};


export const MOD_LABEL = { poisonous: '☣️ ядовитый', armored: '🛡️ бронированный', swift: '💨 стремительный', vampiric: '🧛 вампирский', regenerating: '💚 регенерирующий', berserk: '💢 берсерк' };

export function getTheme(name) { return THEMES[name] || THEMES.default; }

function getCurrentBiome() {
  return state.overworld?.theme || state.overworld?.locationId || 'default';
}

export function getCurrentTheme() {
  return getTheme(getCurrentBiome());
}


export function initWeather(themeName) {
  weatherParticles = [];
  fireflies = [];
  fogLayers = [];
  const theme = getTheme(themeName);
  const count = theme.weather === 'none' ? 0 : 50;
  for (let i = 0; i < count; i++) {
    weatherParticles.push({
      x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
      speed: 2 + Math.random() * 4, size: Math.random() * 2 + 1, angle: Math.random() * Math.PI * 2
    });
  }

  if (['forest', 'swamp', 'briar-hollow', 'village'].includes(themeName)) {
    for (let i = 0; i < (themeName === 'village' ? 7 : 12); i++) {
      fireflies.push({
        x: Math.random() * VIEW_W, y: Math.random() * VIEW_H,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5
      });
    }
  }

  // A few warm village motes add a calm evening atmosphere without affecting gameplay.
  if (themeName === 'village') {
    for (let i = 0; i < 5; i++) {
      fireflies.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        phase: Math.random() * Math.PI * 2,
        speed: 0.12 + Math.random() * 0.18,
        warmMote: true
      });
    }
  }

  for (let i = 0; i < 3; i++) {
    fogLayers.push({
      x: Math.random() * VIEW_W,
      y: Math.random() * VIEW_H,
      speed: 0.15 + Math.random() * 0.3,
      alpha: 0.04 + Math.random() * 0.06,
      size: 300 + Math.random() * 200
    });
  }

  // Build soft fog textures once per location instead of creating three gradients every frame.
  fogSpriteCache = fogLayers.map(layer => {
    if (typeof document === 'undefined') return null;
    const diameter = Math.ceil(layer.size * 2);
    const sprite = document.createElement('canvas');
    sprite.width = diameter;
    sprite.height = diameter;
    const spriteCtx = sprite.getContext('2d');
    if (!spriteCtx) return null;
    const gradient = spriteCtx.createRadialGradient(layer.size, layer.size, 0, layer.size, layer.size, layer.size);
    gradient.addColorStop(0, 'rgba(200, 200, 220, 1)');
    gradient.addColorStop(1, 'rgba(200, 200, 220, 0)');
    spriteCtx.fillStyle = gradient;
    spriteCtx.fillRect(0, 0, diameter, diameter);
    return sprite;
  });

  if (!bloomCanvas && typeof document !== 'undefined') {
    // Bloom is optional; keep the world renderable if an offscreen context is unavailable.
    const bloomScale = 0.5;
    const candidate = document.createElement('canvas');
    candidate.width = Math.ceil(VIEW_W * bloomScale);
    candidate.height = Math.ceil(VIEW_H * bloomScale);
    const candidateContext = candidate.getContext('2d', { alpha: true });
    if (candidateContext) {
      candidateContext.setTransform(bloomScale, 0, 0, bloomScale, 0, 0);
      bloomCanvas = candidate;
      bloomCtx = candidateContext;
    } else {
      bloomCanvas = null;
      bloomCtx = null;
    }
  }

  lightning = { timer: 5 + Math.random() * 5, flash: 0 };
}

export function updateWeather(dt) {
  const theme = getCurrentTheme();
  if (theme.weather === 'none') return;
  for (let p of weatherParticles) {
    if (theme.weather === 'rain') {
      p.y += p.speed * 3 * dt; p.x -= p.speed * 1.5 * dt;
      if (p.y > VIEW_H) { p.y = -10; p.x = Math.random() * VIEW_W + 100; }
      if (p.x < -10) p.x = VIEW_W + 10;
    } else if (theme.weather === 'snow') {
      p.y += p.speed * 0.5 * dt; p.x += Math.sin(performance.now() / 1000 + p.angle) * 0.5 * dt;
      if (p.y > VIEW_H) { p.y = -10; p.x = Math.random() * VIEW_W; }
    } else if (theme.weather === 'embers' || theme.weather === 'ash') {
      p.y -= p.speed * 0.3 * dt; p.x += Math.sin(performance.now() / 800 + p.angle) * 0.8 * dt;
      if (p.y < -10) { p.y = VIEW_H + 10; p.x = Math.random() * VIEW_W; }
    }
  }
}

export function updateFireflies(dt, worldTime) {
  const biome = state.overworld?.theme || state.overworld?.locationId;
  if (!['forest', 'swamp', 'briar-hollow', 'village'].includes(biome)) return;
  const dayPhase = (worldTime % 120) / 120;
  const isNight = dayPhase >= 0.5 && dayPhase < 0.8;

  for (let f of fireflies) {
    f.phase += dt * 0.02 * f.speed;
    if (isNight) {
      f.x = (f.x + Math.cos(f.phase) * f.speed * dt + VIEW_W) % VIEW_W;
      f.y = (f.y + Math.sin(f.phase * 0.7) * f.speed * dt + VIEW_H) % VIEW_H;
    }
  }
}

export function updateFog(dt) {
  for (let layer of fogLayers) {
    layer.x += layer.speed * dt * 0.5;
    if (layer.x > VIEW_W + layer.size) layer.x = -layer.size;
  }
}

export function updateLightning(dt) {
  const theme = getCurrentTheme();
  if (theme.weather !== 'rain') { lightning.flash = 0; return; }
  
  lightning.timer -= dt * 0.016;
  if (lightning.timer <= 0) {
    lightning.flash = 1.0;
    lightning.timer = 8 + Math.random() * 12;
  }
  if (lightning.flash > 0) lightning.flash -= dt * 0.08;
}

export function getLightningFlash() { return lightning.flash; }

export function drawWeather(ctx) {
  const theme = getCurrentTheme();
  if (theme.weather === 'none') return;
  ctx.save();
  if (theme.weather === 'rain') {
    ctx.strokeStyle = 'rgba(150, 180, 255, 0.3)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let p of weatherParticles) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 4, p.y + 12); } ctx.stroke();
  } else if (theme.weather === 'snow' || theme.weather === 'embers' || theme.weather === 'ash') {
    // Batch particle circles into one path/fill instead of one draw call per particle.
    ctx.beginPath();
    for (const p of weatherParticles) ctx.moveTo(p.x + p.size, p.y), ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    if (theme.weather === 'snow') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    } else if (theme.weather === 'embers') {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ff4000';
    } else {
      ctx.fillStyle = getCurrentBiome() === 'village'
        ? 'rgba(190, 166, 135, 0.22)'
        : 'rgba(80, 60, 80, 0.4)';
    }
    ctx.fill();
  }
  ctx.restore();
}

export function drawFireflies(ctx, worldTime) {
  if (!['forest', 'swamp', 'briar-hollow', 'village'].includes(getCurrentBiome())) return;
  const dayPhase = (worldTime % 120) / 120;
  const isNight = dayPhase >= 0.5 && dayPhase < 0.8;
  if (!isNight) return;

  const isVillage = getCurrentBiome() === 'village';
  const villageFireflyColor = getCurrentBiome() === 'village' ? '#f3c879' : '#a0ff60';
  ctx.save();
  for (let f of fireflies) {
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(f.phase * 3));
    if (isVillage) {
      // Aurora motes use hard-edged 2D pixel clusters instead of blurred glows.
      ctx.globalAlpha = flicker * (f.warmMote ? 0.34 : 0.82);
      ctx.fillStyle = f.warmMote ? villageFireflyColor : '#d8e99a';
      const x = Math.round(f.x), y = Math.round(f.y);
      const size = f.warmMote ? 2 : 3;
      ctx.fillRect(x, y, size, size);
      if (!f.warmMote) {
        ctx.fillRect(x - 2, y + 1, 2, 1);
        ctx.fillRect(x + size, y + 1, 2, 1);
      }
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = '#fff0bd';
      ctx.fillRect(x + 1, y + 1, 1, 1);
      continue;
    }
    ctx.globalAlpha = flicker * 0.9;
    ctx.fillStyle = villageFireflyColor;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#80ff40';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFogLayers(ctx) {
  const theme = getCurrentTheme();
  const baseAlpha = theme.fog > 0.85 ? 1.5 : 0.8;

  ctx.save();
  for (let i = 0; i < fogLayers.length; i++) {
    const layer = fogLayers[i];
    const sprite = fogSpriteCache[i];
    ctx.globalAlpha = Math.min(1, layer.alpha * baseAlpha);
    if (sprite) {
      ctx.drawImage(sprite, layer.x - layer.size, layer.y - layer.size);
    } else {
      // Fallback for environments without an offscreen canvas.
      const grad = ctx.createRadialGradient(layer.x, layer.y, 0, layer.x, layer.y, layer.size);
      grad.addColorStop(0, `rgba(200, 200, 220, ${layer.alpha * baseAlpha})`);
      grad.addColorStop(1, 'rgba(200, 200, 220, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.fillRect(layer.x - layer.size, layer.y - layer.size, layer.size * 2, layer.size * 2);
    }
  }
  ctx.restore();
}

export function drawBloom(ctx) {
  const ow = state.overworld;
  if (!bloomCtx || !bloomCanvas || !ctx || !ow?.camera || !ow?.player || !state.game?.player) return;
  bloomCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  bloomCtx.save();
  bloomCtx.globalCompositeOperation = 'lighter';
  
  const cam = ow.camera;
  const p = ow.player;

  if (state.game.player.class === 'mage') {
    const grd = bloomCtx.createRadialGradient(p.x - cam.x, p.y - cam.y, 5, p.x - cam.x, p.y - cam.y, 60);
    grd.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
    grd.addColorStop(1, 'rgba(100, 200, 255, 0)');
    bloomCtx.fillStyle = grd;
    bloomCtx.fillRect(p.x - cam.x - 60, p.y - cam.y - 60, 120, 120);
  } else if (state.game.player.class === 'priest') {
    const grd = bloomCtx.createRadialGradient(p.x - cam.x, p.y - cam.y - 20, 5, p.x - cam.x, p.y - cam.y - 20, 40);
    grd.addColorStop(0, 'rgba(255, 220, 100, 0.4)');
    grd.addColorStop(1, 'rgba(255, 220, 100, 0)');
    bloomCtx.fillStyle = grd;
    bloomCtx.fillRect(p.x - cam.x - 40, p.y - cam.y - 60, 80, 80);
  }

  for (const c of ow.chests || []) {
    if (c.opened) continue;
    const cx = c.x - cam.x, cy = c.y - cam.y;
    if (cx < -100 || cx > VIEW_W + 100 || cy < -100 || cy > VIEW_H + 100) continue;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
    const grd = bloomCtx.createRadialGradient(cx, cy, 5, cx, cy, 40 + pulse * 10);
    grd.addColorStop(0, 'rgba(255, 200, 0, 0.5)');
    grd.addColorStop(1, 'rgba(255, 200, 0, 0)');
    bloomCtx.fillStyle = grd;
    bloomCtx.fillRect(cx - 60, cy - 60, 120, 120);
  }

  for (const ev of ow.events || []) {
    const ex = ev.x - cam.x, ey = ev.y - cam.y;
    if (ex < -100 || ex > VIEW_W + 100 || ey < -100 || ey > VIEW_H + 100) continue;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    const grd = bloomCtx.createRadialGradient(ex, ey, 10, ex, ey, 80 + pulse * 20);
    grd.addColorStop(0, 'rgba(255, 220, 100, 0.4)');
    grd.addColorStop(1, 'rgba(255, 220, 100, 0)');
    bloomCtx.fillStyle = grd;
    bloomCtx.fillRect(ex - 120, ey - 120, 240, 240);
  }

  for (const e of ow.enemies || []) {
    if (e.dead) continue;
    if (!e.boss && !e.elite) continue;
    const ex = e.x - cam.x, ey = e.y - cam.y;
    if (ex < -100 || ex > VIEW_W + 100 || ey < -100 || ey > VIEW_H + 100) continue;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 500);
    const color = e.boss ? '176, 96, 255' : '255, 165, 0';
    const grd = bloomCtx.createRadialGradient(ex, ey, 5, ex, ey, (e.boss ? 70 : 50) + pulse * 15);
    grd.addColorStop(0, `rgba(${color}, 0.5)`);
    grd.addColorStop(1, `rgba(${color}, 0)`);
    bloomCtx.fillStyle = grd;
    bloomCtx.fillRect(ex - 100, ey - 100, 200, 200);
  }

  bloomCtx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(8px)';
  ctx.drawImage(bloomCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.filter = 'none';
  ctx.restore();
}

