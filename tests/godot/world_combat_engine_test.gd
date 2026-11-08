extends SceneTree

const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")

func _initialize() -> void:
	var failures: Array[String] = []
	var rarity_hero := {"inventory":[{"id":"root-fiber","qty":2}]}
	if not Combat.add_item(rarity_hero,"root-fiber",1,"rare") or rarity_hero.inventory.size()!=2 or str(rarity_hero.inventory[1].get("rarity",""))!="rare":
		failures.append("rarity-bearing stack must not merge into an unrarified material stack")
	if not Combat.add_item(rarity_hero,"root-fiber",2,"rare") or int(rarity_hero.inventory[1].get("qty",0))!=3:
		failures.append("items with matching rarity must still stack together")

	if Combat.progression_exp_next(1) != 125 or Combat.progression_exp_next(11) != 259 or Combat.progression_exp_next(21) != 269 or Combat.progression_exp_next(31) != 369 or Combat.progression_exp_next(41) != 535 or Combat.progression_exp_next(51) != int(floor(535.0 * pow(51.0 / 50.0, 1.5))):
		failures.append("native XP thresholds must match browser progression bands")
	var progression_hero := {"class":"warrior","level":1,"exp":0,"expNext":125,"maxHp":170,"maxMp":100,"hp":170,"mp":100,"attack":22,"defense":16,"str":18,"int":4,"wis":7,"con":16,"dex":6,"statPoints":0,"passivePoints":0,"luck":5.0}
	if Combat._grant_experience(progression_hero, 125) != 1 or int(progression_hero.level) != 2 or int(progression_hero.statPoints) != 1 or int(progression_hero.passivePoints) != 1 or int(progression_hero.maxHp) != 184 or int(progression_hero.str) != 20 or int(progression_hero.con) != 17 or int(progression_hero.dex) != 7:
		failures.append("warrior level-up must apply browser XP threshold, class growth and points")
	var mage_growth := {"class":"mage","level":1,"exp":0,"expNext":125,"maxHp":105,"maxMp":180,"hp":105,"mp":100,"attack":12,"defense":7,"str":4,"int":20,"wis":14,"con":7,"dex":8,"statPoints":0,"passivePoints":0,"luck":5.0}
	if Combat._grant_experience(mage_growth, 125) != 1 or int(mage_growth.int) != 22 or int(mage_growth.wis) != 15 or int(mage_growth.con) != 8 or int(mage_growth.maxMp) != 193 or int(mage_growth.mp) != 193:
		failures.append("mage level-up must grow intelligence, wisdom, constitution and restore mana")
	var archer_growth := {"class":"archer","level":1,"exp":0,"expNext":125,"maxHp":125,"maxMp":100,"hp":125,"mp":50,"attack":20,"defense":10,"str":12,"int":7,"wis":9,"con":10,"dex":18,"statPoints":0,"passivePoints":0,"luck":5.0}
	if Combat._grant_experience(archer_growth, 125) != 1 or int(archer_growth.dex) != 20 or int(archer_growth.str) != 13 or int(archer_growth.con) != 11 or int(archer_growth.maxHp) != 135:
		failures.append("archer level-up must grow dexterity, strength and constitution")
	var class_stats_world := WorldState.create(990)
	Combat.select_class(class_stats_world, "mage")
	if int(class_stats_world.hero.str) != 4 or int(class_stats_world.hero.int) != 20 or int(class_stats_world.hero.wis) != 14 or int(class_stats_world.hero.con) != 7 or int(class_stats_world.hero.dex) != 8 or Combat.effective_stat(class_stats_world.hero, "magic") != 20:
		failures.append("native class attributes and derived magic must match browser class base stats")
	var world := WorldState.create(991)
	world["currentRegionId"] = "forest"
	var hero := Combat.ensure_hero(world)
	var enemy := {"name": "Тестовый гоблин", "persistentId": "enemy-0", "hp": 10, "maxHp": 10, "attack": 1, "defense": 0, "exp": 25, "gold": 15, "boss": false, "dead": false}
	var fight := Combat.begin(enemy)
	var result := Combat.player_attack(world, fight)
	if not result.ok or fight.result != "victory":
		failures.append("player attack must defeat a low-health enemy")
	if int(world.hero.exp) != 25 or int(world.hero.gold) != 2:
		failures.append("victory must award experience and gold")
	if not WorldState.is_enemy_defeated(world, "forest", "enemy-0", 0.0):
		failures.append("regular enemy defeat must be persisted with respawn deadline")
	var hard_respawn_world := WorldState.create(9911)
	hard_respawn_world["difficulty"] = "hard"
	hard_respawn_world["currentRegionId"] = "forest"
	var hard_respawn_enemy := {"name":"Враг","enemyId":"goblin","persistentId":"enemy-hard-respawn","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":1,"gold":0,"boss":false,"dead":false,"drops":[],"dropSeed":11}
	var hard_respawn_fight := Combat.begin(hard_respawn_enemy)
	Combat.player_attack(hard_respawn_world, hard_respawn_fight)
	var hard_respawn_record: Dictionary = WorldState.get_region_record(hard_respawn_world, "forest")
	if not is_equal_approx(float(hard_respawn_record.get("defeatedEnemies", {}).get("enemy-hard-respawn", -1.0)), 1.0):
		failures.append("hard difficulty must persist a sixty-second respawn deadline in world-clock minutes")
	var boss := {"name": "Босс", "persistentId": "boss-test", "hp": 10, "maxHp": 10, "attack": 1, "defense": 0, "exp": 100, "gold": 50, "boss": true, "dead": false}
	var boss_fight := Combat.begin(boss)
	Combat.player_attack(world, boss_fight)
	if not world.regions.forest.defeatedBosses.has("boss-test"):
		failures.append("boss victory must be persisted permanently")
	var guarded_world := WorldState.create(9912)
	guarded_world["factions"] = {"schemaVersion":1,"reputation":{"hub-guardians":90}}
	var guarded_hero := Combat.ensure_hero(guarded_world)
	var guarded_enemy := {"name":"Проверка удара","persistentId":"enemy-guarded","hp":1000,"maxHp":1000,"attack":20,"defense":0,"exp":1,"gold":0,"boss":false,"dead":false}
	var guarded_fight := Combat.begin(guarded_enemy)
	var guarded_hp_before := int(guarded_hero.hp)
	Combat.player_attack(guarded_world, guarded_fight)
	var guarded_damage := guarded_hp_before - int(guarded_hero.hp)
	var expected_raw := maxi(1, 20 - int(floor(float(Combat.effective_stat(guarded_hero, "defense")) / 2.0)))
	var expected_guarded := maxi(1, int(floor(float(expected_raw) * 0.85)))
	if guarded_damage != expected_guarded:
		failures.append("allied Hub Guardians must reduce incoming native combat damage by 15 percent")
	var strong := {"name": "Сильный враг", "persistentId": "enemy-strong", "hp": 100, "maxHp": 100, "attack": 999, "defense": 0, "exp": 1, "gold": 1, "boss": false, "dead": false}
	var loss_fight := Combat.begin(strong)
	var hp_before := int(world.hero.hp)
	Combat.player_attack(world, loss_fight)
	if loss_fight.result != "defeat" or int(world.hero.hp) != 1 or bool(strong.dead):
		failures.append("defeat must leave enemy alive and hero at one HP")
	var poisoned := {"hp": 50, "effects": []}
	Combat.apply_effect(poisoned, "poison")
	var poison_tick := Combat.tick_effects(poisoned)
	if int(poison_tick.damage) != 5 or poisoned.effects[0].duration != 2:
		failures.append("poison must damage and decrement duration")
	var phase_enemy := {"name":"Теневой маг","enemyId":"shadow-mage","persistentId":"phase-boss","hp":40,"maxHp":100,"attack":30,"defense":0,"exp":1,"gold":1,"boss":true,"dead":false,"phases":[{"atHp":0.5,"atkMult":1.4,"msg":"Босс ярится!","specialEvery":1}],"special":{"type":"snipe","every":3,"mult":1.8,"name":"Тёмная стрела","effect":"burn"}}
	var phase_messages := Combat._update_boss_phase(phase_enemy)
	if int(phase_enemy.get("phase",0)) != 1 or float(phase_enemy.get("phaseAttackMult",1.0)) != 1.4 or int(phase_enemy.get("phaseSpecialEvery",0)) != 1 or phase_messages.is_empty():
		failures.append("boss phase transition must update attack and special cadence")
	var modifier_world := WorldState.create(9901)
	var vamp_enemy := {"name":"Вампир","persistentId":"enemy-vamp","hp":40,"maxHp":100,"attack":10,"defense":0,"exp":1,"gold":1,"boss":false,"dead":false,"modifierEffect":"vampiric"}
	var vamp_fight := Combat.begin(vamp_enemy)
	var vamp_before := int(vamp_enemy.hp)
	var vamp_expected := vamp_before - Combat.effective_stat(Combat.ensure_hero(modifier_world), "attack")
	Combat.player_attack(modifier_world, vamp_fight)
	if int(vamp_enemy.hp) <= vamp_expected:
		failures.append("vampiric modifier must restore enemy health after its counterattack")
	var regen_enemy := {"name":"Страж регенерации","persistentId":"enemy-regen","hp":40,"maxHp":100,"attack":1,"defense":0,"exp":1,"gold":1,"boss":false,"dead":false,"modifierEffect":"regenerate"}
	var regen_fight := Combat.begin(regen_enemy)
	Combat.player_attack(modifier_world, regen_fight)
	if int(regen_enemy.hp) <= 40:
		failures.append("regenerating modifier must restore enemy health each turn")
	var poison_enemy := {"name":"Ядовитый","persistentId":"enemy-poison","hp":100,"maxHp":100,"attack":1,"defense":0,"exp":1,"gold":1,"boss":false,"dead":false,"modifierEffect":"poison"}
	var poison_fight := Combat.begin(poison_enemy)
	Combat.player_attack(modifier_world, poison_fight)
	if not modifier_world.hero.effects.any(func(effect): return str(effect.get("id","")) == "poison"):
		failures.append("poisonous modifier must apply a poison status")
	var special_enemy := {"name":"Шаман","persistentId":"enemy-shaman","hp":100,"maxHp":100,"attack":10,"defense":0,"exp":1,"gold":1,"boss":false,"dead":false,"special":{"type":"snipe","every":1,"mult":2.0,"name":"Ядовитые споры","effect":"poison"}}
	var special_fight := Combat.begin(special_enemy)
	var special_result := Combat.player_attack(world, special_fight)
	if not special_result.ok or not str(special_result.message).contains("Особый приём") or world.hero.effects.is_empty():
		failures.append("enemy special attack must apply its status effect")
	var mage_world := WorldState.create(992)
	mage_world["hero"] = {"class":"mage","maxHp":105,"hp":105,"maxMp":180,"mp":180,"attack":12,"defense":7,"level":1,"exp":0,"gold":0}
	var mage := Combat.ensure_hero(mage_world)
	var spell_enemy := {"name":"Тестовый враг","persistentId":"enemy-spell","hp":100,"maxHp":100,"attack":1,"defense":0,"exp":1,"gold":1,"boss":false,"dead":false}
	var spell_fight := Combat.begin(spell_enemy)
	var spell_result := Combat.cast_spell(mage_world, spell_fight, "fireball")
	if not spell_result.ok or int(mage_world.hero.mp) != 165 or int(spell_enemy.hp) >= 100:
		failures.append("mage must cast known spells and spend mana")
	var warrior_world := WorldState.create(993)
	var warrior := Combat.ensure_hero(warrior_world)
	var ability_enemy := {"name":"Манекен","persistentId":"enemy-ability","hp":1000,"maxHp":1000,"attack":1,"defense":0,"exp":1,"gold":1,"boss":false,"dead":false}
	var ability_fight := Combat.begin(ability_enemy)
	var ability_result := Combat.use_ability(warrior_world, ability_fight, "charge")
	if not ability_result.ok or int(warrior_world.hero.mp) != 80 or warrior_world.hero.buffs.is_empty():
		failures.append("warrior abilities must consume resource and apply buffs")
	var invalid_spell := Combat.cast_spell(warrior_world, ability_fight, "fireball")
	if invalid_spell.ok:
		failures.append("classes must not cast spells they do not know")
	var inventory_world := WorldState.create(994)
	var inventory_hero := Combat.ensure_hero(inventory_world)
	if inventory_hero.inventory.size() != 3:
		failures.append("new warrior must receive the three authored starting items")
	var initial_hp := int(inventory_hero.hp)
	var potion_result := Combat.use_item(inventory_world,"health-potion")
	if not potion_result.ok or int(inventory_world.hero.hp) < initial_hp:
		failures.append("health potion must be consumed and restore health")
	var equip_result := Combat.equip_item(inventory_world,0)
	if not equip_result.ok or inventory_world.hero.equipped.get("weapon",null) == null:
		failures.append("weapon must equip into its matching slot")
	if Combat.effective_stat(inventory_world.hero,"attack") <= int(inventory_world.hero.attack):
		failures.append("equipped weapon bonus must affect effective attack")
	var scroll_world := WorldState.create(995)
	var scroll_hero := Combat.ensure_hero(scroll_world)
	Combat.add_item(scroll_hero,"scroll-lightning",1)
	var scroll_result := Combat.use_item(scroll_world,"scroll-lightning")
	if not scroll_result.ok or not scroll_world.hero.spells.has("lightning"):
		failures.append("spell scroll must teach a spell and be consumed")
	var class_choice_world := WorldState.create(996)
	var class_choice := Combat.select_class(class_choice_world,"mage")
	if not class_choice.ok or class_choice_world.hero.class != "mage" or class_choice_world.hero.inventory.size() != 3:
		failures.append("class selection must initialize the chosen class and starter loadout")
	var class_reselect := Combat.select_class(class_choice_world,"archer")
	if class_reselect.ok:
		failures.append("class selection must be locked after character creation")
	var slow_target := {"hp":100,"effects":[]}
	Combat.apply_effect(slow_target,"slow")
	if slow_target.effects.is_empty():
		failures.append("slow status effect must be supported")
	var thorn_drops: Dictionary = preload("res://godot/scripts/world_enemy_catalog.gd").get_enemy("thorn-stalker")
	if thorn_drops.get("drops", []).is_empty():
		failures.append("thorn-stalker loot must be exposed as top-level enemy drops")
	var loot_world := WorldState.create(997)
	var loot_hero := Combat.ensure_hero(loot_world)
	var loot_boss := {"name":"Босс с добычей","enemyId":"shadow-mage","persistentId":"boss-loot","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":1,"gold":1,"boss":true,"dead":false,"drops":["mana-potion","apprentice-staff"],"dropSeed":12345}
	var loot_fight := Combat.begin(loot_boss)
	var loot_result := Combat.player_attack(loot_world,loot_fight)
	if not loot_result.ok or not loot_hero.inventory.any(func(item): return str(item.get("id","")) == "mana-potion"):
		failures.append("boss victory must guarantee its first signature drop")
	if not loot_hero.inventory.any(func(item): return str(item.get("id","") ) in ["herb-life", "herb-moon"] and int(item.get("qty", 0)) >= 2):
		failures.append("boss victory must award a deterministic two-herb bundle when its seeded herb roll succeeds")
	var ability_reward_world := WorldState.create(998)
	ability_reward_world["currentRegionId"] = "forest"
	var ability_reward_hero := Combat.ensure_hero(ability_reward_world)
	var ability_boss := {"name":"Босс от способности","enemyId":"shadow-mage","persistentId":"boss-ability-reward","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":37,"gold":19,"boss":true,"dead":false,"drops":["mana-potion"],"dropSeed":6789}
	var ability_reward_fight := Combat.begin(ability_boss)
	var ability_kill := Combat.use_ability(ability_reward_world, ability_reward_fight, "shield-bash")
	if not ability_kill.ok or ability_reward_fight.result != "victory" or int(ability_reward_hero.exp) != 37 or int(ability_reward_hero.gold) != 3 or not ability_reward_hero.inventory.any(func(item): return str(item.get("id","")) == "mana-potion") or not ability_reward_world.regions.forest.defeatedBosses.has("boss-ability-reward"):
		failures.append("ability victory must award XP, gold, guaranteed boss loot and persist boss defeat")
	var spell_reward_world := WorldState.create(999)
	spell_reward_world["currentRegionId"] = "forest"
	spell_reward_world["hero"] = {"class":"mage","maxHp":105,"hp":105,"maxMp":180,"mp":180,"attack":12,"defense":7,"level":1,"exp":0,"gold":0}
	var spell_reward_hero := Combat.ensure_hero(spell_reward_world)
	var spell_boss := {"name":"Босс от заклинания","enemyId":"shadow-mage","persistentId":"boss-spell-reward","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":41,"gold":23,"boss":true,"dead":false,"drops":["mana-potion"],"dropSeed":9876}
	var spell_reward_fight := Combat.begin(spell_boss)
	var spell_kill := Combat.cast_spell(spell_reward_world, spell_reward_fight, "fireball")
	if not spell_kill.ok or spell_reward_fight.result != "victory" or int(spell_reward_hero.exp) != 41 or int(spell_reward_hero.gold) != 3 or not spell_reward_hero.inventory.any(func(item): return str(item.get("id","")) == "mana-potion") or not spell_reward_world.regions.forest.defeatedBosses.has("boss-spell-reward"):
		failures.append("spell victory must award XP, gold, guaranteed boss loot and persist boss defeat")

	var dragon_world := WorldState.create(1001)
	dragon_world["currentRegionId"] = "obsidian-fields"
	dragon_world["hero"] = {"class":"warrior","level":30,"exp":0,"expNext":125,"maxHp":170,"hp":170,"maxMp":100,"mp":100,"attack":22,"defense":16,"str":18,"int":4,"wis":7,"con":16,"dex":6,"gold":0,"inventory":[],"equipped":{},"activeCampaignMission":"a3-m5","campaignKills":{},"campaignClaimed":{}}
	var dragon_hero := Combat.ensure_hero(dragon_world)
	var dragon_boss := {"name":"Пепельный Вестник","enemyId":"flame-lord","persistentId":"story-dragon-test","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":10,"gold":5,"boss":true,"dead":false,"drops":[],"dropSeed":123}
	var dragon_fight := Combat.begin(dragon_boss)
	var dragon_result := Combat.player_attack(dragon_world,dragon_fight)
	if not dragon_result.ok or dragon_world.get("storyDragons",{}).get("ash-herald",false)!=true or dragon_world.get("storyShards",{}).get("flame",false)!=true or dragon_hero.get("storyShards",{}).get("flame",false)!=true or not dragon_hero.inventory.any(func(item): return str(item.get("id",""))=="shard-flame"):
		failures.append("accepted Ash Herald finale must grant its story flag, flame shard and quest item")
	var repeat_dragon := Combat._claim_story_dragon_reward(dragon_world,dragon_hero,"flame-lord","obsidian-fields")
	if not repeat_dragon.is_empty() or dragon_hero.inventory.filter(func(item): return str(item.get("id",""))=="shard-flame").size()!=1:
		failures.append("story dragon shard must not be awarded twice")
	var wrong_mission_world := WorldState.create(1002)
	wrong_mission_world["currentRegionId"]="obsidian-fields"
	wrong_mission_world["hero"]={"class":"warrior","level":30,"activeCampaignMission":"a3-m4","inventory":[]}
	var wrong_hero := Combat.ensure_hero(wrong_mission_world)
	if not Combat._claim_story_dragon_reward(wrong_mission_world,wrong_hero,"flame-lord","obsidian-fields").is_empty():
		failures.append("story dragon must not grant a shard outside its finale mission")

	var remaining_dragons := [
		{"enemy":"ice-queen","region":"frost-citadel","mission":"a4-m5","flag":"ice-grasp","shard":"ice","item":"shard-ice"},
		{"enemy":"ancient-dragon","region":"dragon-lair","mission":"a5-m5","flag":"blood-crown","shard":"blood","item":"shard-blood"}
	]
	for i in range(remaining_dragons.size()):
		var spec: Dictionary = remaining_dragons[i]
		var story_world := WorldState.create(1010+i)
		story_world["currentRegionId"] = str(spec.region)
		story_world["hero"] = {"class":"warrior","level":50,"inventory":[],"activeCampaignMission":str(spec.mission)}
		var normalized_hero := Combat.ensure_hero(story_world)
		var story_enemy := {"name":"Story dragon","enemyId":str(spec.enemy),"persistentId":"story-test-%s" % str(spec.shard),"hp":1,"maxHp":1,"attack":1,"defense":0,"exp":10,"gold":5,"boss":true,"dead":false,"drops":[],"dropSeed":1010+i}
		var story_fight := Combat.begin(story_enemy)
		var story_result := Combat.player_attack(story_world,story_fight)
		if not bool(story_result.get("ok",false)) or story_world.get("storyDragons",{}).get(str(spec.flag),false)!=true or story_world.get("storyShards",{}).get(str(spec.shard),false)!=true or normalized_hero.get("storyShards",{}).get(str(spec.shard),false)!=true or not normalized_hero.inventory.any(func(item): return str(item.get("id",""))==str(spec.item)):
			failures.append("finale %s combat victory must grant its matching story flag, shard and quest item" % str(spec.mission))
		var CampaignProgress = preload("res://godot/scripts/world_campaign_engine.gd")
		var shard_gate := CampaignProgress.progress(normalized_hero, {"id":"test-%s" % str(spec.shard),"count":1,"shardId":str(spec.shard)})
		if not bool(shard_gate.shardFound):
			failures.append("dragon reward must be visible to campaign shard requirements")

	var tower_reward_world := WorldState.create(1003)
	tower_reward_world["currentRegionId"] = "obsidian-fields"
	tower_reward_world["hero"] = {"class":"warrior","level":30,"exp":0,"expNext":125,"maxHp":170,"hp":170,"maxMp":100,"mp":100,"attack":22,"defense":16,"str":18,"int":4,"wis":7,"con":16,"dex":6,"gold":0,"inventory":[],"equipped":{},"activeCampaignMission":"a3-m5","campaignKills":{},"campaignClaimed":{}}
	var tower_reward_enemy := {"name":"Башенный Вестник","enemyId":"flame-lord","persistentId":"tower-reward-test","towerMode":true,"towerFloor":5,"hp":1,"maxHp":1,"attack":1,"defense":0,"exp":31,"gold":17,"boss":true,"dead":false,"drops":["shard-flame"],"dropSeed":222}
	var tower_reward_fight := Combat.begin(tower_reward_enemy)
	var tower_reward_result := Combat.player_attack(tower_reward_world,tower_reward_fight)
	if not tower_reward_result.ok or int(tower_reward_world.hero.exp) != 31 or int(tower_reward_world.hero.gold) != 17:
		failures.append("Tower victory must still award its authored XP and gold")
	if tower_reward_world.get("storyDragons",{}).get("ash-herald",false) or tower_reward_world.get("storyShards",{}).get("flame",false) or tower_reward_world.hero.get("storyShards",{}).get("flame",false):
		failures.append("Tower boss must not trigger campaign dragon story rewards")
	if tower_reward_world.get("regions",{}).get("obsidian-fields",{}).get("defeatedBosses",[]).has("tower-reward-test"):
		failures.append("Tower boss must not mark a regional campaign boss as defeated")

	var PhaseCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
	var authored_phase_ids := ["shadow-mage","grave-king","archmage","flame-lord","ice-queen","sand-king","ancient-dragon","fire-drake","elder-treant","bone-colossus","bone-tyrant","void-harbinger","root-court-executioner","drowned-queen","oath-forge-warden","mirror-icekeeper","echo-devourer"]
	for phase_id in authored_phase_ids:
		var phase_definition: Dictionary = PhaseCatalog.get_enemy(phase_id)
		if phase_definition.is_empty() or phase_definition.get("phases", []).is_empty():
			failures.append("browser phase data must be present for %s" % phase_id)
	var ability_phase_world := WorldState.create(1004)
	var ability_phase_enemy := {"name":"Фазовый босс","enemyId":"elder-treant","persistentId":"phase-ability","hp":100,"maxHp":100,"attack":1,"defense":0,"exp":1,"gold":1,"boss":true,"dead":false,"phases":[{"atHp":0.9,"atkMult":1.3,"msg":"Фаза способности","specialEvery":1}]}
	var ability_phase_fight := Combat.begin(ability_phase_enemy)
	var ability_phase_result := Combat.use_ability(ability_phase_world,ability_phase_fight,"shield-bash")
	if not ability_phase_result.ok or int(ability_phase_enemy.get("phase",0)) != 1:
		failures.append("ability damage must trigger a boss phase transition")
	var spell_phase_world := WorldState.create(1005)
	spell_phase_world["hero"] = {"class":"mage","level":1,"hp":105,"maxHp":105,"mp":180,"maxMp":180,"inventory":[],"spells":["fireball"]}
	var spell_phase_enemy := {"name":"Фазовый босс","enemyId":"elder-treant","persistentId":"phase-spell","hp":100,"maxHp":100,"attack":1,"defense":0,"exp":1,"gold":1,"boss":true,"dead":false,"phases":[{"atHp":0.9,"atkMult":1.3,"msg":"Фаза заклинания","specialEvery":1}]}
	var spell_phase_fight := Combat.begin(spell_phase_enemy)
	var spell_phase_result := Combat.cast_spell(spell_phase_world,spell_phase_fight,"fireball")
	if not spell_phase_result.ok or int(spell_phase_enemy.get("phase",0)) != 1:
		failures.append("spell damage must trigger a boss phase transition")
	var retreat_fight := Combat.begin(strong)
	if not Combat.retreat(retreat_fight) or retreat_fight.result != "retreat":
		failures.append("retreat must close combat without killing enemy")

	var PassiveTree = preload("res://godot/scripts/world_passive_tree.gd")
	var PassiveEngine = preload("res://godot/scripts/world_passive_engine.gd")
	for class_id in ["warrior","mage","archer"]:
		var passive_tree: Dictionary = PassiveTree.get_tree(class_id)
		if passive_tree.nodes.size()!=31: failures.append("%s tree must contain 30 nodes and start" % class_id)
	var passive_hero := {"class":"warrior","level":1,"passivePoints":2,"passives":["start"],"gold":1000}
	if PassiveEngine.can_allocate(passive_hero,"warrior-might-1"): failures.append("passive must enforce level requirement")
	passive_hero["level"]=2
	if not PassiveEngine.can_allocate(passive_hero,"warrior-might-1"): failures.append("first passive must unlock at level 2")
	var purchase: Dictionary = PassiveEngine.allocate(passive_hero,"warrior-might-1")
	if not purchase.ok or int(passive_hero.passivePoints)!=1 or not passive_hero.passives.has("warrior-might-1"): failures.append("passive allocation must consume one point")
	if int(PassiveEngine.get_bonus(passive_hero).atkFlat)!=3: failures.append("might passive must grant +3 attack")
	var mage_tree_hero := {"class":"mage","level":2,"passivePoints":1,"passives":["start","mage-fire-1"]}
	if not is_equal_approx(float(PassiveEngine.get_bonus(mage_tree_hero).spellMult),1.06): failures.append("mage fire passive must multiply spell damage by 1.06")
	if Combat.effective_stat({"class":"warrior","str":18,"passives":["start","warrior-might-1"]},"attack") != 21: failures.append("passive flat attack bonus must feed combat effective stats")
	if PassiveEngine.can_allocate(passive_hero,"warrior-might-2"): failures.append("second passive must require level 5")
	passive_hero["level"]=5
	if not PassiveEngine.can_allocate(passive_hero,"warrior-might-2"): failures.append("second connected passive must unlock at level 5")
	var purchase_two: Dictionary = PassiveEngine.allocate(passive_hero,"warrior-might-2")
	if not purchase_two.ok or int(passive_hero.passivePoints)!=0: failures.append("second passive must spend final point")
	var reset_result: Dictionary = PassiveEngine.reset(passive_hero)
	if not reset_result.ok or int(reset_result.refunded)!=2 or int(passive_hero.passivePoints)!=2 or int(passive_hero.gold)!=500 or passive_hero.passives!=["start"]: failures.append("reset must cost 500 gold and refund all points")
	var mage_passive := {"class":"mage","level":50,"passivePoints":1,"passives":["start"]}
	if PassiveEngine.can_allocate(mage_passive,"warrior-might-1") or not PassiveEngine.can_allocate(mage_passive,"mage-fire-1"): failures.append("passive trees must be class-specific")
	var talent_hero := {"class":"warrior","level":4,"gold":1000,"hp":100,"maxHp":100,"mp":0,"maxMp":0,"talents":[]}
	if PassiveEngine.can_take_talent(talent_hero,"w-berserker"): failures.append("class talent must enforce level tier")
	talent_hero["level"]=5
	if not PassiveEngine.can_take_talent(talent_hero,"w-berserker") or not PassiveEngine.can_take_talent(talent_hero,"w-guardian"): failures.append("both talent choices must be available before spending tier")
	var talent_pick: Dictionary = PassiveEngine.take_talent(talent_hero,"w-guardian")
	if not talent_pick.ok or int(talent_hero.maxHp)!=120 or not talent_hero.talents.has("w-guardian"): failures.append("guardian talent must apply HP multiplier")
	if not is_equal_approx(float(PassiveEngine.get_bonus(talent_hero).defMult),1.0): failures.append("guardian legacy talent should not invent a defense multiplier")
	var berserker_bonus_hero := {"class":"warrior","talents":["w-berserker"]}
	if not is_equal_approx(float(PassiveEngine.get_bonus(berserker_bonus_hero).dmgMult),1.15): failures.append("legacy class talent damage modifier must feed shared bonuses")
	if PassiveEngine.can_take_talent(talent_hero,"w-berserker"): failures.append("only one talent may be chosen per tier")
	var talent_reset: Dictionary = PassiveEngine.reset_talents(talent_hero)
	if not talent_reset.ok or int(talent_hero.maxHp)!=100 or int(talent_hero.gold)!=500 or not talent_hero.talents.is_empty(): failures.append("talent reset must reverse HP multiplier and cost 500 gold")
	var legacy_priest := {"class":"priest","level":5,"talents":[]}
	if not PassiveEngine.can_take_talent(legacy_priest,"p-light"): failures.append("legacy priest talents must remain supported")

	var DailyQuest = preload("res://godot/scripts/world_daily_quest_engine.gd")
	var daily_world := {"seed":12345,"hero":{"class":"warrior","level":1,"exp":0,"expNext":125,"gold":0,"hp":100,"maxHp":100,"maxMp":0,"mp":0,"str":18,"int":0,"wis":0,"con":12,"dex":5,"statPoints":0,"passivePoints":0}}
	var daily_list: Array = DailyQuest.get_quests(daily_world)
	if daily_list.size()!=3: failures.append("daily quest generator must create three tasks")
	DailyQuest.update_progress(daily_world,"kill","goblin",1)
	var goblin_quest: Dictionary={}
	for q in daily_world.dailyQuests.list:
		if q.id=="q-kill-goblin":goblin_quest=q
	if not goblin_quest.is_empty() and int(goblin_quest.current)!=1: failures.append("daily kill progress must track target enemy")
	var claim_world := {"seed":12345,"hero":{"class":"warrior","level":1,"exp":0,"expNext":125,"gold":0,"hp":100,"maxHp":100,"maxMp":0,"mp":0,"str":18,"int":0,"wis":0,"con":12,"dex":5,"statPoints":0,"passivePoints":0},"dailyQuests":{"date":DailyQuest.today_key(),"list":[{"id":"q-kill-any","current":10,"completed":true,"claimed":false,"gold":8,"exp":50},{"id":"q-kill-goblin","current":0},{"id":"q-kill-skeleton","current":0}]}}
	var daily_claim: Dictionary=DailyQuest.claim(claim_world,"q-kill-any")
	if not daily_claim.ok or int(claim_world.hero.gold)!=8 or int(claim_world.hero.exp)!=50: failures.append("daily quest claim must award gold and experience")
	if DailyQuest.claim(claim_world,"q-kill-any").ok: failures.append("daily quest reward must not be claimed twice")

	var Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
	var campaign_hero := {"level":1,"gold":0,"campaignKills":{},"campaignClaimed":{},"activeCampaignMission":""}
	var campaign_next: Dictionary = Campaign.get_next(campaign_hero)
	if str(campaign_next.id)!="a1-m1" or Campaign.Catalog.all_missions().size()!=25: failures.append("campaign catalog must preserve all 25 story missions")
	if not Campaign.accept(campaign_hero,"a1-m1"): failures.append("first story mission must be accepted")
	if Campaign.accept(campaign_hero,"a1-m2"): failures.append("later story mission must remain locked")
	var campaign_world := {"hero":campaign_hero,"currentRegionId":"briar-hollow"}
	for i in range(3): Campaign.record_kill(campaign_world,"briar-hollow","goblin")
	var campaign_progress: Dictionary=Campaign.progress(campaign_hero,campaign_next)
	if int(campaign_progress.current)!=3 or not bool(campaign_progress.complete): failures.append("story mission kill progress must match region and enemy")
	var campaign_reward: Dictionary=Campaign.claim(campaign_hero)
	if not campaign_reward.ok or not bool(campaign_hero.campaignClaimed.get("a1-m1",false)): failures.append("completed campaign mission must be claimable once")
	if Campaign.claim(campaign_hero).ok or str(Campaign.get_next(campaign_hero).id)!="a1-m2": failures.append("campaign must advance after claimed mission")
	var briar_access: Dictionary=Campaign.can_enter_location(campaign_hero,"briar-hollow")
	var forest_access: Dictionary=Campaign.can_enter_location(campaign_hero,"forest")
	if not bool(briar_access.allowed): failures.append("first story region must be open at the beginning")
	if bool(forest_access.allowed) or str(forest_access.reason)!="level": failures.append("next story region must enforce its recommended level")
	campaign_hero.level=3
	forest_access=Campaign.can_enter_location(campaign_hero,"forest")
	if bool(forest_access.allowed) or str(forest_access.reason)!="campaign" or str(forest_access.requiredMissionId)!="a1-m1": failures.append("story region must remain locked until its preceding mission is claimed")
	campaign_hero.campaignClaimed["a1-m1"]=true
	forest_access=Campaign.can_enter_location(campaign_hero,"forest")
	if not bool(forest_access.allowed): failures.append("claiming the previous story mission must unlock the next region")
	if not bool(Campaign.can_enter_location(campaign_hero,"village").allowed): failures.append("non-story hub regions must remain accessible")

	var Npc = preload("res://godot/scripts/world_npc_engine.gd")
	var npc_world := {"seed":17,"hero":{"class":"warrior","level":1,"gold":30,"hp":50,"maxHp":100,"mp":0,"maxMp":0,"exp":0,"expNext":125,"str":18,"int":0,"wis":0,"con":12,"dex":5,"statPoints":0,"passivePoints":0,"inventory":[],"buffs":[],"effects":[]}}
	var healer_result: Dictionary=Npc.heal(npc_world)
	if not healer_result.ok or int(npc_world.hero.hp)!=100 or int(npc_world.hero.gold)!=22: failures.append("healer must fully restore hero for 8 gold")
	var bard_result: Dictionary=Npc.pay_bard(npc_world)
	if not bard_result.ok or int(npc_world.hero.gold)!=7 or not Npc.has_entry(npc_world.hero,"bardBuff"): failures.append("bard must charge 15 gold and grant three-battle buff")
	var blessing_result: Dictionary=Npc.take_blessing(npc_world)
	if not blessing_result.ok or not Npc.has_entry(npc_world.hero,"elderBlessing","effects"): failures.append("elder must grant ten-battle experience blessing")
	var well_world := {"hero":{"class":"mage","hp":10,"maxHp":100,"mp":0,"maxMp":80,"gold":0}}
	if not Npc.use_well(well_world,100000).ok or int(well_world.hero.hp)!=100 or int(well_world.hero.mp)!=80: failures.append("well must restore HP and MP")
	if Npc.use_well(well_world,100001).ok: failures.append("well must enforce 24-hour cooldown")

	var NpcCatalog = preload("res://godot/scripts/world_npc_catalog.gd")
	if NpcCatalog.ids().size()!=12: failures.append("NPC catalog must preserve all twelve village NPC definitions")
	var buff_hero := {"class":"warrior","level":1,"exp":0,"expNext":125,"maxHp":100,"maxMp":0,"hp":100,"mp":0,"str":18,"int":0,"wis":0,"con":12,"dex":5,"statPoints":0,"passivePoints":0,"gold":0,"inventory":[],"buffs":[{"id":"bardBuff","duration":3}],"effects":[{"id":"elderBlessing","duration":10}]}
	var buff_world := {"seed":23,"currentRegionId":"village","hero":buff_hero}
	Combat._award_victory(buff_world,{"enemyId":"goblin","persistentId":"npc-buff-test","exp":100,"gold":0,"hp":0,"maxHp":1,"dead":false,"boss":false,"drops":[],"dropSeed":1})
	if int(buff_world.hero.exp)!=7 or int(buff_world.hero.level)!=2: failures.append("bard and elder buffs must multiply XP reward to 132 before level-up")
	if int(buff_world.hero.buffs[0].duration)!=2 or int(buff_world.hero.effects[0].duration)!=9: failures.append("bard and elder buffs must consume one charge per victory")

	var Npc = preload("res://godot/scripts/world_npc_engine.gd")
	var economy_world := {"seed":31,"hero":{"class":"warrior","level":1,"gold":200,"hp":100,"maxHp":100,"mp":0,"maxMp":0,"inventory":[],"equipped":{},"buffs":[],"effects":[],"campaignClaimed":{}}}
	var purchase: Dictionary=Npc.buy_item(economy_world,"health-potion")
	if not purchase.ok or int(economy_world.hero.gold)!=190: failures.append("merchant purchase must use act-one item price")
	var sale: Dictionary=Npc.sell_item(economy_world,0)
	if not sale.ok or int(economy_world.hero.gold)!=193: failures.append("merchant sale must return 35 percent of item price")
	var craft_world := {"hero":{"class":"warrior","level":1,"gold":0,"inventory":[{"id":"herb-life","qty":3}],"equipped":{},"campaignClaimed":{}}}
	var craft_result: Dictionary=Npc.craft(craft_world,"r-hp")
	if not craft_result.ok or str(craft_world.hero.inventory[0].id)!="health-potion": failures.append("alchemist must consume three life herbs and create a health potion")
	var rarity_world := {"hero":{"class":"warrior","level":1,"gold":0,"inventory":[{"id":"briar-court-mantle","qty":1,"rarity":"common"},{"id":"root-court-seal","qty":1},{"id":"root-fiber","qty":2}],"equipped":{},"campaignClaimed":{}}}
	var rarity_result: Dictionary=Npc.craft(rarity_world,"r-briar-court-mantle")
	if not rarity_result.ok or str(rarity_world.hero.inventory[0].get("rarity",""))!="common" or rarity_world.hero.inventory.size()!=2 or str(rarity_world.hero.inventory[1].get("rarity",""))!="uncommon":
		failures.append("crafting a duplicate named item must apply recipe rarity only to the newly created equipment")
	var forge_world := {"hero":{"class":"warrior","level":1,"gold":30,"inventory":[],"equipped":{"weapon":{"id":"iron-sword","bonus":{"attack":8},"forgeLevel":0}},"campaignClaimed":{}}}
	var forge_result: Dictionary=Npc.upgrade_equipment(forge_world,"weapon")
	if not forge_result.ok or int(forge_world.hero.gold)!=0 or int(forge_world.hero.equipped.weapon.forgeLevel)!=1 or int(forge_world.hero.equipped.weapon.bonus.attack)!=8: failures.append("blacksmith upgrade must charge 30 gold and apply five-percent bonus rounding")

	var NpcEngine = preload("res://godot/scripts/world_npc_engine.gd")
	var NpcCatalog = preload("res://godot/scripts/world_npc_catalog.gd")
	var dialogue_world := {"hero":{"class":"warrior","level":1,"gold":2,"inventory":[],"equipped":{},"campaignClaimed":{}}}
	var greeting_a: Dictionary=NpcEngine.talk(dialogue_world,"guard")
	var greeting_b: Dictionary=NpcEngine.talk(dialogue_world,"guard")
	if str(greeting_a.message)==str(greeting_b.message): failures.append("NPC greetings must rotate instead of repeating a fixed line")
	if not str(greeting_a.message).contains("\n"): failures.append("NPC name and greeting must render on separate lines")
	if int(dialogue_world.npcDialogueCounts.guard)!=2: failures.append("NPC dialogue counters must persist in world state")
	var rumor: Dictionary=NpcEngine.choose_dialogue(dialogue_world,"herald","treasure")
	if not rumor.ok or not str(rumor.message).contains("тайникам"): failures.append("herald treasure choice must return its matching dialogue branch")
	var invalid_choice: Dictionary=NpcEngine.choose_dialogue(dialogue_world,"guard","not-a-choice")
	if invalid_choice.ok: failures.append("unknown dialogue branches must be rejected")
	var poor_kids: Dictionary=NpcEngine.choose_dialogue(dialogue_world,"kids","coin")
	if poor_kids.ok or int(dialogue_world.hero.gold)!=2: failures.append("kids coin choice must not spend gold when unaffordable")
	dialogue_world.hero.gold=2
	var gift_once: Dictionary=NpcEngine.choose_dialogue(dialogue_world,"kids","coin")
	var gift_twice: Dictionary=NpcEngine.choose_dialogue(dialogue_world,"kids","coin")
	if not gift_once.ok or gift_twice.ok or int(dialogue_world.hero.gold)!=1: failures.append("kids gift must be charged once and reject repeated rewards")
	if NpcCatalog.map_locations().size()!=NpcCatalog.ids().size(): failures.append("all village NPCs must have authored map coordinates")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World combat engine checks passed")
	quit(0)
