# Save-scoped exploration state, ported from systems/world-state.js.
# This is separate from WorldGraph: graph topology is immutable; this data is mutable per save.
class_name WorldStateData
extends RefCounted

const SCHEMA_VERSION := 1
const GENERATOR_VERSION := 1
const WorldRandomScript = preload("res://godot/scripts/world_random.gd")
const WorldEnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
const WorldTowerEngine = preload("res://godot/scripts/world_tower_engine.gd")
const AchievementEngine = preload("res://godot/scripts/world_achievement_engine.gd")
const DailyQuestEngine = preload("res://godot/scripts/world_daily_quest_engine.gd")
const FactionEngine = preload("res://godot/scripts/world_faction_engine.gd")


static func create(seed: int = 1, legacy: bool = false) -> Dictionary:
	var normalized_seed := seed & 0xffffffff
	if normalized_seed == 0:
		normalized_seed = 1
	var discovered: Array = WorldGraph.region_ids() if legacy else WorldGraph.STARTING_REGIONS.duplicate()
	var routes: Array[String] = []
	if legacy:
		for from_id in WorldGraph.region_ids():
			for to_id in WorldGraph.neighbors(from_id):
				var key := WorldGraph.route_key(from_id, to_id)
				if not routes.has(key):
					routes.append(key)
	else:
		for route in WorldGraph.STARTING_ROUTES:
			routes.append(WorldGraph.route_key(route[0], route[1]))
	var event_seed := WorldRandomScript.derive_seed([normalized_seed, "world-events"])
	return {
		"schemaVersion": SCHEMA_VERSION,
		"seed": normalized_seed,
		"generatorVersion": GENERATOR_VERSION,
		"clockMinutes": 0,
		"legacyFastTravel": legacy,
		"discoveredRegions": discovered,
		"unlockedRoutes": routes,
		"currentRegionId": "village",
		"regionVisits": {"village": 1},
		"regions": {},
		"factionCampaigns": {},
		"factions": FactionEngine.create_state(),
		"events": {
			"active": [],
			"cooldowns": {},
			"history": [],
			"sequence": 0,
			"nextSpawnAt": 480 + (event_seed % 241)
		}
	}


