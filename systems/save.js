import { state } from './state.js';
import { STORY } from '../data/story.js';
import { getExpNext } from './progression.js';
import { ensureWorldState } from './world-state.js';
import { ensureFactionState } from './factions.js';
import { ensureCampaignBranchState } from './campaign-branches.js';

const SLOT_PREFIX = 'magic-rpg-save-';
const LEGACY_KEY = 'magic-rpg-save';
const SETTINGS_KEY = 'magic-rpg-settings';

const SAVE_VERSION = 18;
const SETTINGS_VERSION = 6;
const MAX_SLOT = 3;

let lastSaveTime = null;
let lastSaveGame = null;

function isValidSlot(slot) {
  return Number.isSafeInteger(slot) && slot >= 1 && slot <= MAX_SLOT;
}

function slotKey(slot) {
  return SLOT_PREFIX + slot;
}

export function migrateLegacySave() {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return false;

    // Preserve the legacy slot when slot 1 already exists. Removing it here
    // would silently destroy a second, potentially valuable character save.
    if (localStorage.getItem(slotKey(1))) return false;

    // Copy first and remove the legacy key only after the new slot is verified.
    localStorage.setItem(slotKey(1), legacy);
    if (localStorage.getItem(slotKey(1)) !== legacy) {
      throw new Error('Legacy save migration verification failed');
    }
    localStorage.removeItem(LEGACY_KEY);
    return true;
  } catch (error) {
    console.warn('[save] Не удалось перенести старое сохранение:', error);
    return false;
  }
}

export function saveGame() {
  if (!state.game) return false;

  ensureWorldState(state.game, { legacy: false });
  ensureFactionState(state.game);
  ensureCampaignBranchState(state.game.player);

  const slot = isValidSlot(state.currentSlot) ? state.currentSlot : 1;
  const now = Date.now();
  const player = state.game.player;
  let playtimeSec = player && Number.isFinite(player.playtimeSec)
    ? Math.max(0, Math.floor(player.playtimeSec))
    : 0;

  if (player && lastSaveGame === state.game && Number.isFinite(lastSaveTime)) {
    const deltaSec = (now - lastSaveTime) / 1000;
    if (deltaSec > 0 && deltaSec < 3600) {
      playtimeSec += Math.floor(deltaSec);
    }
  }

  // Serialize a snapshot first. Neither schema version nor playtime changes
  // in live state until localStorage confirms the write succeeded.
  const snapshot = {
    ...state.game,
    version: SAVE_VERSION,
    ...(player ? { player: { ...player, playtimeSec } } : {})
  };
  let serialized;
  try {
    serialized = JSON.stringify(snapshot);
    localStorage.setItem(slotKey(slot), serialized);
  } catch (error) {
    // Serialization can fail too (e.g. cyclic extension data or BigInt),
    // and must follow the same non-mutating failure path as storage errors.
    console.error('[save] Не удалось подготовить или записать сохранение:', error);
    return false;
  }

  state.game.version = SAVE_VERSION;
  if (player) player.playtimeSec = playtimeSec;
  lastSaveTime = now;
  lastSaveGame = state.game;
  return true;
}

function normalizeEquipped(player) {
  if (!player || !player.equipped) return;

  for (const slot of ['weapon', 'armor']) {
    const instance = player.equipped[slot];

    if (typeof instance === 'string') {
      player.equipped[slot] = {
        id: instance,
        qty: 1
      };
    }
  }
}

