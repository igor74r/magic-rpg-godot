import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { migrateSettings, loadSettings, saveSettings, hasSave, getSlotInfo, deleteSave } from '../systems/save.js';
import { state } from '../systems/state.js';

const legacy = migrateSettings({ volume: 42 });
assert.equal(legacy.musicVolume, 42);
assert.equal(legacy.sfxVolume, 42);
assert.equal(legacy.autoSave, true);
assert.equal(legacy.autoSaveInterval, 30);
assert.equal(legacy.difficulty, 'normal');
assert.equal(legacy.settingsVersion, 6);
assert.equal(legacy.fontScale, 1);
assert.equal(legacy.graphicsQuality, 'high');
assert.equal(legacy.weatherEffects, true);
assert.equal(legacy.ambientFog, true);
assert.equal(legacy.bloomEffects, true);
assert.equal('volume' in legacy, false);

const complete = migrateSettings({
  musicVolume: 25,
  sfxVolume: 90,
  difficulty: 'hard',
  autoSave: false,
  autoSaveInterval: 15,
  screenShake: false,
  damageNumbers: false,
  lowHealthEffects: false,
  reducedMotion: true,
  showFps: true,
  soundEnabled: false,
  graphicsQuality: 'balanced',
  weatherEffects: false,
  ambientFog: false,
  bloomEffects: false,
  fontScale: 1.25
});
assert.equal(complete.musicVolume, 25);
assert.equal(complete.sfxVolume, 90);
assert.equal(complete.difficulty, 'hard');
assert.equal(complete.autoSave, false);
assert.equal(complete.autoSaveInterval, 15);
assert.equal(complete.screenShake, false);
assert.equal(complete.damageNumbers, false);
assert.equal(complete.lowHealthEffects, false);
assert.equal(complete.reducedMotion, true);
assert.equal(complete.showFps, true);
assert.equal(complete.soundEnabled, false);
assert.equal(complete.graphicsQuality, 'balanced');
assert.equal(complete.weatherEffects, false);
assert.equal(complete.ambientFog, false);
assert.equal(complete.bloomEffects, false);
assert.equal(complete.fontScale, 1.25);

const invalid = migrateSettings({
  musicVolume: 140,
  sfxVolume: -20,
  difficulty: 'nightmare',
  autoSaveInterval: 10,
  screenShake: 'false',
  damageNumbers: null
});
assert.equal(invalid.musicVolume, 100);
assert.equal(invalid.sfxVolume, 0);
assert.equal(invalid.difficulty, 'normal');
assert.equal(invalid.autoSaveInterval, 30);
assert.equal(invalid.screenShake, true);
assert.equal(invalid.damageNumbers, true);

const empty = migrateSettings(null);
assert.equal(empty.musicVolume, 60);
assert.equal(empty.sfxVolume, 80);
assert.equal(empty.reducedMotion, false);
assert.equal(empty.graphicsQuality, 'high');
assert.equal(empty.fontScale, 1);


const menu = readFileSync(new URL('../ui/menu.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

for (const controlId of [
  'set-music-volume', 'set-sfx-volume', 'set-sound',
  'set-difficulty', 'set-autosave', 'set-autosave-interval',
  'set-hotkeys', 'set-fps', 'set-damage-numbers',
  'set-screen-shake', 'set-low-health', 'set-reduced-motion', 'set-font-scale',
  'set-graphics-quality', 'set-weather-effects', 'set-ambient-fog', 'set-bloom-effects'
]) {
  assert.ok(menu.includes(`id="${controlId}"`), `missing settings control: ${controlId}`);
  assert.ok(menu.includes(`value('${controlId}')`) || menu.includes(`setBool('${controlId}'`) || controlId.includes('volume'), `settings control is not read: ${controlId}`);
}
assert.ok(html.includes("switchSettingsTab('accessibility')"), 'accessibility tab is not reachable');
assert.ok(html.includes("switchSettingsTab('graphics')"), 'graphics tab is not reachable');
assert.ok(menu.includes("tab === 'graphics'"), 'graphics settings are not rendered');
assert.ok(menu.includes("tab === 'accessibility'"), 'accessibility settings are not rendered');
assert.ok(menu.includes('applyFontScale();'), 'font scale is not applied live');
assert.ok(css.includes('zoom: var(--ui-font-scale, 1)'), 'font scale is not reflected in the UI');
assert.match(css, /@media\s*\(max-width:\s*600px\)/, 'mobile settings layout breakpoint missing');
assert.ok(css.includes('#settings-content .settings-row'), 'settings row styles missing');
assert.ok(menu.includes('saveSettings();'), 'settings are not persisted after applying');
const render = readFileSync(new URL('../ui/overworld/render.js', import.meta.url), 'utf8');
assert.ok(render.includes('settings.weatherEffects'), 'weather graphics setting is not applied');
assert.ok(render.includes('settings.ambientFog'), 'ambient fog setting is not applied');
assert.ok(render.includes('settings.bloomEffects'), 'bloom graphics setting is not applied');


const originalStorage = globalThis.localStorage;
const originalSettings = state.settings;
const originalGame = state.game;
const originalSlot = state.currentSlot;
const settingsStorage = new Map();
let storageBlocked = false;
globalThis.localStorage = {
  getItem(key) {
    if (storageBlocked) throw new Error('storage blocked');
    return settingsStorage.get(key) ?? null;
  },
  setItem(key, value) {
    if (storageBlocked) throw new Error('storage blocked');
    settingsStorage.set(key, String(value));
  }
};
try {
  state.settings = { musicVolume: 33, settingsVersion: 2 };
  storageBlocked = true;
  assert.equal(saveSettings(), false, 'settings save should report unavailable storage without throwing');
  assert.equal(state.settings.settingsVersion, 2, 'failed settings write must not mark the live settings as persisted');
  assert.equal(loadSettings(), false, 'settings load should safely fall back when storage is blocked');
  assert.equal(state.settings.musicVolume, 33, 'blocked storage should retain in-memory preferences');
  state.game = { player: { name: 'Keep me' } };
  state.currentSlot = 1;
  assert.equal(hasSave(1), false, 'slot checks should fail safely when storage is blocked');
  assert.equal(getSlotInfo(1), null, 'slot previews should fail safely when storage is blocked');
  assert.equal(deleteSave(1), false, 'slot deletion should report blocked storage');
  assert.equal(state.game.player.name, 'Keep me', 'failed deletion must not clear the active character');
  storageBlocked = false;
  assert.equal(saveSettings(), true, 'settings should save after storage recovers');
  assert.equal(JSON.parse(settingsStorage.get('magic-rpg-settings')).settingsVersion, 6);
} finally {
  state.settings = originalSettings;
  state.game = originalGame;
  state.currentSlot = originalSlot;
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}

console.log('Settings migration, UI and storage resilience checks passed');
