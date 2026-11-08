extends SceneTree


func _initialize() -> void:
	var failures: Array[String] = []
	var packed := load("res://godot/scenes/main.tscn") as PackedScene
	if packed == null:
		failures.append("main scene must load as a PackedScene")
	else:
		var scene := packed.instantiate()
		var scroll := scene.get_node_or_null("MarginContainer/ScrollContainer") as ScrollContainer
		if scroll == null:
			failures.append("main scene must place its content inside a ScrollContainer")
		else:
			var content := scroll.get_node_or_null("Content") as VBoxContainer
			if content == null:
				failures.append("scroll container must own the main VBoxContainer")
			if scroll.horizontal_scroll_mode != ScrollContainer.SCROLL_MODE_SHOW_NEVER:
				failures.append("main UI must not require horizontal scrolling")
			if scroll.vertical_scroll_mode == ScrollContainer.SCROLL_MODE_SHOW_NEVER:
				failures.append("main UI must allow vertical scrolling")
		var main_script := scene.get_script() as GDScript
		if main_script == null or not main_script.source_code.contains("$MarginContainer/ScrollContainer/Content"):
			failures.append("main controller onready paths must target the scrollable content node")
		scene.free()

	if failures.is_empty():
		print("PASS: main scene keeps the native game UI vertically scrollable")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
