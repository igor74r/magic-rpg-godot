// scripts/smoke-load.mjs
// Smoke-тест: динамически загружает чистые логические модули и данные проекта в Node
// и проверяет базовые инварианты. Не должен трогать DOM / localStorage / Audio.

const mods = await Promise.all([
  import('../systems/state.js'),
  import('../systems/events.js'),
  import('../systems/progression.js'),
  import('../systems/status.js'),
  import('../systems/stats.js'),
  import('../data/classes.js'),
  import('../data/items.js'),
  import('../data/spells.js'),
  import('../data/locations.js'),
  import('../data/enemies.js'),
  import('../data/achievements.js'),
  import('../data/talents.js'),
  import('../data/npcs.js'),
  import('../data/shop.js'),
  import('../data/story.js'),
  import('../data/passives.js'),
  import('../systems/campaign.js'),
  import('../systems/save.js'),
  import('../systems/talents.js'),
  import('../systems/inventory.js'),
  import('../ui/overworld/tile-atlas.js'),
  import('../systems/overworld/hazards.js'),
  import('../ui/overworld/effects.js'),
  import('../systems/overworld/map.js'),
  import('../systems/overworld/spawn.js'),
  import('../systems/story-dragons.js'),
  import('../systems/rift.js'),
  import('../systems/tower.js'),
  import('../systems/loot.js'),
  import('../systems/crafting.js'),
  import('../systems/shop.js'),
]);

const { state } = mods[0];
const { on, emit } = mods[1];
const { addExp } = mods[2];
const { EFFECTS, applyEffect, hasEffect } = mods[3];
const { getEffStats, resolveCriticalChance } = mods[4];
const { CLASSES } = mods[5];
const { ITEMS, RARITIES, rollRarity, getRarityWeights, rollItemAffixes } = mods[6];
const { SPELLS } = mods[7];
const { LOCATIONS } = mods[8];
const { ENEMIES } = mods[9];
const { getLootDropChance } = mods[28];
const { canCraftRecipe, craftRecipe, canReforgeItem, reforgeItemByIndex, upgradeEquipment } = mods[29];
const { sellItemsByIndices, getBuybackItems, buybackItem } = mods[30];
const { ACHIEVEMENTS } = mods[10];
const { TALENTS } = mods[11];
const { NPCS, FORGE_BONUS } = mods[12];
const { SHOP_ITEMS } = mods[13];
const { STORY } = mods[14];
const { getPassiveTree } = mods[15];
const { getCampaignProgress, isCampaignComplete, canCompleteMainQuest, recordCampaignKill, acceptCampaignMission, claimCampaignMission, getNextCampaignMission, getMissionReward } = mods[16];
const { migrateGame } = mods[17];
const { recordStoryDragonDefeat, claimStoryDragonReward, STORY_DRAGONS } = mods[25];
const { getRiftLocations, getRiftLocation, isRiftReady } = mods[26];
const { TOWER_MAX_FLOOR, getTowerLocation, getTowerMult } = mods[27];
const { getAvailablePassives, allocatePassive, getTalentBonus } = mods[18];
const { addItem, useItem, equipItemByIndex, socketRune, EQUIPMENT_SLOTS, getInventoryWeight, getInventoryCapacity, getInventorySlotCount } = mods[19];
const { drawAtlasTile, drawAtlasProp } = mods[20];
const { getTileDanger } = mods[21];
const { getCurrentTheme, THEMES } = mods[22];
const { isBlocked, isWalkable } = mods[23];
const { createSpawnRoster } = mods[24];

const results = [];
const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);

check('state.game is null initially', state.game === null);
check('state has settings', !!state.settings);
check('event bus: on/emit registered', (() => { let got = null; on('smoke:test', (p) => { got = p; }); emit('smoke:test', { ok: true }); return got && got.ok === true; })());

