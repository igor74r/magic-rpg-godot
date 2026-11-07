import assert from 'node:assert/strict';
import { state } from '../systems/state.js';
import { createWorldState, ensureWorldState } from '../systems/world-state.js';
import { createFactionState, changeFactionReputation } from '../systems/factions.js';
import { renderWorldOverview } from '../ui/world.js';
import { readFileSync } from 'node:fs';

const game = {
  version: 18,
  location: 'forest',
  player: { name: 'Тестовый путник', level: 1 },
  world: createWorldState({ seed: 123456 }),
  factions: createFactionState()
};
ensureWorldState(game, { legacy: false });
game.world.currentRegionId = 'forest';
game.world.regionVisits.forest = 1;
game.world.discoveredRegions = ['village', 'forest'];
game.world.unlockedRoutes = ['village::forest', 'forest::village'];
game.world.regions = { forest: { discoveredSecrets: ['secret-2-3', 'secret-8-5'] } };
game.world.clockMinutes = 125;
game.world.events.nextSpawnAt = 400;
game.world.events.active = [{
  id: 'world-event-1',
  name: 'Караван торговцев',
  regionId: 'forest',
  factionId: 'free-traders',
  status: 'active',
  accepted: true,
  progress: 1,
  targetCount: 2,
  objectiveText: 'Отразите нападение на караван.',
  expiresAt: 200,
  reward: { gold: 45 }
}];
game.world.events.history = [{
  id: 'world-event-0',
  name: 'Засада на патруль',
  regionId: 'briar-hollow',
  factionId: 'hub-guardians',
  status: 'completed',
  accepted: true,
  progress: 3,
  targetCount: 3,
  rewardClaimed: false,
  reward: { gold: 35 },
  finishedAt: 90
}];
changeFactionReputation(game, 'hub-guardians', 35, '<img src=x onerror=alert(1)>', 'ui-test');
state.game = game;

const html = renderWorldOverview();
assert.match(html, /Мир и фракции/);
assert.match(html, /Стражи Хаба/);
assert.match(html, /Вольные торговцы/);
assert.match(html, /Дружелюбие/);
assert.match(html, /\+35/);
assert.match(html, /Караван торговцев/);
assert.match(html, /Засада на патруль/);
assert.match(html, /Награда ожидает получения/);
assert.match(html, /Открыто регионов/);
assert.match(html, /Открыто маршрутов/);
assert.match(html, /Найдено тайников/);
assert.match(html, />2<\/b>/, 'world overview must display persistent discovered-secret total');
assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/, 'reputation log text must be escaped');
assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);

const header = readFileSync(new URL('../ui/header.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/rpg-overhaul.css', import.meta.url), 'utf8');
assert.match(header, /renderWorldOverview/);
assert.match(header, /tab === 'world'/);
assert.match(index, /id="game-tab-world"[^>]*data-tab="world"/);
assert.match(index, /Мир и фракции/);
assert.match(css, /\.world-overview/);

console.log('PASS world overview renders faction standing, active and claimable events, exploration progress and escaped history');