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
