import { state } from '../systems/state.js';
import { FACTIONS, getFactionRank, getFactionReputation, getFactionTradeDiscount, getFactionDamageReduction, getFactionLootBonus, getFactionEventGoldBonus } from '../systems/factions.js';
import { WORLD_REGION_IDS } from '../data/world.js';
import { LOCATIONS } from '../data/locations.js';
import { escapeHtml } from './screens.js';

const FACTION_RANK_LABELS = Object.freeze({
  hostile: 'Враждебность',
  wary: 'Настороженность',
  neutral: 'Нейтралитет',
  friendly: 'Дружелюбие',
  honored: 'Почёт',
  allied: 'Союз'
});

function signed(value) {
  const number = Number(value) || 0;
  return number > 0 ? '+' + number : String(number);
}

function regionName(regionId) {
  return LOCATIONS[regionId]?.name || regionId || 'Неизвестный регион';
}

function factionPerkProgressLabel(label, bonus, reputation) {
  const percent = Math.round(bonus * 100);
  const nextThreshold = [30, 70, 90].find(threshold => reputation < threshold);
  const hint = percent === 0
    ? 'откроется при +30'
    : nextThreshold
      ? 'следующий уровень +' + nextThreshold
      : 'максимальный уровень';
  return label + ': ' + percent + '% · ' + hint;
}

function renderFactionCard(game, faction) {
  const reputation = getFactionReputation(game, faction.id);
  const rank = getFactionRank(reputation);
  const percent = Math.max(0, Math.min(100, Math.round((reputation + 100) / 2)));
  const benefits = {
    'free-traders': '🛒 ' + factionPerkProgressLabel('Скидка торговцев', getFactionTradeDiscount(game), reputation),
    'hub-guardians': '🛡️ ' + factionPerkProgressLabel('Защита', getFactionDamageReduction(game), reputation),
    'ash-nomads': '🎒 ' + factionPerkProgressLabel('Шанс добычи', getFactionLootBonus(game), reputation),
    'rift-cult': '🌀 ' + factionPerkProgressLabel('Золото событий', getFactionEventGoldBonus(game, 'rift-cult'), reputation)
  };
  const benefit = benefits[faction.id] || '';
  return [
    '<article class="world-faction-card" data-faction-id="' + escapeHtml(faction.id) + '">',
      '<div class="world-faction-card-top"><div><span class="world-card-kicker">ФРАКЦИЯ</span><h3>' + escapeHtml(faction.name) + '</h3></div>',
      '<b class="world-faction-value">' + signed(reputation) + '</b></div>',
      '<div class="world-faction-rank">' + escapeHtml(FACTION_RANK_LABELS[rank] || rank) + '</div>',
      benefit ? '<div class="world-faction-benefit">' + escapeHtml(benefit) + '</div>' : '',
      '<div class="world-reputation-track" role="progressbar" aria-label="Репутация: ' + escapeHtml(faction.name) + '" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="' + reputation + '" aria-valuetext="' + signed(reputation) + ' — ' + escapeHtml(FACTION_RANK_LABELS[rank] || rank) + '">',
        '<i class="world-reputation-fill" style="width:' + percent + '%"></i><span class="world-reputation-center" aria-hidden="true"></span>',
      '</div>',
      '<div class="world-reputation-scale"><span>−100</span><span>0</span><span>+100</span></div>',
    '</article>'
  ].join('');
}

