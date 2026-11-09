// Migration regression: exercise every supported save version v1-v17 without touching real browser storage.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { migrateGame, loadGameData, migrateLegacySave, hasSave, deleteSave, getSlotInfo, saveGame, validateCurrentSaveShape } from '../systems/save.js';
import { state } from '../systems/state.js';
import { EQUIPMENT_SLOTS } from '../systems/inventory.js';
import { createCharacter } from '../systems/character.js';
import { getExpNext } from '../systems/progression.js';

const expectedSlots = ['weapon','head','shoulders','chest','gloves','legs','boots','shield','ring1','ring2','amulet','cloak'];
const failures = [];
for (let version = 1; version <= 17; version++) {
  const equipped = version <= 12
    ? {
        weapon: 'iron-sword', armor: 'leather-armor',
        helmet: { id: 'cinder-visor', qty: 1 },
        hands: { id: 'tower-shield', qty: 1 },
        legs: { id: 'windstep-boots', qty: 1 },
        back: { id: 'ranger-cloak', qty: 1 },
        wrists: { id: 'oath-bracers', qty: 1 },
        seal: { id: 'seal-five-orders', qty: 1 }
      }
    : version <= 15
      ? {
          weapon: 'iron-sword', head: { id: 'cinder-visor', qty: 1 },
          chest: { id: 'leather-armor', qty: 1 },
          hands: { id: 'tower-shield', qty: 1 },
          legs: { id: 'windstep-boots', qty: 1 },
          back: { id: 'ranger-cloak', qty: 1 },
          wrists: { id: 'oath-bracers', qty: 1 },
          seal: { id: 'seal-five-orders', qty: 1 },
          shoulders: null, ring1: null, ring2: null
        }
      : {
          weapon: { id: 'iron-sword', qty: 1 },
          head: { id: 'cinder-visor', qty: 1 },
          chest: { id: 'leather-armor', qty: 1 },
          shield: { id: 'tower-shield', qty: 1 },
          boots: { id: 'windstep-boots', qty: 1 },
          cloak: { id: 'ranger-cloak', qty: 1 },
          gloves: { id: 'oath-bracers', qty: 1 },
          amulet: { id: 'seal-five-orders', qty: 1 },
          shoulders: null, legs: null, ring1: null, ring2: null
        };
  const player = {
    name: 'Migration Fixture', class: 'warrior', level: 12, exp: 345, gold: 678,
    hp: 100, maxHp: 120, mp: 40, maxMp: 80,
    str: 12, int: 8, wis: 9, con: 10, dex: 10, luck: 5,
    statPoints: 0, passivePoints: 0,
    inventory: [version < 17 ? { id: 'mana-crystal', qty: 2 } : { id: 'old-archive-seal', qty: 2 }, { id: 'health-potion', qty: 3 }],
    spells: ['fireball'],
    stats: { kills: { wolf: 17 }, deaths: 4, goldEarned: 900, chestsOpened: 2 },
    equipped,
    campaignKills: { 'a1-m1': 3 }
  };
  if (version >= 12) {
    player.campaignClaimed = { 'a1-m1': true };
    player.activeCampaignMission = null;
  }
  if (version >= 15) player.luck = 10.5;
  const fixture = { version, player, location: 'village', shards: { forest: true } };
  if (version >= 14) {
    fixture.storyShards = { flame: false, ice: false, blood: false };
    fixture.storyDragons = { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false };
  }
  const migrated = migrateGame(fixture);
  try {
    assert.doesNotThrow(() => validateCurrentSaveShape(migrated),
      'every supported legacy version must migrate into a valid current save');
    assert.equal(migrated.version, 18);
    assert.ok(Number.isSafeInteger(migrated.worldSeed) && migrated.worldSeed > 0 && migrated.worldSeed <= 0xffffffff,
      'every migrated save must receive a stable unsigned world seed');
    assert.equal(migrated.worldGeneratorVersion, 1);
    assert.equal(migrated.world.seed, migrated.worldSeed, 'nested world state must reuse the compatibility seed');
    assert.equal(migrated.world.generatorVersion, migrated.worldGeneratorVersion);
    assert.equal(migrated.world.legacyFastTravel, true, 'legacy saves must retain unrestricted travel');
    const worldSeed = migrated.worldSeed;
    migrateGame(migrated);
    assert.equal(migrated.worldSeed, worldSeed, 'world seed must remain stable across repeated migrations');
    assert.equal(migrated.world.seed, worldSeed, 'nested world seed must remain stable across repeated migrations');
    assert.equal(migrated.player.name, 'Migration Fixture');
    assert.equal(migrated.player.level, 12);
    assert.equal(migrated.player.expNext, getExpNext(12));
    assert.equal(migrated.player.exp, 16, 'legacy XP progress must be preserved proportionally');
    assert.equal(migrated.player.gold, 678);
    assert.deepEqual(migrated.player.stats.kills, { wolf: 17 });
    assert.equal(migrated.player.stats.deaths, 4);
    assert.ok(migrated.player.spells.includes('fireball'));
    assert.equal(migrated.player.inventory.find(item => item.id === 'old-archive-seal')?.qty, 2);
    assert.equal(migrated.player.inventory.find(item => item.id === 'health-potion')?.qty, 3);
    assert.equal(migrated.player.equipped.weapon?.id, 'iron-sword');
    assert.equal(migrated.player.equipped.chest?.id, 'leather-armor');
    assert.equal(migrated.player.equipped.head?.id, 'cinder-visor');
    assert.equal(migrated.player.equipped.shield?.id, 'tower-shield');
    assert.equal(migrated.player.equipped.boots?.id, 'windstep-boots');
    assert.equal(migrated.player.equipped.cloak?.id, 'ranger-cloak');
    assert.equal(migrated.player.equipped.gloves?.id, 'oath-bracers');
    assert.equal(migrated.player.equipped.amulet?.id, 'seal-five-orders');
    assert.deepEqual(Object.keys(migrated.player.equipped).sort(), [...expectedSlots].sort());
    assert.equal(migrated.player.luck, 10.5,
      'legacy characters receive the Luck progression bonus during v15 migration');
    assert.equal(migrated.player.campaignClaimed['a1-m1'], true);
    assert.equal(migrated.storyShards.flame, false);
    assert.equal(migrated.storyShards.ice, false);
    assert.equal(migrated.storyShards.blood, false);
    assert.equal(migrated.storyDragons['blood-crown'], false);
    const snapshot = JSON.stringify(migrated);
    migrateGame(migrated);
    assert.equal(JSON.stringify(migrated), snapshot, 'migration must be idempotent');
    console.log(`PASS save v${version} -> v18 (data, slots, shards, Luck, idempotence)`);
  } catch (error) {
    failures.push({ version, error: error.message });
    console.log(`FAIL save v${version} -> v18: ${error.message}`);
  }
}
assert.deepEqual(EQUIPMENT_SLOTS, expectedSlots);

