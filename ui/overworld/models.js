// ui/overworld/models.js
// Совместимый фасад отрисовки: спрайты живут в sprites.js, данные эффектов — здесь.
import { drawHero, drawEnemy, drawObject } from './sprites.js';

export const MODIFIERS_LABEL = {
  poisonous:    { name: 'Ядовитый',       prefix: '☣️',  color: '#60a060' },
  armored:      { name: 'Бронированный',  prefix: '🛡️', color: '#a0a0a0' },
  swift:        { name: 'Стремительный',  prefix: '💨',  color: '#60a0ff' },
  vampiric:     { name: 'Вампирский',     prefix: '🧛',  color: '#800060' },
  regenerating: { name: 'Регенерирующий', prefix: '💚',  color: '#60ff60' },
  berserk:      { name: 'Берсерк',        prefix: '💢',  color: '#ff4040' }
};

export const EFFECTS_DATA = {
  poison:        { name: 'Отравление',    icon: '☠️', color: '#60a060' },
  burn:          { name: 'Ожог',          icon: '🔥', color: '#ff6020' },
  bleed:         { name: 'Кровотечение',  icon: '🩸', color: '#d63030' },
  stun:          { name: 'Оглушение',     icon: '💫', color: '#d6c030' },
  atkBuff:       { name: 'Боевой клич',   icon: '📢', color: '#ffd060' },
  defBuff:       { name: 'Щит маны',      icon: '🛡️', color: '#60a0ff' },
  lifesteal:     { name: 'Кровожадность', icon: '🩸', color: '#d63030' },
  strength:      { name: 'Эликсир силы',  icon: '💪', color: '#ff9060' },
  manaShield:    { name: 'Эликсир маны',  icon: '💧', color: '#60d0ff' },
  elderBlessing: { name: 'Благословение', icon: '✨', color: '#ffd060' }
};

export function drawPlayerByClass(ctx, x, y, playerClass, shadowColor, moving = false) {
  drawHero(ctx, x, y, playerClass, shadowColor, moving);
}

export function drawEnemyByType(ctx, e, x, y, shadowColor) {
  drawEnemy(ctx, e, x, y, shadowColor);
}

export function drawStatic(ctx, obj, x, y, shadowColor) {
  drawObject(ctx, obj, x, y, shadowColor);
}
