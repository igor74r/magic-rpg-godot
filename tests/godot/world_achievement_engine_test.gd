extends SceneTree

const AchievementEngine = preload("res://godot/scripts/world_achievement_engine.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var world := {"hero":{
		"level":10,"gold":100,"riftBest":25,
		"storyShards":{"flame":true,"ice":true,"blood":true},
		"stats":{"kills":{"goblin":10,"skeleton":10,"wolf":5,"ancient-dragon":1},
			"goldEarned":1000,"eliteKills":5,"bossKills":2,"chestsOpened":10,"dailyChestsOpened":3}
	}}
	var unlocked := AchievementEngine.evaluate(world)
	if unlocked.size() != AchievementEngine.DEFINITIONS.size():
		failures.append("all achievement conditions must unlock exactly once when every objective is met")
	if AchievementEngine.unlocked_count(world.hero) != AchievementEngine.DEFINITIONS.size():
		failures.append("unlocked count must include only known achievement ids")
	var expected_gold := 100
	for entry in AchievementEngine.DEFINITIONS:
		expected_gold += int(entry.reward)
	if int(world.hero.gold) != expected_gold:
		failures.append("achievement rewards must be credited exactly once")
	if not AchievementEngine.evaluate(world).is_empty():
		failures.append("already unlocked achievements must never pay twice")
	if int(world.hero.gold) != expected_gold:
		failures.append("repeat evaluation must not change gold")

	var partial := {"hero":{"level":1,"gold":0,"stats":{"kills":{"goblin":9}}}}
	var partial_unlocks := AchievementEngine.evaluate(partial)
	if partial_unlocks.size() != 0 or partial.hero.achievements.size() != 0:
		failures.append("progress below an objective must not unlock an achievement")
	var overflow := {"hero":{"level":1,"gold":2147483640,"stats":{"kills":{"goblin":1}}}}
	var overflow_unlocks := AchievementEngine.evaluate(overflow)
	if overflow_unlocks.size() != 0 or overflow.hero.achievements.size() != 0:
		failures.append("reward overflow must not grant an achievement without its reward")


	var progress_world := {"hero":{"level":4,"gold":0,"stats":{"kills":{"goblin":6}}}}
	var goblin_definition: Dictionary = {}
	for definition in AchievementEngine.DEFINITIONS:
		if str(definition.id) == "goblin-slayer":
			goblin_definition = definition
	var progress := AchievementEngine.get_progress(progress_world, goblin_definition)
	if int(progress.get("current", -1)) != 6 or int(progress.get("target", -1)) != 10 or bool(progress.get("complete", true)):
		failures.append("achievement progress view must expose accurate partial progress")
	progress_world.hero.stats.kills.goblin = 10
	progress = AchievementEngine.get_progress(progress_world, goblin_definition)
	if int(progress.get("current", -1)) != 10 or not bool(progress.get("complete", false)):
		failures.append("achievement progress must clamp at target and report completion")
	if AchievementEngine.ICONS.size() != AchievementEngine.DEFINITIONS.size():
		failures.append("every achievement must have a native UI icon")

	if failures.is_empty():
		print("PASS: native achievement conditions, one-time rewards and overflow safety")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
