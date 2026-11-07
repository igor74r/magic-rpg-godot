import { state } from './state.js';
import { CLASSES } from '../data/classes.js';
import { STORY } from '../data/story.js';
import { addItem } from './inventory.js';
import { migrateGame, saveGame } from './save.js';
import { emit } from './events.js';
import { getExpNext } from './progression.js';
import { createWorldState } from './world-state.js';
import { createFactionState } from './factions.js';

export function createCharacter(name, className) {
  const cls = CLASSES[className];

  if (!cls || !['warrior', 'mage', 'archer'].includes(className)) {
    return false;
  }

  const stats = cls.baseStats;
  const previousGame = state.game;
  const previousSlot = state.currentSlot;
  const previousPendingSlot = state.pendingSlot;

  if (Number.isSafeInteger(state.pendingSlot) && state.pendingSlot >= 1 && state.pendingSlot <= 3) {
    state.currentSlot = state.pendingSlot;
  }
  state.pendingSlot = null;

  state.game = {
    version: 18,

    player: {
      name,
      class: className,

      level: 1,
      exp: 0,
      expNext: getExpNext(1),

      hp: stats.maxHp,
      maxHp: stats.maxHp,

      mp: 0,
      maxMp: stats.maxMp,

      str: stats.str,
      int: stats.int,
      wis: stats.wis,
      con: stats.con,
      dex: stats.dex || 0,
      luck: 5,

      statPoints: 0,
      passivePoints: 0,
      campaignKills: {},
      campaignClaimed: {},
      activeCampaignMission: null,
      activeCampaignByBranch: { intro: null, ash: null, ice: null, blood: null },
      campaignShards: {},

      gold: 0,

      inventory: [],

      equipped: {
        weapon: null,
        head: null,
        shoulders: null,
        chest: null,
        gloves: null,
        legs: null,
        boots: null,
        shield: null,
        ring1: null,
        ring2: null,
        amulet: null,
        cloak: null
      },

      spells: [...cls.startingSpells],

      stats: {
        kills: {},
        deaths: 0,
        goldEarned: 0,
        chestsOpened: 0,
        dailyChestAt: 0,
        dailyChestsOpened: 0,
        eliteKills: 0,
        bossKills: 0,
        flawlessStreak: 0
      },

      achievements: [],

      weaponLevel: 0,
      armorLevel: 0,

      herbs: {},
      cooldowns: {},
      effects: [],

      ngPlus: 0,
      riftBest: 0,

      playtimeSec: 0,
      createdAt: Date.now(),

      talents: [],
      passives: ['start'],

      victoryAchieved: false,

      dailyQuests: {
        date: 0,
        list: []
      },

      buffs: []
    },

    location: 'village',
    world: createWorldState(),
    factions: createFactionState(),

    storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false },
    storyShards: { flame: false, ice: false, blood: false },
    shards: { forest: false, ruins: false, shadow: false },

    quests: {}
  };

  // Маг начинает с полной маной.
  // Воин копит ярость, Лучник — концентрацию в бою.
  if (className === 'mage') {
    state.game.player.mp = stats.maxMp;
  }

  for (const itemId of cls.startingItems) {
    addItem(itemId, 1, { rarity: 'common' });
  }

  STORY.quests.forEach(quest => {
    state.game.quests[quest.id] = false;
  });

  // Apply the current save schema before saveGame stamps the version.
  // Otherwise a fresh v15 character would skip the v16/v17 migrations.
  migrateGame(state.game);
  if (!saveGame()) {
    // Character creation is a transaction: preserve the prior in-memory game
    // and slot selection when storage rejects the new save (e.g. quota).
    state.game = previousGame;
    state.currentSlot = previousSlot;
    state.pendingSlot = previousPendingSlot;
    return false;
  }

  emit('game:started', {
    name,
    cls
  });

  return true;
}
