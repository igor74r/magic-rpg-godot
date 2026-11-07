import { state } from '../systems/state.js';
import { getMissionProgress, isMissionComplete, getActiveCampaignMission, getNextCampaignMission, getMissionReward, countStoryShards } from '../systems/campaign.js';
import { STORY } from '../data/story.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { LOCATIONS } from '../data/locations.js';
import { getDailyQuests, claimQuestReward } from '../systems/dailyQuests.js';
import { takeTalent, resetTalents } from '../systems/talents.js';
import { saveGame } from '../systems/save.js';
import { getUnlockedAchievementIds } from '../systems/achievements.js';
import { getSafeCount, getTotalKills } from '../systems/stats.js';
import { showScreen, toast } from './screens.js';
import { renderGame, renderHeader } from './header.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function openQuestBoard() {
  const quests = getDailyQuests();
  const dragons = state.game?.storyDragons || {};
  const shards = state.game?.storyShards || {};
  const villageNews = [];
  if (dragons['blood-crown'] === true) {
    villageNews.push('Разлом открыт. По ночам над площадью видны далёкие огни за трещиной, а стража просит жителей держаться ближе к фонарям.');
  } else if (dragons['ice-grasp'] === true) {
    villageNews.push('Северные ветра стали мягче после падения Ледяной Хватки. Путники говорят, что снег перестал идти даже у старого тракта.');
  } else if (dragons['ash-herald'] === true) {
    villageNews.push('Пепельные бури ослабли. На кузнице Борина снова работают допоздна — деревня ждёт новых поставок металла.');
  } else {
    villageNews.push('Старейшина Эдвин ищет надёжного путника. Говорят, три дракона удерживают древнюю печать у границы мира.');
  }
  const shardCount = countStoryShards(shards);
  if (shardCount > 0) villageNews.push(`В хронике деревни отмечено сюжетных осколков: ${shardCount}/3. Каждый получен после победы над своим драконом.`);
  const newsHtml = villageNews.map(line => `<div class="npc-slot"><div style="color:#d8c39a;line-height:1.55;">🕯️ ${line}</div></div>`).join('');

  const html = quests.map(quest => {
    const current = Math.max(0, Math.min(Number(quest.current) || 0, Number(quest.max) || 0));
    const max = Math.max(0, Number(quest.max) || 0);
    const pct = max > 0 ? (current / max) * 100 : 0;
    const reward = [];

    if (quest.gold) reward.push(`${quest.gold}💰`);
    if (quest.exp) reward.push(`${quest.exp} EXP`);

    return `
      <div class="npc-slot">
        <div style="font-weight:bold;color:#c9a227;">
          ${quest.completed ? '✅' : '⏳'} ${quest.text}
        </div>

        <div class="bar" role="progressbar" aria-label="Прогресс: ${quest.text}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${current}" style="margin-top:8px;">
          <div class="bar-fill bar-exp" style="width:${pct}%"></div>
          <div class="bar-text">${current} / ${max}</div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="color:#ffd060;font-size:12px;">
            Награда: ${reward.join(' + ')}
          </div>

          ${
            quest.completed && !quest.claimed
              ? `<button type="button" data-game-action="claim-quest" data-quest-id="${quest.id}" class="sell-btn" style="padding:6px 12px;font-size:12px;">Забрать</button>`
              : quest.claimed
                ? `<span style="color:#60ff60;font-size:12px;">Получено</span>`
                : ''
          }
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <div class="npc-header">
      <div class="npc-emoji">📋</div>
      <div>
        <h3 style="margin:0;">Доска объявлений</h3>
        <p style="color:#a89060;font-style:italic;margin-top:4px;">
          «Ежедневные задания обновляются каждый день.»
        </p>
      </div>
    </div>

    <h3 style="margin:16px 0 8px;color:#d8c39a;">Новости Авроры</h3>
    <div class="item-list">${newsHtml}</div>
    <h3 style="margin:16px 0 8px;color:#d8c39a;">Ежедневные поручения</h3>
    <div class="item-list">
      ${html}
    </div>

    <button type="button" data-game-action="close-npc" style="width:100%;margin-top:15px;">
      ← Уйти
    </button>
  `;

  if (state.overworld && state.overworld.active) {
    document.getElementById('npc-dialog-content').innerHTML = content;
    document.getElementById('npc-dialog-modal').style.display = 'flex';
  } else {
    (document.getElementById('dashboard-tab-modal-body') || document.getElementById('tab-content')).innerHTML = content;
    showScreen('screen-game');
  }
}

function missionComplete(player, mission) {
  return isMissionComplete(player, mission);
}

function actComplete(player, act) {
  return act.missions.every(mission => missionComplete(player, mission));
}

function actUnlocked(player, actIndex) {
  return (
    actIndex === 0 ||
    STORY.acts.slice(0, actIndex).every(act => actComplete(player, act))
  );
}

function missionUnlocked(player, actIndex, missionIndex) {
  if (!actUnlocked(player, actIndex)) return false;
  if (missionIndex === 0) return true;

  return STORY.acts[actIndex].missions
    .slice(0, missionIndex)
    .every(mission => missionComplete(player, mission));
}

function renderMission(player, act, actIndex, mission, missionIndex) {
  const done = missionComplete(player, mission);
  const unlocked = missionUnlocked(player, actIndex, missionIndex);
  const missionProgress = getMissionProgress(player, mission);
  const progress = Math.min(100, (missionProgress.current / missionProgress.required) * 100);
  const enemy = ENEMIES[mission.enemyId];
  const missionLocationId = mission.locationId || act.locationId;
  const location = LOCATIONS[missionLocationId];
  const reward = getMissionReward(mission);
  const rewardItem = ITEMS[reward.itemId];
  const progressPct = mission.count > 0 ? Math.round(Math.min(missionProgress.current, mission.count) / mission.count * 100) : 0;

  const status = done
    ? '<span class="campaign-status complete">Сдано Эдвину</span>'
    : missionProgress.active && missionProgress.complete
      ? '<span class="campaign-status ready">Вернуться к Эдвину</span>'
      : missionProgress.active
        ? '<span class="campaign-status active">Принято</span>'
        : !unlocked
          ? '<span class="campaign-status locked">Закрыто</span>'
          : '<span class="campaign-status available">Выдаёт Эдвин</span>';

  const prerequisite = !unlocked
    ? actIndex > 0 && !actUnlocked(player, actIndex)
      ? `Откройте акт «${STORY.acts[actIndex - 1].title}».`
      : missionIndex > 0
        ? `Сначала завершите миссию ${act.number}.${missionIndex} «${act.missions[missionIndex - 1].title}».`
        : 'Предыдущий сюжетный этап ещё не завершён.'
    : '';

  return `
    <article class="campaign-mission quest-card ${done ? 'done' : ''} ${missionProgress.active ? 'current' : ''} ${!unlocked ? 'locked' : ''}" data-quest-card="${mission.id}">
      <div class="campaign-mission-top quest-card-top">
        <span class="campaign-mission-number">${act.number}.${missionIndex + 1}</span>
        <span class="quest-card-location">📍 ${location?.name || act.locationId}</span>
        ${status}
      </div>

      <h4>${mission.title}</h4>
      <p>${mission.desc}</p>
      ${!unlocked ? `<p class="campaign-prerequisite">🔒 ${prerequisite}</p>` : ''}
      ${mission.briefing ? `<p class="campaign-story-beat"><b>Слова Эдвина:</b> ${mission.briefing}</p>` : ''}
      ${mission.clue ? `<p class="campaign-story-clue">◆ ${mission.clue}</p>` : ''}
      ${done && mission.aftermath ? `<p class="campaign-story-aftermath"><b>Итог:</b> ${mission.aftermath}</p>` : ''}

      <div class="campaign-objective">
        <span>${enemy?.emoji || '⚔️'} ${mission.objective}</span>
        <b>${Math.min(missionProgress.current, mission.count)} / ${mission.count}</b>
      </div>

      <div class="campaign-progress" role="progressbar" aria-label="Прогресс миссии: ${mission.title}" aria-valuemin="0" aria-valuemax="${mission.count}" aria-valuenow="${Math.min(missionProgress.current, mission.count)}">
        <i style="width:${missionProgress.active ? progress : done ? 100 : 0}%"></i>
      </div>

      <div class="quest-card-footer">
        <small>Регион: ${location?.name || act.locationId}</small>
        <div class="quest-card-rewards" aria-label="Награда за миссию">
          <span>💰 ${reward.gold}</span><span>✨ ${reward.exp} EXP</span>
          ${rewardItem ? `<span title="${escapeHtml(rewardItem.name)}">${rewardItem.icon} ${escapeHtml(rewardItem.name)}</span>` : ''}
        </div>
      </div>
      <div class="quest-card-progress-caption">${done ? 'Миссия завершена' : missionProgress.active ? `Выполнено: ${progressPct}%` : unlocked ? 'Готово к принятию' : 'Ожидает предыдущую миссию'}</div>
    </article>
  `;
}

export function renderQuests() {
  const player = state.game.player;

  const totalMissions = STORY.acts.reduce(
    (sum, act) => sum + act.missions.length,
    0
  );

  let completedMissions = 0;

  for (const act of STORY.acts) {
    for (const mission of act.missions) {
      if (missionComplete(player, mission)) {
        completedMissions++;
      }
    }
  }

  const currentMission = getActiveCampaignMission(player) || getNextCampaignMission(player);
  const currentProgress = currentMission
    ? getMissionProgress(player, currentMission.mission)
    : null;

  const actsHtml = STORY.acts.map((act, actIndex) => {
    const unlocked = actUnlocked(player, actIndex);
    const completed = actComplete(player, act);
    const actDone = act.missions.filter(
      mission => missionComplete(player, mission)
    ).length;

    const actStatus = completed
      ? '✅ Пройден'
      : unlocked
        ? '⚔️ Открыт'
        : '🔒 Не открыт';

    const missionsHtml = act.missions
      .map((mission, missionIndex) =>
        renderMission(player, act, actIndex, mission, missionIndex)
      )
      .join('');

    return `
      <section class="campaign-act ${unlocked ? 'unlocked' : 'locked'} ${completed ? 'completed' : ''}">
        <div class="campaign-act-heading">
          <div>
            <span class="campaign-act-kicker">${act.subtitle} · Рекомендуемый уровень: ${act.recommendedLevel || '—'}</span>
            <h3>${act.number}. ${act.title}</h3>
            <p>${act.intro}</p>
            ${act.chapter ? `<p class="campaign-chapter"><b>${act.chapter}</b> — ${act.chapterGoal}</p>` : ''}
            ${act.keyCharacters ? `<p class="campaign-act-characters">Ключевые персонажи: ${act.keyCharacters}</p>` : ''}
            ${completed && act.revelation ? `<p class="campaign-act-revelation"><b>Открытая истина:</b> ${act.revelation}</p>` : ''}
          </div>

          <div class="campaign-act-progress" aria-label="Прогресс акта ${act.number}: ${actDone} из ${act.missions.length}">
            <b>${actDone}/${act.missions.length}</b>
            <span>${actStatus}</span>
            <div class="campaign-act-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${act.missions.length}" aria-valuenow="${actDone}" aria-label="Завершение акта">
              <i style="width:${Math.round(actDone / act.missions.length * 100)}%"></i>
            </div>
          </div>
        </div>

        <div class="campaign-missions">
          ${missionsHtml}
        </div>

        ${completed ? `<p class="campaign-outro">${act.outro}</p>` : ''}
      </section>
    `;
  }).join('');

  const shards = countStoryShards(state.game.storyShards);

  const shardItems = STORY.quests.map(quest => {
    const shardId = quest.id.replace('shard-', '');
    const complete = state.game.storyShards?.[shardId] === true;

    return `
      <div class="item ${complete ? 'campaign-shard-done' : ''}">
        <div class="item-info">
          <div class="item-name">
            ${complete ? '✅' : '◇'} ${quest.name}
          </div>
          <div class="item-desc">${quest.desc}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="campaign-header">
      <div>
        <span class="campaign-kicker">Хроники мира · сюжетная кампания</span>
        <h2>Пять актов. Двадцать пять миссий.</h2>
        <p>${STORY.intro}</p>
      </div>

      <div class="campaign-total">
        <b>${completedMissions}/${totalMissions}</b>
        <span>миссий завершено</span>
      </div>
    </div>

    ${
      currentMission
        ? `
          <section class="campaign-current-objective campaign-quest-journal" aria-label="Журнал текущего задания" aria-live="polite">
            <div class="campaign-journal-topline">
              <span>📜 ${currentProgress.active ? 'Текущее поручение' : 'Следующее поручение'}</span>
              <span class="campaign-journal-step">${currentMission.act.number}.${currentMission.missionIndex + 1} / ${totalMissions}</span>
            </div>
            <b class="campaign-journal-title">${currentMission.mission.title}</b>
            <p>${currentMission.mission.desc}</p>
            <div class="campaign-objective">
              <span>🎯 ${currentMission.mission.objective}</span>
              <b>${currentProgress.current}/${currentProgress.required}</b>
            </div>
            <div class="campaign-progress campaign-journal-progress" role="progressbar" aria-label="Выполнение текущего задания" aria-valuemin="0" aria-valuemax="${currentProgress.required}" aria-valuenow="${currentProgress.current}">
              <i style="width:${currentProgress.active ? Math.round(currentProgress.current / currentProgress.required * 100) : 0}%"></i>
            </div>
            <div class="campaign-journal-meta">
              <span>📍 ${LOCATIONS[currentMission.mission.locationId || currentMission.act.locationId]?.name || currentMission.mission.locationId || currentMission.act.locationId}</span>
              <span>🎁 ${getMissionReward(currentMission.mission).gold}💰 · ${getMissionReward(currentMission.mission).exp} EXP</span>
            </div>
            <p class="campaign-journal-next-step">${currentProgress.active
              ? currentProgress.complete
                ? '✓ Цель выполнена — вернитесь к Старейшине Эдвину в Аврору.'
                : 'Следующий шаг: победите указанного врага в этой локации.'
              : 'Следующий шаг: поговорите со Старейшиной Эдвином в Авроре и примите задание.'}</p>
          </section>
        `
        : `
          <div class="campaign-current-objective campaign-finished">
            <span>Кампания завершена</span>
            <b>Все пять актов пройдены</b>
            <p>Три дракона повержены, три осколка собраны. Разлом открыт — теперь можно исследовать его области и покорять Башню.</p>
          </div>
        `
    }

    <div class="campaign-acts">
      ${actsHtml}
    </div>

    <section class="campaign-shards">
      <h3>Осколки Кристалла Разлома: ${shards}/3</h3>
      <div class="item-list">${shardItems}</div>
    </section>
  `;
}

export function renderAchievements() {
  const unlocked = getUnlockedAchievementIds(state.game.player);
  const total = ACHIEVEMENTS.length;
  const got = unlocked.size;

  const items = ACHIEVEMENTS.map(achievement => {
    const done = unlocked.has(achievement.id);
    let progressText = '';

    if (!done && achievement.progress && achievement.target !== undefined) {
      let current = 0;

      try {
        current = achievement.progress(state.game);
      } catch {
        current = 0;
      }

      current = Math.min(current, achievement.target);
      progressText = ` <span style="color:#60ff60;">(${current}/${achievement.target})</span>`;
    }

    return `
      <div class="achievement ${done ? 'done' : ''}">
        <div class="achievement-icon">
          ${done ? achievement.icon : '🔒'}
        </div>

        <div class="achievement-body">
          <div class="achievement-name">
            ${done ? achievement.name : '???'}
          </div>

          <div class="achievement-desc">
            ${achievement.desc}${progressText}
          </div>

          <div class="achievement-reward">
            ${
              done
                ? `✅ Получено (+${achievement.reward}💰)`
                : `🎁 ${achievement.reward}💰`
            }
          </div>
        </div>
      </div>
    `;
  }).join('');

  const pct = total > 0 ? Math.round((got / total) * 100) : 0;

  return `
    <h3>
      🏆 Достижения: ${got}/${total}
      <span style="color:#a89060;font-size:14px;">(${pct}%)</span>
    </h3>
    <div class="achievement-list">${items}</div>
  `;
}

export function renderStatistics() {
  const player = state.game.player;
  const stats = player.stats || {};
  const kills = stats.kills && typeof stats.kills === 'object' && !Array.isArray(stats.kills)
    ? stats.kills
    : {};

  const totalKills = getTotalKills(kills);
  const deaths = getSafeCount(stats.deaths);
  const goldEarned = getSafeCount(stats.goldEarned);
  const chestsOpened = getSafeCount(stats.chestsOpened);
  const playtimeSec = getSafeCount(player.playtimeSec);
  const eliteKills = getSafeCount(stats.eliteKills);
  const bossKills = getSafeCount(stats.bossKills);
  const riftBest = getSafeCount(player.riftBest);
  const towerBest = getSafeCount(player.towerBest);
  const ngPlus = getSafeCount(player.ngPlus);
  const achievementsCount = getUnlockedAchievementIds(player).size;

  const hours = Math.floor(playtimeSec / 3600);
  const minutes = Math.floor((playtimeSec % 3600) / 60);

  const playtimeStr = hours > 0
    ? `${hours}ч ${minutes}м`
    : `${minutes}м`;

  const killRows = Object.entries(kills)
    .map(([id, count]) => [id, getSafeCount(count)])
    .filter(([id, count]) => count > 0 && ENEMIES[id])
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `
      <div class="stat-row">
        <span>${ENEMIES[id].emoji} ${ENEMIES[id].name}</span>
        <span class="stat-val">${count}</span>
      </div>
    `)
    .join('');

  return `
    <h3>📊 Статистика</h3>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">⚔️ Убийств</div>
        <div class="stat-value">${totalKills}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">💀 Смертей</div>
        <div class="stat-value">${deaths}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">💰 Золота</div>
        <div class="stat-value">${goldEarned}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">📦 Сундуков</div>
        <div class="stat-value">${chestsOpened}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">★ Элитных</div>
        <div class="stat-value">${eliteKills}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">☠️ Боссов</div>
        <div class="stat-value">${bossKills}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">🏆 Достижений</div>
        <div class="stat-value">${achievementsCount}/${ACHIEVEMENTS.length}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">🌀 Разлом</div>
        <div class="stat-value">${riftBest}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">🏰 Башня</div>
        <div class="stat-value">${towerBest}/40</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">🔄 NG+</div>
        <div class="stat-value">${ngPlus}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">⏱️ Время</div>
        <div class="stat-value">${playtimeStr}</div>
      </div>
    </div>

    ${
      killRows
        ? `
          <h3 style="margin-top:15px;">Детали по врагам</h3>
          <div class="kill-list">${killRows}</div>
        `
        : ''
    }
  `;
}

export function renderBestiary() {
  const rawKills = state.game.player.stats?.kills;
  const kills = rawKills && typeof rawKills === 'object' && !Array.isArray(rawKills) ? rawKills : {};
  const totalKilled = getTotalKills(kills);

  const allIds = Object.keys(ENEMIES);
  const totalEnemies = allIds.length;
  const known = allIds.filter(id => getSafeCount(kills[id]) > 0).length;

  const sorted = allIds.sort((a, b) => {
    const aKnown = getSafeCount(kills[a]) > 0 ? 0 : 1;
    const bKnown = getSafeCount(kills[b]) > 0 ? 0 : 1;

    if (aKnown !== bKnown) return aKnown - bKnown;

    return (ENEMIES[a].hp || 0) - (ENEMIES[b].hp || 0);
  });

  const cards = sorted.map(id => {
    const enemy = ENEMIES[id];
    const count = getSafeCount(kills[id]);
    const killed = count > 0;

    if (!killed) {
      return `
        <div class="item bestiary-card" style="opacity:0.45;">
          <div class="item-info">
            <div class="item-name" style="color:#6a5a3a;">❓ ???</div>
            <div class="item-desc">
              Неизвестное существо. Убейте его, чтобы открыть запись.
            </div>
          </div>
        </div>
      `;
    }

    const drops = (enemy.drops || [])
      .map(id => ITEMS[id]?.name || id)
      .join(', ') || '—';

    const bossTag = enemy.boss
      ? ' <span style="color:#b060ff;font-weight:bold;">[БОСС]</span>'
      : '';

    return `
      <div class="item bestiary-card">
        <div class="item-info">
          <div class="item-name">
            ${enemy.emoji || '❓'} ${enemy.name}${bossTag}
            <span style="color:#60ff60;font-size:12px;">×${count}</span>
          </div>

          <div class="item-desc">
            ${enemy.lore ? `<p>${enemy.lore}</p>` : ''}
            ${enemy.tactics ? `<p><b>Тактика:</b> ${enemy.tactics}</p>` : ''}
            ❤️ ${enemy.hp} · ⚔️ ${enemy.attack} · 🛡️ ${enemy.defense}<br>
            🏆 ${enemy.exp} EXP · 💰 ${enemy.gold} золота<br>
            📦 Дроп: ${drops}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <h3>
      📖 Бестиарий
      <span style="color:#a89060;font-size:14px;">(${known}/${totalEnemies})</span>
    </h3>

    <p style="color:#a89060;font-size:13px;margin-bottom:12px;">
      Всего убито врагов:
      <b style="color:#ffd060;">${totalKilled}</b>
    </p>

    <div class="item-list">${cards}</div>
  `;
}

export function claimQuestUI(id) {
  if (claimQuestReward(id)) {
    renderHeader();
    openQuestBoard();
    return;
  }
  toast('Награда не выдана: проверьте баланс золота и состояние задания.');
}

export function takeTalentUI(id) {
  const player = state.game.player;
  const ok = takeTalent(player, id);

  if (ok) {
    saveGame();
    renderGame();
  }
}

export function resetTalentsUI() {
  const player = state.game.player;
  const result = resetTalents(player);

  if (!result.ok && result.msg) {
    toast(result.msg);
  } else {
    saveGame();
    renderGame();
  }
}