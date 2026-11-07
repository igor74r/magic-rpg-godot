extends SceneTree

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const EnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
const MapGenerator = preload("res://godot/scripts/world_map_generator.gd")
const Encounter = preload("res://godot/scripts/world_encounter_generator.gd")

func _initialize() -> void:
	var failures: Array[String] = []
	for region_id in Catalog.region_ids():
		for enemy_id in Catalog.enemy_roster(region_id):
			if EnemyCatalog.get_enemy(enemy_id).is_empty():
				failures.append("missing combat definition: %s" % enemy_id)
	var grid := MapGenerator.generate_map("forest", 40, 30, 123456, 1, 1)
	var first := Encounter.generate("forest", grid, 123456, 1, 1)
	var second := Encounter.generate("forest", grid, 123456, 1, 1)
	if first.size() != 4:
		failures.append("forest should spawn four authored encounters")
	if first != second:
		failures.append("same seed and visit must produce identical encounters")
	if not Encounter.generate("village", grid, 123456).is_empty():
		failures.append("safe village must not spawn enemies")
	for enemy in first:
		if enemy.hp <= 0 or enemy.maxHp != enemy.hp or enemy.cell.x < 0:
			failures.append("spawned enemy has invalid stats or position")
		if Vector2(enemy.cell - Vector2i(20, 15)).length() < 5.0:
			failures.append("enemy spawned too close to player")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World encounter generation checks passed")
	quit(0)