const menuSource = await readFile(new URL('../ui/menu.js', import.meta.url), 'utf8');
const newGameSlotBody = menuSource.match(/export function newGameSlot\(slot\) \{([\s\S]*?)\n\}/)?.[1] || '';
const loadSlotBody = menuSource.match(/export function loadSlot\(slot\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(newGameSlotBody, /state\.pendingSlot\s*=\s*slot/);
assert.doesNotMatch(newGameSlotBody, /state\.currentSlot\s*=/,
  'new-game selection must not change the active slot before character creation');
assert.doesNotMatch(loadSlotBody, /state\.currentSlot\s*=/,
  'failed slot loads must not switch the active slot in the UI');
const saveAndMenuBody = menuSource.match(/export function saveAndMenu\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(saveAndMenuBody, /if\s*\(!saveGame\(\)\)/,
  'manual save failure must stop navigation away from the active game');
assert.match(saveAndMenuBody, /return false/,
  'manual save failure must be reported to its caller');
console.log('PASS menu defers slot switching until a new character is created and load succeeds');

// Exercise the real load-and-rewrite path against disposable in-memory storage.
const storage = new Map([
  ['magic-rpg-save-1', JSON.stringify({
    version: 16,
    player: {
      name: 'Storage Fixture', class: 'mage', level: 8, exp: 0, expNext: getExpNext(8), gold: 0,
      hp: 80, maxHp: 100, mp: 30, maxMp: 60,
      str: 5, int: 8, wis: 7, con: 6, dex: 8, luck: 8.5,
      statPoints: 0, passivePoints: 0,
      inventory: [{ id: 'mana-crystal', qty: 4 }],
      spells: [], stats: { kills: {} }, campaignKills: {}, campaignClaimed: {}, activeCampaignMission: null,
      equipped: Object.fromEntries(expectedSlots.map(slot => [slot, null]))
    },
    storyShards: { flame: false, ice: false, blood: false },
    storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false }
  })],
  ['magic-rpg-settings', '{"sentinel":"keep"}']
]);
let failWrites = false;
globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => {
    if (failWrites) throw new Error('QuotaExceededError');
    storage.set(key, String(value));
  },
  removeItem: key => storage.delete(key)
};
state.game = null;
state.currentSlot = 1;
assert.equal(createCharacter('Fresh Schema Hero', 'warrior'), true);
const freshSave = JSON.parse(storage.get('magic-rpg-save-1'));
assert.equal(freshSave.version, 18, 'new character must be saved with current schema');
assert.deepEqual(Object.keys(freshSave.player.equipped).sort(), [...expectedSlots].sort(),
  'new character must pass equipment-slot migrations before first save');
assert.ok(!['back', 'wrists', 'hands', 'seal'].some(slot => slot in freshSave.player.equipped),
  'new character must not persist obsolete equipment slots');

for (const [label, mutate] of [
  ['unsafe gold balance', player => { player.gold = Number.MAX_SAFE_INTEGER + 1; }],
  ['unknown class', player => { player.class = 'dragon'; }],
  ['missing class', player => { delete player.class; }],
  ['infinite HP', player => { player.hp = Infinity; }],
  ['zero maximum HP', player => { player.maxHp = 0; }],
  ['invalid MP', player => { player.mp = NaN; }],
  ['negative XP', player => { player.exp = -1; }],
  ['invalid strength', player => { player.str = 'strong'; }],
  ['negative stat points', player => { player.statPoints = -1; }],
  ['fractional level', player => { player.level = 1.5; }],
  ['level above the cap', player => { player.level = 101; }],
  ['negative NG+ cycle', player => { player.ngPlus = -1; }],
  ['fractional NG+ cycle', player => { player.ngPlus = 1.5; }],
  ['string NG+ cycle', player => { player.ngPlus = '2'; }],
  ['unsafe NG+ cycle', player => { player.ngPlus = Number.MAX_SAFE_INTEGER + 1; }]
]) {
  const invalid = JSON.parse(JSON.stringify(freshSave));
  mutate(invalid.player);
  assert.throws(() => validateCurrentSaveShape(invalid), /Invalid current save structure/,
    `current save validator must reject ${label}`);
}
const legacyPriestShape = JSON.parse(JSON.stringify(freshSave));
legacyPriestShape.player.class = 'priest';
assert.doesNotThrow(() => validateCurrentSaveShape(legacyPriestShape),
  'legacy priest saves must remain valid for backward compatibility');
console.log('PASS current save validator rejects invalid core stats, balances, classes and levels; legacy Priest remains supported');
const malformedLegacyCycle = JSON.parse(JSON.stringify(freshSave));
malformedLegacyCycle.version = 16;
malformedLegacyCycle.player.ngPlus = -4;
migrateGame(malformedLegacyCycle);
assert.equal(malformedLegacyCycle.player.ngPlus, 0,
  'legacy saves with invalid NG+ counters must normalize to cycle zero');
assert.doesNotThrow(() => validateCurrentSaveShape(malformedLegacyCycle),
  'normalized legacy NG+ counters must pass current schema validation');
console.log('PASS malformed legacy NG+ counters normalize safely; current saves reject invalid counters');
assert.equal(freshSave.world.legacyFastTravel, false, 'new characters must use the connected world graph');
assert.deepEqual(freshSave.world.discoveredRegions, ['village'], 'new characters must start with Aurora discovered only');
assert.equal(freshSave.world.currentRegionId, 'village', 'new characters must track their starting region');
assert.deepEqual(freshSave.world.regionVisits, { village: 1 }, 'the starting region visit seed must be initialized exactly once');
assert.equal(freshSave.worldSeed, freshSave.world.seed, 'top-level and nested save seeds must stay synchronized');
assert.equal(freshSave.worldGeneratorVersion, freshSave.world.generatorVersion);
const fractionalGeneratorSave = JSON.parse(JSON.stringify(freshSave));
fractionalGeneratorSave.worldGeneratorVersion = 2.75;
fractionalGeneratorSave.world.generatorVersion = 2.75;
migrateGame(fractionalGeneratorSave);
assert.equal(fractionalGeneratorSave.worldGeneratorVersion, 2);
assert.equal(fractionalGeneratorSave.world.generatorVersion, 2);
assert.doesNotThrow(() => validateCurrentSaveShape(fractionalGeneratorSave),
  'fractional generator metadata must normalize to a valid synchronized integer version');
console.log('PASS new character starts on v18 with a fresh, non-legacy world');
storage.set('magic-rpg-save-1', JSON.stringify({
  version: 16,
  player: {
    name: 'Storage Fixture', class: 'mage', level: 8, exp: 0, expNext: getExpNext(8), gold: 0, luck: 8.5,
    hp: 80, maxHp: 100, mp: 30, maxMp: 60,
    str: 5, int: 8, wis: 7, con: 6, dex: 8,
    statPoints: 0, passivePoints: 0,
    inventory: [{ id: 'mana-crystal', qty: 4 }], spells: [],
    stats: { kills: {} }, campaignKills: {}, campaignClaimed: {}, activeCampaignMission: null,
    equipped: Object.fromEntries(expectedSlots.map(slot => [slot, null]))
  },
  storyShards: { flame: false, ice: false, blood: false },
  storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false }
}));
state.game = null;
const loaded = loadGameData(1);
const rewritten = JSON.parse(storage.get('magic-rpg-save-1'));
const storagePathOk = loaded && state.game?.version === 18 && rewritten.version === 18 &&
  rewritten.player.inventory[0]?.id === 'old-archive-seal' && rewritten.player.inventory[0]?.qty === 4 &&
  storage.get('magic-rpg-settings') === '{"sentinel":"keep"}';
