# Deterministic tile-map generation. Village streets and gardens mirror
# systems/overworld/map.js; other regions use its obstacle/road layout.
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
	for _y in range(rows):
		var line: Array[int] = []
		line.resize(cols)
		line.fill(TILE_GROUND)
		grid.append(line)
	if region_id == "village":
		return _generate_village(grid, cols, rows)
	var rng := WorldRandomScript.for_region(world_seed, generator_version, region_id, visit_index)
	for _cluster in range(3):
		var cx := rng.next_int(cols)
		var cy := rng.next_int(rows)
		var radius := 2 + rng.next_int(3)
		for y in range(maxi(0, cy - radius), mini(rows, cy + radius)):
			for x in range(maxi(0, cx - radius), mini(cols, cx + radius)):
				if Vector2(x - cx, y - cy).length() <= radius and rng.next_float() > 0.2:
					grid[y][x] = TILE_STONE
	for _cluster in range(8):
		var cx := rng.next_int(cols)
		var cy := rng.next_int(rows)
		var radius := 1 + rng.next_int(2)
		for y in range(maxi(0, cy - radius), mini(rows, cy + radius)):
			for x in range(maxi(0, cx - radius), mini(cols, cx + radius)):
				if Vector2(x - cx, y - cy).length() <= radius and rng.next_float() > 0.3:
					grid[y][x] = TILE_WALL
	for _prop in range(24):
		var x := rng.next_int(cols)
		var y := rng.next_int(rows)
		if grid[y][x] == TILE_GROUND:
			grid[y][x] = TILE_PROP
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


static func wandering_merchant_cell(region_id: String, cols: int, rows: int, world_seed: int, generator_version: int = 1, visit_index: int = 0) -> Vector2i:
	if cols < 7 or rows < 7 or region_id in ["village", "rift", "obsidian-fields", "frost-citadel", "dragon-lair"] or region_id.begins_with("tower-floor-"):
		return Vector2i(-1, -1)
	if WorldRegionCatalog.is_safe(region_id):
		return Vector2i(-1, -1)
	var seed_value := WorldRandomScript.derive_seed([world_seed, generator_version, region_id, maxi(0, visit_index), "wandering-merchant"])
	var rng := WorldRandomScript.new(seed_value)
	if rng.next_float() >= 0.16:
		return Vector2i(-1, -1)
	return Vector2i(3 + rng.next_int(maxi(1, cols - 6)), 3 + rng.next_int(maxi(1, rows - 6)))


