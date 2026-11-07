import { state } from './state.js';
import { CLASSES } from '../data/classes.js';
import { STORY } from '../data/story.js';
import { findTalentById } from '../data/talents.js';
import { saveGame } from './save.js';
import { emit } from './events.js';
import { canCompleteMainQuest } from './campaign.js';
import { getExpNext } from './progression.js';
import { createWorldState } from './world-state.js';
import { createFactionState } from './factions.js';

function computeMaxHpFromTalents(baseHp, talents, classId) {
  let mult = 1;
  for (const id of talents || []) {
    const t = findTalentById(classId, id);
    if (t?.effects?.hpMult) mult *= t.effects.hpMult;
  }
  return Math.round(baseHp * mult);
}

function computeMaxMpFromTalents(baseMp, talents, classId) {
  let mult = 1;
  for (const id of talents || []) {
    const t = findTalentById(classId, id);
    if (t?.effects?.mpMult) mult *= t.effects.mpMult;
  }
  return Math.round(baseMp * mult);
}

export function startNGPlus() {
  const g = state.game;
  if (!g?.player) return false;
  const p = g.player;
  if (p.victoryAchieved !== true || !canCompleteMainQuest(g)) {
    emit('toast', 'Новая игра+ доступна после полного завершения основной кампании.');
    return false;
  }
  const cls = CLASSES[p.class];
  if (!cls?.baseStats) return false;
  const s = cls.baseStats;
  const newCycle = (p.ngPlus || 0) + 1;
  const playerSnapshot = { ...p };
  const gameSnapshot = {
    location: g.location,
    storyDragons: g.storyDragons,
    storyShards: g.storyShards,
    riftEnding: g.riftEnding,
    riftOpeningSeen: g.riftOpeningSeen,
    riftOpenedAt: g.riftOpenedAt,
    riftClearedLocations: p.riftClearedLocations,
    shards: g.shards,
    quests: g.quests,
    world: g.world,
    factions: g.factions
  };

  const carry = {
    inventory: p.inventory || [],
    equipped: p.equipped || { weapon: null, armor: null },
    craftingJobs: Array.isArray(p.craftingJobs) ? p.craftingJobs : [],
    gold: p.gold || 0,
    achievements: p.achievements || [],
    stats: p.stats || { kills: {}, deaths: 0, goldEarned: 0, chestsOpened: 0, dailyChestAt: 0, dailyChestsOpened: 0 },
    weaponLevel: p.weaponLevel || 0,
    armorLevel: p.armorLevel || 0,
    herbs: p.herbs || {},
    talents: p.talents || [],
    playtimeSec: p.playtimeSec || 0
  };

  const newMaxHp = computeMaxHpFromTalents(s.maxHp, carry.talents, p.class);
  const newMaxMp = computeMaxMpFromTalents(s.maxMp, carry.talents, p.class);

  Object.assign(p, {
    level: 1, exp: 0, expNext: getExpNext(1),
    hp: newMaxHp, maxHp: newMaxHp,
    mp: p.class === 'warrior' ? 0 : newMaxMp, maxMp: newMaxMp,   // ⬅️ Воин — с 0 Ярости
    str: s.str, int: s.int, wis: s.wis, con: s.con, dex: s.dex || 10, luck: 5,
    statPoints: 0,
    passivePoints: 0,
    passives: ['start'],
    craftedHighTierByAct: {},
    craftingJobs: [],
    buyback: [],
    campaignKills: {},
    campaignClaimed: {},
    campaignShards: {},
    storyShards: { flame: false, ice: false, blood: false },
    storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false },
    activeCampaignMission: null,
    activeCampaignByBranch: { intro: null, ash: null, ice: null, blood: null },
    spells: [...cls.startingSpells],
    cooldowns: {},
    effects: [],
    buffs: [],
    ngPlus: newCycle,
    victoryAchieved: false,
    ...carry
  });

  g.location = 'village';
  g.storyDragons = { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false };
  g.storyShards = { flame: false, ice: false, blood: false };
  g.riftEnding = null;
  g.riftOpeningSeen = false;
  g.riftOpenedAt = null;
  g.player.riftClearedLocations = [];
  g.player.craftedHighTierByAct = {};
  g.shards = { forest: false, ruins: false, shadow: false };
  g.quests = {};
  STORY.quests.forEach(q => g.quests[q.id] = false);
  g.world = createWorldState({ seed: gameSnapshot.world?.seed });
  g.factions = createFactionState();

  if (!saveGame()) {
    Object.assign(p, playerSnapshot);
    g.location = gameSnapshot.location;
    g.storyDragons = gameSnapshot.storyDragons;
    g.storyShards = gameSnapshot.storyShards;
    g.riftEnding = gameSnapshot.riftEnding;
    g.riftOpeningSeen = gameSnapshot.riftOpeningSeen;
    g.riftOpenedAt = gameSnapshot.riftOpenedAt;
    g.shards = gameSnapshot.shards;
    g.quests = gameSnapshot.quests;
    g.world = gameSnapshot.world;
    g.factions = gameSnapshot.factions;
    p.riftClearedLocations = gameSnapshot.riftClearedLocations;
    emit('toast', 'Не удалось сохранить новую игру+. Прогресс кампании восстановлен.');
    return false;
  }
  emit('toast', `🔄 NG+${newCycle}! Враги сильнее, награды больше.`);
  emit('log', { channel: 'game', msg: `🔄 NG+${newCycle}: сложность растёт, прогресс сохранён!`, cls: 'success' });
  emit('game:started', {});
  return true;
}

// ⬇️ ВОЗВРАЩЁН: используется в spawn.js и combat.js
export function getNGPlusMult() {
  const rawCycle = state.game?.player?.ngPlus;
  const n = Number.isSafeInteger(rawCycle) && rawCycle >= 0 ? rawCycle : 0;
  return {
    hpMult: 1 + 0.5 * n,
    atkMult: 1 + 0.3 * n,
    goldMult: 1 + 0.3 * n,
    expMult: 1 + 0.3 * n
  };
}