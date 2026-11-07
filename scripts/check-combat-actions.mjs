// Deterministic smoke coverage for the three playable classes' combat actions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state } from '../systems/state.js';
import { createCharacter } from '../systems/character.js';
import { ENEMIES } from '../data/enemies.js';
import { SPELLS } from '../data/spells.js';
import { CLASSES } from '../data/classes.js';
import { enterCombat, combatAttack, combatBlock, combatCastSpell, combatUseAbility, combatUseItem } from '../systems/overworld/combat.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
const combatSource = readFileSync(new URL('../systems/overworld/combat.js', import.meta.url), 'utf8');
// Narrow signature check catches common double-decoding artifacts without rejecting valid Cyrillic.
assert.doesNotMatch(combatSource, /(?:Р.{0,2}Р|СѓСЂРѕРЅР°|рџ|в[љњћЂџ\u0098|в—Ћ])/, 'combat log must not contain UTF-8/Windows-1251 mojibake');
assert.match(combatSource, /talent\.dmgMult\s*\*\s*resolveCriticalMultiplier\(talent\.critMult\)\s*\*\s*enemyDamageMultiplier\(enemy, 'ranged'\)/,
  'aimed shot critical damage must use the shared 1.25x–2.5x multiplier clamp');
assert.match(combatSource, /stats\.atk \* 1\.05 - defense \* 0\.65\) \* talent\.dmgMult \* enemyDamageMultiplier\(enemy, 'melee'\)/,
  'shield bash must respect physical weakness and resistance matchups');
assert.match(combatSource, /applyElementalReaction\(enemy, 'ice'\)/,
  'frost nova must trigger the shared ice elemental reaction');
assert.match(combatSource, /34 \+ Math\.floor\(stats\.mag \* 0\.7\) - Math\.floor\(defense \/ 2\)\) \* talent\.spellMult \* enemyDamageMultiplier\(enemy, 'magic'\)/,
  'frost nova must respect enemy defense and magic weakness/resistance matchups');

const scheduled = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, delay) => { scheduled.push({ fn, delay }); return scheduled.length; };

function fixture(classId) {
  state.currentSlot = 1;
  assert.equal(createCharacter('Combat Test', classId), true);
  const p = state.game.player;
  state.overworld = {
    locationId: 'forest',
    player: { x: 100, y: 100, hp: p.hp, mp: p.mp },
    enemies: [], log: [], floatingNumbers: [], particles: [],
    chests: [], events: [], combat: null, defeated: false
  };
  const base = ENEMIES.goblin;
  const enemy = {
    enemyId: 'goblin', x: 180, y: 100,
    hp: 1000, maxHp: 1000, defense: base.defense || 0,
    state: 'idle', boss: false, elite: false,
    effects: [], modifier: null
  };
  state.overworld.enemies.push(enemy);
  enterCombat(enemy);
  return { player: p, enemy, ow: state.overworld };
}