static func normalize(world_value: Variant, seed_fallback: int = 1, legacy: bool = false) -> Dictionary:
	var world: Dictionary = world_value.duplicate(true) if world_value is Dictionary else create(seed_fallback, legacy)
	var defaults := create(seed_fallback, legacy)
	world["schemaVersion"] = SCHEMA_VERSION
	var raw_seed: Variant = world.get("seed", seed_fallback)
	# Match browser Number.isFinite before applying JavaScript's >>> 0
	# conversion. Numeric strings must not be coerced into valid world seeds.
	var numeric_seed := float(raw_seed) if raw_seed is int or raw_seed is float else float(seed_fallback)
	if not is_finite(numeric_seed):
		numeric_seed = float(seed_fallback)
	var seed_value := int(fposmod(numeric_seed, 4294967296.0))
	world["seed"] = seed_value if seed_value != 0 else 1
	var raw_generator: Variant = world.get("generatorVersion", GENERATOR_VERSION)
	var generator := float(raw_generator) if raw_generator is int or raw_generator is float else float(GENERATOR_VERSION)
	world["generatorVersion"] = float(maxi(1, int(floor(generator)))) if is_finite(generator) and generator <= 9007199254740991.0 else float(GENERATOR_VERSION)
	var raw_clock: Variant = world.get("clockMinutes", 0)
	var clock := float(raw_clock) if raw_clock is int or raw_clock is float else 0.0
	world["clockMinutes"] = maxf(0.0, clock) if is_finite(clock) else 0.0
	world["legacyFastTravel"] = world.get("legacyFastTravel", false) == true or legacy

	var valid_regions: Array = WorldGraph.region_ids()
	var discovered: Array = []
	var source_discovered: Variant = world.get("discoveredRegions", defaults.discoveredRegions)
	if source_discovered is Array:
		for region_id in source_discovered:
			if valid_regions.has(region_id) and not discovered.has(region_id):
				discovered.append(region_id)
	if discovered.is_empty():
		discovered = valid_regions.duplicate() if world["legacyFastTravel"] else WorldGraph.STARTING_REGIONS.duplicate()
	world["discoveredRegions"] = discovered

	var valid_routes: Array[String] = []
	for from_id in valid_regions:
		for to_id in WorldGraph.neighbors(from_id):
			var key := WorldGraph.route_key(from_id, to_id)
			if not valid_routes.has(key):
				valid_routes.append(key)
	var routes: Array[String] = []
	var source_routes: Variant = world.get("unlockedRoutes", defaults.unlockedRoutes)
	if source_routes is Array:
		for route in source_routes:
			if route is String and valid_routes.has(route) and not routes.has(route):
				routes.append(route)
	if world["legacyFastTravel"]:
		routes = valid_routes.duplicate()
	else:
		for region_id in discovered:
			for neighbor_id in WorldGraph.neighbors(region_id):
				var key := WorldGraph.route_key(region_id, neighbor_id)
				if not routes.has(key):
					routes.append(key)
	world["unlockedRoutes"] = routes

	var visits: Dictionary = world.get("regionVisits", {}) if world.get("regionVisits", {}) is Dictionary else {}
	var clean_visits := {}
	for region_id in visits:
		if valid_regions.has(region_id):
			var visit_value: Variant = visits[region_id]
			# Browser Number.isFinite rejects numeric strings and booleans before
			# Math.floor; do not let GDScript int() coerce them into visit counts.
			if (visit_value is int or visit_value is float) and is_finite(float(visit_value)):
				clean_visits[region_id] = maxi(0, int(floor(float(visit_value))))
			else:
				clean_visits[region_id] = 0
	world["regionVisits"] = clean_visits
	var current := str(world.get("currentRegionId", ""))
	if not valid_regions.has(current):
		current = "village"
	world["currentRegionId"] = current
	if int(clean_visits.get(current, 0)) < 1:
		clean_visits[current] = 1

	var source_regions: Variant = world.get("regions", {})
	var clean_regions: Dictionary = {}
	if source_regions is Dictionary:
		for region_id in source_regions:
			if valid_regions.has(region_id):
				clean_regions[region_id] = _normalize_region_record(source_regions[region_id])
	world["regions"] = clean_regions
	# Rift progression is validated as part of the save payload.
	var hero_value: Variant = world.get("hero", {})
	if hero_value is Dictionary:
		var hero: Dictionary = hero_value
		var hero_shards: Dictionary = hero.get("storyShards", {}) if hero.get("storyShards", {}) is Dictionary else {}
		var world_shards: Dictionary = world.get("storyShards", {}) if world.get("storyShards", {}) is Dictionary else {}
		var clean_shards := {"flame": hero_shards.get("flame", false) == true or world_shards.get("flame", false) == true, "ice": hero_shards.get("ice", false) == true or world_shards.get("ice", false) == true, "blood": hero_shards.get("blood", false) == true or world_shards.get("blood", false) == true}
		hero["storyShards"] = clean_shards.duplicate(true)
		world["storyShards"] = clean_shards.duplicate(true)
		var dragon_flags: Dictionary = world.get("storyDragons", {}) if world.get("storyDragons", {}) is Dictionary else {}
		world["storyDragons"] = {"ash-herald": dragon_flags.get("ash-herald", false) == true, "ice-grasp": dragon_flags.get("ice-grasp", false) == true, "blood-crown": dragon_flags.get("blood-crown", false) == true}
		hero["riftBest"] = clampi(int(hero.get("riftBest", 0)), 0, 2147483647)
		var clean_cleared: Array = []
		var source_cleared: Variant = hero.get("riftClearedLocations", [])
		if source_cleared is Array:
			for location_id in source_cleared:
				if location_id is String and location_id in _rift_location_ids() and not clean_cleared.has(location_id):
					clean_cleared.append(location_id)
		hero["riftClearedLocations"] = clean_cleared
		world["hero"] = hero
	if hero_value is Dictionary:
		var tower_hero: Dictionary = hero_value
		tower_hero["towerBest"] = clampi(int(tower_hero.get("towerBest", 0)), 0, 40)
		world["hero"] = tower_hero
	var tower_value: Variant = world.get("towerRun", {})
	if tower_value is Dictionary and bool(tower_value.get("active", false)):
		var tower_run: Dictionary = tower_value
		var tower_floor := int(tower_run.get("floor", 0))
		var tower_queue: Variant = tower_run.get("enemies", [])
		var tower_index := int(tower_run.get("enemyIndex", -1))
		var tower_valid := tower_floor >= 1 and tower_floor <= 40 and tower_queue is Array and not tower_queue.is_empty() and tower_index >= 0 and tower_index < tower_queue.size()
		if tower_valid:
			var expected_floor: Dictionary = WorldTowerEngine.floor_definition(tower_floor)
			var expected_ids: Array = expected_floor.get("enemyIds", [])
			if tower_queue.size() != expected_ids.size() or str(tower_run.get("sourceId", "")) != str(expected_floor.get("sourceId", "")) or bool(tower_run.get("guardian", false)) != bool(expected_floor.get("guardian", false)):
				tower_valid = false
			var persistent_ids: Array[String] = []
			for enemy_index in range(tower_queue.size()):
				var tower_enemy: Variant = tower_queue[enemy_index]
				if not tower_enemy is Dictionary or not bool(tower_enemy.get("towerMode", false)) or int(tower_enemy.get("towerFloor", 0)) != tower_floor:
					tower_valid = false
					break
				var tower_enemy_id := str(tower_enemy.get("enemyId", ""))
				var persistent_id := str(tower_enemy.get("persistentId", ""))
				var expected_enemy_id := str(expected_ids[enemy_index]) if enemy_index < expected_ids.size() else ""
				var expected_persistent_id := "tower-%02d-%02d-%s" % [tower_floor, enemy_index, expected_enemy_id]
				if tower_enemy_id != expected_enemy_id or persistent_id != expected_persistent_id:
					tower_valid = false
					break
				var enemy_hp := int(tower_enemy.get("hp", -1))
				if WorldEnemyCatalog.get_enemy(tower_enemy_id).is_empty() or persistent_id.is_empty() or persistent_ids.has(persistent_id) or enemy_hp < 0:
					tower_valid = false
					break
				persistent_ids.append(persistent_id)
				if enemy_index < tower_index and (enemy_hp != 0 or not bool(tower_enemy.get("dead", false))):
					tower_valid = false
					break
				if enemy_index >= tower_index and enemy_hp <= 0:
					tower_valid = false
					break
		world["towerRun"] = tower_run.duplicate(true) if tower_valid else {"active": false, "invalidated": true}
	else:
		world["towerRun"] = tower_value.duplicate(true) if tower_value is Dictionary else {}
	var run_value: Variant = world.get("riftRun", {})
	if run_value is Dictionary and bool(run_value.get("active", false)):
		var run: Dictionary = run_value
		var location_id := str(run.get("locationId", ""))
		var floor_value := int(run.get("floor", 0))
		var enemy_value: Variant = run.get("enemy", {})
		var valid_enemy := enemy_value is Dictionary and int(enemy_value.get("hp", 0)) > 0 and int(enemy_value.get("maxHp", 0)) >= int(enemy_value.get("hp", 0)) and not bool(enemy_value.get("dead", false)) and bool(enemy_value.get("riftMode", false)) and str(enemy_value.get("persistentId", "")).is_empty() == false and str(enemy_value.get("enemyId", "")).is_empty() == false and not WorldEnemyCatalog.get_enemy(str(enemy_value.get("enemyId", ""))).is_empty() and str(enemy_value.get("riftLocationId", "")) == location_id and int(enemy_value.get("riftFloor", 0)) == floor_value
		if location_id in _rift_location_ids() and floor_value >= 1 and valid_enemy:
			world["riftRun"] = run.duplicate(true)
		else:
			world["riftRun"] = {"active": false, "completed": false, "invalidated": true}
	else:
		world["riftRun"] = run_value.duplicate(true) if run_value is Dictionary else {}
	if not world.get("factionCampaigns", {}) is Dictionary:
		world["factionCampaigns"] = {}
	var campaigns: Dictionary = world["factionCampaigns"]
	for campaign_id in campaigns.keys():
		var campaign_value: Variant = campaigns[campaign_id]
		if campaign_id != "ash-nomad-warband" or not campaign_value is Dictionary:
			campaigns.erase(campaign_id)
			continue
		var campaign: Dictionary = campaign_value
		if not ["active", "completed", "failed"].has(campaign.get("status", null)):
			campaign["status"] = "failed"
		var campaign_stage: Variant = campaign.get("stage", null)
		campaign["stage"] = clampi(int(campaign_stage), 1, 2) if _is_safe_integer(campaign_stage) else 1
		var campaign_started: Variant = campaign.get("startedAt", null)
		campaign["startedAt"] = maxf(0.0, float(campaign_started)) if _is_finite_number(campaign_started) else 0.0
	world["factionCampaigns"] = campaigns
	FactionEngine.ensure_state(world)
	if not world.get("events", {}) is Dictionary:
		world["events"] = defaults.events.duplicate(true)
	var events: Dictionary = world["events"]
	for key in ["active", "history"]:
		if not events.get(key, []) is Array:
			events[key] = []
		var sanitized_events: Array = []
		for event_value in events[key]:
			var sanitized_event: Variant = _sanitize_world_event(event_value)
			if sanitized_event is Dictionary:
				sanitized_events.append(sanitized_event)
		events[key] = sanitized_events
	if not events.get("cooldowns", {}) is Dictionary:
		events["cooldowns"] = {}
	if not _is_safe_integer(events.get("sequence", null)) or int(events.sequence) < 0:
		events["sequence"] = 0
	var next_spawn_value: Variant = events.get("nextSpawnAt", defaults.events.nextSpawnAt)
	var next_spawn_at := float(next_spawn_value) if next_spawn_value is int or next_spawn_value is float else -1.0
	if not is_finite(next_spawn_at) or next_spawn_at < 0.0:
		events["nextSpawnAt"] = defaults.events.nextSpawnAt
	else:
		events["nextSpawnAt"] = next_spawn_at
	return world


