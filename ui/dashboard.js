import { state } from '../systems/state.js';
import { CLASSES } from '../data/classes.js';
import { LOCATIONS } from '../data/locations.js';
import { getEffStats, getTotalKills } from '../systems/stats.js';
import { getActiveCampaignMission, getNextCampaignMission, getMissionProgress } from '../systems/campaign.js';
import { STORY } from '../data/story.js';
import { escapeHtml } from './screens.js';

function getCampaignSummary(player) {
  let completed = 0;
  let total = 0;
  let activeAct = 0;
  for (let actIndex = 0; actIndex < STORY.acts.length; actIndex++) {
    const act = STORY.acts[actIndex];
    let actDone = 0;
    for (const mission of act.missions) {
      total++;
      if (player.campaignClaimed?.[mission.id] === true) {
        completed++;
        actDone++;
      }
    }
    if (actDone < act.missions.length && activeAct === 0) activeAct = act.number;
  }
  return { completed, total, activeAct: activeAct || STORY.acts.length };
}

export function renderHeroOverview() {
  if (!state.game?.player) return '<div class="rpg-empty-state"><h3>Герой не выбран</h3></div>';
  const p = state.game.player;
  const cls = CLASSES[p.class] || CLASSES.mage;
  const stats = getEffStats();
  const kills = getTotalKills(p.stats?.kills);
  const shards = ['flame', 'ice', 'blood'].filter(id => state.game.storyShards?.[id] === true).length;
  const campaign = getCampaignSummary(p);
  const location = LOCATIONS[state.game.location] || { name: state.game.location || 'Неизвестно', emoji: '📍' };
  const resourceName = p.class === 'warrior' ? 'Ярость' : p.class === 'archer' ? 'Концентрация' : 'Мана';
  const hpPercent = p.maxHp > 0 ? Math.max(0, Math.min(100, p.hp / p.maxHp * 100)) : 0;
  const mpPercent = p.maxMp > 0 ? Math.max(0, Math.min(100, p.mp / p.maxMp * 100)) : 0;
  const expPercent = p.expNext > 0 ? Math.max(0, Math.min(100, p.exp / p.expNext * 100)) : 0;
  const cards = [
    ['Сила', p.str], ['Интеллект', p.int], ['Мудрость', p.wis], ['Телосложение', p.con], ['Ловкость', p.dex || 0],
    ['Критический удар', Math.round((stats.critChance || 0) * 100) + '%'], ['Уклонение', Math.round((stats.dodgeChance || 0) * 100) + '%'],
    ['Блок', Math.round((stats.blockChance || 0) * 100) + '%'], ['Броня', Math.round(stats.defense || 0)], ['Убийства', kills]
  ];
  return `
    <section class="hero-overview">
      <div class="hero-overview-identity">
        <div class="hero-overview-emblem">${cls.emoji || '✦'}</div>
        <div><span class="dashboard-eyebrow">ЛИЧНОЕ ДЕЛО ПУТНИКА</span><h2>${escapeHtml(p.name)}</h2><p>${escapeHtml(cls.name)} · Уровень ${p.level}</p></div>
        <div class="hero-overview-gold">💰 ${Number(p.gold) || 0}</div>
      </div>
      <div class="hero-overview-columns" style="display:grid;grid-template-columns:minmax(250px,0.8fr) minmax(0,1.2fr);gap:12px;align-items:stretch;width:100%">
        <section class="hero-overview-left" aria-label="Ресурсы героя" style="display:flex;flex-direction:column;gap:10px;min-width:0;padding:12px;border:1px solid rgba(201,162,39,.28);border-radius:8px;background:rgba(15,12,9,.65);box-sizing:border-box">
          <div class="hero-vital"><span>❤ Здоровье</span><b>${p.hp} / ${p.maxHp}</b><i role="progressbar" aria-label="Здоровье" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(hpPercent)}"><em class="vital-hp" style="width:${hpPercent}%"></em></i></div>
          <div class="hero-vital"><span>🔹 ${resourceName}</span><b>${p.mp} / ${p.maxMp}</b><i role="progressbar" aria-label="${resourceName}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(mpPercent)}"><em class="vital-mp" style="width:${mpPercent}%"></em></i></div>
          <div class="hero-vital hero-level-vital"><span>✦ Уровень ${p.level} · Опыт</span><b>${p.exp} / ${p.expNext}</b><i role="progressbar" aria-label="Опыт до следующего уровня" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(expPercent)}"><em class="vital-exp" style="width:${expPercent}%"></em></i><small>До следующего уровня: ${Math.max(0, (p.expNext || 0) - (p.exp || 0))} XP</small></div>
        </section>
        <section class="hero-overview-right" aria-label="Подробные характеристики" style="min-width:0;width:100%;box-sizing:border-box">
          <details class="hero-details" open>
            <summary>⚔️ Подробные характеристики</summary>
            <div class="hero-stat-grid">${cards.map(([label, value]) => `<div class="hero-stat"><span>${label}</span><b>${value ?? 0}</b></div>`).join('')}</div>
            <div class="hero-progression-grid">
              <div><span>📍 Текущее место</span><b>${location.emoji || '📍'} ${escapeHtml(location.name)}</b></div>
              <div><span>📖 Сюжетная кампания</span><b>Акт ${campaign.activeAct} · ${campaign.completed}/${campaign.total} миссий</b></div>
              <div><span>🐉 Осколки Разлома</span><b>${shards}/3</b></div>
              <div><span>🏰 Башня</span><b>${p.towerBest || 0}/40 этажей</b></div>
            </div>
          </details>
        </section>
      </div>
      <div class="hero-overview-actions">
        <button type="button" onclick="GameAPI.switchTab('inventory')">🎒 Экипировка</button>
        <button type="button" onclick="GameAPI.switchTab('talents')">🌳 Таланты</button>
        <button type="button" onclick="GameAPI.switchTab('statistics')">📊 Статистика</button>
      </div>
    </section>
  `;
}