static func _generate_village(grid: Array, cols: int, rows: int) -> Array:
	var cx := floori(cols / 2.0)
	var cy := floori(rows / 2.0)
	_road(grid, [Vector2i(cx, rows - 1), Vector2i(cx, rows - 6), Vector2i(cx - 1, rows - 9), Vector2i(cx, cy + 4), Vector2i(cx, cy)], 3)
	_road(grid, [Vector2i(cx, cy), Vector2i(cx - 1, cy - 3), Vector2i(cx, cy - 6), Vector2i(cx, 4)], 2)
	_road(grid, [Vector2i(cx, cy), Vector2i(cx - 4, cy - 1), Vector2i(cx - 8, cy), Vector2i(7, cy - 1), Vector2i(7, 9)], 2)
	_road(grid, [Vector2i(7, 9), Vector2i(6, 11), Vector2i(7, 14), Vector2i(8, 17), Vector2i(7, 21)], 2)
	_road(grid, [Vector2i(cx, cy), Vector2i(cx + 4, cy + 1), Vector2i(cx + 8, cy), Vector2i(cols - 7, cy + 1), Vector2i(cols - 7, 9)], 2)
	_road(grid, [Vector2i(cols - 7, 9), Vector2i(cols - 6, 12), Vector2i(cols - 7, 16), Vector2i(cols - 7, 21)], 2)
	_road(grid, [Vector2i(cx - 1, cy + 3), Vector2i(cx - 4, cy + 5), Vector2i(cx - 6, rows - 5), Vector2i(13, rows - 4)], 2)
	_road(grid, [Vector2i(cx + 1, cy + 3), Vector2i(cx + 4, cy + 5), Vector2i(cx + 6, rows - 5), Vector2i(25, rows - 4)], 2)
	_road(grid, [Vector2i(13, rows - 4), Vector2i(15, rows - 5), Vector2i(17, rows - 4), Vector2i(cx, rows - 5)], 2)
	_road(grid, [Vector2i(cx - 7, cy), Vector2i(cx - 9, cy - 2), Vector2i(cx - 10, cy - 4), Vector2i(11, cy - 5)], 2)
	_road(grid, [Vector2i(cx + 7, cy), Vector2i(cx + 9, cy - 2), Vector2i(cx + 10, cy - 4), Vector2i(cols - 11, cy - 5)], 2)
	_road(grid, [Vector2i(cx - 2, cy + 5), Vector2i(cx - 4, cy + 7), Vector2i(cx - 5, rows - 7), Vector2i(10, rows - 7)], 2)
	_road(grid, [Vector2i(cx + 2, cy + 5), Vector2i(cx + 4, cy + 7), Vector2i(cx + 5, rows - 7), Vector2i(cols - 10, rows - 7)], 2)
	# Small planted beds are placed only on untouched ground; streets always win.
	var gardens: Array = [
		{"x": 1, "y": 1, "rows": [[1,3],[0,4],[0,3],[1,2]]},
		{"x": cols - 5, "y": 1, "rows": [[1,3],[0,4],[0,3],[1,2]]},
		{"x": 1, "y": rows - 5, "rows": [[1,2],[0,3],[0,4],[1,3]]},
		{"x": cols - 5, "y": rows - 5, "rows": [[1,3],[0,4],[0,3],[1,2]]},
		{"x": 10, "y": 2, "rows": [[1,2],[0,3],[1,2]]},
		{"x": cols - 13, "y": 2, "rows": [[1,2],[0,3],[1,2]]},
		{"x": 2, "y": 12, "rows": [[1,2],[0,3],[1,2]]},
		{"x": cols - 5, "y": 13, "rows": [[1,2],[0,3],[1,2]]},
		{"x": 5, "y": 2, "rows": [[1,3],[0,4],[1,3]]},
		{"x": cols - 10, "y": 2, "rows": [[1,3],[0,4],[1,3]]},
		{"x": 5, "y": rows - 6, "rows": [[1,3],[0,4],[1,3]]},
		{"x": cols - 10, "y": rows - 6, "rows": [[1,3],[0,4],[1,3]]}
	]
	for patch in gardens:
		var rows_data: Array = patch["rows"]
		for row_index in range(rows_data.size()):
			var span: Array = rows_data[row_index]
			for x in range(int(patch["x"]) + int(span[0]), int(patch["x"]) + int(span[1]) + 1):
				var y := int(patch["y"]) + row_index
				if y >= 0 and y < rows and x >= 0 and x < cols and grid[y][x] == TILE_GROUND:
					grid[y][x] = TILE_PROP
	return grid


static func _road(grid: Array, points: Array, width: int) -> void:
	for segment in range(points.size() - 1):
		var pos: Vector2i = points[segment]
		var target: Vector2i = points[segment + 1]
		var dx := absi(target.x - pos.x)
		var dy := absi(target.y - pos.y)
		var sx := signi(target.x - pos.x)
		var sy := signi(target.y - pos.y)
		var error := dx - dy
		var toggle := segment % 2 == 0
		for _step in range(grid.size() + grid[0].size() + 8):
			_stamp_road(grid, pos.x, pos.y, width)
			if pos == target:
				break
			var twice := error * 2
			var can_x := twice > -dy and pos.x != target.x
			var can_y := twice < dx and pos.y != target.y
			if can_x and can_y:
				if toggle:
					pos.x += sx
					error -= dy
				else:
					pos.y += sy
					error += dx
				toggle = not toggle
			elif can_x:
				pos.x += sx
				error -= dy
			elif can_y:
				pos.y += sy
				error += dx
			else:
				break


static func _stamp_road(grid: Array, x: int, y: int, width: int) -> void:
	var radius := maxi(0, floori((width - 1) / 2.0))
	for oy in range(-radius, radius + 1):
		for ox in range(-radius, radius + 1):
			if abs(ox) + abs(oy) > radius + (0 if width % 2 == 1 else 1):
				continue
			var tx := x + ox
			var ty := y + oy
			if ty >= 0 and ty < grid.size() and tx >= 0 and tx < grid[ty].size():
				grid[ty][tx] = TILE_ROAD
	if y >= 0 and y < grid.size() and x >= 0 and x < grid[y].size():
		grid[y][x] = TILE_ROAD


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