check('3 playable classes loaded', ['warrior', 'mage', 'archer'].every(id => !!CLASSES[id]));
check('spells loaded', Object.keys(SPELLS).length >= 13);
check('all shop entries exist', SHOP_ITEMS.every(id => !!ITEMS[id]));
check('shop presets offer at least one item for every canonical equipment type', ['weapon','head','shoulders','chest','gloves','legs','boots','shield','ring','amulet','cloak'].every(type => SHOP_ITEMS.some(id => ITEMS[id]?.type === type)));
check('merchant sells every new equipment and rune item', NPCS.merchant.stock.every(id => !!ITEMS[id]));
check('merchant stock covers all canonical equipment categories and healer greeting matches price', ['weapon','head','shoulders','chest','gloves','legs','boots','shield','ring','amulet','cloak'].every(type => NPCS.merchant.stock.some(id => ITEMS[id]?.type === type)) && NPCS.healer.cost === 8 && NPCS.healer.greetings.includes('Полное исцеление — 8 золота.'));
check('all enemy drop references resolve to items', Object.values(ENEMIES).every(enemy => (enemy.drops || []).every(id => !!ITEMS[id])));
check('all scroll spell references resolve', Object.values(ITEMS).filter(item => item.type === 'scroll').every(item => !!SPELLS[item.spellId] && typeof item.use === 'function'));
check('spell effects are registered', Object.values(SPELLS).every(spell => (!spell.effect || !!EFFECTS[spell.effect]) && (!spell.selfEffect || !!EFFECTS[spell.selfEffect])));
check('new items have callable use handlers', ['greater-health-potion', 'greater-mana-potion', 'scroll-frost-nova', 'scroll-shadow-lance', 'scroll-arcane-surge', 'scroll-radiant-aegis', 'scroll-renewal', 'restorative-potion'].every(id => typeof ITEMS[id]?.use === 'function'));
check('new gear, rune and material categories exist', ['rootbound-hood','cinder-visor','duelist-grips','gravebinder-gloves','windstep-boots','glacier-greaves','amulet-first-light','pendant-last-oath','ring-wolf-eye','ring-quiet-tide'].every(id => !!ITEMS[id]) && ['rune-root','rune-ember','rune-tide','rune-frost','rune-void'].every(id => ITEMS[id]?.type === 'rune') && ['root-fiber','grave-salt','ember-core','frost-essence','void-dust'].every(id => ITEMS[id]?.type === 'material'));
check('gear definitions use distinct shield, gloves, leg armor, boots, cloak and amulet types', ITEMS['tower-shield']?.type === 'shield' && ITEMS['duelist-grips']?.type === 'gloves' && ITEMS['glacier-greaves']?.type === 'legs' && ITEMS['windstep-boots']?.type === 'boots' && ITEMS['ranger-cloak']?.type === 'cloak' && ITEMS['seal-five-orders']?.type === 'amulet');
check('locations loaded', Object.keys(LOCATIONS).length >= 10);
check('every location has a valid visual theme', Object.values(LOCATIONS).every(location => !!THEMES[location.theme]));
check('new biomes use dedicated terrain rows and configured themes', ['briar-hollow', 'sunken-necropolis', 'obsidian-fields', 'frost-citadel', 'void-crater'].every(id => Number.isInteger({ 'briar-hollow': 1, 'sunken-necropolis': 2, 'obsidian-fields': 5, 'frost-citadel': 6, 'void-crater': 3 }[id]) && !!THEMES[LOCATIONS[id]?.theme]));
check('hazard surfaces are walkable only in their region', isWalkable([[3]], 1, 1, 24, 24, 'obsidian-fields') && isWalkable([[3]], 1, 1, 24, 24, 'sunken-necropolis') && !isWalkable([[3]], 1, 1, 24, 24, 'forest'));
check('ordinary stone and prop obstacles remain blocked', isBlocked([[3]], 0, 0) && isBlocked([[2]], 0, 0) && isBlocked([[4]], 0, 0));
check('enemies loaded', Object.keys(ENEMIES).length >= 20);
check('achievements loaded', ACHIEVEMENTS.length >= 15);
check('effects loaded', Object.keys(EFFECTS).length >= 5);
check('critical chance adds temporary bonuses once and caps at 75%', resolveCriticalChance({ critChance: 0.2 }, 0.05) === 0.25 && resolveCriticalChance({ critChance: 0.7 }, 0.1) === 0.75);
class ImageStub { set src(value) { this.url = value; this.onload?.(); } }
globalThis.Image = ImageStub;
const atlasCalls = [];
const canvasStub = { save() {}, restore() {}, drawImage: (...args) => atlasCalls.push(args) };
const atlasDrawn = drawAtlasTile(canvasStub, 2, 10, 20, 48, 'briar-hollow');
check('high-resolution terrain atlas resolves new biome coordinates', atlasDrawn && atlasCalls.length === 1 && atlasCalls[0][1] === 192 && atlasCalls[0][2] === 96);
const propDrawn = drawAtlasProp(canvasStub, 9, 10, 20, 48, 48);
check('high-resolution props atlas resolves 8×4 sprite coordinates', propDrawn && atlasCalls.length === 2 && atlasCalls[1][1] === 96 && atlasCalls[1][2] === 96);
check('new volcanic region has lava hazards', getTileDanger(3, 'obsidian-fields')?.type === 'lava');
check('new marsh region has poison hazards', getTileDanger(3, 'briar-hollow')?.type === 'poison');
check('new necropolis region has spike hazards', getTileDanger(3, 'sunken-necropolis')?.type === 'spike');
check('ordinary ground has no environmental damage', getTileDanger(0, 'obsidian-fields') === null && getTileDanger(0, 'sunken-necropolis') === null);
check('hazard surfaces are walkable only in their matching regions', !isBlocked([[3]], 0, 0, 'obsidian-fields') && !isBlocked([[3]], 0, 0, 'sunken-necropolis') && isBlocked([[3]], 0, 0, 'forest') && isBlocked([[4]], 0, 0, 'obsidian-fields') && isBlocked([[2]], 0, 0, 'obsidian-fields'));
state.overworld = { locationId: 'briar-hollow', theme: LOCATIONS['briar-hollow'].theme };
const briarWeather = getCurrentTheme().weather;
state.overworld = { locationId: 'obsidian-fields', theme: LOCATIONS['obsidian-fields'].theme };
const obsidianWeather = getCurrentTheme().weather;
state.overworld = null;
check('new regions use their own biome weather', briarWeather === 'rain' && obsidianWeather === 'embers');
const voidRosterSize = LOCATIONS['void-crater'].enemies.length;
const actRoster = createSpawnRoster(LOCATIONS['void-crater'].enemies, voidRosterSize, () => 0);
check('act spawn always includes each enemy and the boss', actRoster.length === voidRosterSize && new Set(actRoster).size === voidRosterSize && LOCATIONS['void-crater'].enemies.every(id => actRoster.includes(id)));
check('extra spawn slots repeat enemies only after full roster', createSpawnRoster(['wolf', 'boss'], 4, () => 0).length === 4 && new Set(createSpawnRoster(['wolf', 'boss'], 4, () => 0)).size === 2);
check('campaign has 5 acts and 25 missions', STORY.acts?.length === 5 && STORY.acts.reduce((n, act) => n + act.missions.length, 0) === 25);
check('campaign enemy IDs exist', STORY.acts.every(act => act.missions.every(mission => !!ENEMIES[mission.enemyId])));
check('25 missions cover all 15 adventure regions with valid enemy spawns', STORY.acts.every(act => act.missions.every(mission => { const location = LOCATIONS[mission.locationId || act.locationId]; return !!location && location.enemies.includes(mission.enemyId); })) && new Set(STORY.acts.flatMap(act => act.missions.map(mission => mission.locationId || act.locationId))).size === 15);
check('passive trees exist for all 3 playable classes', ['warrior', 'mage', 'archer'].every(id => Object.keys(getPassiveTree(id).nodes).length === 31));
const passiveTestPlayer = { class: 'warrior', level: 1, passives: ['start'], passivePoints: 1, talents: [] };
const lockedAtLevelOne = getAvailablePassives(passiveTestPlayer).length === 0;
passiveTestPlayer.level = 2;
const availablePassive = getAvailablePassives(passiveTestPlayer)[0];
const passiveAllocated = !!availablePassive && allocatePassive(passiveTestPlayer, availablePassive.id);
check('passives respect level requirements and spend points', lockedAtLevelOne && passiveAllocated && passiveTestPlayer.passivePoints === 0 && passiveTestPlayer.passives.includes(availablePassive.id));
check('allocated passives affect combat bonuses', getTalentBonus(passiveTestPlayer).atkFlat > 0 || getTalentBonus(passiveTestPlayer).defFlat > 0);