static func _is_finite_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))


static func _is_safe_integer(value: Variant) -> bool:
	if not _is_finite_number(value):
		return false
	var number := float(value)
	return floor(number) == number and absf(number) <= 9007199254740991.0


static func _sanitize_world_event(value: Variant) -> Variant:
	if not value is Dictionary:
		return null
	var event: Dictionary = value.duplicate(true)
	var event_id: Variant = event.get("id", null)
	var region_id: Variant = event.get("regionId", null)
	if not event_id is String or str(event_id).is_empty() or str(event_id).length() > 100:
		return null
	if not WorldGraph.region_ids().has(region_id):
		return null
	if event.get("objectiveType", null) == "region-discovery":
		var target_region: Variant = event.get("targetRegionId", null)
		if not WorldGraph.region_ids().has(target_region) or not WorldGraph.neighbors(str(region_id)).has(target_region):
			event["targetRegionId"] = null
			event["objectiveText"] = "Цель разведки недоступна. Обратитесь к доске объявлений."
	var target_value: Variant = event.get("targetCount", null)
	var target_count := mini(1000, int(target_value)) if _is_safe_integer(target_value) and int(target_value) > 0 else 1
	event["targetCount"] = target_count
	var progress_value: Variant = event.get("progress", null)
	var progress := clampi(int(progress_value), 0, target_count) if _is_safe_integer(progress_value) else 0
	event["progress"] = progress
	if event.get("objectiveType", null) == "defend-region":
		var elapsed_value: Variant = event.get("holdElapsedMinutes", null)
		event["holdElapsedMinutes"] = maxf(float(progress), minf(float(target_count), float(elapsed_value))) if _is_finite_number(elapsed_value) else float(progress)
	event["phase"] = progress
	var objective_text: Variant = event.get("objectiveText", null)
	if not objective_text is String:
		event["objectiveText"] = ""
	elif str(objective_text).length() > 240:
		event["objectiveText"] = str(objective_text).left(240)
	if not event.get("accepted", null) is bool:
		event["accepted"] = false
	if event.get("campaignId", null) != "ash-nomad-warband" or not [1, 2].has(event.get("campaignStage", null)):
		event["campaignId"] = null
		event["campaignStage"] = null
	return event


