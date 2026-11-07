import { state } from '../systems/state.js';
import { CLASSES } from '../data/classes.js';
import { SPELLS } from '../data/spells.js';

export function renderSpells() {
  const p = state.game.player; const cls = CLASSES[p.class]; const abilities = cls.abilities || []; const cooldowns = p.cooldowns || {};
  let html = '';
  if (p.spells.length) { html += `<h3>✨ Заклинания</h3><div class="item-list">` + p.spells.map(id => { const sp = SPELLS[id]; if (!sp) return ''; const noMp = p.mp < sp.cost; return `<div class="item"><div class="item-info"><div class="item-name">${sp.icon} ${sp.name}</div><div class="item-desc">${sp.desc} · ${sp.cost} MP${noMp ? ' <span style="color:#ff6060;">(мало MP)</span>' : ''}</div></div></div>`; }).join('') + `</div>`; }
  else html += `<p style="color:#a89060;text-align:center;padding:15px;">Вы не знаете заклинаний</p>`;
  if (abilities.length) {
    html += `<h3 style="margin-top:15px;">🌟 Способности класса <span style="color:#a89060;font-size:13px;font-weight:normal;">(в бою — [6])</span></h3><div class="item-list">`;
    html += abilities.map(a => { const passive = !!a.passive; const cd = cooldowns[a.id] || 0; const noMp = !passive && p.mp < (a.cost || 0); let statusHtml = ''; if (passive) statusHtml = `<span class="ability-status passive">🔒 пассив</span>`; else if (cd > 0) statusHtml = `<span class="ability-status cooldown">⌛ ${cd} ${cd === 1 ? 'ход' : 'хода'}</span>`; else if (noMp) statusHtml = `<span class="ability-status nomana">⚠️ мало ${p.class === 'warrior' ? 'Ярости' : 'MP'}</span>`; else statusHtml = `<span class="ability-status ready">✅ Готова</span>`; const meta = passive ? 'пассивная' : `${a.cost || 0} ${p.class === 'warrior' ? 'Ярости' : 'MP'} · кулдаун ${a.cooldown} х.`; return `<div class="item ability-item"><div class="item-info"><div class="item-name">${a.icon} ${a.name}</div><div class="item-desc">${a.desc} · ${meta}</div></div>${statusHtml}</div>`; }).join('');
    html += `</div>`;
  }
  return html;
}
