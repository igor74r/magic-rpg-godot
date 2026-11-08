extends SceneTree

const MapView = preload("res://godot/scripts/world_map_view.gd")


func _initialize() -> void:
	var failures: Array[String] = []
	var view := MapView.new()
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

	view.free()
	if failures.is_empty():
		print("PASS: map NPC interaction supports mouse and touch input")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