export function renderDashboardContext() {
  const root = document.getElementById('dashboard-context');
  if (!root || !state.game?.player) return;
  const player = state.game.player;
  const mission = getActiveCampaignMission(player) || getNextCampaignMission(player);
  const location = LOCATIONS[state.game.location] || { name: state.game.location || 'Неизвестно' };
  const shards = ['flame', 'ice', 'blood'].filter(id => state.game.storyShards?.[id] === true).length;
  const summary = getCampaignSummary(player);
  let missionHtml = '<p class="dashboard-context-empty">Сюжетные задания завершены. Можно исследовать мир и Башню.</p>';
  if (mission) {
    const progress = getMissionProgress(player, mission.mission);
    const percent = Math.round(progress.current / progress.required * 100);
    missionHtml = `
      <div class="context-mission-meta"><span>Акт ${mission.act.number} · ${mission.missionIndex + 1}/5</span><b>${progress.current}/${progress.required}</b></div>
      <strong>${escapeHtml(mission.mission.title)}</strong>
      <p>${escapeHtml(mission.mission.objective)}</p>
      <div class="context-progress" role="progressbar" aria-label="Прогресс текущего задания" aria-valuemin="0" aria-valuemax="${progress.required}" aria-valuenow="${progress.current}" aria-valuetext="${progress.current} из ${progress.required}"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div>
      <small>${progress.complete ? 'Цель выполнена — вернитесь и завершите задание.' : progress.active ? 'Задание активно' : 'Следующее сюжетное задание'}</small>
    `;
  }
  root.innerHTML = `
    <div class="dashboard-context-heading"><span>🎯 ПУТЕВОДИТЕЛЬ</span><span>${summary.completed}/${summary.total}</span></div>
    <div class="dashboard-context-location">📍 ${escapeHtml(location.name)}</div>
    <div class="dashboard-context-mission" role="status" aria-live="polite" aria-atomic="true">${missionHtml}</div>
    <div class="dashboard-context-shards"><span>Осколки</span><b>${shards}/3</b></div>
    <div class="dashboard-context-actions">
      <button type="button" onclick="GameAPI.interactNpc('world-portal')">🌀 Портал миров</button>
    </div>
  `;
}
