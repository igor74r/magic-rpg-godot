class_name SaveRepository
extends RefCounted

const SAVE_VERSION := 18
const SLOT_PATH_TEMPLATE := "user://shards_slot_%d.json"


static func save_slot(slot: int, payload: Dictionary) -> Error:
	if slot < 1 or slot > 3:
		return ERR_INVALID_PARAMETER
	if int(payload.get("version", -1)) != SAVE_VERSION:
		return ERR_INVALID_DATA

	var file := FileAccess.open(SLOT_PATH_TEMPLATE % slot, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()

	file.store_string(JSON.stringify(payload))
	return file.get_error()


static func load_slot(slot: int) -> Dictionary:
	if slot < 1 or slot > 3:
		return {}
	var path := SLOT_PATH_TEMPLATE % slot
	if not FileAccess.file_exists(path):
		return {}

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}

	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		return {}
	if int(parsed.get("version", -1)) != SAVE_VERSION:
		return {}
	return parsed
