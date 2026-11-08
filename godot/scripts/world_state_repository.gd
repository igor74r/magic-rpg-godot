extends RefCounted

const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const WORLD_PATH := "user://shards_world_state.json"


static func save_world(world: Dictionary) -> Error:
	return _write_json_atomically(WORLD_PATH, JSON.stringify(world))


static func _write_json_atomically(path: String, serialized: String) -> Error:
	var temporary_path := path + ".tmp"
	var backup_path := path + ".bak"
	var temporary_file := FileAccess.open(temporary_path, FileAccess.WRITE)
	if temporary_file == null:
		return FileAccess.get_open_error()
	temporary_file.store_string(serialized)
	temporary_file.flush()
	var write_error := temporary_file.get_error()
	temporary_file.close()
	if write_error != OK:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(temporary_path))
		return write_error

	var absolute_path := ProjectSettings.globalize_path(path)
	var absolute_temporary := ProjectSettings.globalize_path(temporary_path)
	var absolute_backup := ProjectSettings.globalize_path(backup_path)
	var had_previous := FileAccess.file_exists(path)
	if FileAccess.file_exists(backup_path):
		if not had_previous:
			var recovery_error := DirAccess.rename_absolute(absolute_backup, absolute_path)
			if recovery_error != OK:
				DirAccess.remove_absolute(absolute_temporary)
				return recovery_error
		else:
			DirAccess.remove_absolute(absolute_backup)
	if had_previous:
		var backup_error := DirAccess.rename_absolute(absolute_path, absolute_backup)
		if backup_error != OK:
			DirAccess.remove_absolute(absolute_temporary)
			return backup_error

	var replace_error := DirAccess.rename_absolute(absolute_temporary, absolute_path)
	if replace_error != OK:
		if had_previous:
			DirAccess.rename_absolute(absolute_backup, absolute_path)
		DirAccess.remove_absolute(absolute_temporary)
		return replace_error

	if had_previous and FileAccess.file_exists(backup_path):
		DirAccess.remove_absolute(absolute_backup)
	return OK


static func load_world() -> Dictionary:
	if not FileAccess.file_exists(WORLD_PATH) and not FileAccess.file_exists(WORLD_PATH + ".bak"):
		return WorldStateScript.create(1)
	var parsed := _read_dictionary(WORLD_PATH)
	if not parsed.is_empty():
		return WorldStateScript.normalize(parsed, 1)

	# A crash between the two renames can leave the last good world in .bak.
	var backup := _read_dictionary(WORLD_PATH + ".bak")
	if backup.is_empty():
		return WorldStateScript.create(1)
	var primary_absolute := ProjectSettings.globalize_path(WORLD_PATH)
	var backup_absolute := ProjectSettings.globalize_path(WORLD_PATH + ".bak")
	if FileAccess.file_exists(WORLD_PATH):
		DirAccess.remove_absolute(primary_absolute)
	DirAccess.rename_absolute(backup_absolute, primary_absolute)
	return WorldStateScript.normalize(backup, 1)


static func _read_dictionary(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	return parsed if parsed is Dictionary else {}
