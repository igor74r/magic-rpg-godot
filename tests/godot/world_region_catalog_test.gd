extends SceneTree

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const Graph = preload("res://godot/scripts/world_graph.gd")

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
	if Catalog.enemy_roster("wasteland").count("sand-worm") != 2:
		failures.append("authored duplicate enemy weights must be preserved")
	if Catalog.get_region("void-crater").get("chestsCount") != 6:
		failures.append("void crater must preserve its six-chest setting")
	if not Catalog.get_region("unknown").is_empty():
		failures.append("unknown region must return empty data")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World region catalog checks passed")
	quit(0)