const completeCampaignKills = Object.fromEntries(
  STORY.acts.flatMap(act => act.missions.map(mission => [mission.id, mission.count]))
);
const completeCampaignClaims = Object.fromEntries(
  STORY.acts.flatMap(act => act.missions.map(mission => [mission.id, true]))
);
const completedCampaignPlayer = {
  campaignKills: completeCampaignKills,
  campaignClaimed: completeCampaignClaims
};
const completedShards = { flame: true, ice: true, blood: true };
check('campaign starts incomplete', !isCampaignComplete({ campaignKills: {}, campaignClaimed: {} }));

const regionMission = STORY.acts[0].missions[0];
const regionTestPlayer = { campaignKills: {}, campaignClaimed: {}, activeCampaignMission: null };
const accepted = acceptCampaignMission(regionTestPlayer, regionMission.id);
recordCampaignKill(regionTestPlayer, 'forest', regionMission.enemyId);
const noOffRegionProgress = (regionTestPlayer.campaignKills[regionMission.id] || 0) === 0;
recordCampaignKill(regionTestPlayer, STORY.acts[0].locationId, regionMission.enemyId);
const firstKillRecorded = regionTestPlayer.campaignKills[regionMission.id] === 1;
const rewardPreview = getMissionReward(regionMission);
check('campaign requires accepting a mission and counts only in its region', accepted && noOffRegionProgress && firstKillRecorded && rewardPreview.gold > 0 && rewardPreview.exp > 0);
const secondMissionBeforeTurnIn = getNextCampaignMission(regionTestPlayer)?.mission.id === regionMission.id;
regionTestPlayer.campaignKills[regionMission.id] = regionMission.count;
const claimedMission = claimCampaignMission(regionTestPlayer);
check('campaign mission must be completed and turned in', !!claimedMission && claimedMission.mission.id === regionMission.id && regionTestPlayer.activeCampaignMission === null);
const nextMission = getNextCampaignMission(regionTestPlayer);
check('next mission unlocks only after previous turn-in', secondMissionBeforeTurnIn && nextMission?.mission.id === STORY.acts[0].missions[1].id);

