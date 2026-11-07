import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { state } from '../systems/state.js';
import {
  equipItemByIndex, unequipItemBySlot, equipBest, socketRune,
  canAddItem, getInventorySlotCount, getInventoryWeight, getInventoryCapacity
} from '../systems/inventory.js';

const player = {
  str: 100, inventory: [
    { id: 'rootbound-hood', qty: 1, rarity: 'common', sockets: 1, runes: [] },
    { id: 'cinder-visor', qty: 1, rarity: 'common', sockets: 1, runes: [] },
    { id: 'rune-root', qty: 2 }
  ],
  equipped: {}, pendingLoot: []
};
state.game = { player };

assert.equal(canAddItem('iron-sword', 1, player).ok, true);
assert.equal(getInventorySlotCount(player), 3, 'a rune stack occupies one bag slot');
assert.ok(getInventoryWeight(player) <= getInventoryCapacity(player));
assert.equal(getInventoryCapacity({ str: Number.POSITIVE_INFINITY }), 50,
  'non-finite strength must not grant infinite carry capacity');
assert.equal(Number.isFinite(getInventoryCapacity({ str: Number.MAX_VALUE })), true,
  'overflowing strength must not produce infinite carry capacity');


const firstEquip = equipItemByIndex(0);
assert.equal(firstEquip, 'head');
assert.equal(player.equipped.head.id, 'rootbound-hood');
assert.equal(player.inventory[0].id, 'cinder-visor', 'remaining equipment keeps its relative order');

const replacement = equipItemByIndex(0);
assert.equal(replacement, 'head');
assert.equal(player.equipped.head.id, 'cinder-visor');
assert.equal(player.inventory.at(-1).id, 'rootbound-hood', 'replaced gear returns to the bag');

assert.equal(socketRune(1, 'head'), false, 'only an actual rune may be socketed');
assert.equal(socketRune(0, 'head'), true);
assert.deepEqual(player.equipped.head.runes, ['rune-root']);
assert.equal(player.inventory.find(item => item.id === 'rune-root').qty, 1, 'socketing consumes exactly one rune');
assert.equal(socketRune(0, 'head'), false, 'a full socket cannot accept another rune');

assert.equal(unequipItemBySlot('head'), true);
assert.equal(player.equipped.head, null);
assert.ok(player.inventory.some(item => item.id === 'cinder-visor'));

player.inventory = Array.from({ length: 30 }, () => ({ id: 'iron-sword', qty: 1 }));
player.equipped.head = { id: 'rootbound-hood', qty: 1, sockets: 1, runes: [] };
assert.equal(unequipItemBySlot('head'), false, 'unequip must respect the 30-slot limit');
assert.equal(player.equipped.head.id, 'rootbound-hood', 'failed unequip must preserve equipped gear');

player.inventory = [
  { id: 'iron-sword', qty: 1 },
  { id: 'steel-sword', qty: 1 },
  { id: 'rootbound-hood', qty: 1 },
  { id: 'cinder-visor', qty: 1 }
];
player.equipped = { weapon: { id: 'iron-sword', qty: 1 }, head: null };
assert.equal(equipBest(), true);
assert.equal(player.equipped.weapon.id, 'steel-sword');
assert.equal(player.equipped.head.id, 'cinder-visor');

player.inventory = [{ id: 'ring-quiet-tide', qty: 1, runes: ['rune-void'] }];
player.equipped = { ring1: { id: 'ring-wolf-eye', qty: 1 }, ring2: null };
assert.equal(equipBest(), true, 'equip-best must include socketed rune bonuses');
assert.equal(player.equipped.ring1.id, 'ring-quiet-tide', 'rune-enhanced ring must replace weaker ring');

const ui = await readFile(new URL('../ui/inventory.js', import.meta.url), 'utf8');
assert.match(ui, /rune\.dex \|\| 0/);
assert.match(ui, /rune\.armorPen \|\| 0/);
assert.match(ui, /rune\.blockChance \|\| 0/);
assert.match(ui, /rune\.blockPower \|\| 0/,
  'inventory item power must include every combat-relevant rune bonus');
assert.doesNotMatch(ui, /\son(?:click|mouseover|mouseout)\s*=/i, 'inventory UI must not emit inline event handlers');
assert.match(ui, /data-inv-action="socket-rune"/);
assert.match(ui, /data-sale-action="confirm"/);
const characterUI = await readFile(new URL('../ui/character.js', import.meta.url), 'utf8');
assert.doesNotMatch(characterUI, /\son(?:click|mouseover|mouseout)\s*=/i, 'class selection must not emit inline event handlers');
assert.match(characterUI, /data-class-id=/);
assert.match(characterUI, /event\.key !== 'Enter'/, 'class cards must support keyboard selection');

state.game = null;
console.log('check-equipment: PASS (equip, replace, unequip capacity, runes, equip-best and delegated UI)');