console.log(`${storagePathOk ? 'PASS' : 'FAIL'} loadGameData migrates and rewrites v16 slot without changing settings`);
assert.ok(storagePathOk);

// A crash/reload after defeat must not strand the player at zero HP.
const defeatedSave = JSON.parse(JSON.stringify(freshSave));
defeatedSave.location = 'dark-forest';
defeatedSave.player.class = 'mage';
defeatedSave.player.hp = 0;
defeatedSave.player.maxHp = 120;
defeatedSave.player.mp = 0;
defeatedSave.player.maxMp = 60;
defeatedSave.player.effects = [{ id: 'poison', duration: 3 }];
defeatedSave.player.cooldowns = { fireball: 4 };
defeatedSave.player.stats.deaths = 2;
storage.set('magic-rpg-save-1', JSON.stringify(defeatedSave));
state.game = null;
assert.equal(loadGameData(1), true, 'defeated save should still load');
assert.equal(state.game.player.hp, 60, 'defeated player should recover half HP');
assert.equal(state.game.player.mp, 30, 'non-warrior should recover half MP');
assert.equal(state.game.location, 'village', 'defeated player should return to village');
assert.deepEqual(state.game.player.effects, [], 'temporary effects must clear on recovery');
assert.deepEqual(state.game.player.cooldowns, {}, 'cooldowns must clear on recovery');
assert.equal(state.game.player.stats.deaths, 2, 'death statistics must be preserved');
const recovered = JSON.parse(storage.get('magic-rpg-save-1'));
assert.equal(recovered.player.hp, 60, 'recovered state must be rewritten to storage');
console.log('PASS zero-HP save recovers to village at half HP/MP without losing death stats');