check('campaign progress reaches 25/25', getCampaignProgress(completedCampaignPlayer).completed === 25 && getCampaignProgress(completedCampaignPlayer).percent === 100);
check('main quest waits for story campaign', !canCompleteMainQuest({ storyShards: completedShards, player: { campaignKills: {}, campaignClaimed: {} } }));
check('main quest requires the final dragon, all three shards and 25 missions', canCompleteMainQuest({ storyShards: completedShards, storyDragons: { 'blood-crown': true }, player: completedCampaignPlayer }));
check('main quest remains locked before Blood Crown defeat', !canCompleteMainQuest({ storyShards: completedShards, storyDragons: { 'blood-crown': false }, player: completedCampaignPlayer }));
const dragonGateGame = { player: { activeCampaignMission: null }, storyDragons: {} };
const blockedDragon = recordStoryDragonDefeat(dragonGateGame, 'flame-lord', 'obsidian-fields');
dragonGateGame.player.activeCampaignMission = 'a3-m5';
const wrongLocationDragon = recordStoryDragonDefeat(dragonGateGame, 'flame-lord', 'volcano');
const acceptedDragon = recordStoryDragonDefeat(dragonGateGame, 'flame-lord', 'obsidian-fields');
const repeatedDragon = recordStoryDragonDefeat(dragonGateGame, 'flame-lord', 'obsidian-fields');
const dragonFinalesMatch = Object.values(STORY_DRAGONS).every(dragon => {
  const finale = STORY.acts[dragon.act - 1]?.missions?.[4];
  return finale?.id === dragon.missionId && finale.enemyId === dragon.enemyId && ENEMIES[dragon.enemyId]?.boss === true;
});
check('exactly three canonical dragon bosses match act 3–5 finales', Object.keys(STORY_DRAGONS).length === 3 && dragonFinalesMatch);
check('old act-one shard missions are removed', STORY.acts.every(act => act.missions.every(mission => !mission.shardId)));
check('exactly three Crystal Rift shard items exist and no enemy/location can award another', Object.values(ITEMS).filter(item => item.storyShard === true).length === 3 && ['shard-flame','shard-ice','shard-blood'].every(id => ITEMS[id]?.storyShard === true) && !ITEMS['mana-crystal'] && Object.values(ENEMIES).every(enemy => !(enemy.drops || []).some(id => ['shard-flame','shard-ice','shard-blood'].includes(id))) && Object.values(LOCATIONS).every(location => !location.shardId && !location.shardDrop));
check('story dragon flags require their accepted finale mission and canonical region, and award once', blockedDragon === null && wrongLocationDragon === null && acceptedDragon?.newlyDefeated === true && repeatedDragon?.newlyDefeated === false && dragonGateGame.storyDragons['ash-herald'] === true);
const allShardClaimsValid = Object.values(STORY_DRAGONS).every(dragon => {
  const game = { player: { activeCampaignMission: dragon.missionId } };
  const wrongRegion = claimStoryDragonReward(game, dragon.enemyId, 'wrong-location');
  const first = claimStoryDragonReward(game, dragon.enemyId, dragon.locationId);
  const second = claimStoryDragonReward(game, dragon.enemyId, dragon.locationId);
  return wrongRegion === null && first?.newlyDefeated === true && first.shardItemId === dragon.shardItemId && game.storyShards?.[dragon.shardId] === true && second?.newlyDefeated === false && Object.keys(game.storyShards).length === 1;
});
check('all three designated dragon rewards set exactly one matching shard and cannot be claimed twice', allShardClaimsValid && claimStoryDragonReward({ player: { activeCampaignMission: 'a3-m5' } }, 'goblin') === null);
const riftAreasLow = getRiftLocations(1);
const riftAreasHigh = getRiftLocations(50);
check('Rift map contains 30 unique named areas', riftAreasLow.length === 30 && new Set(riftAreasLow.map(area => area.id)).size === 30 && new Set(riftAreasLow.map(area => area.name)).size === 30);
check('exactly 10 Rift areas require level 50', riftAreasLow.filter(area => !area.unlocked && area.minLevel === 50).length === 10 && riftAreasHigh.every(area => area.unlocked));
check('all Rift areas resolve to real enemy regions', riftAreasLow.every(area => getRiftLocation(area.id)?.enemies?.length > 0));
state.game = { player: { level: 1 }, storyShards: { flame: true, ice: true, blood: true }, storyDragons: { 'blood-crown': false } };
const riftClosedBeforeCrown = !isRiftReady();
state.game.storyDragons['blood-crown'] = true;
check('Rift unlock depends on Blood Crown defeat, not shard count', riftClosedBeforeCrown && isRiftReady());
const towerFloors = Array.from({ length: TOWER_MAX_FLOOR }, (_, index) => getTowerLocation(index + 1));
const towerGuardians = towerFloors.filter((floor, index) => (index + 1) % 5 === 0);
check('Tower contains 40 unique floors with valid enemy rosters', towerFloors.length === 40 && new Set(towerFloors.map(floor => floor.id)).size === 40 && towerFloors.every(floor => floor.enemies.length >= 4));
check('Tower has eight non-dragon guardian floors', towerGuardians.length === 8 && towerGuardians.every(floor => floor.enemies.some(id => ENEMIES[id]?.boss) && !floor.enemies.some(id => ['flame-lord', 'ice-queen', 'ancient-dragon'].includes(id))));
check('Tower scaling increases with each floor', getTowerMult(40).hpMult > getTowerMult(1).hpMult && getTowerMult(40).atkMult > getTowerMult(1).atkMult);

