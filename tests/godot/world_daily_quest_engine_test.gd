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

	if failures.is_empty():
		print("PASS: daily cumulative Rift progress and kill objective isolation")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