// Explicit null must never alias the active slot during deletion.
storage.set('magic-rpg-save-1', '{"marker":"active-slot-must-survive"}');
deleteSave(null);
assert.equal(storage.get('magic-rpg-save-1'), '{"marker":"active-slot-must-survive"}',
  'null slot must not delete the active save');

// Save-slot API must reject invalid indices rather than read, write or delete
// arbitrary localStorage keys.
for (const invalidSlot of [0, -1, 4, 1.5, '1', null]) {
  assert.equal(loadGameData(invalidSlot), false, `invalid slot ${String(invalidSlot)} must not load`);
  assert.equal(hasSave(invalidSlot), false, `invalid slot ${String(invalidSlot)} must not be reported as saved`);
  assert.equal(getSlotInfo(invalidSlot), null, `invalid slot ${String(invalidSlot)} must not expose slot info`);
}
storage.set('magic-rpg-save-4', '{"marker":"must-not-delete"}');
deleteSave(4);
assert.equal(storage.get('magic-rpg-save-4'), '{"marker":"must-not-delete"}',
  'invalid slot must not delete storage outside the three supported slots');
console.log('PASS save-slot APIs reject invalid slot indices');

// Legacy single-slot saves must not be deleted if slot 1 is already occupied.
storage.set('magic-rpg-save', JSON.stringify({ marker: 'legacy-character' }));
storage.set('magic-rpg-save-1', JSON.stringify({ marker: 'slot-one-character' }));
migrateLegacySave();
assert.equal(storage.get('magic-rpg-save'), JSON.stringify({ marker: 'legacy-character' }),
  'legacy save must remain untouched when slot 1 is occupied');