static func _rift_location_ids() -> Array:
	var ids: Array = []
	for index in range(1, 31):
		ids.append("rift-%02d" % index)
	return ids


static func can_travel(world: Dictionary, from_id: String, to_id: String) -> bool:
	var known_regions := WorldGraph.region_ids()
	if not known_regions.has(from_id) or not known_regions.has(to_id) or from_id == to_id:
		return false
	if world.get("legacyFastTravel", false):
		return true
	if not WorldGraph.is_route(from_id, to_id):
		return false
	return (world.get("unlockedRoutes", []) as Array).has(WorldGraph.route_key(from_id, to_id))


static func discover_region(world: Dictionary, region_id: String, from_id: String = "") -> bool:
	if not WorldGraph.region_ids().has(region_id):
		return false
	if not from_id.is_empty() and not can_travel(world, from_id, region_id):
		return false
	var discovered: Array = world.get("discoveredRegions", [])
	if discovered.has(region_id):
		return false
	discovered.append(region_id)
	world["discoveredRegions"] = discovered
	var routes: Array = world.get("unlockedRoutes", [])
	for neighbor_id in WorldGraph.neighbors(region_id):
		var key := WorldGraph.route_key(region_id, neighbor_id)
		if not routes.has(key):
			routes.append(key)
	world["unlockedRoutes"] = routes
	return true


