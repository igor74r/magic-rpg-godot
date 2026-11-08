extends SceneTree

const Repository = preload("res://godot/scripts/world_state_repository.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var path: String = Repository.WORLD_PATH
	var backup_path := path + ".bak"
	var temporary_path := path + ".tmp"
	for candidate in [path, backup_path, temporary_path]:
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))

	var original := WorldState.create(424242)
	original["clockMinutes"] = 135
	original["discoveredRegions"] = ["village", "forest"]
	if Repository.save_world(original) != OK:
		failures.append("world repository must atomically save a world")
	var loaded := Repository.load_world()
	if int(loaded.get("seed", 0)) != 424242 or float(loaded.get("clockMinutes", -1)) != 135.0:
		failures.append("saved world must round-trip its seed and clock")

	# Simulate interruption after the old primary was moved to its backup.
	var good_serialized := JSON.stringify(original)
	var backup_file := FileAccess.open(backup_path, FileAccess.WRITE)
	if backup_file == null:
		failures.append("test must create a recovery backup")
	else:
		backup_file.store_string(good_serialized)
		backup_file.close()
	var broken_file := FileAccess.open(path, FileAccess.WRITE)
	if broken_file == null:
		failures.append("test must create a broken primary")
	else:
		broken_file.store_string("{broken json")
		broken_file.close()
	var recovered := Repository.load_world()
	if int(recovered.get("seed", 0)) != 424242 or float(recovered.get("clockMinutes", -1)) != 135.0:
		failures.append("corrupt primary must recover the last valid backup")
	if not FileAccess.file_exists(path) or not Repository._read_dictionary(path).has("clockMinutes"):
		failures.append("recovery must restore a valid primary save")

	for candidate in [path, backup_path, temporary_path]:
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
	if failures.is_empty():
		print("PASS: atomic world saves, round-trip and interrupted-write recovery")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