const migratedV10 = migrateGame({
  version: 10,
  player: { class: 'mage', level: 12, stats: { kills: { [STORY.acts[0].missions[0].enemyId]: 2 } } }
});
check('v10 save migrates to v18 with level-scaled Luck and without importing lifetime kills', migratedV10.version === 18 && migratedV10.player.dex === 8 && migratedV10.player.luck === 10.5 && Object.keys(migratedV10.player.campaignKills).length === 0 && migratedV10.player.stats.kills[STORY.acts[0].missions[0].enemyId] === 2 && EQUIPMENT_SLOTS.length === 12 && EQUIPMENT_SLOTS.every(slot => slot in migratedV10.player.equipped) && ['ash-herald', 'ice-grasp', 'blood-crown'].every(id => migratedV10.storyDragons[id] === false) && ['flame', 'ice', 'blood'].every(id => migratedV10.storyShards[id] === false));
const migratedGear = migrateGame({ version: 15, player: { inventory: [], equipped: { hands: { id: 'tower-shield' }, legs: { id: 'windstep-boots' }, back: { id: 'ranger-cloak' }, wrists: { id: 'oath-bracers' }, seal: { id: 'seal-five-orders' } } } });
check('v15 equipment migration preserves shield, boots, cloak, gloves and amulet in the correct slots', migratedGear.version === 18 && migratedGear.player.equipped.shield?.id === 'tower-shield' && migratedGear.player.equipped.boots?.id === 'windstep-boots' && migratedGear.player.equipped.cloak?.id === 'ranger-cloak' && migratedGear.player.equipped.gloves?.id === 'oath-bracers' && migratedGear.player.equipped.amulet?.id === 'seal-five-orders' && ['hands','back','wrists','seal'].every(slot => !(slot in migratedGear.player.equipped)) && migratedGear.player.equipped.legs === null);
const migratedLegacyToken = migrateGame({ version: 16, player: { inventory: [{ id: 'mana-crystal', qty: 1 }], equipped: {} } });
check('v16 save renames the obsolete Mana Crystal quest token without losing it', migratedLegacyToken.version === 18 && migratedLegacyToken.player.inventory[0]?.id === 'old-archive-seal');

