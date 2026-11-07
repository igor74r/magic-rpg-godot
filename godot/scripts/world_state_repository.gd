extends RefCounted

const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const WORLD_PATH := "user://shards_world_state.json"


static func save_world(world: Dictionary) -> Error:
	var file := FileAccess.open(WORLD_PATH, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify(world))
	return file.get_error()


static func load_world() -> Dictionary:
	if not FileAccess.file_exists(WORLD_PATH):
		return WorldStateScript.create(1)
	var file := FileAccess.open(WORLD_PATH, FileAccess.READ)
	if file == null:
		return WorldStateScript.create(1)
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		return WorldStateScript.create(1)
	return WorldStateScript.normalize(parsed, 1)
