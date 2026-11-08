extends SceneTree

const Daily = preload("res://godot/scripts/world_daily_quest_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var world := WorldState.create(20261108)
	world["hero"] = {"level": 1, "gold": 0, "exp": 0}
	world["dailyQuests"] = {
		"date": Daily.today_key(),
		"list": [
			{"id": "q-rift-floor", "current": 0, "completed": false, "claimed": false},
			{"id": "q-kill-any", "current": 0, "completed": false, "claimed": false},
			{"id": "q-chest", "current": 0, "completed": false, "claimed": false}
		]
	}

	Daily.set_progress(world, "rift", "floor", 2)
	Daily.set_progress(world, "rift", "floor", 1)
	var quests: Array = Daily.get_quests(world)
	var rift_quest: Dictionary = {}
	for quest in quests:
		if str(quest.get("id", "")) == "q-rift-floor":
			rift_quest = quest
	if int(rift_quest.get("current", 0)) != 2:
		failures.append("cumulative floor progress must not move backwards")
	Daily.set_progress(world, "rift", "floor", 3)
	quests = Daily.get_quests(world)
	for quest in quests:
		if str(quest.get("id", "")) == "q-rift-floor":
			rift_quest = quest
	if int(rift_quest.get("current", 0)) != 3 or not bool(rift_quest.get("completed", false)):
		failures.append("reaching the third Rift floor must complete the daily objective")

	Daily.update_progress(world, "kill", "goblin", 2)
	quests = Daily.get_quests(world)
	for quest in quests:
		if str(quest.get("id", "")) == "q-kill-any":
			if int(quest.get("current", 0)) != 2:
				failures.append("generic kill objectives must count specific enemy kills")
		if str(quest.get("id", "")) == "q-chest" and int(quest.get("current", 0)) != 0:
			failures.append("unrelated objective progress must remain unchanged")


	# Daily chest: rolling 24-hour cooldown, browser-millisecond timestamp parity,
	# one-time lifetime counters, item reward and achievement unlock.
	var chest_world := WorldState.create(8080)
	chest_world["hero"] = {"level": 1, "gold": 0, "stats": {"dailyChestAt": 0, "dailyChestsOpened": 0, "goldEarned": 0}, "inventory": [], "pendingLoot": []}
	var opened := Daily.open_daily_chest(chest_world, 200000000)
	if not bool(opened.get("ok", false)):
		failures.append("daily chest must open when no cooldown is active")
	if int(chest_world.hero.gold) != 8 or int(chest_world.hero.stats.goldEarned) != 8 or int(chest_world.hero.stats.dailyChestsOpened) != 1:
		failures.append("daily chest must credit gold and lifetime counters exactly once")
	if not ["health-potion", "mana-potion", "strong-health-potion", "strong-mana-potion"].has(str(opened.get("itemId", ""))) or chest_world.hero.inventory.size() != 1:
		failures.append("daily chest must award exactly one valid potion")
	var blocked := Daily.open_daily_chest(chest_world, 200000001)
	if bool(blocked.get("ok", false)) or int(blocked.get("remainingMs", 0)) != 86399999:
		failures.append("daily chest must enforce a rolling 24-hour cooldown")
	var ready_again := Daily.can_open_daily(chest_world, 286400000)
	if not ready_again:
		failures.append("daily chest must become available at the exact 24-hour boundary")
	var devotee_world := WorldState.create(8081)
	devotee_world["hero"] = {"level": 1, "gold": 0, "stats": {"dailyChestAt": 0, "dailyChestsOpened": 2, "goldEarned": 0}, "inventory": []}
	var devotee := Daily.open_daily_chest(devotee_world, 300000000)
	if not bool(devotee.get("ok", false)) or not devotee_world.hero.get("achievements", []).has("daily-devotee") or int(devotee_world.hero.gold) != 30:
		failures.append("third daily chest must unlock the daily devotee achievement and its reward")

	if failures.is_empty():
		print("PASS: daily cumulative Rift progress and kill objective isolation")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
