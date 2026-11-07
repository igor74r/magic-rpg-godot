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
	if not Generator.is_blocked([[Generator.TILE_STONE]], 0, 0):
		failures.append("stone must block ordinary movement")
	if Generator.is_blocked([[Generator.TILE_STONE]], 0, 0, true):
		failures.append("hazard surface may be walkable")
	if not Generator.is_blocked([[Generator.TILE_WALL]], 0, 0, true):
		failures.append("walls remain blocked in hazard regions")
	if not Generator.generate_map("forest", 4, 30, 1).is_empty():
		failures.append("invalid dimensions must be rejected")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World map generation checks passed")
	quit(0)
