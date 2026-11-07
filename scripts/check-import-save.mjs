import assert from 'node:assert/strict';
import { state } from '../systems/state.js';

const originalDocument = globalThis.document;
const originalStorage = globalThis.localStorage;
const originalFileReader = globalThis.FileReader;
const originalConfirm = globalThis.confirm;
const originalSetTimeout = globalThis.setTimeout;
const originalGame = state.game;
const originalSlot = state.currentSlot;

const nodes = new Map();
const toastMessages = [];
globalThis.document = {
  createElement: () => ({ className: '', textContent: '', setAttribute() {}, remove() {} }),
  body: { appendChild(node) { toastMessages.push(node.textContent); } }
};
const storage = new Map([['magic-rpg-save-1', 'KEEP-EXISTING-SAVE']]);
let failImportWrite = false;
let failRollbackWrite = false;
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => {
    if (failImportWrite && key === 'magic-rpg-save-1') {
      storage.set(key, String(value));
      failImportWrite = false;
      throw new Error('simulated storage quota failure after partial write');
    }
    if (failRollbackWrite && key === 'magic-rpg-save-1') {
      failRollbackWrite = false;
      throw new Error('simulated rollback write failure');
    }
    storage.set(key, String(value));
  },
  removeItem: key => storage.delete(key)
};
globalThis.confirm = () => true;
globalThis.setTimeout = () => 1;

let fileContent = '';
globalThis.FileReader = class {
  readAsText() { this.onload({ target: { result: fileContent } }); }
};

try {
  const { importSave, exportSave } = await import('../ui/menu.js');
  state.currentSlot = 1;
  state.game = { player: { name: 'Export test hero' } };
  const originalGetItem = globalThis.localStorage.getItem;
  globalThis.localStorage.getItem = () => { throw new Error('simulated blocked storage read'); };
  assert.doesNotThrow(() => exportSave(), 'export must not throw when browser storage is blocked');
  assert.match(toastMessages.at(-1), /хранилище браузера недоступно/,
    'export must report a blocked storage read to the user');
  assert.match(storage.get('magic-rpg-save-1'), /Export test hero/,
    'export must persist the active in-memory game before reading the save slot');
  storage.set('magic-rpg-save-1', 'KEEP-EXISTING-SAVE');
  globalThis.localStorage.getItem = originalGetItem;

  let readCalls = 0;
  let failFileRead = false;
  globalThis.FileReader.prototype.readAsText = function () {
    readCalls++;
    if (failFileRead) {
      failFileRead = false;
      this.onerror(new Error('simulated file read failure'));
      return;
    }
    this.onload({ target: { result: fileContent } });
  };
  const runImport = content => {
    fileContent = JSON.stringify(content);
    const event = { target: { files: [{ size: fileContent.length }], value: 'selected.json' } };
    importSave(event);
    return event;
  };

  const oversizedEvent = { target: { files: [{ size: 6 * 1024 * 1024 }], value: 'oversized.json' } };
  importSave(oversizedEvent);
  assert.equal(readCalls, 0, 'oversized save must be rejected before reading');
  assert.equal(storage.get('magic-rpg-save-1'), 'KEEP-EXISTING-SAVE');

  runImport({ version: 999, player: { name: 'Future save', level: 10 } });
  assert.equal(storage.get('magic-rpg-save-1'), 'KEEP-EXISTING-SAVE', 'unsupported future save must not overwrite the slot');

  runImport({ version: 18, player: { name: 'Broken save', level: 10 } });
  assert.equal(storage.get('magic-rpg-save-1'), 'KEEP-EXISTING-SAVE', 'incomplete current save must not overwrite the slot');

  failFileRead = true;
  const readFailureEvent = runImport({ version: 16, player: { name: 'Unreadable file' } });
  assert.equal(readFailureEvent.target.value, '', 'failed file reads must clear the input');
  assert.match(toastMessages.at(-1), /Не удалось прочитать файл сохранения/,
    'failed FileReader operations must report a useful error');

  const legacy = {
    version: 16,
    location: 'village',
    player: {
      name: 'Legacy hero', class: 'mage', level: 5, exp: 0, expNext: 100,
      gold: 50, hp: 80, maxHp: 100, mp: 30, maxMp: 50,
      str: 5, int: 8, wis: 5, con: 5, dex: 5, luck: 5,
      statPoints: 0, passivePoints: 0,
      inventory: [{ id: 'mana-crystal', qty: 1 }],
      spells: [], equipped: {}, stats: { kills: {} }, campaignKills: {}, campaignClaimed: {},
      activeCampaignMission: null, effects: [], buffs: []
    },
    storyShards: { flame: false, ice: false, blood: false },
    storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false }
  };
  const malformedLegacy = structuredClone(legacy);
  malformedLegacy.player.level = 'not-a-number';
  runImport(malformedLegacy);
  assert.equal(storage.get('magic-rpg-save-1'), 'KEEP-EXISTING-SAVE', 'legacy save with invalid core values must be rejected after migration');

  failImportWrite = true;
  runImport(legacy);
  assert.equal(storage.get('magic-rpg-save-1'), 'KEEP-EXISTING-SAVE', 'failed import write must restore the previous slot');
  assert.match(toastMessages.at(-1), /прежнее сохранение восстановлено/,
    'import must only claim rollback success after verifying the previous save');

  failImportWrite = true;
  failRollbackWrite = true;
  runImport(legacy);
  assert.notEqual(storage.get('magic-rpg-save-1'), 'KEEP-EXISTING-SAVE',
    'test must simulate a rollback failure after a partial import write');
  assert.match(toastMessages.at(-1), /не удалось записать импорт и подтвердить восстановление/i,
    'import must warn when rollback cannot be verified');
  storage.set('magic-rpg-save-1', 'KEEP-EXISTING-SAVE');

  runImport(legacy);
  const importedText = storage.get('magic-rpg-save-1');
  assert.notEqual(importedText, 'KEEP-EXISTING-SAVE',
    `legacy import should persist; last notification: ${toastMessages.at(-1) || 'none'}`);
  const imported = JSON.parse(importedText);
  assert.equal(imported.version, 18, 'legacy save should be migrated before storage');
  assert.equal(imported.player.inventory[0].id, 'old-archive-seal', 'legacy quest item migration should be retained');
  assert.equal(imported.player.name, 'Legacy hero');
  console.log('check-import-save: PASS (invalid files and failed writes preserve existing saves; legacy saves migrate before import)');
} finally {
  state.game = originalGame;
  state.currentSlot = originalSlot;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
  if (originalFileReader === undefined) delete globalThis.FileReader;
  else globalThis.FileReader = originalFileReader;
  if (originalConfirm === undefined) delete globalThis.confirm;
  else globalThis.confirm = originalConfirm;
  if (originalSetTimeout === undefined) delete globalThis.setTimeout;
  else globalThis.setTimeout = originalSetTimeout;
}
