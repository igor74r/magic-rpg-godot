import { state } from '../state.js';

export const PARTICLE_PRESETS = {
  spark:   { colors: ['#ffd060', '#ffa500', '#ff6060'], speed: 2.5, size: 3,   life: 1.5, gravity: 0.15 },
  smoke:   { colors: ['#6a5a5a', '#3a2a2a', '#8a7a7a'], speed: 1.2, size: 4,   life: 2.0, gravity: -0.05 },
  levelup: { colors: ['#ffd060', '#c9a227', '#ffedb0'], speed: 2.0, size: 3.5, life: 2.0, gravity: -0.10 },
  hurt:    { colors: ['#ff4040', '#d63030', '#ff8080'], speed: 2.0, size: 3,   life: 1.2, gravity: 0.10 },
  slash:   { colors: ['#fff0c2', '#d9e7ef', '#f3b75d'], speed: 3.6, size: 3.8, life: 0.9, gravity: 0.04 },
  arrow:   { colors: ['#d9e9ff', '#8db8ed', '#fff0c2'], speed: 4.2, size: 2.6, life: 0.85, gravity: 0.02 },
  fire:    { colors: ['#ffef9a', '#ff8b32', '#e94328'], speed: 3.0, size: 4.2, life: 1.3, gravity: -0.08 },
  ice:     { colors: ['#e4ffff', '#80d9f4', '#5795e8'], speed: 2.8, size: 3.8, life: 1.4, gravity: -0.04 },
  blood:   { colors: ['#ff5268', '#a90f35', '#e9a0ae'], speed: 2.4, size: 4.0, life: 1.25, gravity: 0.12 },
  arcane:  { colors: ['#e6b6ff', '#9b68dc', '#fff0d2'], speed: 2.7, size: 3.6, life: 1.4, gravity: -0.12 },
  guard:   { colors: ['#d9f5ff', '#72b9e8', '#f6d88a'], speed: 2.5, size: 3.5, life: 1.0, gravity: -0.02 },
  impact:  { colors: ['#fff1c2', '#c6a15b', '#8b7760'], speed: 3.1, size: 4.4, life: 0.8, gravity: 0.18 }
};

export function spawnParticles(x, y, type, count) {
  const ow = state.overworld;
  if (!ow) return;
  if (!ow.particles) ow.particles = [];
  const preset = PARTICLE_PRESETS[type];
  if (!preset) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = preset.speed * (0.5 + Math.random() * 0.8);
    ow.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: preset.colors[Math.floor(Math.random() * preset.colors.length)],
      size: preset.size * (0.7 + Math.random() * 0.6),
      life: preset.life,
      maxLife: preset.life,
      gravity: preset.gravity
    });
  }
}

export function updateParticles(dt) {
  const ow = state.overworld;
  if (!ow || !ow.particles) return;
  for (const p of ow.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.98;
    p.life -= dt * 0.02;
  }
  ow.particles = ow.particles.filter(p => p.life > 0);
}