check('T1–T6 rarity table preserves configured base weights', Object.keys(RARITIES).length === 6 && [60, 25, 10, 4, 0.9, 0.1].every((weight, i) => Object.values(RARITIES)[i].weight === weight));
check('Luck and reputation multiply base loot chance and Luck caps at 100', Math.abs(getLootDropChance(0.5, { level: 1, luck: 5 }) - 0.5125) < 1e-9 && Math.abs(getLootDropChance(0.5, { level: 1, luck: 100, reputationModifier: 0.1 }) - 0.825) < 1e-9);
const riftWeights = getRarityWeights({ player: { riftClearedLocations: ['a', 'b', 'c'] }, isRift: true });
const cappedRiftWeights = getRarityWeights({ player: { riftClearedLocations: ['a', 'b', 'c', 'd'] }, isRift: true });
check('Rift bonus raises only T4+ rarity weights and caps at 30%', riftWeights.common === 60 && riftWeights.uncommon === 25 && Math.abs(riftWeights.epic - 5.2) < 1e-9 && Math.abs(riftWeights.legendary - 1.17) < 1e-9 && Math.abs(cappedRiftWeights.epic - 5.2) < 1e-9);

state.game = { player: { inventory: [], spells: [], hp: 100, maxHp: 500, mp: 0, maxMp: 300, level: 1, luck: 5 } };
const tierSamples = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map(rarity => {
  const before = state.game.player.inventory.length;
  addItem('iron-sword', 1, { rarity, allowMythic: true, random: () => 0 });
  return state.game.player.inventory[before];
});
const tierBaseBudgets = tierSamples.map(instance => Object.entries(instance.bonus).reduce((sum, [key, value]) => sum + (['attack', 'magic', 'defense', 'armor', 'dex', 'armorPen'].includes(key) ? value : 0), 0) - instance.affixes.reduce((sum, affix) => sum + Object.values(affix.bonus).reduce((total, value) => total + (typeof value === 'number' && Number.isInteger(value) ? value : 0), 0), 0));
check('generated equipment base stats use the six configured tier ranges', tierBaseBudgets.every((value, i) => value >= Object.values(RARITIES)[i].statRange[0] && value <= Object.values(RARITIES)[i].statRange[1]));
check('generated gear receives the configured tier affix count', tierSamples.every((instance, i) => instance.affixes.length === Object.values(RARITIES)[i].mods));
check('every canonical equipment category can roll all five T6 affixes', ['weapon','head','shoulders','chest','gloves','legs','boots','shield','ring','amulet','cloak'].every(type => rollItemAffixes({ type }, 'mythic', () => 0).length === 5));
state.game = { player: { inventory: [], str: 2 } };
addItem('iron-sword', 2, { rarity: 'common', random: () => 0 });
const weightBeforeReject = getInventoryWeight();
const overweightRejected = addItem('iron-sword', 1, { rarity: 'common', random: () => 0 }).length === 0;
check('Strength sets carrying capacity at 5 weight per point', getInventoryCapacity() === 10 && weightBeforeReject === 10 && overweightRejected);
state.game = { player: { inventory: [], str: 100 } };
for (let i = 0; i < 30; i++) addItem('iron-sword', 1, { rarity: 'common', random: () => 0 });
const fullBagRejected = addItem('iron-sword', 1, { rarity: 'common', random: () => 0 }).length === 0;
const shardAllowed = addItem('shard-flame', 1).length === 1;
check('bag is limited to 30 slots while quest shards use a separate weightless allowance', getInventorySlotCount() === 30 && fullBagRejected && shardAllowed && getInventoryWeight() === 150);

