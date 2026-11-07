import assert from 'node:assert/strict';
import { getPassiveTree } from '../data/passives.js';
import {
  allocatePassive,
  canAllocatePassive,
  getTalentBonus,
  getPassiveNodeStatus,
  resetPassives
} from '../systems/talents.js';

const classes = ['warrior', 'mage', 'archer'];

const warriorTree = getPassiveTree('warrior');
const mageTree = getPassiveTree('mage');
const archerTree = getPassiveTree('archer');
assert.match(warriorTree.nodes['warrior-endurance-1'].desc, /\+2 к защите и \+1 HP восстановления/);
assert.match(mageTree.nodes['mage-frost-1'].desc, /\+2 к магии и \+1 MP восстановления/);
assert.match(mageTree.nodes['mage-frost-4'].desc, /силы блока/);
assert.equal(archerTree.nodes['archer-hunter-6'].effects.critMult, 1.8,
  'final hunter passive must add 0.1 to the preceding 1.7 critical multiplier');

for (const classId of classes) {
  const tree = getPassiveTree(classId);
  assert.equal(tree.classId, classId);
  assert.equal(Object.keys(tree.nodes).length, 31, `${classId}: expected 20 nodes plus start`);
  assert.ok(tree.nodes.start);
  for (const node of Object.values(tree.nodes)) {
    if (node.id !== 'start') assert.ok(node.levelReq >= 2 && node.levelReq <= 35);
    for (const parentId of node.conn) {
      assert.ok(tree.nodes[parentId], `${classId}/${node.id}: missing connection ${parentId}`);
    }
  }
}

const player = {
  class: 'warrior',
  level: 20,
  passivePoints: 4,
  passives: ['start'],
  gold: 500
};

const lowLevelPlayer = { class: 'warrior', level: 1, passivePoints: 2, passives: ['start'] };
assert.equal(getPassiveNodeStatus(lowLevelPlayer, 'warrior-might-1'), 'Требуется уровень 2 (текущий: 1)');
assert.equal(getPassiveNodeStatus({ ...lowLevelPlayer, level: 20, passivePoints: 0 }, 'warrior-might-1'), 'Нет свободных очков навыков');
assert.equal(getPassiveNodeStatus({ ...lowLevelPlayer, level: 20, passivePoints: 1, passives: ['start', 'warrior-might-1'] }, 'warrior-might-1'), 'Уже изучено');
assert.equal(getPassiveNodeStatus({ ...lowLevelPlayer, level: 20, passivePoints: 1 }, 'warrior-might-2'), 'Сначала изучите соединённый узел');
assert.equal(getPassiveNodeStatus({ ...lowLevelPlayer, level: 20, passivePoints: 1 }, 'warrior-might-1'), 'Доступно для изучения');

assert.equal(canAllocatePassive(player, 'warrior-might-1'), true);
assert.equal(allocatePassive(player, 'warrior-might-1'), true);
assert.equal(allocatePassive(player, 'warrior-might-2'), true);
assert.equal(allocatePassive(player, 'warrior-might-3'), true);
assert.equal(allocatePassive(player, 'warrior-might-4'), true);
assert.equal(player.passivePoints, 0);
assert.equal(player.passives.length, 5);
assert.ok(getTalentBonus(player).dmgMult > 1);

const result = resetPassives(player);
assert.deepEqual(result, { ok: true, refunded: 4, cost: 500 });
assert.deepEqual(player.passives, ['start']);
assert.equal(player.passivePoints, 4);
assert.equal(player.gold, 0);

const brokePlayer = {
  class: 'mage',
  level: 20,
  passivePoints: 0,
  passives: ['start', 'mage-fire-1'],
  gold: 499
};
for (const invalidGold of [Infinity, Number.MAX_SAFE_INTEGER + 1, -1, NaN]) {
  const invalidBalancePlayer = {
    class: 'mage',
    level: 20,
    passivePoints: 0,
    passives: ['start', 'mage-fire-1'],
    gold: invalidGold
  };
  const invalidBalanceResult = resetPassives(invalidBalancePlayer);
  assert.equal(invalidBalanceResult.ok, false, 'passive reset must reject invalid gold balances');
  assert.deepEqual(invalidBalancePlayer.passives, ['start', 'mage-fire-1'],
    'invalid gold must not reset passive allocations');
  assert.equal(invalidBalancePlayer.passivePoints, 0,
    'invalid gold must not refund passive points');
  assert.ok(Object.is(invalidBalancePlayer.gold, invalidGold),
    'invalid gold balance must remain unchanged');
}

const failed = resetPassives(brokePlayer);
assert.equal(failed.ok, false);
assert.equal(brokePlayer.passives.length, 2);
assert.equal(brokePlayer.passivePoints, 0);
assert.equal(brokePlayer.gold, 499);

console.log('Passive tree checks passed');