try {
  let f = fixture('warrior');
  const warriorBefore = f.enemy.hp;
  combatAttack();
  assert.ok(f.enemy.hp < warriorBefore, 'Warrior basic attack must damage the target');
  assert.equal(f.ow.combat.turn, 'enemy');
  console.log('PASS Warrior basic attack deals damage and advances the turn');

  f = fixture('warrior');
  combatBlock();
  assert.equal(f.ow.combat.blocking, true);
  assert.equal(f.ow.combat.turn, 'enemy');
  console.log('PASS Warrior block activates the defensive stance');

  f = fixture('mage');
  const fireball = SPELLS.fireball;
  const timersBeforeMalformedSpell = scheduled.length;
  const mpBeforeMalformedSpell = f.player.mp;
  const hpBeforeMalformedSpell = f.enemy.hp;
  SPELLS.fireball = { ...fireball, cost: -1 };
  combatCastSpell('fireball');
  assert.equal(f.player.mp, mpBeforeMalformedSpell, 'invalid spell cost must not consume mana');
  assert.equal(f.enemy.hp, hpBeforeMalformedSpell, 'invalid spell must not damage target');
  assert.equal(f.ow.combat.turn, 'player', 'invalid spell must not consume the turn');
  assert.equal(scheduled.length, timersBeforeMalformedSpell, 'invalid spell must not schedule enemy turn');
  SPELLS.fireball = { ...fireball, damage: Number.NaN };
  combatCastSpell('fireball');
  assert.equal(f.player.mp, mpBeforeMalformedSpell, 'NaN spell damage must not consume mana');
  assert.equal(f.enemy.hp, hpBeforeMalformedSpell, 'NaN spell damage must not mutate enemy HP');
  SPELLS.fireball = fireball;

  f = fixture('mage');
  const manaBeforeInvalidStats = f.player.mp;
  f.player.int = Number.POSITIVE_INFINITY;
  combatCastSpell('fireball');
  assert.equal(f.player.mp, manaBeforeInvalidStats, 'invalid derived stats must not consume spell mana');
  assert.equal(f.ow.combat.turn, 'player', 'invalid derived stats must not consume the turn');
  console.log('PASS Invalid derived spell stats are rejected before mana or turn changes');

  console.log('PASS Malformed spell cost/damage is rejected before resource or turn changes');

  f = fixture('mage');
  const mageHpBefore = f.enemy.hp;
  const mageMpBefore = f.player.mp;
  combatCastSpell('fireball');
  assert.ok(f.enemy.hp < mageHpBefore, 'Mage fireball must damage the target');
  assert.ok(f.player.mp < mageMpBefore, 'Mage fireball must consume mana');
  console.log('PASS Mage fireball damages the target and consumes mana');

  f = fixture('mage');
  f.player.effects = [null, 'broken-effect'];
  f.enemy.effects = [null, 'broken-effect'];
  assert.doesNotThrow(() => combatCastSpell('fireball'),
    'spell casting and elemental reactions must tolerate malformed player/enemy effects');
  console.log('PASS Combat spell and elemental reaction ignore malformed effect entries');



  f = fixture('archer');
  const archerAbility = CLASSES.archer.abilities.find(item => item.id === 'aimed-shot');
  const archerMpBeforeInvalidAbility = f.player.mp;
  const archerTurnBeforeInvalidAbility = f.ow.combat.turn;
  CLASSES.archer.abilities.push({ id: 'unfinished-test-action', name: 'Broken', cost: 10, cooldown: 2 });
  combatUseAbility('unfinished-test-action');
  assert.equal(f.player.mp, archerMpBeforeInvalidAbility, 'unimplemented ability must not spend resource');
  assert.equal(f.ow.combat.turn, archerTurnBeforeInvalidAbility, 'unimplemented ability must not advance turn');
  CLASSES.archer.abilities.pop();
  CLASSES.archer.abilities = CLASSES.archer.abilities.map(item =>
    item.id === 'aimed-shot' ? { ...item, cost: Number.NaN } : item
  );
  combatUseAbility('aimed-shot');
  assert.equal(f.player.mp, archerMpBeforeInvalidAbility, 'NaN ability cost must not spend resource');
  assert.equal(f.player.cooldowns['aimed-shot'], undefined, 'invalid ability must not enter cooldown');
  CLASSES.archer.abilities = CLASSES.archer.abilities.map(item =>
    item.id === 'aimed-shot' ? archerAbility : item
  );

  f = fixture('warrior');
  f.player.mp = 100;
  f.ow.player.mp = 100;
  const rageBeforeInvalidStats = f.player.mp;
  f.player.str = Number.POSITIVE_INFINITY;
  combatUseAbility('shield-bash');
  assert.equal(f.player.mp, rageBeforeInvalidStats, 'invalid derived stats must not consume rage');
  assert.equal(f.player.cooldowns['shield-bash'], undefined, 'invalid derived stats must not start cooldown');
  assert.equal(f.ow.combat.turn, 'player', 'invalid derived stats must not consume the turn');
  console.log('PASS Invalid derived ability stats are rejected before resource/cooldown/turn changes');

  console.log('PASS Unsupported or malformed ability is rejected before resource/cooldown changes');

  f = fixture('archer');
  f.player.mp = 100;
  const archerHpBefore = f.enemy.hp;
  combatUseAbility('aimed-shot');
  assert.ok(f.enemy.hp < archerHpBefore, 'Archer aimed shot must damage the target');
  assert.ok(f.player.cooldowns['aimed-shot'] > 0, 'Archer ability must enter cooldown');
  console.log('PASS Archer aimed shot damages the target and starts cooldown');

  f = fixture('warrior');
  f.player.inventory = f.player.inventory.filter(item => item.id !== 'health-potion');
  f.player.hp = Math.max(1, f.player.maxHp - 40);
  f.ow.player.hp = f.player.hp;
  const hpWithoutItem = f.player.hp;
  const timersBeforeMissingItem = scheduled.length;
  combatUseItem('health-potion');
  assert.equal(f.player.hp, hpWithoutItem, 'Combat use must not apply an item that is not owned');
  assert.equal(f.ow.combat.turn, 'player', 'Rejected item use must not consume the turn');
  assert.equal(scheduled.length, timersBeforeMissingItem, 'Rejected item use must not schedule an enemy turn');
  console.log('PASS Combat item use rejects consumables missing from inventory');

  f.player.inventory.push({ id: 'health-potion', qty: 1 });
  const hpBeforePotion = f.player.hp;
  combatUseItem('health-potion');
  assert.equal(f.player.hp, Math.min(f.player.maxHp, hpBeforePotion + 80), 'Owned health potion must apply its effect');
  assert.equal(f.player.inventory.some(item => item.id === 'health-potion'), false, 'Used potion must be consumed exactly once');
  assert.equal(f.ow.combat.turn, 'enemy');
  console.log('PASS Owned combat consumable applies once, is consumed, and advances the turn');


  f = fixture('warrior');
  f.enemy.hp = 2;
  f.player.hp = f.player.maxHp - 20;
  f.ow.player.hp = f.player.hp;
  f.player.effects = [{ id: 'lifesteal', duration: 2 }];
  const hpBeforeOverkill = f.player.hp;
  combatAttack();
  assert.equal(f.player.hp, hpBeforeOverkill + 1,
    'lifesteal must heal from the two HP actually removed, not the overkill hit');
  console.log('PASS Lifesteal uses actual enemy HP removed on a killing hit');

  f = fixture('mage');
  f.player.effects = [
    { id: 'atkBuff', duration: 2 },
    { id: 'poison', duration: 2 },
    { id: 'elderBlessing', duration: 2 }
  ];
  f.player.cooldowns = { 'test-ability': 2 };
  f.enemy.hp = 1;
  combatAttack();
  const persistedVictory = JSON.parse(storage.get('magic-rpg-save-1'));
  assert.deepEqual(persistedVictory.player.effects, [{ id: 'elderBlessing', duration: 1 }]);
  assert.deepEqual(persistedVictory.player.cooldowns, {});
  f = fixture('mage');
  f.player.effects = [null, 'broken-effect', { id: 'elderBlessing', duration: 2 }];
  f.enemy.hp = 1;
  assert.doesNotThrow(() => combatAttack(),
    'victory reward processing must tolerate malformed effects around a valid blessing');
  assert.deepEqual(f.player.effects, [{ id: 'elderBlessing', duration: 1 }],
    'valid elder blessing must survive malformed-effect cleanup and victory');

  console.log('PASS Victory save contains post-combat effects and cooldown state');


  f = fixture('warrior');
  // Warrior combat abilities spend rage; prime the fixture with generated resource.
  f.player.mp = 100;
  f.ow.player.mp = 100;
  const shieldBashHp = f.enemy.hp;
  combatUseAbility('shield-bash');
  assert.ok(f.enemy.hp < shieldBashHp, 'Shield bash must damage the target');
  assert.ok(f.enemy.effects.some(effect => effect?.id === 'stun'), 'Shield bash must stun the target');
  assert.ok(f.ow.particles.length > 0, 'Shield bash must produce combat feedback particles');
  console.log('PASS Warrior shield bash damages, stuns, and animates');

  f = fixture('mage');
  f.enemy.effects = [{ id: 'burn', duration: 2 }];
  const frostNovaHp = f.enemy.hp;
  combatUseAbility('frost-nova');
  assert.ok(f.enemy.hp < frostNovaHp, 'Frost nova must damage the target');
  assert.ok(!f.enemy.effects.some(effect => effect?.id === 'burn'), 'Frost nova must trigger the ice reaction and extinguish burn');
  assert.ok(f.enemy.effects.some(effect => effect?.id === 'stun'), 'Frost nova must stun the target');
  assert.ok(f.ow.particles.length > 0, 'Frost nova must produce ice particles');
  console.log('PASS Mage frost nova damages, stuns, and animates');

  f = fixture('archer');
  // Archer abilities consume concentration; prime it before testing the damage handler.
  f.player.mp = 100;
  f.ow.player.mp = 100;
  const piercingHp = f.enemy.hp;
  combatUseAbility('piercing-shot');
  assert.ok(f.enemy.hp < piercingHp, 'Piercing shot must damage the target');
  assert.ok(f.ow.particles.length > 0, 'Piercing shot must produce arrow particles');
  console.log('PASS Archer piercing shot damages and animates');

  assert.ok(scheduled.length >= 5, 'combat actions should schedule enemy responses');
  console.log(`Combat action regression: 10/10 action checks passed; ${scheduled.length} enemy turns safely queued.`);
} finally {
  globalThis.setTimeout = realSetTimeout;
  state.overworld = null;
  state.game = null;
}