const craftMaterials = [
  { id: 'ember-core', qty: 3 }, { id: 'void-dust', qty: 3 },
  { id: 'grave-salt', qty: 1 }, { id: 'frost-essence', qty: 2 },
  { id: 'root-fiber', qty: 2 }
];
state.game = { player: { inventory: craftMaterials.map(item => ({ ...item })), level: 50, campaignClaimed: {} } };
check('T5 forge recipes stay locked before Act 5', !canCraftRecipe('r5-dragon-blade').ok);
const finalActClaims = {};
for (const act of STORY.acts.slice(0, 4)) for (const mission of act.missions) finalActClaims[mission.id] = true;
state.game.player.campaignClaimed = finalActClaims;
check('T5 forge exposes three recipes only in the final act', canCraftRecipe('r5-dragon-blade').ok && canCraftRecipe('r5-dragon-plate').ok && canCraftRecipe('r5-astral-staff').ok);
state.game.player.craftedHighTierByAct = { 4: 1 };
check('only one T4+ craft is allowed per act', !canCraftRecipe('r5-dragon-blade').ok);
globalThis.localStorage = { setItem() {}, getItem() { return null; }, removeItem() {} };
state.game = { location: 'village', player: { inventory: [{ id: 'herb-life', qty: 3 }], level: 1, campaignClaimed: {} } };
const instantCraft = craftRecipe('r-hp');
check('city crafting completes immediately and consumes ingredients', instantCraft.ok && !instantCraft.queued && state.game.player.inventory.some(item => item.id === 'health-potion'));
state.game = { location: 'camp', player: { inventory: [{ id: 'herb-life', qty: 3 }], level: 1, campaignClaimed: {} } };
const campCraft = craftRecipe('r-hp');
const campHours = campCraft.hours;
check('camp crafting queues a persistent 1–3 hour job', campCraft.ok && campCraft.queued && campHours >= 1 && campHours <= 3 && state.game.player.craftingJobs.length === 1);

state.game = { player: { inventory: [], spells: [], hp: 100, maxHp: 500, mp: 0, maxMp: 300, level: 1, luck: 5 } };
addItem('scroll-frost-nova', 2);
const scrollStacked = state.game.player.inventory.length === 1 && state.game.player.inventory[0].qty === 2;
const scrollUsed = useItem('scroll-frost-nova');
check('new scroll stacks and teaches its spell', scrollStacked && scrollUsed && state.game.player.spells.includes('frost-nova') && state.game.player.inventory[0].qty === 1);
addItem('greater-health-potion');
const potionUsed = useItem('greater-health-potion');
check('new potion restores health and is consumed', potionUsed && state.game.player.hp === 460 && !state.game.player.inventory.some(item => item.id === 'greater-health-potion'));

state.game = { player: { inventory: [], level: 1 } };
addItem('iron-sword', 1, { rarity: 'common', random: () => 0 });
addItem('root-fiber', 1);
const reforgeAvailable = canReforgeItem(0).ok;
const reforgeResult = reforgeItemByIndex(0);
check('reforging spends the matching essence and rerolls the same gear tier', reforgeAvailable && reforgeResult.ok && state.game.player.inventory[0].id === 'iron-sword' && state.game.player.inventory[0].rarity === 'common' && !state.game.player.inventory.some(item => item.id === 'root-fiber'));

state.game = { player: { inventory: [], equipped: { weapon: null }, gold: 100 } };
addItem('dragon-blade', 1, { rarity: 'legendary', random: () => 0 });
const weaponSlot = equipItemByIndex(0);
const attackBeforeUpgrade = state.game.player.equipped.weapon.bonus.attack;
const upgradeResult = upgradeEquipment('weapon');
const attackAfterUpgrade = state.game.player.equipped.weapon.bonus.attack;
check('blacksmith upgrade increases item stats by 5%', weaponSlot === 'weapon' && upgradeResult.ok && attackAfterUpgrade === Math.round(attackBeforeUpgrade * 1.05));

