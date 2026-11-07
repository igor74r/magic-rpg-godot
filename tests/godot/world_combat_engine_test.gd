extends SceneTree

const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")

func _initialize() -> void:
	var failures: Array[String] = []
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
	if int(world.hero.exp) != 25 or int(world.hero.gold) != 15:
		failures.append("victory must award experience and gold")
	if not WorldState.is_enemy_defeated(world, "forest", "enemy-0", 0.0):
		failures.append("regular enemy defeat must be persisted with respawn deadline")
	var boss := {"name": "Босс", "persistentId": "boss-test", "hp": 10, "maxHp": 10, "attack": 1, "defense": 0, "exp": 100, "gold": 50, "boss": true, "dead": false}
	var boss_fight := Combat.begin(boss)
	Combat.player_attack(world, boss_fight)
	if not world.regions.forest.defeatedBosses.has("boss-test"):
		failures.append("boss victory must be persisted permanently")
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
	var ability_reward_world := WorldState.create(998)
	ability_reward_world["currentRegionId"] = "forest"
	var ability_reward_hero := Combat.ensure_hero(ability_reward_world)
	var ability_boss := {"name":"Босс от способности","enemyId":"shadow-mage","persistentId":"boss-ability-reward","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":37,"gold":19,"boss":true,"dead":false,"drops":["mana-potion"],"dropSeed":6789}
	var ability_reward_fight := Combat.begin(ability_boss)
	var ability_kill := Combat.use_ability(ability_reward_world, ability_reward_fight, "shield-bash")
	if not ability_kill.ok or ability_reward_fight.result != "victory" or int(ability_reward_hero.exp) != 37 or int(ability_reward_hero.gold) != 19 or not ability_reward_hero.inventory.any(func(item): return str(item.get("id","")) == "mana-potion") or not ability_reward_world.regions.forest.defeatedBosses.has("boss-ability-reward"):
		failures.append("ability victory must award XP, gold, guaranteed boss loot and persist boss defeat")
	var spell_reward_world := WorldState.create(999)
	spell_reward_world["currentRegionId"] = "forest"
	spell_reward_world["hero"] = {"class":"mage","maxHp":105,"hp":105,"maxMp":180,"mp":180,"attack":12,"defense":7,"level":1,"exp":0,"gold":0}
	var spell_reward_hero := Combat.ensure_hero(spell_reward_world)
	var spell_boss := {"name":"Босс от заклинания","enemyId":"shadow-mage","persistentId":"boss-spell-reward","hp":1,"maxHp":1,"attack":1,"defense":0,"exp":41,"gold":23,"boss":true,"dead":false,"drops":["mana-potion"],"dropSeed":9876}
	var spell_reward_fight := Combat.begin(spell_boss)
	var spell_kill := Combat.cast_spell(spell_reward_world, spell_reward_fight, "fireball")
	if not spell_kill.ok or spell_reward_fight.result != "victory" or int(spell_reward_hero.exp) != 41 or int(spell_reward_hero.gold) != 23 or not spell_reward_hero.inventory.any(func(item): return str(item.get("id","")) == "mana-potion") or not spell_reward_world.regions.forest.defeatedBosses.has("boss-spell-reward"):
		failures.append("spell victory must award XP, gold, guaranteed boss loot and persist boss defeat")
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
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World combat engine checks passed")
	quit(0)