export function validateCurrentSaveShape(game) {
  if (!game || typeof game !== 'object' || Array.isArray(game) ||
      !game.player || typeof game.player !== 'object' || Array.isArray(game.player)) {
    throw new Error('Invalid save structure: player data is missing');
  }
  const version = game.version == null ? 0 : Number(game.version);
  if (version !== SAVE_VERSION) return true;
  const player = game.player;
  const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const finitePlayerFields = ['hp', 'maxHp', 'mp', 'maxMp', 'str', 'int', 'wis', 'con', 'dex', 'luck'];
  if (!Number.isSafeInteger(game.worldSeed) || game.worldSeed < 1 || game.worldSeed > 0xffffffff ||
      !Number.isSafeInteger(game.worldGeneratorVersion) || game.worldGeneratorVersion < 1 ||
      finitePlayerFields.some(key => !Number.isFinite(player[key])) ||
      player.hp < 0 || player.maxHp <= 0 || player.mp < 0 || player.maxMp <= 0 ||
      !Number.isSafeInteger(player.exp) || player.exp < 0 ||
      !Number.isSafeInteger(player.statPoints) || player.statPoints < 0 ||
      !Number.isSafeInteger(player.passivePoints) || player.passivePoints < 0 ||
      player.luck < 0 || player.luck > 100 ||
      typeof player.name !== 'string' || !player.name.trim() ||
      !['warrior', 'mage', 'archer', 'priest'].includes(player.class) ||
      !Number.isSafeInteger(player.level) || player.level < 1 || player.level > 100 ||
      !Number.isSafeInteger(player.ngPlus) || player.ngPlus < 0 ||
      !Number.isSafeInteger(player.gold) || player.gold < 0 ||
      !Array.isArray(player.inventory) ||
      !player.inventory.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string' && item.id.trim() && (item.qty == null || (Number.isSafeInteger(item.qty) && item.qty > 0))) ||
      !Array.isArray(player.spells) || !player.spells.every(id => typeof id === 'string') ||
      !isRecord(player.equipped) || !isRecord(player.stats) || !isRecord(player.stats.kills) ||
      !isRecord(player.campaignKills) || !isRecord(player.campaignClaimed) ||
      !isRecord(game.storyShards) || !isRecord(game.storyDragons) ||
      !isRecord(player.activeCampaignByBranch) || !isRecord(game.world) ||
      !Number.isSafeInteger(game.world.seed) || game.world.seed <= 0 ||
      !Number.isSafeInteger(game.world.generatorVersion) || game.world.generatorVersion < 1 ||
      game.world.generatorVersion !== game.worldGeneratorVersion ||
      !Array.isArray(game.world.discoveredRegions) || !Array.isArray(game.world.unlockedRoutes) ||
      !isRecord(game.factions) || !isRecord(game.factions.reputation) || !Array.isArray(game.factions.changeLog) ||
      !(player.activeCampaignMission === null || typeof player.activeCampaignMission === 'string')) {
    throw new Error('Invalid current save structure');
  }
  return true;
}

