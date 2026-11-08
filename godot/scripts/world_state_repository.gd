extends RefCounted

const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const SaveRepositoryScript = preload("res://godot/scripts/save_repository.gd")
const WORLD_PATH := "user://shards_world_state.json"


static func save_world(world: Dictionary) -> Error:
	return _write_json_atomically(WORLD_PATH, JSON.stringify(world))


# Convert a validated browser v18 snapshot into the native runtime envelope.
# Keep the source snapshot so browser-only fields survive native play and export.
static func from_browser_payload(payload: Dictionary) -> Dictionary:
	if not SaveRepositoryScript.is_browser_v18_payload(payload):
		return {}
	var browser_world_value: Variant = payload.get("world", {})
	var browser_world: Dictionary = browser_world_value.duplicate(true) if browser_world_value is Dictionary else {}
	var player: Dictionary = payload.player.duplicate(true)
	var source_seed := int(browser_world.get("seed", payload.get("worldSeed", 1)))
	var source_generator := int(browser_world.get("generatorVersion", payload.get("worldGeneratorVersion", 1)))
	browser_world["seed"] = source_seed
	browser_world["generatorVersion"] = source_generator
	browser_world["hero"] = player
	browser_world["factions"] = payload.factions.duplicate(true)
	browser_world["storyShards"] = payload.storyShards.duplicate(true)
	browser_world["storyDragons"] = payload.storyDragons.duplicate(true)
	browser_world["_browserSourcePayload"] = payload.duplicate(true)
	return WorldStateScript.normalize(browser_world, source_seed)


# Rebuild a browser-compatible snapshot from the live native runtime state.
# Start from the original browser document to retain fields not yet interpreted
# by Godot, then overlay the authoritative native hero and progression state.
static func to_browser_payload(world: Dictionary) -> Dictionary:
	var source_value: Variant = world.get("_browserSourcePayload", {})
	if not source_value is Dictionary or source_value.is_empty():
		return {}
	var payload: Dictionary = source_value.duplicate(true)
	var hero_value: Variant = world.get("hero", {})
	if not hero_value is Dictionary or hero_value.is_empty():
		return {}
	var browser_world: Dictionary = world.duplicate(true)
	for runtime_key in ["hero", "factions", "storyShards", "storyDragons", "_browserSourcePayload"]:
		browser_world.erase(runtime_key)
	payload["player"] = hero_value.duplicate(true)
	payload["world"] = browser_world
	payload["worldSeed"] = int(world.get("seed", payload.get("worldSeed", 1)))
	payload["worldGeneratorVersion"] = int(world.get("generatorVersion", payload.get("worldGeneratorVersion", 1)))
	payload["factions"] = world.get("factions", payload.get("factions", {})).duplicate(true)
	payload["storyShards"] = world.get("storyShards", payload.get("storyShards", {})).duplicate(true)
	payload["storyDragons"] = world.get("storyDragons", payload.get("storyDragons", {})).duplicate(true)
	return payload


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
			had_previous = true
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
