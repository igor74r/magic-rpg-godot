extends SceneTree

const Generator = preload("res://godot/scripts/world_map_generator.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var failures: Array[String] = []
	var first := Generator.generate_map("forest", 40, 30, 123456, 1, 1)
	var second := Generator.generate_map("forest", 40, 30, 123456, 1, 1)
	if first != second:
		failures.append("same seed and visit must be deterministic")
	var other := Generator.generate_map("forest", 40, 30, 123456, 1, 2)
	if first == other:
		failures.append("different visits must produce different maps")
	var village := Generator.generate_map("village", 40, 30, 123456)
	if village.size() != 30 or village[0].size() != 40:
		failures.append("village map dimensions must be 40x30")
	var road_count := 0
	for row in village:
		for tile in row:
			if tile == Generator.TILE_ROAD:
				road_count += 1
	if road_count < 180:
		failures.append("village must contain its authored road network, not a simple cross")
	var cross_count := 0
	for x in range(40):
		if village[15][x] == Generator.TILE_ROAD:
			cross_count += 1
	if cross_count == 40:
		failures.append("village horizontal road must not be a full-width cross")
	if village[15][18] != Generator.TILE_ROAD or village[15][22] != Generator.TILE_ROAD:
		failures.append("village central plaza must retain the browser's widened paved footprint")
	if village[14][13] != Generator.TILE_ROAD or village[16][13] != Generator.TILE_ROAD:
		failures.append("village craft and market junctions must retain their paved widening")
	var protected_cells: Array[Vector2i] = [
		Vector2i(19,15), Vector2i(17,19), Vector2i(20,19), Vector2i(22,6), Vector2i(4,9), Vector2i(33,10), Vector2i(5,20), Vector2i(33,21),
		Vector2i(16,14), Vector2i(19,13), Vector2i(22,13), Vector2i(15,10), Vector2i(17,10), Vector2i(20,10), Vector2i(7,10), Vector2i(31,10),
		Vector2i(7,21), Vector2i(31,21), Vector2i(24,6), Vector2i(19,25), Vector2i(12,16), Vector2i(13,13), Vector2i(27,13), Vector2i(15,8), Vector2i(15,18),
		Vector2i(12,9), Vector2i(27,9), Vector2i(12,20), Vector2i(27,20), Vector2i(10,14), Vector2i(29,14), Vector2i(10,18), Vector2i(29,18),
		Vector2i(29,22), Vector2i(9,9), Vector2i(9,11), Vector2i(10,11), Vector2i(29,21), Vector2i(9,21),
		Vector2i(25,4), Vector2i(7,8), Vector2i(31,8), Vector2i(7,20), Vector2i(31,20), Vector2i(13,25), Vector2i(25,25), Vector2i(13,4),
		Vector2i(16,6), Vector2i(17,8), Vector2i(22,8), Vector2i(23,10)
	]
	for cell in protected_cells:
		if village[cell.y][cell.x] == Generator.TILE_PROP:
			failures.append("browser-protected village interaction cell must never become a garden obstacle: %s" % str(cell))
			break
	if not Generator.is_blocked([[Generator.TILE_STONE]], 0, 0):
		failures.append("stone must block ordinary movement")
	if Generator.is_blocked([[Generator.TILE_STONE]], 0, 0, true):
		failures.append("hazard surface may be walkable")
	if not Generator.is_blocked([[Generator.TILE_WALL]], 0, 0, true):
		failures.append("walls remain blocked in hazard regions")
	var merchant_spawn := Generator.wandering_merchant_cell("forest", 40, 30, 3, 1, 1)
	if merchant_spawn.x < 3 or merchant_spawn.x > 36 or merchant_spawn.y < 3 or merchant_spawn.y > 26:
		failures.append("deterministic forest seed with a merchant encounter must spawn inside the map bounds")
	if merchant_spawn != Vector2i(12, 19):
		failures.append("wandering merchant spawn must match the deterministic browser-compatible seed vector")
	if Generator.wandering_merchant_cell("forest", 40, 30, 3, 1, 1) != merchant_spawn:
		failures.append("wandering merchant placement must be deterministic for the same save and visit")
	var merchant_map := Generator.generate_map("forest", 40, 30, 3, 1, 1)
	var safe_merchant_spawn := Generator.wandering_merchant_cell("forest", 40, 30, 3, 1, 1, merchant_map)
	if safe_merchant_spawn != merchant_spawn or Generator.is_blocked(merchant_map, safe_merchant_spawn.x, safe_merchant_spawn.y):
		failures.append("merchant must retain its preferred deterministic cell when walkable and never spawn on blocked terrain")
	var blocked_merchant_map: Array = []
	for _row in range(10):
		var blocked_row: Array[int] = []
		blocked_row.resize(10)
		blocked_row.fill(Generator.TILE_WALL)
		blocked_merchant_map.append(blocked_row)
	blocked_merchant_map[3][3] = Generator.TILE_GROUND
	var relocated_merchant := Generator.wandering_merchant_cell("forest", 10, 10, 3, 1, 1, blocked_merchant_map)
	if relocated_merchant != Vector2i(3, 3):
		failures.append("merchant must relocate deterministically to the nearest walkable cell when its preferred cell is blocked")
	if Generator.wandering_merchant_cell("forest", 40, 30, 1, 1, 1) != Vector2i(-1, -1):
		failures.append("regions without a successful 16 percent encounter roll must not spawn a merchant")
	for excluded_region in ["village", "rift", "obsidian-fields", "frost-citadel", "dragon-lair", "tower-floor-1"]:
		if Generator.wandering_merchant_cell(excluded_region, 40, 30, 3, 1, 1) != Vector2i(-1, -1):
			failures.append("wandering merchant must not spawn in excluded safe or boss region: %s" % excluded_region)
	if not Generator.generate_map("forest", 4, 30, 1).is_empty():
		failures.append("invalid dimensions must be rejected")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World map generation checks passed")
	quit(0)