export function migrateGame(game) {
  if (!game || !game.player) return game;

  // Never downgrade or rewrite saves created by a newer game schema.
  const sourceVersion = game.version == null ? 0 : Number(game.version);
  if (typeof game.version === 'boolean' || !Number.isSafeInteger(sourceVersion) || sourceVersion < 0) {
    throw new Error(`Unsupported save version: ${String(game.version)}`);
  }
  if (sourceVersion > SAVE_VERSION) {
    throw new Error(`Save version ${sourceVersion} is newer than supported version ${SAVE_VERSION}`);
  }
  game.version = sourceVersion;

  normalizeEquipped(game.player);

  if (!game.version || game.version < 2) {
    if (!Array.isArray(game.player.spells)) {
      game.player.spells = [];
    }

    if (!game.player.inventory) {
      game.player.inventory = [];
    }

    if (!game.player.equipped) {
      game.player.equipped = {
        weapon: null,
        armor: null
      };
    }

    game.version = 2;
  }

  if (game.version < 3) {
    if (typeof game.player.statPoints !== 'number') {
      game.player.statPoints = 0;
    }

    if (!game.shards) {
      game.shards = {
        forest: false,
        ruins: false,
        shadow: false
      };
    }

    if (!game.quests) {
      game.quests = {};
    }

    game.version = 3;
  }

  if (game.version < 4) {
    const player = game.player;

    if (!player.stats) {
      player.stats = {
        kills: {},
        deaths: 0,
        goldEarned: 0,
        chestsOpened: 0,
        dailyChestAt: 0,
        dailyChestsOpened: 0
      };
    }

    if (!Array.isArray(player.achievements)) {
      player.achievements = [];
    }

    if (typeof player.weaponLevel !== 'number') {
      player.weaponLevel = 0;
    }

    if (typeof player.armorLevel !== 'number') {
      player.armorLevel = 0;
    }

    if (!player.herbs) {
      player.herbs = {};
    }

    if (!player.cooldowns) {
      player.cooldowns = {};
    }

    if (!Array.isArray(player.effects)) {
      player.effects = [];
    }

    game.version = 4;
  }

  if (game.version < 5) {
    if (typeof game.player.ngPlus !== 'number') {
      game.player.ngPlus = 0;
    }

    game.version = 5;
  }

  if (game.version < 6) {
    if (typeof game.player.riftBest !== 'number') {
      game.player.riftBest = 0;
    }

    game.version = 6;
  }

  if (game.version < 7) {
    if (typeof game.player.playtimeSec !== 'number') {
      game.player.playtimeSec = 0;
    }

    if (typeof game.player.createdAt !== 'number') {
      game.player.createdAt = Date.now();
    }

    game.version = 7;
  }

  if (game.version < 8) {
    if (!Array.isArray(game.player.talents)) {
      game.player.talents = [];
    }

    game.version = 8;
  }

  if (game.version < 9) {
    if (!game.player.dailyQuests) {
      game.player.dailyQuests = {
        date: 0,
        list: []
      };
    }

    if (!Array.isArray(game.player.buffs)) {
      game.player.buffs = [];
    }

    game.version = 9;
  }

  // Версия 10: ловкость и новое дерево пассивных навыков.
  if (game.version < 10) {
    const player = game.player;

    if (typeof player.dex !== 'number') {
      player.dex = 0;
    }

    if (!Array.isArray(player.passives)) {
      player.passives = ['start'];
    } else if (!player.passives.includes('start')) {
      player.passives.unshift('start');
    }

    // Компенсация за уровни, уже полученные до внедрения нового древа.
    // Один достигнутый уровень после первого даёт одно очко пассивки.
    if (typeof player.passivePoints !== 'number') {
      player.passivePoints = Math.max(
        0,
        (player.level || 1) - 1
      );
    }

    if (typeof player.statPoints !== 'number') {
      player.statPoints = 0;
    }

    if (!player.stats) {
      player.stats = {
        kills: {},
        deaths: 0,
        goldEarned: 0,
        chestsOpened: 0
      };
    }

    if (!player.stats.kills) {
      player.stats.kills = {};
    }

    game.version = 10;
  }

  // Версия 11: отдельный прогресс сюжетной кампании.
  // Старые убийства остаются в бестиарии, но не завершают новую сюжетную кампанию автоматически.
  if (game.version < 11) {
    const player = game.player;
    const defaultDex = { warrior: 6, mage: 8, archer: 18, priest: 7 };

    if (!Number.isFinite(player.dex) || player.dex <= 0) {
      player.dex = defaultDex[player.class] || 10;
    }

    if (!player.campaignKills || typeof player.campaignKills !== 'object' || Array.isArray(player.campaignKills)) {
      player.campaignKills = {};
    }

    for (const [enemyId, value] of Object.entries(player.campaignKills)) {
      const kills = Number(value);
      player.campaignKills[enemyId] = Number.isFinite(kills)
        ? Math.max(0, Math.floor(kills))
        : 0;
    }

    game.version = 11;
  }

  // Version 12: equipment slots, runes and accepted/claimed campaign missions.
  if (game.version < 12) {
    const player = game.player;
    const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'amulet', 'ring1', 'ring2'];
    if (!player.equipped || typeof player.equipped !== 'object') player.equipped = {};
    for (const slot of slots) {
      if (player.equipped[slot] === undefined) player.equipped[slot] = null;
    }
    for (const [slot, instance] of Object.entries(player.equipped)) {
      if (!instance || typeof instance !== 'object') continue;
      if (!Array.isArray(instance.runes)) instance.runes = [];
    }

    if (!player.campaignClaimed || typeof player.campaignClaimed !== 'object') {
      player.campaignClaimed = {};
    }
    for (const act of STORY.acts) {
      for (const mission of act.missions) {
        const kills = Number(player.campaignKills?.[mission.id] || 0);
        if (kills >= mission.count) player.campaignClaimed[mission.id] = true;
      }
    }
    if (typeof player.activeCampaignMission !== 'string') {
      player.activeCampaignMission = null;
      for (const act of STORY.acts) {
        if (player.activeCampaignMission) break;
        for (const mission of act.missions) {
          const kills = Number(player.campaignKills?.[mission.id] || 0);
          if (!player.campaignClaimed[mission.id] && kills > 0) {
            player.activeCampaignMission = mission.id;
            break;
          }
        }
      }
    }
    game.version = 12;
  }

  // Version 13: anatomical armor slots and the separate signet slot.
  if (game.version < 13) {
    const player = game.player;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    if (!player.equipped || typeof player.equipped !== 'object') player.equipped = {};

    const legacy = [
      ['helmet', 'head'],
      ['armor', 'chest'],
      ['gloves', 'hands'],
      ['boots', 'legs']
    ];
    for (const [oldSlot, defaultSlot] of legacy) {
      const instance = player.equipped[oldSlot];
      if (!instance) {
        delete player.equipped[oldSlot];
        continue;
      }
      const id = typeof instance === 'string' ? instance : instance.id;
      const destination = id === 'crystal-amulet' ? 'amulet'
        : id === 'ranger-cloak' ? 'back'
        : defaultSlot;
      if (!player.equipped[destination]) player.equipped[destination] = instance;
      else player.inventory.push(instance);
      delete player.equipped[oldSlot];
    }

    const slots = [
      'weapon', 'head', 'shoulders', 'chest', 'back', 'wrists',
      'hands', 'legs', 'ring1', 'ring2', 'amulet', 'seal'
    ];
    for (const slot of slots) {
      if (player.equipped[slot] === undefined) player.equipped[slot] = null;
      const instance = player.equipped[slot];
      if (typeof instance === 'string') {
        player.equipped[slot] = { id: instance, qty: 1, runes: [] };
      } else if (instance && typeof instance === 'object') {
        if (!Array.isArray(instance.runes)) instance.runes = [];
      }
    }

    for (const instance of player.inventory) {
      if (instance && typeof instance === 'object' && instance.id && instance.qty === undefined) instance.qty = 1;
    }
    if (!player.campaignShards || typeof player.campaignShards !== 'object') {
      player.campaignShards = {};
    }
    for (const shard of ['forest', 'ruins', 'shadow']) {
      if (game.shards?.[shard]) player.campaignShards[shard] = true;
    }
    game.version = 13;
  }

  // Version 14: initialize canonical Shards of the Rift dragon flags.
  if (game.version < 14) {
    game.storyDragons = game.storyDragons && typeof game.storyDragons === 'object' && !Array.isArray(game.storyDragons)
      ? game.storyDragons
      : {};
    for (const id of ['ash-herald', 'ice-grasp', 'blood-crown']) {
      if (game.storyDragons[id] !== true) game.storyDragons[id] = false;
    }
    game.storyShards = game.storyShards && typeof game.storyShards === 'object' && !Array.isArray(game.storyShards)
      ? game.storyShards
      : {};
    for (const id of ['flame', 'ice', 'blood']) {
      if (game.storyShards[id] !== true) game.storyShards[id] = false;
    }
    game.version = 14;
  }

  // Version 15: Luck starts at 5 and grows by 0.5 per character level.
  if (game.version < 15) {
    const level = Math.max(1, Math.floor(Number(game.player.level) || 1));
    // Luck did not scale on legacy saves. Backfill the progression bonus
    // for every pre-v15 character, even when the old default value (5) exists.
    game.player.luck = Math.min(100, 5 + (level - 1) * 0.5);
    game.version = 15;
  }

  // Version 16: normalize the 12 canonical equipment slots (including shield, boots and cloak).
  if (game.version < 16) {
    const player = game.player;
    if (!Array.isArray(player.inventory)) player.inventory = [];
    if (!player.equipped || typeof player.equipped !== 'object') player.equipped = {};
    const moves = [
      ['back', 'cloak'],
      ['wrists', 'gloves'],
      ['seal', 'amulet']
    ];
    for (const [oldSlot, newSlot] of moves) {
      const instance = player.equipped[oldSlot];
      if (!instance) { delete player.equipped[oldSlot]; continue; }
      if (!player.equipped[newSlot]) player.equipped[newSlot] = instance;
      else player.inventory.push(instance);
      delete player.equipped[oldSlot];
    }
    for (const oldSlot of ['hands', 'legs']) {
      const instance = player.equipped[oldSlot];
      if (!instance) { delete player.equipped[oldSlot]; continue; }
      const id = typeof instance === 'string' ? instance : instance.id;
      const newSlot = oldSlot === 'hands'
        ? (id === 'tower-shield' ? 'shield' : 'gloves')
        : (id === 'windstep-boots' ? 'boots' : 'legs');
      if (!player.equipped[newSlot]) player.equipped[newSlot] = instance;
      else player.inventory.push(instance);
      delete player.equipped[oldSlot];
    }
    const slots = ['weapon', 'head', 'shoulders', 'chest', 'gloves', 'legs', 'boots', 'shield', 'ring1', 'ring2', 'amulet', 'cloak'];
    for (const slot of slots) {
      if (player.equipped[slot] === undefined) player.equipped[slot] = null;
      const instance = player.equipped[slot];
      if (typeof instance === 'string') player.equipped[slot] = { id: instance, qty: 1, runes: [], sockets: 0 };
      else if (instance && typeof instance === 'object' && !Array.isArray(instance)) {
        if (!Array.isArray(instance.runes)) instance.runes = [];
      }
    }
    game.version = 16;
  }

  // Version 17: rename the obsolete Mana Crystal quest token so the world has exactly three Rift shards.
  if (game.version < 17) {
    if (!Array.isArray(game.player.inventory)) game.player.inventory = [];
    const inventory = game.player.inventory;
    for (let index = 0; index < inventory.length; index++) {
      const entry = inventory[index];
      if (entry === 'mana-crystal') inventory[index] = { id: 'old-archive-seal', qty: 1 };
      else if (entry && typeof entry === 'object' && entry.id === 'mana-crystal') entry.id = 'old-archive-seal';
    }
    game.version = 17;
  }

  // Version 18: preserve a stable per-save seed and initialize the connected world systems.
  if (game.version < 18) {
    const source = [
      Number.isSafeInteger(game.player.createdAt) ? game.player.createdAt : 0,
      typeof game.player.name === 'string' ? game.player.name : '',
      typeof game.player.class === 'string' ? game.player.class : '',
      typeof game.location === 'string' ? game.location : 'village'
    ].join('|');
    let seed = Number.isSafeInteger(game.worldSeed) && game.worldSeed > 0 ? game.worldSeed : 2166136261;
    if (!(Number.isSafeInteger(game.worldSeed) && game.worldSeed > 0)) {
      for (let index = 0; index < source.length; index++) {
        seed = Math.imul(seed ^ source.charCodeAt(index), 16777619);
      }
      seed >>>= 0;
    }
    game.worldSeed = seed || 1;
    game.worldGeneratorVersion = Number.isSafeInteger(game.worldGeneratorVersion) && game.worldGeneratorVersion >= 1
      ? game.worldGeneratorVersion
      : 1;
    ensureWorldState(game, { legacy: true });
    ensureFactionState(game);
    ensureCampaignBranchState(game.player);
    game.version = 18;
  } else {
    const hasWorldState = game.world && typeof game.world === 'object' && !Array.isArray(game.world);
    ensureWorldState(game, { legacy: !hasWorldState });
    ensureFactionState(game);
    ensureCampaignBranchState(game.player);
  }

  // Rebase stored XP thresholds after progression balance changes while
  // preserving the character's fractional progress toward the next level.
  const player = game.player;
  if (Number.isSafeInteger(player.level) && player.level >= 1 && player.level < 100) {
    const nextExp = getExpNext(player.level);
    const previousNext = Number.isSafeInteger(player.expNext) && player.expNext > 0
      ? player.expNext
      : Math.floor(100 * Math.pow(player.level, 1.6));
    const previousExp = Number.isSafeInteger(player.exp) && player.exp >= 0
      ? player.exp
      : 0;
    if (previousNext !== nextExp) {
      const progress = previousNext > 0
        ? Math.min(1, previousExp / previousNext)
        : 0;
      player.exp = Math.min(nextExp - 1, Math.floor(progress * nextExp));
    }
    player.expNext = nextExp;
  }

  // NG+ is a non-negative whole-number cycle counter. Normalize malformed
  // legacy values before validating and exposing the migrated save.
  if (!Number.isSafeInteger(game.player.ngPlus) || game.player.ngPlus < 0) {
    game.player.ngPlus = 0;
  }

  return game;
}

