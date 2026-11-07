extends SceneTree

const Generator = preload("res://godot/scripts/world_map_generator.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var first := Generator.generate_map("forest", 40, 30, 123456, 1, 1)
	var second := Generator.generate_map("forest", 40, 30, 123456, 1, 1)
	if first != second:
		failures.append("same world seed and visit must generate identical map")
	var other_visit := Generator.generate_map("forest", 40, 30, 123456, 1, 2)
	if first == other_visit:
		failures.append("different visit index must generate a different map")
	if first.size() != 30 or first[0].size() != 40:
		failures.append("generated map must match requested dimensions")
	var cx := 20
	var cy := 15
	if not first[cy].all(func(tile): return tile == Generator.TILE_ROAD):
		failures.append("central horizontal road must be clear")
	for row in first:
		if row[cx] != Generator.TILE_ROAD:
			failures.append("central vertical road must be clear")
			break
	var spawn := Generator.find_free_cell(first, Vector2i(cx, cy), 0.0)
	if spawn.x < 0:
		failures.append("generated map must contain a free spawn cell")
	if not Generator.is_blocked([[Generator.TILE_STONE]], 0, 0):
		failures.append("stone must block movement in ordinary regions")
	if Generator.is_blocked([[Generator.TILE_STONE]], 0, 0, true):
		failures.append("hazard terrain may be traversable when region rules allow it")
	if not Generator.is_blocked([[Generator.TILE_WALL]], 0, 0, true):
		failures.append("walls must remain blocked even in hazard regions")
	if not Generator.generate_map("forest", 4, 30, 1).is_empty():
		failures.append("invalid dimensions must be rejected")

	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World map generation checks passed")
	quit(0)
