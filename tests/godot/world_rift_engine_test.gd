extends SceneTree

const Rift = preload("res://godot/scripts/world_rift_engine.gd")
const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var failures: Array[String] = []
	var world := {"hero":{"level":1,"riftBest":0,"riftClearedLocations":[]},"storyDragons":{"blood-crown":true}}
	if not Rift.is_available(world):
		failures.append("Rift must be available after the Blood Crown story flag")
	var locked := Rift.begin_area(world, "rift-21")
	if bool(locked.get("ok", false)):
		failures.append("level-50 Rift area must reject a level-1 hero")
	var entered := Rift.begin_area(world, "rift-01")
	if not bool(entered.get("ok", false)):
		failures.append("valid Rift area must start a run")
	var enemy: Dictionary = entered.get("enemy", {})
	if enemy.is_empty() or not bool(enemy.get("riftMode", false)) or int(enemy.get("riftFloor", 0)) != 1:
		failures.append("Rift run must create a tagged floor encounter")
	if int(enemy.get("hp", 0)) < 1 or int(enemy.get("attack", 0)) < 1:
		failures.append("Rift encounter stats must remain valid")
	var forged := enemy.duplicate(true)
	forged["riftFloor"] = 99
	if bool(Rift.complete_area(world, forged).get("ok", false)):
		failures.append("Rift completion must reject a mismatched floor")
	var completed := Rift.complete_area(world, enemy)
	if not bool(completed.get("ok", false)) or int(world.hero.riftBest) != 1 or not world.hero.riftClearedLocations.has("rift-01"):
		failures.append("winning the Rift encounter must persist the area and best floor")
	if bool(Rift.get_run(world).get("active", true)):
		failures.append("completed Rift run must no longer be active")
	var second := Rift.begin_area(world, "rift-02")
	if not bool(second.get("ok", false)) or int(second.enemy.riftFloor) != 2:
		failures.append("next Rift entry must advance the floor record")
	if not Rift.abandon(world) or bool(Rift.get_run(world).get("active", true)):
		failures.append("abandoning a Rift run must close the active run")
	world.hero.level = 50
	var final_area := Rift.begin_area(world, "rift-30")
	if not bool(final_area.get("ok", false)):
		failures.append("level-50 hero must enter the final Rift area")
	if failures.is_empty():
		print("PASS: playable Rift entry, encounter scaling, completion, records and abandonment")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
