extends SceneTree

const Graph = preload("res://godot/scripts/world_graph.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var ids: Array = Graph.region_ids()

	if ids.size() != 16:
		failures.append("expected 16 canonical regions, got %d" % ids.size())
	if not ids.has("village"):
		failures.append("starting village is missing")

	for from_id in ids:
		for to_id in Graph.neighbors(from_id):
			if not Graph.is_route(from_id, to_id):
				failures.append("route %s -> %s is not bidirectional" % [from_id, to_id])

	var reachable: Array = Graph.reachable_from("village")
	if reachable.size() != ids.size():
		failures.append("world graph is disconnected: village reaches %d/%d regions" % [reachable.size(), ids.size()])

	var expected_start := ["forest", "briar-hollow", "ruins"]
	var actual_start: Array = Graph.neighbors("village")
	actual_start.sort()
	expected_start.sort()
	if actual_start != expected_start:
		failures.append("starting village exits differ from browser reference")

	if not Graph.is_route("village", "forest"):
		failures.append("known village/forest route was not found")
	if Graph.is_route("village", "dragon-lair"):
		failures.append("nonexistent village/dragon-lair route was accepted")
	if Graph.route_key("village", "forest") != Graph.route_key("forest", "village"):
		failures.append("route keys must be direction-independent")
	if not Graph.neighbors("missing-region").is_empty():
		failures.append("unknown region must have no neighbors")
	if not Graph.reachable_from("missing-region").is_empty():
		failures.append("unknown region must not produce a reachable set")

	if failures.is_empty():
		print("PASS: canonical 16-region graph, bidirectional routes and connectivity")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
