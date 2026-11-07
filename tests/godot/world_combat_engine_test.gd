extends SceneTree

const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")

func _initialize() -> void:
	var failures: Array[String] = []
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
	var retreat_fight := Combat.begin(strong)
	if not Combat.retreat(retreat_fight) or retreat_fight.result != "retreat":
		failures.append("retreat must close combat without killing enemy")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World combat engine checks passed")
	quit(0)
