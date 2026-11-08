extends SceneTree

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const Graph = preload("res://godot/scripts/world_graph.gd")
const Enemies = preload("res://godot/scripts/world_enemy_catalog.gd")
const Npcs = preload("res://godot/scripts/world_npc_catalog.gd")

func _initialize() -> void:
	var failures: Array[String] = []
	var ids := Catalog.region_ids()
	if ids.size() != 16:
		failures.append("catalog must cover all 16 world regions")
	for region_id in Graph.region_ids():
		var data := Catalog.get_region(region_id)
		if data.is_empty():
			failures.append("missing region data: %s" % region_id)
		if region_id == "village":
			if not Catalog.is_safe(region_id) or not Catalog.enemy_roster(region_id).is_empty():
				failures.append("village must be safe and have no enemy roster")
		elif Catalog.is_safe(region_id):
			failures.append("combat region marked safe: %s" % region_id)
		if Catalog.enemy_roster(region_id).is_empty() and region_id != "village":
			failures.append("combat region has no authored enemy roster: %s" % region_id)
		for enemy_id in Catalog.enemy_roster(region_id):
			if not enemy_id is String or enemy_id.is_empty():
				failures.append("invalid enemy id in %s" % region_id)
			elif Enemies.get_enemy(str(enemy_id)).is_empty():
				failures.append("region %s references missing enemy definition: %s" % [region_id, enemy_id])
	if Catalog.enemy_roster("wasteland").count("sand-worm") != 2:
		failures.append("authored duplicate enemy weights must be preserved")
	if Catalog.get_region("void-crater").get("chestsCount") != 6:
		failures.append("void crater must preserve its six-chest setting")
	if not Catalog.get_region("unknown").is_empty():
		failures.append("unknown region must return empty data")
	var npc_ids := Npcs.ids()
	var npc_positions: Dictionary = Npcs.map_locations()
	if npc_positions.size() != npc_ids.size():
		failures.append("every authored NPC must have exactly one village map position")
	for npc_id in npc_ids:
		if not npc_positions.has(npc_id):
			failures.append("NPC has no map position: %s" % npc_id)
			continue
		var pos: Vector2i = npc_positions[npc_id]
		if pos.x < 0 or pos.x >= 40 or pos.y < 0 or pos.y >= 30:
			failures.append("NPC position is outside the 40x30 village map: %s" % npc_id)
	if npc_positions.has("questBoard") and npc_positions["questBoard"] == npc_positions.get("elder", Vector2i(-1, -1)):
		failures.append("quest board must not overlap the elder position")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World region catalog checks passed")
	quit(0)