assert.equal(storage.get('magic-rpg-save-1'), JSON.stringify({ marker: 'slot-one-character' }),
  'existing slot 1 must not be overwritten');
console.log('PASS legacy save is preserved when slot 1 is occupied');

// When slot 1 is empty, migration copies the legacy save and then removes the old key.
storage.delete('magic-rpg-save-1');
migrateLegacySave();
assert.equal(storage.get('magic-rpg-save-1'), JSON.stringify({ marker: 'legacy-character' }),
  'legacy save must migrate into empty slot 1');
assert.equal(storage.has('magic-rpg-save'), false, 'legacy key is removed only after successful copy');
console.log('PASS legacy save migrates when slot 1 is empty');

// Newer and malformed schema versions must be rejected without rewriting the slot.
for (const unsupportedVersion of [19, 'future', 17.5, -1, true]) {
  const original = JSON.stringify({
    version: unsupportedVersion,
    player: { name: 'Future Save', level: 20, inventory: [{ id: 'future-item', qty: 1 }] },
    futureSchemaMarker: { preserve: true }
  });
  storage.set('magic-rpg-save-1', original);
  state.game = null;
  const realConsoleError = console.error;
  console.error = () => {};
  let rejected = false;
  try {
    rejected = loadGameData(1) === false;
  } finally {
    console.error = realConsoleError;
  }
  assert.equal(rejected, true, `unsupported schema ${unsupportedVersion} must be rejected`);
  assert.equal(storage.get('magic-rpg-save-1'), original, `unsupported schema ${unsupportedVersion} must not be rewritten`);
  assert.equal(state.game, null, `unsupported schema ${unsupportedVersion} must not replace active game state`);
  console.log(`PASS future/malformed save version ${String(unsupportedVersion)} is rejected without mutation`);
}

const malformedSave = JSON.stringify({ version: 18, inventory: [{ id: 'health-potion', qty: 1 }] });
storage.set('magic-rpg-save-1', malformedSave);
state.game = null;
const realConsoleError = console.error;
console.error = () => {};
let malformedRejected = false;
try {
  malformedRejected = loadGameData(1) === false;
} finally {
  console.error = realConsoleError;
}
assert.equal(malformedRejected, true, 'save without player object must be rejected');
assert.equal(storage.get('magic-rpg-save-1'), malformedSave, 'malformed save must not be rewritten');
assert.equal(state.game, null, 'malformed save must not replace active game state');
console.log('PASS malformed save structure is rejected without mutation');

