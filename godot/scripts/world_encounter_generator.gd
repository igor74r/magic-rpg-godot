# Deterministic ambient encounter generation for authored world regions.
class_name WorldEncounterGenerator
extends RefCounted

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const Enemies = preload("res://godot/scripts/world_enemy_catalog.gd")
const RandomScript = preload("res://godot/scripts/world_random.gd")
const MapGenerator = preload("res://godot/scripts/world_map_generator.gd")
const TILE_SIZE := 32
const ELITE_HP_MULT := 1.5
const ELITE_ATTACK_MULT := 1.3

static func generate(region_id: String, grid: Array, world_seed: int, generator_version: int = 1, visit_index: int = 1, player_cell: Vector2i = Vector2i(20, 15), security_threat: int = 0, difficulty: String = "normal") -> Array:
	if Catalog.is_safe(region_id) or grid.is_empty():
		return []
	var region_rng := RandomScript.for_region(world_seed, generator_version, region_id, visit_index)
	var roster: Array = Catalog.enemy_roster(region_id).filter(func(id): return Enemies.ENEMIES.has(id))
	if roster.is_empty():
		return []
	var count := mini(maxi(roster.size(), 4), 7)
	for i in range(roster.size() - 1, 0, -1):
		var j := region_rng.next_int(i + 1)
		var swap = roster[i]
		roster[i] = roster[j]
		roster[j] = swap
	var spawn_roster := roster.slice(0, count)
	while spawn_roster.size() < count:
		spawn_roster.append(roster[region_rng.next_int(roster.size())])
	var chance_by_difficulty := {"easy": 0.15, "normal": 0.20, "hard": 0.35}
	var elite_chance := minf(0.5, float(chance_by_difficulty.get(difficulty, 0.20)) + clampi(security_threat, 0, 3) * 0.05)
	var used_cells: Array[Vector2i] = []
	var enemies: Array = []
	var boss_occurrences := {}
	for index in range(spawn_roster.size()):
		var cell := _find_free_cell(grid, used_cells, player_cell, region_rng)
		if cell.x < 0:
			continue
		used_cells.append(cell)
		var enemy_id := str(spawn_roster[index])
		var definition := Enemies.get_enemy(enemy_id)
		if definition.is_empty():
			continue
		var is_boss := bool(definition.get("boss", false))
		var occurrence := 0
		if is_boss:
			occurrence = int(boss_occurrences.get(enemy_id, 0)) + 1
			boss_occurrences[enemy_id] = occurrence
		var elite := not is_boss and region_rng.next_float() < elite_chance
		var hp := int(round(float(definition.hp) * (ELITE_HP_MULT if elite else 1.0)))
		var attack := int(round(float(definition.attack) * (ELITE_ATTACK_MULT if elite else 1.0)))
		var persistent_id := "boss-%s%s" % [enemy_id, "" if occurrence <= 1 else "-%d" % occurrence] if is_boss else "enemy-%d" % index
		enemies.append({
			"id": index, "persistentId": persistent_id, "enemyId": enemy_id,
			"name": definition.name, "emoji": definition.emoji,
			"x": cell.x * TILE_SIZE + TILE_SIZE / 2, "y": cell.y * TILE_SIZE + TILE_SIZE / 2,
			"cell": cell, "hp": hp, "maxHp": hp, "attack": attack,
			"defense": int(definition.defense), "exp": int(definition.exp), "gold": int(definition.gold),
			"special": definition.get("special", {}).duplicate(true),
			"elite": elite, "boss": is_boss, "effects": [], "phase": 0,
			"state": "idle", "dead": false, "respawnAt": 0
		})
	return enemies

static func _find_free_cell(grid: Array, used: Array[Vector2i], player_cell: Vector2i, rng: WorldRandom) -> Vector2i:
	var candidates: Array[Vector2i] = []
	for y in range(grid.size()):
		for x in range(grid[y].size()):
			var cell := Vector2i(x, y)
			if MapGenerator.is_blocked(grid, x, y):
				continue
			if Vector2(cell - player_cell).length() < 5.0:
				continue
			var occupied := false
			for other in used:
				if Vector2(cell - other).length() < 3.0:
					occupied = true
					break
			if not occupied:
				candidates.append(cell)
	if candidates.is_empty():
		return Vector2i(-1, -1)
	return candidates[rng.next_int(candidates.size())]
