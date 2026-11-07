extends SceneTree

const Rift = preload("res://godot/scripts/world_rift_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")
const Enemies = preload("res://godot/scripts/world_enemy_catalog.gd")
const Daily = preload("res://godot/scripts/world_daily_quest_engine.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var world := WorldState.create(20261108)
	world["hero"] = {"level": 50, "ngPlus": 2, "riftBest": 0, "riftClearedLocations": []}
	world["storyDragons"] = {"blood-crown": true}
	world["dailyQuests"] = {
		"date": Daily.today_key(),
		"list": [
			{"id": "q-rift-floor", "current": 0, "completed": false, "claimed": false},
			{"id": "q-kill-any", "current": 0, "completed": false, "claimed": false},
			{"id": "q-chest", "current": 0, "completed": false, "claimed": false}
		]
	}

	var started: Dictionary = Rift.begin_area(world, "rift-01")
	if not bool(started.get("ok", false)):
		failures.append("valid post-story Rift area must start")
	else:
		var enemy: Dictionary = started.get("enemy", {})
		var definition: Dictionary = Enemies.get_enemy(str(enemy.get("enemyId", "")))
		var expected_hp := int(round(float(definition.get("hp", 0)) * 2.0))
		var expected_attack := int(round(float(definition.get("attack", 0)) * 1.6))
		if int(enemy.get("hp", 0)) != expected_hp:
			failures.append("Rift encounter HP must apply New Game+ scaling")
		if int(enemy.get("attack", 0)) != expected_attack:
			failures.append("Rift encounter attack must apply New Game+ scaling")
		var invalid_enemy := enemy.duplicate(true)
		invalid_enemy["riftFloor"] = 2
		if bool(Rift.complete_area(world, invalid_enemy).get("ok", false)):
			failures.append("Rift must reject a completion from a different floor")
		var forged_enemy := enemy.duplicate(true)
		forged_enemy["persistentId"] = "forged-rift-enemy"
		if Rift.sync_encounter(world, forged_enemy):
			failures.append("Rift must reject syncing a different enemy identity")
		if bool(Rift.complete_area(world, forged_enemy).get("ok", false)):
			failures.append("Rift must reject a forged enemy identity")
		if bool(Rift.complete_area(world, enemy).get("ok", false)):
			failures.append("Rift must reject completion while the enemy is alive")
		enemy["hp"] = 0
		enemy["dead"] = true
		var completed: Dictionary = Rift.complete_area(world, enemy)
		if not bool(completed.get("ok", false)) or int(world.hero.get("riftBest", 0)) != 1:
			failures.append("valid Rift completion must persist the floor record")
		if bool(Rift.complete_area(world, enemy).get("ok", false)):
			failures.append("the same Rift encounter must not award completion twice")
		var quests: Array = Daily.get_quests(world)
		var rift_quest: Dictionary = {}
		for quest in quests:
			if str(quest.get("id", "")) == "q-rift-floor":
				rift_quest = quest
		if int(rift_quest.get("current", 0)) != 1 or bool(rift_quest.get("completed", false)):
			failures.append("Rift completion must update the daily floor objective exactly once")

	if failures.is_empty():
		print("PASS: Rift encounter scaling, completion validation and daily floor progress")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
