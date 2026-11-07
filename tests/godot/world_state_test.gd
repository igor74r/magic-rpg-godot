extends SceneTree

const World = preload("res://godot/scripts/world_state.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var world := World.create(123456)
	if world.seed != 123456 or world.currentRegionId != "village":
		failures.append("new world must preserve its seed and start in village")
	if world.regionVisits.get("village", 0) != 1:
		failures.append("new world must record its initial village visit")
	if not World.can_travel(world, "village", "forest"):
		failures.append("starting village-to-forest route must be unlocked")
	if World.can_travel(world, "forest", "shadow"):
		failures.append("undiscovered forest exit must remain locked")

	if not World.enter_region(world, "forest", "village"):
		failures.append("travel over a starting route must succeed")
	if not world.discoveredRegions.has("forest"):
		failures.append("entering a region must discover it")
	if not World.can_travel(world, "forest", "shadow"):
		failures.append("discovering forest must reveal its outgoing routes")
	if world.regionVisits.get("forest", 0) != 1:
		failures.append("first entry must increment the visit counter")
	if not World.enter_region(world, "village", "forest"):
		failures.append("return over an opened route must succeed")
	if world.regionVisits.get("village", 0) != 2:
		failures.append("return visit must increment the counter")

	var before_seed := World.region_visit_seed(world, "forest", 1)
	var after_seed := World.region_visit_seed(world, "forest", 2)
	if before_seed == after_seed:
		failures.append("different visit indices must produce distinct generation seeds")

	var normalized := World.normalize(world, 123456)
	if normalized.seed != 123456 or normalized.currentRegionId != "village":
		failures.append("normalization must preserve valid save state")
	if not normalized.unlockedRoutes.has(WorldGraph.route_key("forest", "shadow")):
		failures.append("normalization must preserve unlocked routes")

	var legacy := World.create(77, true)
	if not World.can_travel(legacy, "village", "void-crater"):
		failures.append("legacy fast travel must preserve access to every region")

	# Region persistence: chests, enemy respawn deadlines and boss state survive normalization.
	if not World.mark_chest_opened(world, "forest", "chest-01"):
		failures.append("first chest open must be recorded")
	if World.mark_chest_opened(world, "forest", "chest-01"):
		failures.append("the same chest must not be recorded twice")
	if not World.mark_enemy_defeated(world, "forest", "wolf-01", 900.0):
		failures.append("enemy defeat and respawn deadline must be recorded")
	if not World.is_enemy_defeated(world, "forest", "wolf-01", 899.0):
		failures.append("enemy must remain defeated before its respawn time")
	if World.is_enemy_defeated(world, "forest", "wolf-01", 900.0):
		failures.append("enemy must respawn at its deadline")
	if not World.set_boss_progress(world, "forest", "forest-warden", 0.45, 2, 7, true):
		failures.append("valid boss progress must be saved")
	if World.set_boss_progress(world, "forest", "bad-boss", 1.5, 0, 0):
		failures.append("invalid boss health ratio must be rejected")
	var saved_region := World.normalize(world, 123456).regions.get("forest", {})
	if not saved_region.get("openedChests", []).has("chest-01"):
		failures.append("opened chest state must survive normalization")
	if float(saved_region.get("defeatedEnemies", {}).get("wolf-01", -1)) != 900.0:
		failures.append("enemy respawn state must survive normalization")
	var saved_boss := saved_region.get("bossProgress", {}).get("forest-warden", {})
	if float(saved_boss.get("hpRatio", 0.0)) != 0.45 or int(saved_boss.get("phase", -1)) != 2 or not saved_boss.get("pendingSpecial", false):
		failures.append("boss progress must survive normalization")
	if not World.mark_boss_defeated(world, "forest", "forest-warden"):
		failures.append("boss defeat must be recorded")
	if not world.regions.forest.defeatedBosses.has("forest-warden") or world.regions.forest.bossProgress.has("forest-warden"):
		failures.append("defeating a boss must clear its partial progress")

	if failures.is_empty():
		print("PASS: save-scoped discovery, route unlocking, visits and legacy travel")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