static func enter_region(world: Dictionary, region_id: String, from_id: String = "") -> bool:
	if not WorldGraph.region_ids().has(region_id):
		return false
	if not from_id.is_empty() and not can_travel(world, from_id, region_id):
		return false
	if not from_id.is_empty():
		discover_region(world, region_id, from_id)
	var visits: Dictionary = world.get("regionVisits", {})
	visits[region_id] = maxi(0, int(visits.get(region_id, 0))) + 1
	world["regionVisits"] = visits
	world["currentRegionId"] = region_id
	return true


static func region_visit_seed(world: Dictionary, region_id: String, visit_index: int = -1) -> int:
	var visits: Dictionary = world.get("regionVisits", {})
	var index := int(visits.get(region_id, 0)) if visit_index < 0 else visit_index
	return WorldRandomScript.derive_region_seed(
		int(world.get("seed", 1)),
		int(world.get("generatorVersion", GENERATOR_VERSION)),
		region_id,
		index
	)


static func _clean_string_ids(value: Variant) -> Array:
	var result: Array = []
	if value is Array:
		for item in value:
			if item is String and not item.is_empty() and item.length() <= 80 and not result.has(item):
				result.append(item)
	return result


static func _new_region_record() -> Dictionary:
	return {
		"generationVisit": 1, "securityThreat": 0, "openedChests": [],
		"defeatedEnemies": {}, "defeatedBosses": [], "bossProgress": {},
		"resolvedEvents": [], "discoveredSecrets": [], "secretChests": [],
		"secretLayoutGenerated": false, "secretWalls": []
	}


