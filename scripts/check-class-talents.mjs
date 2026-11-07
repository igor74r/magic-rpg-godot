import assert from 'node:assert/strict';
import { getClassTalents, findTalentById } from '../data/talents.js';
import { getTalentBonus, getAvailableTalents, canTakeTalent, takeTalent, resetTalents } from '../systems/talents.js';
import { state } from '../systems/state.js';

const playableClasses = ['warrior', 'mage', 'archer'];

for (const classId of playableClasses) {
  const talents = getClassTalents(classId);
  assert.equal(talents.length, 8, `${classId}: expected eight class talents`);
  assert.equal(new Set(talents.map(t => t.id)).size, talents.length, `${classId}: duplicate talent IDs`);
  assert.deepEqual([...new Set(talents.map(t => t.tier))].sort((a, b) => a - b), [5, 10, 15, 20]);
}

assert.ok(getClassTalents('priest').length > 0, 'legacy priest talents must remain for old saves');
assert.equal(findTalentById('archer', 'a-deadeye')?.name, 'Смертельный прицел');
assert.equal(findTalentById('archer', 'a-apex')?.effects.dodgeChance, 0.10);

const archer = { class: 'archer', level: 5, talents: [], passives: ['start'] };
assert.equal(getAvailableTalents(archer).length, 2, 'archer should have two tier-5 choices');
archer.talents.push('a-deadeye', 'a-quickdraw');
const archerBonus = getTalentBonus(archer);
assert.equal(archerBonus.critChance, 0.10);
assert.equal(archerBonus.dmgMult, 1.10);
assert.equal(archerBonus.atkFlat, 2);

const cryomancer = findTalentById('mage', 'm-cryomancer');
assert.equal(cryomancer.effects.spellMult, 1.5, 'cryomancer effect must match its +50% description');
assert.match(cryomancer.desc, /\+40% макс MP, \+50% урона заклинаниями/, 'cryomancer description must not contradict its effects');

const malformedLegacy = { class: 'archer', level: 5, talents: 'corrupt-list', gold: 0 };
const deadeye = findTalentById('archer', 'a-deadeye');
assert.equal(canTakeTalent(malformedLegacy, deadeye), true,
  'legacy talent availability must treat a malformed list as empty');
assert.equal(malformedLegacy.talents, 'corrupt-list',
  'availability checks must not mutate the player');
const originalGame = state.game;
const originalSlot = state.currentSlot;
const originalStorage = globalThis.localStorage;
state.game = { player: malformedLegacy };
state.currentSlot = 1;
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('simulated talent save failure'); },
  removeItem() {}
};
try {
  assert.equal(takeTalent(malformedLegacy, 'a-deadeye'), false,
    'failed talent persistence must report failure');
  assert.equal(malformedLegacy.talents, 'corrupt-list',
    'failed talent persistence must restore the original malformed legacy value');
} finally {
  state.game = originalGame;
  state.currentSlot = originalSlot;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}

for (const invalidGold of [Infinity, NaN, -1, Number.MAX_SAFE_INTEGER + 1]) {
  const invalidReset = {
    class: 'mage', level: 20, gold: invalidGold, talents: ['m-cryomancer'],
    hp: 100, maxHp: 100, mp: 100, maxMp: 100
  };
  const before = JSON.stringify(invalidReset);
  assert.equal(resetTalents(invalidReset).ok, false,
    'talent reset must reject invalid currency balances');
  assert.equal(JSON.stringify(invalidReset), before,
    'invalid reset balance must not mutate player state');
}

console.log('Class talent checks passed');
