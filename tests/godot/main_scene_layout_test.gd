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
		var controller_source := FileAccess.get_file_as_string("res://godot/scripts/main.gd")
		for required_fragment in [
			"func _refresh_chronicles() -> void:",
			"func _add_chronicle_section(",
			"func _set_chronicle_section(",
			"func _make_chronicle_panel_style(",
			"var panel := PanelContainer.new()",
			"panel.visible = false",
			"panel.visible = expanded",
			"toggle.toggled.connect(_set_chronicle_section",
			"note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART",
			"func _handle_combat_victory(defeated_enemy: Dictionary) -> void:",
			"RiftEngineScript.complete_area(world, defeated_enemy)",
			"_complete_tower_victory(defeated_enemy)",
			"_handle_combat_victory(combat_state.get(\"enemy\", {}))"
		]:
			if not controller_source.contains(required_fragment):
				failures.append("native chronicles view must preserve expandable, styled and readable content: %s" % required_fragment)
		scene.free()

	if failures.is_empty():
		print("PASS: main scene keeps the native game UI vertically scrollable")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
