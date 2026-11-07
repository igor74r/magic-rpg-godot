import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { NPCS } from '../data/npcs.js';

const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { innerHTML: '', style: {}, className: '', textContent: '', classList: { add() {}, remove() {} }, setAttribute() {}, remove() {} });
  return nodes.get(id);
};
const originalDocument = globalThis.document;
const originalStorage = globalThis.localStorage;
const originalSetTimeout = globalThis.setTimeout;
globalThis.document = {
  querySelectorAll: () => [],
  getElementById: node,
  createElement: () => ({ className: '', textContent: '', setAttribute() {}, remove() {} }),
  body: { appendChild() {} }
};
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
globalThis.setTimeout = () => 1;

try {
  const { payBardUI, petCatUI, takeElderBlessingUI, useWellUI, acceptElderQuestUI, turnInElderQuestUI, openBlacksmith } = await import('../ui/npcs.js');
  const { getEquipmentForgeLevel, canUpgrade, upgradeEquipment } = await import('../systems/crafting.js');
  state.currentSlot = 1;
  state.overworld = { active: true };
  state.game = {
    player: {
      name: 'NPC test', class: 'mage', level: 1, gold: 30,
      hp: 20, maxHp: 100, mp: 0, maxMp: 50,
      inventory: [], spells: [], equipped: {}, stats: {},
      buffs: [], effects: [], campaignKills: {}, campaignClaimed: {},
      activeCampaignMission: null
    },
    storyShards: { flame: false, ice: false, blood: false },
    storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false }
  };
  const p = state.game.player;
  p.equipped.weapon = { id: 'iron-sword', forgeLevel: 1.5 };
  assert.equal(getEquipmentForgeLevel('weapon'), 0, 'invalid forge levels must normalize to the safe baseline');
  assert.equal(canUpgrade('weapon').ok, true, 'invalid forge levels must not permanently block a valid upgrade');
  assert.doesNotThrow(() => openBlacksmith(), 'blacksmith UI must recover from malformed saved forge levels');
  p.gold = 100;
  p.equipped.weapon.upgradePercent = 'invalid';
  assert.equal(upgradeEquipment('weapon').ok, true, 'a malformed forge level must still allow a baseline upgrade');
  assert.equal(p.equipped.weapon.forgeLevel, 1, 'upgrade must store the validated next forge level');
  assert.equal(p.equipped.weapon.upgradePercent, 0.05, 'invalid upgrade percentages must reset to a safe baseline');
  p.equipped.weapon.forgeLevel = 2;
  assert.equal(getEquipmentForgeLevel('weapon'), 2, 'valid forge levels must remain visible');

  assert.equal(NPCS.bard.cost, 15, 'bard cost must match the visible service price');
  p.gold = Number.MAX_SAFE_INTEGER + 1;
  assert.equal(payBardUI(), false, 'bard must reject unsafe gold balances');
  p.gold = 30;
  assert.equal(payBardUI(), true);
  assert.equal(p.gold, 15);
  assert.equal(p.buffs.filter(b => b.id === 'bardBuff').length, 1);
  assert.equal(payBardUI(), false, 'bard service must not charge twice while its buff is active');
  assert.equal(p.gold, 15, 'duplicate bard call must not spend gold');

  assert.equal(petCatUI(), true);
  assert.equal(p.buffs.filter(b => b.id === 'catLuck').length, 1);
  assert.equal(petCatUI(), false, 'cat luck must not stack through repeated calls');
  assert.equal(p.buffs.filter(b => b.id === 'catLuck').length, 1);

  const originalSetItem = globalThis.localStorage.setItem;
  try {
    globalThis.localStorage.setItem = () => { throw new Error('simulated NPC service storage failure'); };
    p.gold = 30;
    p.buffs = [];
    let snapshot = JSON.stringify(p);
    assert.equal(payBardUI(), false, 'bard payment must fail when persistence fails');
    assert.equal(JSON.stringify(p), snapshot, 'failed bard payment must restore gold and buffs');

    p.buffs = [];
    snapshot = JSON.stringify(p);
    assert.equal(petCatUI(), false, 'cat service must fail when persistence fails');
    assert.equal(JSON.stringify(p), snapshot, 'failed cat service must restore buffs');

    p.effects = [];
    snapshot = JSON.stringify(p);
    assert.equal(takeElderBlessingUI(), false, 'elder blessing must fail when persistence fails');
    assert.equal(JSON.stringify(p), snapshot, 'failed elder blessing must restore effects');

    p.hp = 10; p.mp = 5; p.stats.lastWellUse = 0;
    snapshot = JSON.stringify(p);
    assert.equal(useWellUI(), false, 'well healing must fail when persistence fails');
    assert.equal(JSON.stringify(p), snapshot, 'failed well use must restore health, mana and cooldown');

    p.stats.metElder = true;
    p.campaignKills = {};
    p.campaignClaimed = {};
    p.activeCampaignMission = null;
    snapshot = JSON.stringify(p);
    acceptElderQuestUI();
    assert.equal(JSON.stringify(p), snapshot, 'failed quest acceptance must restore campaign state');
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }

  assert.equal(takeElderBlessingUI(), true);
  assert.equal(p.effects.filter(e => e.id === 'elderBlessing').length, 1);
  assert.equal(takeElderBlessingUI(), false, 'elder blessing must not stack through repeated calls');
  assert.equal(p.effects.filter(e => e.id === 'elderBlessing').length, 1);

  p.stats.lastWellUse = Date.now();
  p.hp = 10;
  assert.equal(useWellUI(), false, 'well cooldown must be enforced inside the service');
  assert.equal(p.hp, 10, 'blocked well use must not heal');
  p.stats.lastWellUse = 0;
  assert.equal(useWellUI(), true);
  assert.equal(p.hp, p.maxHp);
  assert.equal(p.mp, p.maxMp);
  const usedAt = p.stats.lastWellUse;
  p.hp = 10;
  assert.equal(useWellUI(), false, 'well cannot be reused within 24 hours');
  assert.equal(p.hp, 10);
  assert.equal(p.stats.lastWellUse, usedAt);
  state.game = {
    location: 'village',
    storyShards: { flame: false, ice: false, blood: false },
    storyDragons: { 'ash-herald': false, 'ice-grasp': false, 'blood-crown': false },
    player: {
      name: 'Reward test', class: 'mage', level: 1, exp: 0, expNext: 100,
      gold: 0, hp: 100, maxHp: 100, mp: 50, maxMp: 50, str: 1,
      inventory: Array.from({ length: 30 }, (_, index) => ({ id: 'iron-sword', qty: 1, testIndex: index })),
      spells: [], equipped: {}, stats: { kills: {} }, effects: [], buffs: [],
      campaignKills: { 'a1-m1': 3 }, campaignClaimed: {}, activeCampaignMission: 'a1-m1'
    }
  };
  const rewardPlayer = state.game.player;
  turnInElderQuestUI();
  assert.equal(rewardPlayer.campaignClaimed['a1-m1'], true, 'completed campaign mission should be claimed');
  assert.equal(rewardPlayer.inventory.length, 30, 'full inventory should remain unchanged');
  assert.ok(rewardPlayer.pendingLoot?.some(entry => entry.id === 'root-fiber' && entry.qty === 1), 'campaign material reward must be preserved in pending loot');
  console.log('check-npc-services: PASS (NPC service guards and campaign reward overflow storage)');
} finally {
  state.game = null;
  state.overworld = null;
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
  if (originalSetTimeout === undefined) delete globalThis.setTimeout;
  else globalThis.setTimeout = originalSetTimeout;
}