export function loadGameData(slot) {
  const selectedSlot = slot === undefined ? (state.currentSlot ?? 1) : slot;
  if (!isValidSlot(selectedSlot)) return false;

  const previousGame = state.game;
  const previousSlot = state.currentSlot;
  const previousLastSaveTime = lastSaveTime;
  const previousLastSaveGame = lastSaveGame;

  try {
    const data = localStorage.getItem(slotKey(selectedSlot));
    if (!data) return false;

    const game = JSON.parse(data);
    if (!game || typeof game !== 'object' || Array.isArray(game) ||
        !game.player || typeof game.player !== 'object' || Array.isArray(game.player)) {
      throw new Error('Invalid save structure: player data is missing');
    }

    validateCurrentSaveShape(game);
    migrateGame(game);
    // Legacy saves are checked again after migration so invalid balances or
    // impossible levels cannot enter the current v17 runtime.
    validateCurrentSaveShape(game);

    // A defeat is persisted immediately. If the browser was closed on the
    // death screen, restore the character in the village instead of loading
    // an unusable zero-HP state.
    const player = game.player;
    if (Number.isFinite(player.hp) && player.hp <= 0 &&
        Number.isFinite(player.maxHp) && player.maxHp > 0) {
      player.hp = Math.ceil(player.maxHp / 2);
      player.mp = player.class === 'warrior' ? 0
        : Number.isFinite(player.maxMp) ? Math.ceil(player.maxMp / 2) : (player.mp || 0);
      player.effects = [];
      player.cooldowns = {};
      game.location = 'village';
    }

    state.game = game;
    state.currentSlot = selectedSlot;
    lastSaveTime = Date.now();

    // После миграции сразу записываем обновлённую структуру.
    if (!saveGame()) {
      throw new Error('Failed to persist migrated save');
    }

    return true;
  } catch (error) {
    // A failed migration rewrite must not leave a half-loaded character or
    // switch the active slot while the previous save remains authoritative.
    state.game = previousGame;
    state.currentSlot = previousSlot;
    lastSaveTime = previousLastSaveTime;
    lastSaveGame = previousLastSaveGame;
    console.error('[save] Не удалось загрузить сохранение:', error);
    return false;
  }
}

