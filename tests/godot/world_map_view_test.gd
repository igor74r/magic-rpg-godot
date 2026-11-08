extends SceneTree

const MapView = preload("res://godot/scripts/world_map_view.gd")


func _initialize() -> void:
	var failures: Array[String] = []
	var view := MapView.new()
	root.add_child(view)
	view.size = Vector2(100, 100)
	view.set_map([[0, 0], [0, 0]])
	view.set_npcs([{"id":"merchant","cell":Vector2i(0, 0)}])
	var clicked: Array[String] = []
	view.npc_clicked.connect(func(npc_id: String): clicked.append(npc_id))

	var mouse := InputEventMouseButton.new()
	mouse.button_index = MOUSE_BUTTON_LEFT
	mouse.pressed = true
	mouse.position = Vector2(25, 25)
	view._gui_input(mouse)
	if clicked != ["merchant"]:
		failures.append("mouse click must activate a map NPC marker")

	clicked.clear()
	var touch := InputEventScreenTouch.new()
	touch.pressed = true
	touch.position = Vector2(25, 25)
	view._gui_input(touch)
	if clicked != ["merchant"]:
		failures.append("screen touch must activate the same map NPC marker as mouse input")

	clicked.clear()
	touch.position = Vector2(90, 90)
	view._gui_input(touch)
	if not clicked.is_empty():
		failures.append("touches outside NPC hit targets must not activate a marker")

	view.set_npcs([
		{"id":"", "cell":Vector2i(0, 0)},
		{"id":"invalid-cell", "cell":[0, 0]},
		{"id":"outside", "cell":Vector2i(8, 8)},
		{"id":"valid", "cell":Vector2i(1, 1)}
	])
	clicked.clear()
	touch.position = Vector2(75, 75)
	view._gui_input(touch)
	if clicked != ["valid"]:
		failures.append("invalid, unidentified, and out-of-bounds NPC markers must be ignored")

	view.set_map([[0, 0], [0]])
	view.set_npcs([{"id":"edge", "cell":Vector2i(1, 1)}])
	clicked.clear()
	touch.position = Vector2(75, 75)
	view._gui_input(touch)
	if not clicked.is_empty():
		failures.append("NPC markers on missing cells in ragged map rows must be ignored")

	view.set_map([])
	clicked.clear()
	view._gui_input(touch)
	if not clicked.is_empty():
		failures.append("empty maps must safely ignore interaction")

	view.queue_free()
	if failures.is_empty():
		print("PASS: map NPC interaction supports mouse/touch and rejects malformed markers/maps")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