static func _normalize_region_record(value: Variant) -> Dictionary:
	var record: Dictionary = value.duplicate(true) if value is Dictionary else {}
	record["generationVisit"] = maxi(1, int(record.get("generationVisit", 1)))
	record["securityThreat"] = clampi(int(record.get("securityThreat", 0)), 0, 3)
	for key in ["openedChests", "defeatedBosses", "resolvedEvents", "discoveredSecrets"]:
		record[key] = _clean_string_ids(record.get(key, []))

	var defeated_value: Variant = record.get("defeatedEnemies", {})
	var clean_defeated: Dictionary = {}
	if defeated_value is Dictionary:
		for enemy_id in defeated_value:
			var deadline := float(defeated_value[enemy_id])
			if enemy_id is String and not enemy_id.is_empty() and enemy_id.length() <= 80 and is_finite(deadline) and deadline >= 0.0:
				clean_defeated[enemy_id] = deadline
	record["defeatedEnemies"] = clean_defeated

	var progress_value: Variant = record.get("bossProgress", {})
	var clean_progress: Dictionary = {}
	if progress_value is Dictionary:
		for boss_id in progress_value:
			var progress: Variant = progress_value[boss_id]
			if not boss_id is String or boss_id.is_empty() or boss_id.length() > 80 or not progress is Dictionary:
				continue
			var hp_ratio := float(progress.get("hpRatio", 0.0))
			var phase := int(progress.get("phase", -1))
			var turns := int(progress.get("turnCount", -1))
			if is_finite(hp_ratio) and hp_ratio > 0.0 and hp_ratio <= 1.0 and phase >= 0 and phase <= 20 and turns >= 0 and turns <= 100000:
				clean_progress[boss_id] = {"hpRatio": hp_ratio, "phase": phase, "turnCount": turns, "pendingSpecial": progress.get("pendingSpecial", false) == true}
	record["bossProgress"] = clean_progress

	var clean_chests: Array = []
	var chests: Variant = record.get("secretChests", [])
	if chests is Array:
		for chest in chests:
			if not chest is Dictionary:
				continue
			var chest_id: Variant = chest.get("id", "")
			var x := float(chest.get("x", NAN))
			var y := float(chest.get("y", NAN))
			if chest_id is String and not chest_id.is_empty() and chest_id.length() <= 80 and is_finite(x) and is_finite(y):
				clean_chests.append(chest.duplicate(true))
	record["secretChests"] = clean_chests
	record["secretLayoutGenerated"] = record.get("secretLayoutGenerated", false) == true

	var clean_walls: Array = []
	var walls: Variant = record.get("secretWalls", [])
	if walls is Array:
		for wall in walls:
			if not wall is Dictionary:
				continue
			var wall_id: Variant = wall.get("id", "")
			var valid := wall_id is String and not wall_id.is_empty() and wall_id.length() <= 80
			for coordinate in ["tx", "ty", "wx", "wy", "ax", "ay"]:
				valid = valid and is_finite(float(wall.get(coordinate, NAN)))
			if valid and ["chest", "elite", "loot"].has(wall.get("rewardType", "")):
				clean_walls.append(wall.duplicate(true))
	record["secretWalls"] = clean_walls
	return record


static func get_region_record(world: Dictionary, region_id: String) -> Dictionary:
	if not WorldGraph.region_ids().has(region_id):
		return {}
	var regions: Dictionary = world.get("regions", {})
	if not regions.has(region_id) or not regions[region_id] is Dictionary:
		regions[region_id] = _new_region_record()
	world["regions"] = regions
	return regions[region_id]


static func mark_chest_opened(world: Dictionary, region_id: String, chest_id: String) -> bool:
	if chest_id.is_empty() or chest_id.length() > 80:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var opened: Array = record.get("openedChests", [])
	if opened.has(chest_id):
		return false
	opened.append(chest_id)
	record["openedChests"] = opened
	world["regions"][region_id] = record
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	stats["chestsOpened"] = mini(2147483647, maxi(0, int(stats.get("chestsOpened", 0))) + 1)
	hero["stats"] = stats
	world["hero"] = hero
	AchievementEngine.evaluate(world)
	DailyQuestEngine.update_progress(world, "chest", "chest")
	return true


static func mark_enemy_defeated(world: Dictionary, region_id: String, enemy_id: String, respawn_at: float) -> bool:
	if enemy_id.is_empty() or enemy_id.length() > 80 or not is_finite(respawn_at) or respawn_at < 0.0:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var defeated: Dictionary = record.get("defeatedEnemies", {})
	defeated[enemy_id] = respawn_at
	record["defeatedEnemies"] = defeated
	world["regions"][region_id] = record
	return true


static func is_enemy_defeated(world: Dictionary, region_id: String, enemy_id: String, clock_minutes: float) -> bool:
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var defeated: Dictionary = record.get("defeatedEnemies", {})
	return defeated.has(enemy_id) and float(defeated[enemy_id]) > clock_minutes


