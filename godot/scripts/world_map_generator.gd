# Deterministic generic overworld map generation.
# Tile contract follows systems/overworld/map.js:
# 0 ground, 1 road, 2 wall, 3 hazard/stone, 4 dense prop.
class_name WorldMapGenerator
extends RefCounted

const WorldRandomScript = preload("res://godot/scripts/world_random.gd")
const TILE_GROUND := 0
const TILE_ROAD := 1
const TILE_WALL := 2
const TILE_STONE := 3
const TILE_PROP := 4


static func generate_map(region_id: String, cols: int, rows: int, world_seed: int, generator_version: int = 1, visit_index: int = 0) -> Array:
	if cols < 5 or rows < 5 or cols > 256 or rows > 256:
		return []
	var grid: Array = []
	for y in range(rows):
		var line: Array[int] = []
		line.resize(cols)
		line.fill(TILE_GROUND)
		grid.append(line)
	if region_id == "village":
		return _generate_village_placeholder(grid, cols, rows)

	var rng := WorldRandomScript.for_region(world_seed, generator_version, region_id, visit_index)
	# Three rough stone formations.
	for _cluster in range(3):
		var cx := rng.next_int(cols)
		var cy := rng.next_int(rows)
		var radius := 2 + rng.next_int(3)
		for y in range(maxi(0, cy - radius), mini(rows, cy + radius)):
			for x in range(maxi(0, cx - radius), mini(cols, cx + radius)):
				if Vector2(x - cx, y - cy).length() <= radius and rng.next_float() > 0.2:
					grid[y][x] = TILE_STONE
	# Smaller rock and ruin patches.
	for _cluster in range(8):
		var cx := rng.next_int(cols)
		var cy := rng.next_int(rows)
		var radius := 1 + rng.next_int(2)
		for y in range(maxi(0, cy - radius), mini(rows, cy + radius)):
			for x in range(maxi(0, cx - radius), mini(cols, cx + radius)):
				if Vector2(x - cx, y - cy).length() <= radius and rng.next_float() > 0.3:
					grid[y][x] = TILE_WALL
	# Sparse decorative props.
	for _prop in range(24):
		var x := rng.next_int(cols)
		var y := rng.next_int(rows)
		if grid[y][x] == TILE_GROUND:
			grid[y][x] = TILE_PROP

	# Keep the central cross and arrival clearing passable.
	var cx := floori(cols / 2.0)
	var cy := floori(rows / 2.0)
	for x in range(cols):
		grid[cy][x] = TILE_ROAD
	for y in range(rows):
		grid[y][cx] = TILE_ROAD
	for y in range(cy - 2, cy + 3):
		for x in range(cx - 2, cx + 3):
			if x >= 0 and x < cols and y >= 0 and y < rows:
				grid[y][x] = TILE_ROAD
	return grid


static func _generate_village_placeholder(grid: Array, cols: int, rows: int) -> Array:
	# Village has a hand-authored curved road plan in the browser version.
	# Until its full authored layout is ported, keep a safe central arrival hub.
	var cx := floori(cols / 2.0)
	var cy := floori(rows / 2.0)
	for x in range(cols):
		grid[cy][x] = TILE_ROAD
	for y in range(rows):
		grid[y][cx] = TILE_ROAD
	for y in range(maxi(0, cy - 1), mini(rows, cy + 2)):
		for x in range(maxi(0, cx - 1), mini(cols, cx + 2)):
			grid[y][x] = TILE_ROAD
	return grid


static func is_blocked(grid: Array, x: int, y: int, hazard_walkable: bool = false) -> bool:
	if grid.is_empty() or y < 0 or y >= grid.size() or not grid[y] is Array or x < 0 or x >= grid[y].size():
		return true
	var tile := int(grid[y][x])
	if tile == TILE_WALL or tile == TILE_PROP:
		return true
	return tile == TILE_STONE and not hazard_walkable


static func find_free_cell(grid: Array, min_distance_from: Vector2i = Vector2i(-1, -1), min_distance: float = 0.0, hazard_walkable: bool = false) -> Vector2i:
	for y in range(grid.size()):
		for x in range(grid[y].size()):
			if is_blocked(grid, x, y, hazard_walkable):
				continue
			if min_distance_from.x >= 0 and Vector2(x - min_distance_from.x, y - min_distance_from.y).length() < min_distance:
				continue
			return Vector2i(x, y)
	return Vector2i(-1, -1)