state.game = { player: { inventory: [
  { id: 'iron-sword', qty: 1, rarity: 'common' },
  { id: 'dragon-blade', qty: 1, rarity: 'legendary' },
  { id: 'iron-sword', qty: 1, rarity: 'mythic' }
], gold: 0, stats: {} } };
const protectedSale = sellItemsByIndices([1]);
const mythicSale = sellItemsByIndices([2], { confirmed: true });
const confirmedSale = sellItemsByIndices([1], { confirmed: true });
check('sale flow requires confirmation for T4+ and refuses T6 even after confirmation', protectedSale.requiresConfirmation && !mythicSale.ok && confirmedSale.ok && state.game.player.gold === 140 && state.game.player.inventory.length === 2);
state.game = { player: { inventory: [{ id: 'iron-sword', qty: 1, rarity: 'common' }], gold: 2, stats: {} } };
const simpleSale = sellItemsByIndices([0]);
const buybackRecord = getBuybackItems()[0];
const buybackResult = buybackItem(0);
check('same-day buyback restores the sold item at a 20% markup', simpleSale.ok && buybackRecord.price === 4 && buybackResult.ok && state.game.player.gold === 1 && state.game.player.inventory[0]?.id === 'iron-sword');

state.game = { player: {
  class: 'warrior', hp: 170, maxHp: 170, mp: 0, maxMp: 100,
  str: 18, int: 4, wis: 7, con: 16, dex: 6,
  inventory: [], spells: [], effects: [], talents: [],
  equipped: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null]))
} };
addItem('rootbound-hood', 1, { rarity: 'common' });
addItem('rune-root', 1);
const headSlot = equipItemByIndex(0);
const runeInserted = socketRune(0, 'head');
const runeEquipped = state.game.player.equipped.head?.runes?.includes('rune-root');
const gearStats = getEffStats();
check('12 canonical equipment slots include gloves, legs, boots, shield, cloak and two rings', EQUIPMENT_SLOTS.length === 12 && ['head','shoulders','chest','gloves','legs','boots','weapon','shield','ring1','ring2','amulet','cloak'].every(slot => EQUIPMENT_SLOTS.includes(slot)));
check('headgear can be equipped and rune inserted into its socket', headSlot === 'head' && runeInserted && runeEquipped && !state.game.player.inventory.some(item => item.id === 'rune-root'));
check('additional equipment and socketed runes affect character stats', gearStats.def > 0 && gearStats.dodgeChance > CLASSES.warrior.combat.dodgeChance);
state.game.player.equipped.ring1 = { id: 'ring-wolf-eye', rarity: 'common', bonus: ITEMS['ring-wolf-eye'].bonus };
state.game.player.equipped.ring2 = { id: 'ring-quiet-tide', rarity: 'common', bonus: ITEMS['ring-quiet-tide'].bonus };
addItem('ring-wolf-eye', 1, { rarity: 'common' });
const ringSwapSlot = equipItemByIndex(state.game.player.inventory.length - 1);
check('new ring replaces the weaker ring slot instead of always ring one', ringSwapSlot === 'ring2' && state.game.player.equipped.ring1.id === 'ring-wolf-eye' && state.game.player.equipped.ring2.id === 'ring-wolf-eye');

state.game = { player: { exp: 0, level: 1 } };
addExp(30);
check('addExp increases exp', state.game.player.exp === 30);

state.game = { player: { hp: 80, maxHp: 80, mp: 10, maxMp: 10, str: 4, int: 12, wis: 8, con: 5, equipped: { weapon: null, armor: null }, effects: [], talents: [] } };
const eff = getEffStats();
check('getEffStats computes stats', eff.atk > 0 && eff.mag > 0);

state.game = { player: { hp: 80, maxHp: 80, mp: 10, maxMp: 10, str: 4, int: 12, wis: 8, con: 5, equipped: { weapon: null, armor: null }, effects: [], talents: [] } };
const st = state.game.player;
applyEffect(st, 'burn');
check('status: applyEffect/tick/hasEffect', hasEffect(st, 'burn'));

state.game = null;

if (results.some((r) => r.startsWith('FAIL'))) {
  console.error(results.join('\n'));
  process.exit(1);
}
console.log(results.join('\n'));
console.log('smoke-load: OK');
