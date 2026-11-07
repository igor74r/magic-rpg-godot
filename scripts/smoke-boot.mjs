// scripts/smoke-boot.mjs
// Boot-smoke: поднимает main.js в Node с минимальными заглушками DOM/Canvas/Audio,
// создаёт героя, входит в overworld, двигается, переключает вкладки, открывает NPC,
// проводит бой и сохраняется. Ловит ReferenceError и разрывы контрактов, которые
// не видны при `node --check` (например, импорт несуществующего экспорта).
// Ничего в браузере и localStorage не трогает — всё замокано.

const ROOT = new URL('..', import.meta.url);
const { LOCATIONS } = await import(new URL('data/locations.js', ROOT).href);
const { STORY } = await import(new URL('data/story.js', ROOT).href);

// ---------- заглушки Canvas ----------
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient' || prop === 'createPattern') return () => gradient;
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'getImageData') return () => ({ data: [] });
    if (prop === 'canvas') return { width: 800, height: 500 };
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) { target[prop] = value; return true; },
});

// ---------- заглушки DOM ----------
const elements = new Map();

function makeElement(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(), id: '', className: '', innerHTML: '', textContent: '',
    value: 'Герой', checked: false, style: {}, dataset: {},
    width: 800, height: 500, scrollTop: 0, scrollHeight: 0,
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { el.children.push(child); return child; },
    removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    closest() { return null; }, focus() {}, blur() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500 }; },
    getContext() { return ctx; }, toDataURL() { return ''; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
  };
  return el;
}

function byId(id) {
  if (!elements.has(id)) { const el = makeElement(); el.id = id; elements.set(id, el); }
  return elements.get(id);
}

const body = makeElement('body');
const documentStub = {
  body,
  hidden: false,
  getElementById: byId,
  querySelectorAll(sel) {
    if (sel === '.screen') return [...elements.values()].filter((e) => e.id.startsWith('screen-'));
    return [];
  },
  querySelector() { return null; },
  createElement(tag) { return makeElement(tag); },
  addEventListener() {}, removeEventListener() {},
};

// ---------- заглушки хранилища/аудио/окна ----------
const storage = new Map();
const localStorageStub = {
  getItem(k) { return storage.has(k) ? storage.get(k) : null; },
  setItem(k, v) { storage.set(k, String(v)); },
  removeItem(k) { storage.delete(k); },
  clear() { storage.clear(); },
  key(i) { return [...storage.keys()][i] ?? null; },
  get length() { return storage.size; },
};

const listeners = new Map();
const rafQueue = [];
let rafSeq = 1;

const windowStub = {
  innerWidth: 1280, innerHeight: 800,
  addEventListener(type, cb) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(cb);
  },
  removeEventListener() {},
  matchMedia() { return { matches: false, addEventListener() {} }; },
  localStorage: localStorageStub,
  requestAnimationFrame(cb) { rafQueue.push(cb); return rafSeq++; },
  cancelAnimationFrame() {},
  speechSynthesis: undefined,
  AudioContext: class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() {
      return {
        gain: {
          value: 1, setValueAtTime() {}, linearRampToValueAtTime() {},
          cancelScheduledValues() {}, setTargetAtTime() {},
        },
        connect() {}, disconnect() {},
      };
    }
    createMediaElementSource() { return { connect() {}, disconnect() {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
    createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {}, onended: null }; }
    createOscillator() { return { frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { frequency: { value: 0 }, connect() {} }; }
    resume() { return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({}); }
  },
};