static func mark_boss_defeated(world: Dictionary, region_id: String, boss_id: String) -> bool:
	if boss_id.is_empty() or boss_id.length() > 80:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var defeated: Array = record.get("defeatedBosses", [])
	if defeated.has(boss_id):
		return false
	defeated.append(boss_id)
	record["defeatedBosses"] = defeated
	var progress: Dictionary = record.get("bossProgress", {})
	progress.erase(boss_id)
	record["bossProgress"] = progress
	world["regions"][region_id] = record
	return true


static func set_boss_progress(world: Dictionary, region_id: String, boss_id: String, hp_ratio: float, phase: int, turn_count: int, pending_special: bool = false) -> bool:
	if boss_id.is_empty() or boss_id.length() > 80 or not is_finite(hp_ratio) or hp_ratio <= 0.0 or hp_ratio > 1.0 or phase < 0 or phase > 20 or turn_count < 0 or turn_count > 100000:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty() or record.get("defeatedBosses", []).has(boss_id):
		return false
	var progress: Dictionary = record.get("bossProgress", {})
	progress[boss_id] = {"hpRatio": hp_ratio, "phase": phase, "turnCount": turn_count, "pendingSpecial": pending_special}
	record["bossProgress"] = progress
	world["regions"][region_id] = record
	return true


static func set_security_threat(world: Dictionary, region_id: String, threat: int) -> bool:
	if threat < 0 or threat > 3:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	record["securityThreat"] = threat
	world["regions"][region_id] = record
	return true


static func mark_event_resolved(world: Dictionary, region_id: String, event_id: String) -> bool:
	if event_id.is_empty() or event_id.length() > 80:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var resolved: Array = record.get("resolvedEvents", [])
	if resolved.has(event_id):
		return false
	resolved.append(event_id)
	record["resolvedEvents"] = resolved
	world["regions"][region_id] = record
	return true


static func mark_secret_discovered(world: Dictionary, region_id: String, secret_id: String) -> bool:
	if secret_id.is_empty() or secret_id.length() > 80:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var discovered: Array = record.get("discoveredSecrets", [])
	if discovered.has(secret_id):
		return false
	discovered.append(secret_id)
	record["discoveredSecrets"] = discovered
	world["regions"][region_id] = record
	return true


static func set_secret_layout(world: Dictionary, region_id: String, chests: Array, walls: Array) -> bool:
	# A generated layout is immutable for this region/save: never reroll it on reload.
	if chests.size() > 32 or walls.size() > 32:
		return false
	var record := get_region_record(world, region_id)
	if record.is_empty() or record.get("secretLayoutGenerated", false):
		return false
	var candidate := record.duplicate(true)
	candidate["secretChests"] = chests.duplicate(true)
	candidate["secretWalls"] = walls.duplicate(true)
	candidate["secretLayoutGenerated"] = true
	var clean := _normalize_region_record(candidate)
	if clean.secretChests.size() != chests.size() or clean.secretWalls.size() != walls.size():
		return false
	var chest_ids: Array = []
	for chest in clean.secretChests:
		if chest_ids.has(chest.id):
			return false
		chest_ids.append(chest.id)
	var wall_ids: Array = []
	for wall in clean.secretWalls:
		if wall_ids.has(wall.id):
			return false
		wall_ids.append(wall.id)
	world["regions"][region_id] = clean
	return true


static func get_secret_layout(world: Dictionary, region_id: String) -> Dictionary:
	var record := get_region_record(world, region_id)
	if record.is_empty() or not record.get("secretLayoutGenerated", false):
		return {"generated": false, "chests": [], "walls": []}
	return {
		"generated": true,
		"chests": record.get("secretChests", []).duplicate(true),
		"walls": record.get("secretWalls", []).duplicate(true)
	}