function renderEventCard(event, world, game, claimable = false) {
  const target = Math.max(1, Number(event.targetCount) || 1);
  const progress = Math.max(0, Math.min(target, Number(event.progress) || 0));
  const percent = Math.round(progress / target * 100);
  const progressLabel = event.objectiveType === 'defend-region' ? 'Время обороны' : 'Прогресс';
  const progressValue = event.objectiveType === 'defend-region' ? progress + ' / ' + target + ' мин.' : progress + ' / ' + target;
  const faction = FACTIONS[event.factionId];
  const accessText = faction && Number.isFinite(event.requiredFactionReputation)
    ? 'Доступно при репутации ' + signed(event.requiredFactionReputation) + ' с фракцией «' + faction.name + '».'
    : '';
  const remaining = Math.max(0, Math.ceil((Number(event.expiresAt) || 0) - (Number(world.clockMinutes) || 0)));
  const status = claimable
    ? 'Завершено · Награда ожидает получения'
    : event.accepted
      ? 'Принято · задача выполняется'
      : 'Ожидает принятия на карте региона';
  const baseReward = Number(event.reward?.gold) || 0;
  const reward = baseReward > 0
    ? Math.max(1, Math.round(baseReward * (1 + getFactionEventGoldBonus(game, event.factionId))))
    : 0;
  const rewardText = reward > 0 ? reward + ' золота' : 'награда по результату';
  const successReputation = Number(event.reputationReward) || 0;
  const failureReputation = Number(event.failureReputationDelta) || 0;
  const reputationText = faction && (successReputation || failureReputation)
    ? claimable
      ? 'Репутация за событие: ' + signed(successReputation)
      : 'При успехе: ' + signed(successReputation) + ' · при провале: ' + signed(failureReputation)
    : '';
  return [
    '<article class="world-event-card ' + (claimable ? 'is-claimable' : event.accepted ? 'is-accepted' : 'is-pending') + '" data-world-event-id="' + escapeHtml(event.id) + '">',
      '<div class="world-event-card-top"><div><span class="world-card-kicker">' + (claimable ? 'НАГРАДА' : 'МИРОВОЕ СОБЫТИЕ') + '</span><h4>' + escapeHtml(event.name) + '</h4></div>',
      '<span class="world-event-status">' + status + '</span></div>',
      '<div class="world-event-location">📍 ' + escapeHtml(regionName(event.regionId)) + (faction ? ' · ' + escapeHtml(faction.name) : '') + '</div>',
      '<p>' + escapeHtml(event.objectiveText || 'Особое событие региона.') + '</p>',
      accessText ? '<div class="world-event-reputation">🔒 ' + escapeHtml(accessText) + '</div>' : '',
      '<div class="world-event-progress-row"><span>' + progressLabel + '</span><b>' + progressValue + '</b></div>',
      '<div class="world-event-progress" role="progressbar" aria-label="Прогресс события: ' + escapeHtml(event.name) + '" aria-valuemin="0" aria-valuemax="' + target + '" aria-valuenow="' + progress + '"><i style="width:' + percent + '%"></i></div>',
      reputationText ? '<div class="world-event-reputation">⚖️ ' + escapeHtml(reputationText) + '</div>' : '',
      '<div class="world-event-footer"><span>🎁 ' + rewardText + '</span>',
      claimable ? '<span>Вернитесь к маркеру события в регионе</span>' : '<span>⌛ Осталось: ' + remaining + ' игровых мин.</span>',
      '</div>',
    '</article>'
  ].join('');
}

function renderRecentHistory(history) {
  if (!history.length) return '<p class="world-empty-note">Пока нет завершённых событий. История будет пополняться по мере исследования.</p>';
  const labels = { completed: 'Завершено', failed: 'Провалено', expired: 'Истекло' };
  return '<div class="world-history-list">' + history.map(event => {
    const faction = FACTIONS[event.factionId];
    return [
      '<div class="world-history-row" data-world-history-id="' + escapeHtml(event.id) + '">',
      '<span class="world-history-mark ' + escapeHtml(event.status) + '">' + escapeHtml(labels[event.status] || event.status) + '</span>',
      '<div><b>' + escapeHtml(event.name) + '</b><small>' + escapeHtml(regionName(event.regionId)) + (faction ? ' · ' + escapeHtml(faction.name) : '') + '</small></div>',
      '<span class="world-history-reward">' + (event.rewardClaimed ? 'Награда получена' : event.status === 'completed' ? 'Награда ожидает' : '—') + '</span>',
      '</div>'
    ].join('');
  }).join('') + '</div>';
}

