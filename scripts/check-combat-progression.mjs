// End-to-end regression coverage for combat specials, defensive actions,
// resurrection/flee, duplicate victory prevention and tower/rift progression.
// Deterministic timers and random values keep all combat branches reproducible.
import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { createCharacter } from '../systems/character.js';
import { ENEMIES } from '../data/enemies.js';
import {
  enterCombat, combatAttack, combatBlock, combatUseAbility, combatFlee
} from '../systems/overworld/combat.js';
import { enterOverworld, advanceTowerFloor, advanceRiftFloor } from '../systems/overworld.js';
import { getTowerBest, getTowerStartFloor } from '../systems/tower.js';
import { getRiftBest } from '../systems/rift.js';
import { getDailyQuests } from '../systems/dailyQuests.js';
import { saveGame } from '../systems/save.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
const scheduled = [];
const realSetTimeout = globalThis.setTimeout;
const realRandom = Math.random;
globalThis.setTimeout = (fn, delay) => { scheduled.push({ fn, delay }); return scheduled.length; };
Math.random = () => 0.99;

function fixture(classId = 'warrior', enemyId = 'goblin') {
  state.currentSlot = 1;
  const createClass = classId === 'priest' ? 'warrior' : classId;
  assert.equal(createCharacter('Combat Regression', createClass), true);
  const p = state.game.player;
  if (classId === 'priest') p.class = 'priest';
  p.hp = p.maxHp = 5000;
  p.mp = p.maxMp;
  state.overworld = {
    locationId: 'forest', player: { x: 100, y: 100, hp: p.hp, mp: p.mp },
    enemies: [], log: [], floatingNumbers: [], particles: [], chests: [],
    events: [], combat: null, defeated: false, rifMode: false, towerMode: false
  };
  const def = ENEMIES[enemyId];
  const enemy = {
    enemyId, x: 180, y: 100, hp: 5000, maxHp: 5000,
    defense: def.defense || 0, state: 'idle', boss: !!def.boss,
    elite: false, effects: [], modifier: null, phase: 0, dead: false
  };
  state.overworld.enemies.push(enemy);
  enterCombat(enemy);
  return { p, enemy, ow: state.overworld };
}
function runEnemyTurn() {
  const next = scheduled.shift();
  assert.ok(next, 'combat action should schedule an enemy response');
  next.fn();
}