static func record_secret_layout(world: Dictionary, region_id: String, walls: Array) -> bool:
	# Mirrors systems/region-state.js: an empty candidate list can still be a generated layout.
	var record := get_region_record(world, region_id)
	if record.is_empty() or record.get("secretLayoutGenerated", false):
		return false
	var clean_walls: Array = []
	for wall in walls:
		if not wall is Dictionary:
			continue
		var wall_id: Variant = wall.get("id", "")
		var valid := wall_id is String and not wall_id.is_empty() and wall_id.length() <= 80
		for coordinate in ["tx", "ty", "wx", "wy", "ax", "ay"]:
			valid = valid and is_finite(float(wall.get(coordinate, NAN)))
		if valid and ["chest", "elite", "loot"].has(wall.get("rewardType", "")):
			clean_walls.append({
				"id": wall_id, "tx": float(wall.tx), "ty": float(wall.ty),
				"wx": float(wall.wx), "wy": float(wall.wy),
				"ax": float(wall.ax), "ay": float(wall.ay),
				"rewardType": wall.rewardType
			})
	record["secretWalls"] = clean_walls
	record["secretLayoutGenerated"] = true
	world["regions"][region_id] = record
	return true


static func record_secret_discovered(world: Dictionary, region_id: String, secret_id: String, chest: Variant = null) -> bool:
	if not mark_secret_discovered(world, region_id, secret_id):
		return false
	if chest is Dictionary:
		var chest_id: Variant = chest.get("id", "")
		var x := float(chest.get("x", NAN))
		var y := float(chest.get("y", NAN))
		if chest_id is String and not chest_id.is_empty() and chest_id.length() <= 80 and is_finite(x) and is_finite(y):
			var record := get_region_record(world, region_id)
			var chests: Array = record.get("secretChests", [])
			var exists := false
			for item in chests:
				if item is Dictionary and item.get("id", "") == chest_id:
					exists = true
					break
			if not exists:
				chests.append({"id": chest_id, "x": x, "y": y})
			record["secretChests"] = chests
			world["regions"][region_id] = record
	return true


static func apply_region_persistence(world: Dictionary, region_id: String, enemies: Array, chests: Array, events: Array = [], now_msec: float = 0.0) -> bool:
	var record := get_region_record(world, region_id)
	if record.is_empty():
		return false
	var clock := maxf(0.0, float(world.get("clockMinutes", 0.0)))
	var opened: Array = record.get("openedChests", [])
	var resolved: Array = record.get("resolvedEvents", [])
	var defeated_bosses: Array = record.get("defeatedBosses", [])
	for chest in chests:
		if chest is Dictionary:
			chest["opened"] = opened.has(str(chest.get("id", "")))
	for index in range(events.size() - 1, -1, -1):
		var event: Variant = events[index]
		if event is Dictionary and resolved.has(str(event.get("id", ""))):
			events.remove_at(index)
	var defeated: Dictionary = record.get("defeatedEnemies", {})
	var boss_progress: Dictionary = record.get("bossProgress", {})
	for enemy in enemies:
		if not enemy is Dictionary:
			continue
		var persistent_id := str(enemy.get("persistentId", ""))
		if enemy.get("boss", false) and defeated_bosses.has(persistent_id):
			enemy["dead"] = true
			enemy["hp"] = 0
			enemy["respawnAt"] = 0
			enemy["effects"] = []
			if enemy.get("state", "") == "combat":
				enemy["state"] = "dead"
			continue
		if enemy.get("boss", false) and boss_progress.has(persistent_id):
			var progress: Dictionary = boss_progress[persistent_id]
			var max_hp := float(enemy.get("maxHp", 0))
			if max_hp > 0.0:
				enemy["hp"] = maxi(1, mini(int(max_hp), roundi(max_hp * float(progress.hpRatio))))
				enemy["phase"] = int(progress.phase)
				enemy["persistentTurnCount"] = int(progress.turnCount)
				enemy["tacticalSpecialPending"] = progress.pendingSpecial == true
		if not defeated.has(persistent_id):
			continue
		var respawn_clock := float(defeated[persistent_id])
		if respawn_clock <= clock:
			defeated.erase(persistent_id)
			enemy["dead"] = false
			if enemy.get("maxHp") is int or enemy.get("maxHp") is float:
				enemy["hp"] = enemy.maxHp
			enemy["respawnAt"] = 0
			enemy["effects"] = []
			if enemy.get("state", "") == "dead":
				enemy["state"] = "idle"
		else:
			enemy["dead"] = true
			enemy["hp"] = 0
			enemy["respawnAt"] = now_msec + (respawn_clock - clock) * 60000.0
			enemy["effects"] = []
	world["regions"][region_id] = record
	return true