export function hasSave(slot) {
  if (slot === undefined) {
    slot = isValidSlot(state.currentSlot) ? state.currentSlot : 1;
  }
  if (!isValidSlot(slot)) return false;
  try {
    return !!localStorage.getItem(slotKey(slot));
  } catch (error) {
    console.warn('[save] Не удалось проверить слот сохранения:', error);
    return false;
  }
}

export function hasAnySave() {
  for (let i = 1; i <= MAX_SLOT; i++) {
    if (hasSave(i)) return true;
  }

  return false;
}

export function deleteSave(slot, { preserveActiveState = false } = {}) {
  const selectedSlot = slot === undefined ? (state.currentSlot ?? 1) : slot;
  if (!isValidSlot(selectedSlot)) return false;

  try {
    localStorage.removeItem(slotKey(selectedSlot));
  } catch (error) {
    console.error('[save] Не удалось удалить слот сохранения:', error);
    return false;
  }

  if (state.currentSlot === selectedSlot) {
    if (!preserveActiveState) state.game = null;
    lastSaveTime = null;
    lastSaveGame = null;
  }
  return true;
}

export function getSlotInfo(slot) {
  if (!isValidSlot(slot)) return null;

  try {
    const data = localStorage.getItem(slotKey(slot));
    if (!data) return null;
    const game = JSON.parse(data);
    if (!game || typeof game !== 'object' || Array.isArray(game)) return null;
    const player = game.player && typeof game.player === 'object' && !Array.isArray(game.player)
      ? game.player : {};

    return {
      name: typeof player.name === 'string' && player.name ? player.name : '???',
      class: typeof player.class === 'string' && player.class ? player.class : 'mage',
      level: Number.isFinite(player.level) && player.level > 0 ? player.level : 1,
      location: typeof game.location === 'string' && game.location ? game.location : 'village',
      ngPlus: Number.isFinite(player.ngPlus) && player.ngPlus > 0 ? player.ngPlus : 0
    };
  } catch {
    return null;
  }
}

