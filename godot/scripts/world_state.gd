# Save-scoped exploration state, ported from systems/world-state.js.
# This is separate from WorldGraph: graph topology is immutable; this data is mutable per save.
class_name WorldState
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

	if not world.get("regions", {}) is Dictionary:
		world["regions"] = {}
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


static func can_travel(world: Dictionary, from_id: String, to_id: String) -> bool:
	if not WorldGraph.is_route(from_id, to_id):
		return false
	if world.get("legacyFastTravel", false):
		return true
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