export function renderWorldOverview() {
  const game = state.game;
  if (!game?.player) return '<div class="rpg-empty-state"><h3>Мир ещё не открыт</h3><p>Создайте героя, чтобы начать исследование.</p></div>';

  const world = game.world || {};
  const events = world.events || {};
  const activeEvents = Array.isArray(events.active) ? events.active.filter(event => event.status === 'active') : [];
  const history = Array.isArray(events.history) ? events.history : [];
  const claimableEvents = history.filter(event => event.status === 'completed' && event.rewardClaimed !== true);
  const recentHistory = history.filter(event => event.status !== 'completed' || event.rewardClaimed === true).slice(-6).reverse();
  const discovered = Array.isArray(world.discoveredRegions) ? world.discoveredRegions : [];
  const routes = Array.isArray(world.unlockedRoutes) ? world.unlockedRoutes : [];
  const currentRegion = world.currentRegionId || game.location;
  const currentVisits = Math.max(1, Number(world.regionVisits?.[currentRegion]) || 1);
  const currentSecurityThreat = Math.max(0, Math.min(3, Number(world.regions?.[currentRegion]?.securityThreat) || 0));
  const securityLabel = ['Безопасно', 'Низкая угроза', 'Повышенная угроза', 'Опасная зона'][currentSecurityThreat];
  const discoveredSecrets = Object.values(world.regions || {}).reduce((total, record) =>
    total + (Array.isArray(record?.discoveredSecrets) ? record.discoveredSecrets.length : 0), 0);
  const clock = Math.max(0, Number(world.clockMinutes) || 0);
  const nextEventIn = Math.max(0, Math.ceil((Number(events.nextSpawnAt) || 0) - clock));
  const factionCards = Object.values(FACTIONS).map(faction => renderFactionCard(game, faction)).join('');
  const factionLog = (game.factions?.changeLog || []).slice(-6).reverse();
  const factionLogHtml = factionLog.length
    ? '<div class="world-history-list">' + factionLog.map(entry => {
        const faction = FACTIONS[entry.factionId];
        return '<div class="world-history-row"><span class="world-history-mark reputation">' + signed(entry.delta) + '</span><div><b>' + escapeHtml(faction?.name || entry.factionId) + '</b><small>' + escapeHtml(entry.reason || 'Изменение репутации') + '</small></div><span class="world-history-reward">' + signed(entry.value) + '</span></div>';
      }).join('') + '</div>'
    : '<p class="world-empty-note">Репутация пока не менялась. Решения и мировые события повлияют на отношение фракций.</p>';
  const ashCampaign = world.factionCampaigns?.['ash-nomad-warband'];
  const campaignHtml = ashCampaign
    ? '<article class="world-event-card ' + (ashCampaign.status === 'completed' ? 'is-claimable' : ashCampaign.status === 'failed' ? 'is-pending' : 'is-accepted') + '"><span class="world-card-kicker">ЦЕПОЧКА ФРАКЦИИ · ПЕПЕЛЬНЫЕ КОЧЕВНИКИ</span><h4>Военный вызов пепельного отряда</h4><p>' + (ashCampaign.status === 'completed' ? 'Цепочка завершена. Предводитель признал вашу силу.' : ashCampaign.status === 'failed' ? 'Цепочка прервана. Проверьте репутацию и продолжайте сотрудничество с кочевниками.' : ashCampaign.stage === 1 ? 'Этап I из II: найдите и победите двух элитных разведчиков.' : 'Этап II из II: победите предводителя отряда.') + '</p><b>' + (ashCampaign.status === 'completed' ? 'Завершено' : ashCampaign.status === 'failed' ? 'Провалено' : 'Этап ' + ashCampaign.stage + ' / 2') + '</b></article>'
    : '<p class="world-empty-note">Фракционная цепочка Пепельных кочевников откроется при репутации +50 в одном из пепельных регионов.</p>';
  const activeHtml = activeEvents.map(event => renderEventCard(event, world, game)).join('');
  const claimableHtml = claimableEvents.map(event => renderEventCard(event, world, game, true)).join('');
  const discoveredPercent = Math.round(Math.min(WORLD_REGION_IDS.length, discovered.length) / WORLD_REGION_IDS.length * 100);
  const worldHours = Math.floor(clock / 60);
  const worldMinutes = Math.floor(clock % 60);

  return [
    '<section class="world-overview" aria-labelledby="world-overview-title">',
      '<header class="world-overview-hero"><div><span class="world-card-kicker">ХРОНИКИ ПУТЕШЕСТВЕННИКА</span><h2 id="world-overview-title">Мир и фракции</h2>',
      '<p>Ваши поступки меняют отношение организаций, а события оставляют след в истории регионов.</p></div>',
      '<div class="world-overview-current"><span>СЕЙЧАС ВЫ ЗДЕСЬ</span><b>' + escapeHtml(regionName(currentRegion)) + '</b><small>Посещение №' + currentVisits + '</small><small>Безопасность: ' + securityLabel + '</small></div></header>',
      '<div class="world-overview-metrics">',
        '<div class="world-metric"><span>Открыто регионов</span><b>' + discovered.length + ' / ' + WORLD_REGION_IDS.length + '</b><i role="progressbar" aria-label="Исследование мира" aria-valuemin="0" aria-valuemax="' + WORLD_REGION_IDS.length + '" aria-valuenow="' + discovered.length + '"><em style="width:' + discoveredPercent + '%"></em></i></div>',
        '<div class="world-metric"><span>Открыто маршрутов</span><b>' + routes.length + '</b><small>Связи между областями</small></div>',
        '<div class="world-metric"><span>Найдено тайников</span><b>' + discoveredSecrets + '</b><small>Секретные места, раскрытые в регионах</small></div>',
        '<div class="world-metric"><span>Мировое время</span><b>' + worldHours + ' ч ' + worldMinutes + ' мин.</b><small>До следующего события: ' + nextEventIn + ' игровых мин.</small></div>',
      '</div>',
      '<section class="world-overview-section" aria-labelledby="world-factions-title"><div class="world-section-heading"><div><span class="world-card-kicker">ОТНОШЕНИЯ</span><h3 id="world-factions-title">Четыре фракции</h3></div><span>' + Object.keys(FACTIONS).length + ' организаций</span></div>',
      '<div class="world-faction-grid">' + factionCards + '</div></section>',
      '<section class="world-overview-section" aria-labelledby="world-campaign-title"><div class="world-section-heading"><div><span class="world-card-kicker">ДОЛГИЕ ОБЯЗАТЕЛЬСТВА</span><h3 id="world-campaign-title">Фракционные цепочки</h3></div></div>' + campaignHtml + '</section>',
      '<section class="world-overview-section" aria-labelledby="world-events-title"><div class="world-section-heading"><div><span class="world-card-kicker">ЖИВОЙ МИР</span><h3 id="world-events-title">Мировые события</h3></div><span>' + activeEvents.length + ' активно · ' + claimableEvents.length + ' ожидают награды</span></div>',
      activeHtml || '<p class="world-empty-note">Сейчас нет активных событий. Исследуйте регионы — новые ситуации возникают со временем.</p>',
      claimableHtml ? '<h4 class="world-subheading">Завершённые события</h4>' + claimableHtml : '',
      '</section>',
      '<section class="world-overview-section" aria-labelledby="world-reputation-log-title"><div class="world-section-heading"><div><span class="world-card-kicker">ПОСЛЕДСТВИЯ ВАШИХ РЕШЕНИЙ</span><h3 id="world-reputation-log-title">Изменения репутации</h3></div></div>' + factionLogHtml + '</section>',
      '<section class="world-overview-section" aria-labelledby="world-history-title"><div class="world-section-heading"><div><span class="world-card-kicker">ПАМЯТЬ ЗЕМЕЛЬ</span><h3 id="world-history-title">История событий</h3></div><span>Последние ' + recentHistory.length + '</span></div>' + renderRecentHistory(recentHistory) + '</section>',
    '</section>'
  ].join('');
}