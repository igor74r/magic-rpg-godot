extends SceneTree

const SaveRepo = preload("res://godot/scripts/save_repository.gd")
const TEST_SLOT := 3
const TEST_PATH := "user://shards_slot_3.json"


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []

	if SaveRepo.save_slot(0, {"version": 18}) != ERR_INVALID_PARAMETER:
		failures.append("slot 0 must be rejected")
	if SaveRepo.save_slot(4, {"version": 18}) != ERR_INVALID_PARAMETER:
		failures.append("slot 4 must be rejected")
	if SaveRepo.save_slot(TEST_SLOT, {"version": 17}) != ERR_INVALID_DATA:
		failures.append("unsupported save versions must be rejected")

	var payload := {
		"version": 18,
		"player": {"name": "Godot CI fixture", "level": 1},
		"worldSeed": 123456
	}
	var save_error: Error = SaveRepo.save_slot(TEST_SLOT, payload)
	if save_error != OK:
		failures.append("valid v18 payload could not be saved (error %d)" % save_error)
	else:
		var loaded: Dictionary = SaveRepo.load_slot(TEST_SLOT)
		# JSON numbers are decoded as numeric Variants; compare the contract
		# fields rather than relying on Dictionary's strict Variant equality.
		if int(loaded.get("version", -1)) != 18:
			failures.append("loaded save has the wrong schema version")
		var loaded_player: Dictionary = loaded.get("player", {})
		if loaded_player.get("name", "") != "Godot CI fixture":
			failures.append("loaded save lost the player name")
		if int(loaded_player.get("level", 0)) != 1:
			failures.append("loaded save lost the player level")
		if int(loaded.get("worldSeed", 0)) != 123456:
			failures.append("loaded save lost the world seed")

	if FileAccess.file_exists(TEST_PATH):
		var absolute_path := ProjectSettings.globalize_path(TEST_PATH)
		var remove_error := DirAccess.remove_absolute(absolute_path)
		if remove_error != OK:
			failures.append("test save file cleanup failed (error %d)" % remove_error)

	if failures.is_empty():
		print("PASS: save repository slot bounds, version guard and JSON field round-trip")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