class AudioStub {
  constructor(src) { this.src = src; this.volume = 1; this.loop = false; this.paused = true; this.currentTime = 0; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener() {}
}

globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.localStorage = localStorageStub;
globalThis.Audio = AudioStub;
globalThis.AudioContext = windowStub.AudioContext;
globalThis.requestAnimationFrame = windowStub.requestAnimationFrame;
globalThis.cancelAnimationFrame = windowStub.cancelAnimationFrame;
globalThis.confirm = () => true;
globalThis.alert = () => {};
globalThis.matchMedia = windowStub.matchMedia;

// ---------- проверки ----------
const results = [];
const runtimeErrors = [];

function check(name, ok, extra = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  return ok;
}

process.on('uncaughtException', (e) => runtimeErrors.push('uncaught: ' + (e && e.message)));
process.on('unhandledRejection', (e) => runtimeErrors.push('rejection: ' + (e && e.message)));

let ts = 0;
function frame(count = 1) {
  for (let i = 0; i < count; i++) {
    const callbacks = rafQueue.splice(0);
    ts += 16;
    for (const cb of callbacks) cb(ts);
  }
}

function key(type, code) {
  for (const cb of listeners.get(type) || []) cb({ code, key: code, preventDefault() {} });
}

storage.set('magic-rpg-prologue-seen', '1');

let api;
try {
  await import(new URL('main.js', ROOT).href);
  api = windowStub.GameAPI;
  check('main.js загружается', true);
} catch (e) {
  check('main.js загружается', false, String(e && e.message));
}

if (!api) {
  console.log(results.join('\n'));
  console.log('\nsmoke-boot: FAILED (boot)');
  process.exit(1);
}

check('window.GameAPI доступен', Object.keys(api).length > 0, `${Object.keys(api).length} методов`);

const { state } = await import(new URL('systems/state.js', ROOT).href);

// Новая игра
try {
  api.selectClass('mage');
  api.confirmClassSelection();
  check('герой создан', state.game?.player?.class === 'mage');
} catch (e) {
  check('герой создан', false, String(e && e.message));
}

// Деревня + движение
try {
  api.enterOverworld();
  check('вход в overworld (village)', state.overworld?.locationId === 'village', state.overworld?.locationId);
  frame(3);

  const before = { x: state.overworld.player.x, y: state.overworld.player.y };
  key('keydown', 'KeyD');
  frame(30);
  key('keyup', 'KeyD');
  const moved = state.overworld.player.x !== before.x || state.overworld.player.y !== before.y;
  check('движение WASD', moved);
} catch (e) {
  check('overworld/движение', false, String(e && (e.stack || e.message)));
}

// Вкладки дашборда
try {
  for (const tab of ['inventory', 'spells', 'quests', 'achievements', 'statistics', 'talents', 'bestiary', 'chronicles']) {
    api.switchTab(tab);
  }
  check('вкладки дашборда рендерятся', true);
  check('HUD keeps the Rift shortcut without duplicating the village Tower gate', !byId('game-header').innerHTML.includes('data-header-action="tower"') && byId('game-header').innerHTML.includes('data-header-action="rift"'));
  check('хроники мира рендерятся', byId('tab-content').innerHTML.includes('chronicles-page'));
  api.switchTab('talents');
  const talentHtml = byId('tab-content').innerHTML;
  check('дерево талантов можно перемещать мышью и касанием', talentHtml.includes('passive-tree-viewport') && talentHtml.includes('passiveTreePointerDown'));
  api.switchTab('inventory');
  const inventoryHtml = byId('tab-content').innerHTML;
  check('инвентарь рендерит 12 слотов экипировки, 30 ячеек сумки и отдельные вкладки', inventoryHtml.includes('rpg-inventory-layout') && inventoryHtml.includes('Голова') && inventoryHtml.includes('Палец 2') && inventoryHtml.includes('Сумка') && inventoryHtml.includes('Материалы') && inventoryHtml.includes('Осколки') && inventoryHtml.includes('data-inv-action="open-sale"') && (inventoryHtml.match(/class="gear-slot /g) || []).length === 12 && (inventoryHtml.match(/class="inv-slot/g) || []).length === 30);
  api.openSaleUI();
  const saleHtml = byId('inventory-sale-overlay')?.innerHTML || '';
  check('окно продажи показывает инвентарь, список выбранного и массовые действия', saleHtml.includes('Продажа предметов') && saleHtml.includes('Продать все T1–T2') && saleHtml.includes('Выбрать по фильтру') && saleHtml.includes('Итого:'));
  api.cancelSale();
  api.openShop();
  const shopHtml = byId('tab-content').innerHTML;
  check('магазин имеет пять пресетов и раздел обратного выкупа', shopHtml.includes('Дешёвое') && shopHtml.includes('Сборка') && shopHtml.includes('Материалы крафта') && shopHtml.includes('Редкое') && shopHtml.includes('Всё') && typeof api.buybackItem === 'function');
} catch (e) {
  check('вкладки дашборда рендерятся', false, String(e && e.message));
}

// Контракт инвентаря (регрессия: метод был потерян при распиле)
try {
  api.invSlotClick(0);
  check('GameAPI.invSlotClick вызывается', true);
} catch (e) {
  check('GameAPI.invSlotClick вызывается', false, String(e && e.message));
}

// Единый атлас портала заменил старую карту вкладки и её API.
try {
  check('единый атлас портала доступен', typeof api.openWorldPortalMenu === 'function');
  check('старый API радиальной карты удалён',
    typeof api.mapSelect === 'undefined' && typeof api.mapTravel === 'undefined' && typeof api.mapEnter === 'undefined');
} catch (e) {
  check('единый атлас мира', false, String(e && e.message));
}

// NPC-диалоги
try {
  if (state.overworld) api.exitOverworld();
  state.game.location = 'village';
  api.enterOverworld();
  const npcActions = [
    'openBlacksmith', 'openHealer', 'openAlchemist', 'openMerchant', 'openElder',
    'openWell', 'openBard', 'openGuard', 'openCat', 'openKids', 'openHerald', 'openDailyChest',
  ];
  for (const fn of npcActions) if (typeof api[fn] === 'function') api[fn]();
  if (typeof api.closeNpcAndResume === 'function') api.closeNpcAndResume();
  check('NPC-диалоги открываются/закрываются', true);
} catch (e) {
  check('NPC-диалоги открываются/закрываются', false, String(e && e.message));
}

// Интерьеры зданий NPC удалены; проверяем, что диалог NPC по-прежнему доступен.
try {
  api.interactNpc('blacksmith');
  check('диалог кузнеца открывается без кнопки входа в интерьер',
    byId('npc-dialog-content').innerHTML.length > 0 && !byId('npc-dialog-content').innerHTML.includes('Войти внутрь'));
  api.closeNpcAndResume();
} catch (e) {
  check('диалог кузнеца открывается без кнопки входа в интерьер', false, String(e && e.message));
}

// Бой: деревня безопасна, поэтому переходим в лес
try {
  api.exitOverworld?.();
  state.game.location = 'briar-hollow';
  // The Act I optional mini-boss is level-gated; test the complete roster at its threshold.
  state.game.player.level = 8;
  api.enterOverworld();
  frame(2);

  const ow = state.overworld;
  const firstMission = STORY.acts[0].missions[0];
  api.openElder();
  api.acceptElderQuest();
  check('Старейшина выдаёт принятое сюжетное поручение', state.game.player.activeCampaignMission === firstMission.id);
  const enemy = ow.enemies.find((e) => !e.dead && e.enemyId === firstMission.enemyId);
  if (!enemy) throw new Error('враг первого поручения не заспавнился');
  const actEnemyIds = LOCATIONS['briar-hollow'].enemies;
  const spawnedIds = new Set(ow.enemies.map(e => e.enemyId));
  check('все враги акта, включая босса, появляются на карте', actEnemyIds.every(id => spawnedIds.has(id)));

  enemy.x = ow.player.x;
  enemy.y = ow.player.y;
  frame(1);
  check('бой начинается при столкновении', !!state.overworld.combat, enemy.enemyId);

  for (const action of ['owCast', 'owUseItem', 'owBlock', 'owUseAbility']) {
    if (!state.overworld.combat) break;
    api[action](action === 'owCast' ? state.game.player.spells[0] : 'mana-potion');
    frame(8);
  }
  check('боевые действия выполняются', true);

  // Добиваем врага и проверяем, что цикл боя закрывается
  if (state.overworld.combat) {
    state.overworld.combat.enemy.hp = 1;
    state.overworld.combat.enemy.maxHp = 1;
    state.overworld.combat.turn = 'player';
    api.owAttack();
    frame(12);
    if (state.overworld.combat) {
      state.overworld.combat.turn = 'player';
      api.owAttack();
      frame(12);
    }
  }
  check('бой завершается победой', !state.overworld.combat, state.overworld.combat ? 'бой не закрылся' : '');
  const campaignMission = STORY.acts.flatMap(act => act.missions).find(mission => mission.id === firstMission.id);
  check('убийство учитывается в принятом поручении правильного региона', !!campaignMission && state.game.player.campaignKills?.[campaignMission.id] === 1);
  state.game.player.campaignKills[firstMission.id] = firstMission.count;
  const goldBeforeTurnIn = state.game.player.gold;
  api.openElder();
  api.turnInElderQuest();
  check('Эдвин принимает выполненное поручение и выдаёт награду', state.game.player.campaignClaimed?.[firstMission.id] === true && state.game.player.gold > goldBeforeTurnIn && state.game.player.activeCampaignMission === null);
  api.openElder();
  check('после сдачи Эдвин предлагает следующее поручение', byId('npc-dialog-content').innerHTML.includes(STORY.acts[0].missions[1].title));
} catch (e) {
  check('бой', false, String(e && e.message));
}

// Сохранение в слот
try {
  api.saveAndMenu();
  check('сохранение в слот 1', storage.has('magic-rpg-save-1'));
  state.game.riftEnding = 'closed';
  state.game.riftOpeningSeen = true;
  state.game.player.riftClearedLocations = ['rift-01'];
  // Keep the world-map fixture in a post-game state without invoking NG+ here.
  state.game.player.ngPlus = 0;
  state.game.riftEnding = null;
  state.game.riftOpeningSeen = false;
  state.game.player.riftClearedLocations = [];
  state.game.storyDragons['blood-crown'] = true;
  const { emit } = await import(new URL('systems/events.js', ROOT).href);
  const realSetTimeout = globalThis.setTimeout;
  let finishRiftCutscene = null;
  globalThis.setTimeout = callback => { finishRiftCutscene = callback; return 1; };
  emit('rift:opened');
  globalThis.setTimeout = realSetTimeout;
  check('Blood Crown opening event launches the Rift cutscene once', state.game.riftOpeningSeen === true && body.children.some(child => child.id === 'rift-opening-cutscene'));
  finishRiftCutscene?.();
  check('portal atlas entry remains available after Rift unlock', typeof api.openWorldPortalMenu === 'function');
  api.openRiftMap();
  const riftMap = body.children.find(child => child.id === 'rift-map-overlay');
  check('post-game Rift map renders 30 areas with 10 level gates', !!riftMap && (riftMap.innerHTML.match(/data-rift-id=/g) || []).length === 30 && (riftMap.innerHTML.match(/Требуется уровень 50/g) || []).length === 10);
  const { enterOverworld } = await import(new URL('systems/overworld.js', ROOT).href);
  enterOverworld('rift-01', { rifMode: true, rifFloor: 1 });
  check('Rift area aliases load unique map and real enemy roster', state.overworld?.locationId === 'rift-01' && state.overworld?.locationName === 'Пепельный порог' && state.overworld?.rifMode === true && state.overworld.enemies.length > 0);
  api.exitOverworld();
  api.enterTower();
  const towerMap = body.children.find(child => child.id === 'tower-map-overlay');
  check('Tower menu displays all 40 floors and guardian milestones', !!towerMap && (towerMap.innerHTML.match(/СТРАЖ/g) || []).length === 8 && towerMap.innerHTML.includes('Башня · 40 этажей'));
  enterOverworld('tower-floor-01', { towerMode: true, towerFloor: 1 });
  check('Tower starts with floor-specific enemies and scaling mode', state.overworld?.towerMode === true && state.overworld?.towerFloor === 1 && state.overworld.enemies.length >= 4);
  state.overworld.enemies.forEach(enemy => { enemy.dead = true; });
  emit('tower:floor-cleared');
  check('clearing a Tower floor advances to the next floor and records progress', state.overworld?.towerMode === true && state.overworld?.towerFloor === 2 && state.game.player.towerBest === 1);
  api.exitOverworld();
  state.game.player.towerBest = 39;
  enterOverworld('tower-floor-40', { towerMode: true, towerFloor: 40 });
  state.overworld.enemies.forEach(enemy => { enemy.dead = true; });
  emit('tower:floor-cleared');
  check('Tower final floor completes the 40-floor challenge', state.overworld === null && state.game.player.towerBest === 40);
  const finalMission = STORY.acts[4].missions[4];
  state.game.player.campaignClaimed = Object.fromEntries(STORY.acts.flatMap(act => act.missions).map(mission => [mission.id, mission.id !== finalMission.id]));
  state.game.player.campaignKills[finalMission.id] = finalMission.count;
  state.game.player.activeCampaignMission = finalMission.id;
  state.game.storyShards = { flame: true, ice: true, blood: true };
  state.game.storyDragons = { 'ash-herald': true, 'ice-grasp': true, 'blood-crown': true };
  api.turnInElderQuest();
  check('final campaign turn-in triggers the ending after all 25 missions', state.game.player.victoryAchieved === true);
  const { isRiftReady } = await import(new URL('systems/rift.js', ROOT).href);
  api.chooseRiftEnding('closed');
  check('ending choice can permanently seal the Rift', state.game.riftEnding === 'closed' && !isRiftReady());
  api.chooseRiftEnding('open');
  check('ending choice can leave the stabilized Rift open', state.game.riftEnding === 'open' && isRiftReady());
  api.startNGPlus();
  check('NG+ starts after the complete campaign', state.game.player.ngPlus === 1 && Object.keys(state.game.player.campaignKills || {}).length === 0 && Object.keys(state.game.player.campaignClaimed || {}).length === 0 && state.game.player.activeCampaignMission === null);
  check('NG+ resets the Rift ending and cleared-area cycle', state.game.riftEnding === null && state.game.riftOpeningSeen === false && state.game.player.riftClearedLocations.length === 0);
} catch (e) {
  check('сохранение в слот 1', false, String(e && e.message));
}

if (runtimeErrors.length > 0) results.push('RUNTIME ERRORS:\n' + runtimeErrors.join('\n'));

const failed = results.filter((r) => r.startsWith('FAIL'));
console.log(results.join('\n'));

if (failed.length > 0 || runtimeErrors.length > 0) {
  console.log(`\nsmoke-boot: FAILED (${failed.length} проверок, ${runtimeErrors.length} ошибок)`);
  process.exit(1);
}

console.log(`\nsmoke-boot: OK (${results.length} проверок)`);
process.exit(0);