try {
  // A delayed enemy response must not leak into a later encounter.
  scheduled.length = 0;
  const previousEncounter = fixture('warrior', 'goblin');
  combatAttack();
  assert.equal(scheduled.length, 1, 'first encounter should schedule one enemy response');
  combatFlee(true);
  const nextEncounter = fixture('warrior', 'goblin');
  combatAttack();
  const nextEncounterHp = nextEncounter.p.hp;
  runEnemyTurn(); // stale callback from the encounter that was fled
  assert.equal(nextEncounter.p.hp, nextEncounterHp,
    'stale enemy callback must not damage the player in a new encounter');
  assert.equal(nextEncounter.ow.combat.turn, 'enemy',
    'stale callback must not consume the new encounter turn');
  runEnemyTurn(); // current encounter response
  assert.ok(nextEncounter.p.hp < nextEncounterHp,
    'current encounter callback must still resolve the enemy response');
  console.log('PASS delayed enemy responses stay bound to their original encounter');

  // Corrupted saved counters must recover safely when a real combat kill is recorded.
  const counterFixture = fixture('warrior', 'goblin');
  counterFixture.enemy.hp = 1;
  counterFixture.enemy.elite = true;
  counterFixture.enemy.boss = true;
  counterFixture.p.stats.kills.goblin = '7';
  counterFixture.p.stats.flawlessStreak = 'invalid';
  counterFixture.p.stats.eliteKills = '2';
  counterFixture.p.stats.bossKills = 1.5;
  combatAttack();
  assert.equal(counterFixture.p.stats.kills.goblin, 1, 'invalid enemy kill counter must restart at one');
  assert.equal(counterFixture.p.stats.flawlessStreak, 1, 'invalid flawless streak must restart at one');
  assert.equal(counterFixture.p.stats.eliteKills, 1, 'invalid elite counter must restart at one');
  assert.equal(counterFixture.p.stats.bossKills, 1, 'invalid boss counter must restart at one');

  // double, snipe and drain specials are exercised on their scheduled turn.
  for (const [enemyId, expectedEffect] of [
    ['wolf', 'bleed'],
    ['skeleton-archer', 'poison'],
    ['ghost', 'poison']
  ]) {
    const f = fixture('warrior', enemyId);
    f.ow.combat.turnCount = 2;
    if (enemyId === 'ghost') f.enemy.hp = 100;
    const hpBefore = f.p.hp;
    combatAttack();
    const enemyHpAfterPlayerAttack = f.enemy.hp;
    runEnemyTurn(); // telegraph turn: enemy warns before the configured special
    assert.ok(f.enemy.tacticalSpecialPending, `${enemyId} must retain its announced special`);
    combatBlock();
    runEnemyTurn();
    assert.ok(f.p.hp < hpBefore, `${enemyId} special must damage player`);
    assert.ok(f.p.effects.some(effect => effect.id === expectedEffect), `${enemyId} special must apply its configured effect`);
    if (enemyId === 'ghost') assert.ok(f.enemy.hp > enemyHpAfterPlayerAttack, 'drain must restore enemy health after dealing damage');
    console.log(`PASS ${enemyId} ${ENEMIES[enemyId].special.type} special and status effect`);
  }

  // Drain must restore only the HP actually removed from a low-health player.
  scheduled.length = 0;
  const lowHealthDrain = fixture('warrior', 'ghost');
  lowHealthDrain.enemy.hp = 1000;
  lowHealthDrain.ow.combat.turnCount = 2;
  combatAttack();
  runEnemyTurn(); // telegraph the drain
  lowHealthDrain.p.hp = 1;
  lowHealthDrain.ow.player.hp = 1;
  const enemyHpBeforeLowHealthDrain = lowHealthDrain.enemy.hp;
  combatBlock();
  runEnemyTurn();
  assert.equal(lowHealthDrain.enemy.hp, enemyHpBeforeLowHealthDrain + 1,
    'drain must heal only the one HP actually removed from a nearly defeated player');
  assert.ok(lowHealthDrain.ow.floatingNumbers.some(number => number.text === '-1'),
    'drain feedback must show actual damage rather than overkill');
  console.log('PASS drain healing and combat feedback use actual HP removed');

  // Vampiric modifier must heal from actual multi-hit damage, not the pre-special base hit.
  scheduled.length = 0;
  const vampiric = fixture('warrior', 'wolf');
  vampiric.enemy.modifier = 'vampiric';
  vampiric.enemy.hp = 1000;
  vampiric.p.con = 0;
  state.settings.difficulty = 'hard';
  vampiric.ow.combat.turnCount = 2;
  const hpBeforeSpecial = vampiric.p.hp;
  const wolfSpecialEffect = ENEMIES.wolf.special.effect;
  ENEMIES.wolf.special.effect = null;
  combatBlock();
  runEnemyTurn(); // announced attack
  const enemyHpBeforeSpecial = vampiric.enemy.hp;
  const playerHpBeforeSpecial = vampiric.p.hp;
  combatBlock();
  runEnemyTurn(); // prepared double strike
  ENEMIES.wolf.special.effect = wolfSpecialEffect;
  const actualSpecialDamage = playerHpBeforeSpecial - vampiric.p.hp;
  const expectedVampiricHeal = Math.floor(actualSpecialDamage * 0.3);
  assert.equal(vampiric.enemy.hp, enemyHpBeforeSpecial + expectedVampiricHeal, 'vampiric heal must use both actual hits');
  state.settings.difficulty = 'normal';
  console.log('PASS vampiric healing scales with actual double-special damage');

  // Evasion prevents the next enemy action, including a special.
  let f = fixture('archer', 'skeleton-archer');
  f.ow.combat.turnCount = 2;
  f.p.mp = f.p.maxMp;
  f.ow.player.mp = f.p.mp;
  const evasionHp = f.p.hp;
  combatUseAbility('evasion');
  runEnemyTurn();
  assert.equal(f.p.hp, evasionHp, 'evasion must negate the entire incoming action');
  assert.equal(f.ow.combat.guaranteedDodge, false);
  console.log('PASS guaranteed evasion negates a special attack');

  // Compare block against the same deterministic unblocked attack.
  f = fixture('warrior', 'wolf');
  const unblockedHp = f.p.hp;
  combatAttack();
  runEnemyTurn();
  const unblockedLoss = unblockedHp - f.p.hp;

  f = fixture('warrior', 'wolf');
  const blockHp = f.p.hp;
  combatBlock();
  runEnemyTurn();
  const blockedLoss = blockHp - f.p.hp;
  assert.ok(blockedLoss > 0 && blockedLoss < unblockedLoss, 'block must reduce incoming damage');
  assert.equal(f.ow.combat.blocking, false, 'block stance must be consumed after the hit');
  console.log('PASS block stance reduces and consumes the incoming attack');

  // Damage-over-time can cross a boss threshold even without a direct attack.
  f = fixture('warrior', 'ancient-dragon');
  f.enemy.maxHp = 450;
  f.enemy.hp = 230;
  f.enemy.effects = [{ id: 'burn', duration: 2 }];
  combatBlock();
  assert.equal(f.enemy.phase, 1, 'burn tick must advance the boss phase at the 50% threshold');
  console.log('PASS boss phase advances when damage-over-time crosses a threshold');

  // A configured multi-phase enemy must transition even when it is not a reward boss.
  f = fixture('warrior', 'fire-drake');
  assert.equal(f.enemy.boss, false);
  f.enemy.hp = 70;
  combatBlock();
  assert.equal(f.enemy.phase, 1, 'fire-drake must enter its configured 40% phase');
  console.log('PASS non-boss enemy with configured phases transitions correctly');

  // Enemy stun consumes exactly one player turn after the status tick.
  f = fixture('warrior', 'book-guardian');
  f.ow.combat.turnCount = 2;
  combatAttack();
  runEnemyTurn(); // telegraph
  combatAttack();
  runEnemyTurn(); // prepared special applies stun
  assert.equal(f.p.effects.some(effect => effect.id === 'stun'), false, 'stun must be consumed after skipping the player turn');
  assert.equal(f.ow.combat.turn, 'enemy', 'enemy must receive its next turn after player stun');
  runEnemyTurn();
  assert.equal(f.ow.combat.turn, 'player', 'player must regain control after one skipped turn');
  console.log('PASS enemy stun skips exactly one player turn');

  // Legacy priest resurrection works once; the next lethal hit ends combat.
  f = fixture('priest', 'goblin');
  f.p.hp = 1;
  f.ow.player.hp = 1;
  combatBlock();
  runEnemyTurn();
  assert.ok(f.ow.combat, 'first lethal hit should trigger resurrection, not defeat');
  assert.ok(f.p.hp > 0, 'resurrection must restore positive HP');
  assert.equal(f.ow.combat.playerResurrectionUsed, true);
  f.p.hp = 1;
  f.ow.player.hp = 1;
  const originalSetItemForDefeat = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('simulated defeat save quota'); };
  try {
    combatBlock();
    runEnemyTurn();
  } finally {
    globalThis.localStorage.setItem = originalSetItemForDefeat;
  }
  assert.equal(f.ow.combat, null, 'second lethal hit must end combat after resurrection is spent');
  assert.equal(f.ow.defeated, true);
  assert.equal(f.p.stats.deaths, 1);
  assert.ok(f.ow.log.some(entry => entry.cls === 'warning' && entry.msg.includes('Не удалось сохранить поражение')), 'failed defeat save must be visible in the combat log');
  console.log('PASS resurrection is one-use; defeat remains coherent and warns when persistence fails');

  // Forced flee ends combat without killing the enemy or awarding rewards.
  f = fixture('warrior', 'goblin');
  const fleeGold = f.p.gold;
  combatFlee(true);
  assert.equal(f.ow.combat, null);
  assert.equal(f.enemy.dead, false);
  assert.equal(f.p.stats.kills.goblin || 0, 0);
  assert.equal(f.p.gold, fleeGold);
  console.log('PASS forced flee ends combat without victory rewards');

  // A defeated enemy cannot be re-entered and rewarded a second time.
  f = fixture('warrior', 'goblin');
  f.enemy.hp = 1;
  combatAttack();
  assert.equal(f.enemy.dead, true);
  const goldAfterVictory = f.p.gold;
  const killsAfterVictory = f.p.stats.kills.goblin;
  enterCombat(f.enemy);
  assert.equal(f.ow.combat, null, 'dead enemy must not start another encounter');
  assert.equal(f.p.gold, goldAfterVictory);
  assert.equal(f.p.stats.kills.goblin, killsAfterVictory);
  console.log('PASS defeated enemy cannot be farmed for duplicate rewards');

  // A failed persistence write must roll back all victory rewards and keep the fight retryable.
  f = fixture('warrior', 'goblin');
  f.enemy.hp = 1;
  f.p.dailyQuests = {
    date: Date.now(),
    list: [
      { id: 'q-kill-goblin', type: 'kill', text: 'Убей 5 гоблинов', target: 'goblin', max: 5, gold: 6, exp: 30, current: 0, completed: false, claimed: false },
      { id: 'q-kill-any', type: 'kill', text: 'Убей 10 врагов', target: 'any', max: 10, gold: 8, exp: 50, current: 0, completed: false, claimed: false },
      { id: 'q-kill-skeleton', type: 'kill', text: 'Убей 5 скелетов', target: 'skeleton', max: 5, gold: 6, exp: 30, current: 0, completed: false, claimed: false }
    ]
  };
  getDailyQuests();
  assert.equal(saveGame(), true, 'persist the normalized daily quest baseline before the victory transaction');
  const victoryGoldBeforeSaveFailure = f.p.gold;
  const victoryKillsBeforeSaveFailure = f.p.stats.kills.goblin || 0;
  const savedBeforeVictory = storage.get('magic-rpg-save-1');
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = (key, value) => {
    const candidate = JSON.parse(value);
    if ((candidate.player.stats.kills.goblin || 0) === 1) throw new Error('simulated final victory save quota');
    storage.set(key, String(value));
  };
  combatAttack();
  globalThis.localStorage.setItem = originalSetItem;
  assert.equal(state.game.player.gold, victoryGoldBeforeSaveFailure, 'failed save must roll back victory gold');
  assert.equal(state.game.player.stats.kills.goblin || 0, victoryKillsBeforeSaveFailure, 'failed save must roll back kill progress');
  assert.equal(f.enemy.dead, false, 'failed save must leave enemy alive');
  assert.equal(f.enemy.hp, f.enemy.maxHp, 'failed save must restore encounter health');
  assert.ok(f.ow.combat, 'failed save must keep combat active');
  assert.equal(storage.get('magic-rpg-save-1'), savedBeforeVictory,
    'daily kill progress must not be persisted separately when the victory save fails');
  assert.equal(JSON.parse(storage.get('magic-rpg-save-1')).player.dailyQuests.list.find(q => q.id === 'q-kill-goblin').current, 0,
    'failed victory transaction must leave daily kill progress unchanged');
  assert.equal(f.ow.combat.turn, 'player', 'failed save must return control to player');
  assert.equal(f.ow.log.some(entry => entry.msg.includes('🏆 Победа!')), false,
    'failed victory save must not leave success reward messages in the combat log');
  assert.equal(f.ow.log.some(entry => entry.msg.startsWith('Добыча:')), false,
    'failed victory save must not leave loot messages in the combat log');
  console.log('PASS failed victory save rolls back rewards and restores encounter');

  // Gold rewards at the numeric cap must be safely truncated, not overflow the save.
  f = fixture('warrior', 'goblin');
  f.p.gold = Number.MAX_SAFE_INTEGER - 1;
  f.enemy.hp = 1;
  combatAttack();
  assert.equal(state.game.player.gold, Number.MAX_SAFE_INTEGER,
    'victory gold must stop at the largest safe integer');
  assert.ok(f.ow.log.some(entry => entry.msg.includes('безопасного предела')),
    'capped victory gold must be explained in the combat log');
  console.log('PASS victory gold is capped at the safe integer limit');

  // Tower floor events are tied to the floor that emitted them.
  assert.equal(createCharacter('Tower Regression', 'warrior'), true);
  state.game.player.hp = state.game.player.maxHp;
  state.game.player.towerBest = 0;
  enterOverworld('tower-floor-01', { towerMode: true, towerFloor: 1 });
  advanceTowerFloor(1);
  assert.equal(state.overworld.towerFloor, 2);
  advanceTowerFloor(1);
  assert.equal(state.overworld.towerFloor, 2, 'stale tower completion must not skip floor 2');
  assert.equal(getTowerBest(), 1);
  assert.equal(getTowerStartFloor(), 2);
  console.log('PASS tower progression persists records and ignores stale completion events');

  // Rift floor events are similarly idempotent and persist the reached floor.
  state.game.player.level = 60;
  state.game.player.riftBest = 0;
  state.game.player.riftClearedLocations = [];
  state.overworld = {
    rifMode: true, rifFloor: 1, locationId: 'rift-01'
  };
  advanceRiftFloor(1);
  assert.equal(state.overworld.rifMode, true);
  assert.equal(state.overworld.rifFloor, 2);
  advanceRiftFloor(1);
  assert.equal(state.overworld.rifFloor, 2, 'stale rift completion must not skip floor 2');
  assert.equal(getRiftBest(), 2);
  console.log('PASS rift progression persists records and ignores stale completion events');

  console.log('Combat/floor integration: 10/10 scenario groups passed.');
} finally {
  Math.random = realRandom;
  globalThis.setTimeout = realSetTimeout;
  state.overworld = null;
  state.game = null;
}
