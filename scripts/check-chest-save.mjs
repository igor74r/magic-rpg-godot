import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { createCharacter } from '../systems/character.js';
import { openChest } from '../systems/overworld/spawn.js';
import { getDailyQuests } from '../systems/dailyQuests.js';
import { saveGame } from '../systems/save.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

assert.equal(createCharacter('Chest Save Regression', 'warrior'), true);
state.currentSlot = 1;
state.overworld = {
  active: true, locationId: 'forest', sourceLocationId: 'forest',
  floatingNumbers: [], particles: [], log: [], enemies: [], chests: [], events: [],
  combat: null, defeated: false
};
const chest = { x: 100, y: 100, opened: false };
state.overworld.chests.push(chest);
state.game.player.dailyQuests = {
  date: Date.now(),
  list: [
    { id: 'q-chest', type: 'chest', text: 'Открой 3 сундука', target: 'chest', max: 3, gold: 6, exp: 25, current: 0, completed: false, claimed: false },
    { id: 'q-kill-any', type: 'kill', text: 'Убей 10 врагов', target: 'any', max: 10, gold: 8, exp: 50, current: 0, completed: false, claimed: false },
    { id: 'q-kill-goblin', type: 'kill', text: 'Убей 5 гоблинов', target: 'goblin', max: 5, gold: 6, exp: 30, current: 0, completed: false, claimed: false }
  ]
};
getDailyQuests();
assert.equal(saveGame(), true, 'persist the normalized daily quest baseline before the chest transaction');
const before = JSON.stringify(state.game);
const savedBefore = storage.get('magic-rpg-save-1');
const originalSetItem = globalThis.localStorage.setItem;
globalThis.localStorage.setItem = (key, value) => {
  const candidate = JSON.parse(value);
  if (candidate.player.stats.chestsOpened === 1) throw new Error('simulated final chest save quota');
  storage.set(key, String(value));
};

const result = openChest(chest);
globalThis.localStorage.setItem = originalSetItem;

assert.equal(result, false, 'chest opening must fail when persistence fails');
assert.equal(chest.opened, false, 'chest must remain available to retry');
assert.equal(JSON.stringify(state.game), before, 'item, quest and chest statistics must roll back');
assert.equal(storage.get('magic-rpg-save-1'), savedBefore,
  'daily chest progress must not be persisted separately when the chest reward save fails');
assert.equal(JSON.parse(storage.get('magic-rpg-save-1')).player.dailyQuests.list.find(q => q.id === 'q-chest').current, 0,
  'failed chest transaction must leave daily chest quest progress unchanged');
assert.equal(state.overworld.log.length, 1, 'failed chest transactions must not publish reward log entries');
assert.match(state.overworld.log[0].msg, /Не удалось сохранить сундук/, 'failed chest transaction must publish only its rollback warning');
assert.equal(state.overworld.floatingNumbers.length, 0, 'failed chest transactions must not show reward floating numbers');
assert.equal(state.overworld.particles.length, 0, 'failed chest transactions must not spawn reward particles');
state.overworld = null;
state.game = null;
console.log('check-chest-save: OK — chest rewards rollback on persistence failure');