const incompleteCurrentSave = JSON.stringify({ version: 18, player: { name: 'Incomplete Current Save', level: 10 } });
storage.set('magic-rpg-save-1', incompleteCurrentSave);
state.game = null;
console.error = () => {};
let incompleteCurrentRejected = false;
try {
  incompleteCurrentRejected = loadGameData(1) === false;
} finally {
  console.error = realConsoleError;
}
assert.equal(incompleteCurrentRejected, true, 'incomplete v18 save must be rejected');
assert.equal(storage.get('magic-rpg-save-1'), incompleteCurrentSave, 'incomplete v18 save must not be rewritten');
assert.equal(state.game, null, 'incomplete v18 save must not replace active game state');
console.log('PASS incomplete current-version save is rejected without mutation');

// Failed writes must not mutate live schema/playtime or replace the active slot.
const previousNow = Date.now;
const previousGame = {
  version: 16,
  player: { name: 'Active Character', playtimeSec: 120 }
};
state.game = previousGame;
state.currentSlot = 2;
const previousPlaytime = previousGame.player.playtimeSec;
Date.now = () => previousNow() + 120000;
failWrites = true;
const saveFailed = saveGame() === false;
assert.equal(saveFailed, true, 'storage write failure should return false');
assert.equal(previousGame.version, 16, 'failed write must not stamp the current schema version');
assert.equal(previousGame.player.playtimeSec, previousPlaytime, 'failed write must not consume playtime');
storage.set('magic-rpg-save-1', JSON.stringify(freshSave));
const loadFailed = loadGameData(1) === false;
assert.equal(loadFailed, true, 'load must fail when migrated save cannot be rewritten');
assert.equal(state.game, previousGame, 'failed load must preserve the previous active character');
assert.equal(state.currentSlot, 2, 'failed load must preserve the previous active slot');
failWrites = false;
Date.now = previousNow;
console.log('PASS quota/write failure preserves live state, playtime and active slot');

// A newly created character in another slot must not inherit the old session's playtime.
const realDateNow = Date.now;
try {
  state.game = null;
  state.currentSlot = 1;
  Date.now = () => 100000;
  assert.equal(createCharacter('First Slot Hero', 'warrior'), true);
  state.pendingSlot = 2;
  assert.equal(state.currentSlot, 1, 'choosing a new slot must not switch the active save before character creation');
  Date.now = () => 220000;
  assert.equal(createCharacter('Second Slot Hero', 'mage'), true);
  assert.equal(state.currentSlot, 2, 'new character creation should activate the pending slot');
  assert.equal(state.pendingSlot, null, 'pending slot should clear after character creation');
  assert.equal(state.game.player.playtimeSec, 0, 'new character must start with zero playtime');
  assert.equal(JSON.parse(storage.get('magic-rpg-save-2')).player.playtimeSec, 0,
    'new slot must not inherit time from the previous character');
  Date.now = () => 280000;
  saveGame();
  assert.equal(state.game.player.playtimeSec, 60, 'playtime should accrue within the same save session');
  console.log('PASS playtime is isolated between slots and accumulates within a single character');
} finally {
  Date.now = realDateNow;
}

// Legacy-key migration must retain the original when writing the new slot fails.
storage.delete('magic-rpg-save-1');
storage.set('magic-rpg-save', JSON.stringify(freshSave));
failWrites = true;
assert.equal(migrateLegacySave(), false, 'legacy migration should report blocked storage');
assert.equal(storage.has('magic-rpg-save'), true, 'failed migration must preserve the legacy key');
assert.equal(storage.has('magic-rpg-save-1'), false, 'failed migration must not leave a partial destination');
failWrites = false;
assert.equal(migrateLegacySave(), true, 'legacy migration should succeed when storage recovers');
assert.equal(storage.has('magic-rpg-save'), false, 'legacy key should be removed after verified migration');
assert.equal(storage.has('magic-rpg-save-1'), true, 'verified destination slot should exist');
console.log('PASS legacy save migration preserves source data on write failure');

console.log(`Save migration regression: ${17 - failures.length}/17 legacy versions + load path + future-version and malformed-save guards passed; 12 equipment slots verified.`);
if (failures.length) process.exitCode = 1;