export function getMaxSlot() {
  return MAX_SLOT;
}

// ---------- НАСТРОЙКИ ----------

export function migrateSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    settings = {};
  }

  if (!Number.isFinite(settings.musicVolume)) {
    settings.musicVolume = Number.isFinite(settings.volume) ? settings.volume : 60;
  }
  settings.musicVolume = Math.max(0, Math.min(100, settings.musicVolume));

  if (!Number.isFinite(settings.sfxVolume)) {
    settings.sfxVolume = Number.isFinite(settings.volume) ? settings.volume : 80;
  }
  settings.sfxVolume = Math.max(0, Math.min(100, settings.sfxVolume));

  if (typeof settings.autoSave !== 'boolean') {
    settings.autoSave = true;
  }

  if (typeof settings.showHotkeys !== 'boolean') {
    settings.showHotkeys = true;
  }

  if (typeof settings.showFps !== 'boolean') {
    settings.showFps = false;
  }

  if (![15, 30, 60].includes(settings.autoSaveInterval)) {
    settings.autoSaveInterval = 30;
  }

  if (typeof settings.screenShake !== 'boolean') settings.screenShake = true;
  if (typeof settings.damageNumbers !== 'boolean') settings.damageNumbers = true;
  if (typeof settings.lowHealthEffects !== 'boolean') settings.lowHealthEffects = true;
  if (typeof settings.reducedMotion !== 'boolean') settings.reducedMotion = false;
  if (!Number.isFinite(settings.fontScale)) settings.fontScale = 1;
  settings.fontScale = Math.max(0.85, Math.min(1.3, settings.fontScale));
  if (!['low', 'balanced', 'high'].includes(settings.graphicsQuality)) settings.graphicsQuality = 'high';
  if (typeof settings.weatherEffects !== 'boolean') settings.weatherEffects = true;
  if (typeof settings.ambientFog !== 'boolean') settings.ambientFog = true;
  if (typeof settings.bloomEffects !== 'boolean') settings.bloomEffects = true;

  if (!['easy', 'normal', 'hard'].includes(settings.difficulty)) {
    settings.difficulty = 'normal';
  }

  if (typeof settings.soundEnabled !== 'boolean') {
    settings.soundEnabled = true;
  }

  delete settings.volume;

  settings.settingsVersion = SETTINGS_VERSION;

  return settings;
}

export function loadSettings() {
  let data = null;
  try {
    data = localStorage.getItem(SETTINGS_KEY);
  } catch (error) {
    console.warn('[save] Не удалось прочитать настройки браузера:', error);
  }

  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        state.settings = migrateSettings({
          ...state.settings,
          ...parsed
        });
      } else {
        state.settings = migrateSettings(state.settings);
      }
    } catch {
      state.settings = migrateSettings(state.settings);
    }
  } else {
    state.settings = migrateSettings(state.settings);
  }

  // Settings are optional: blocked/quota-exhausted storage must not prevent
  // the game from booting with safe in-memory defaults.
  return saveSettings();
}

export function saveSettings() {
  if (!state.settings || typeof state.settings !== 'object' || Array.isArray(state.settings)) {
    state.settings = {};
  }

  const snapshot = {
    ...state.settings,
    settingsVersion: SETTINGS_VERSION
  };

  try {
    const serialized = JSON.stringify(snapshot);
    localStorage.setItem(SETTINGS_KEY, serialized);
  } catch (error) {
    console.warn('[save] Не удалось сохранить настройки:', error);
    return false;
  }

  state.settings.settingsVersion = SETTINGS_VERSION;
  return true;
}