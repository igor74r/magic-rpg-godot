# Save-scoped exploration state, ported from systems/world-state.js.
# This is separate from WorldGraph: graph topology is immutable; this data is mutable per save.
class_name WorldStateData
extends RefCounted

const SCHEMA_VERSION := 1
const GENERATOR_VERSION := 1
const WorldRandomScript = preload("res://godot/scripts/world_random.gd")


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
	var seed_value := int(world.get("seed", seed_fallback)) & 0xffffffff
	world["seed"] = seed_value if seed_value != 0 else 1
	var generator := int(world.get("generatorVersion", GENERATOR_VERSION))
	world["generatorVersion"] = maxi(1, generator)
	world["clockMinutes"] = maxf(0.0, float(world.get("clockMinutes", 0)))
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
			clean_visits[region_id] = maxi(0, int(visits[region_id]))
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
		hero["riftBest"] = clampi(int(hero.get("riftBest", 0)), 0, 2147483647)
		var clean_cleared: Array = []
		var source_cleared: Variant = hero.get("riftClearedLocations", [])
		if source_cleared is Array:
			for location_id in source_cleared:
				if location_id is String and location_id in _rift_location_ids() and not clean_cleared.has(location_id):
					clean_cleared.append(location_id)
		hero["riftClearedLocations"] = clean_cleared
		world["hero"] = hero
	var run_value: Variant = world.get("riftRun", {})
	if run_value is Dictionary and bool(run_value.get("active", false)):
		var run: Dictionary = run_value
		var location_id := str(run.get("locationId", ""))
		var floor_value := int(run.get("floor", 0))
		var enemy_value: Variant = run.get("enemy", {})
		var valid_enemy := enemy_value is Dictionary and int(enemy_value.get("hp", 0)) > 0 and int(enemy_value.get("maxHp", 0)) >= int(enemy_value.get("hp", 0)) and bool(enemy_value.get("riftMode", false)) and str(enemy_value.get("riftLocationId", "")) == location_id and int(enemy_value.get("riftFloor", 0)) == floor_value
		if location_id in _rift_location_ids() and floor_value >= 1 and valid_enemy:
			world["riftRun"] = run.duplicate(true)
		else:
			world["riftRun"] = {"active": false, "completed": false, "invalidated": true}
	else:
		world["riftRun"] = run_value.duplicate(true) if run_value is Dictionary else {}
	if not world.get("factionCampaigns", {}) is Dictionary:
		world["factionCampaigns"] = {}
	if not world.get("events", {}) is Dictionary:
		world["events"] = defaults.events.duplicate(true)
	var events: Dictionary = world["events"]
	for key in ["active", "history"]:
		if not events.get(key, []) is Array:
			events[key] = []
	if not events.get("cooldowns", {}) is Dictionary:
		events["cooldowns"] = {}
	if not events.get("sequence", 0) is int:
		events["sequence"] = 0
	if not events.get("nextSpawnAt", -1) is int or int(events.get("nextSpawnAt", -1)) < 0:
		events["nextSpawnAt"] = defaults.events.nextSpawnAt
	return world


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
