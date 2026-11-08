class_name SaveRepository
extends RefCounted

const SAVE_VERSION := 18
const PREVIOUS_SAVE_VERSION := 17
const SLOT_PATH_TEMPLATE := "user://shards_slot_%d.json"


static func save_slot(slot: int, payload: Dictionary) -> Error:
	if slot < 1 or slot > 3:
		return ERR_INVALID_PARAMETER
	# Validate the complete payload before opening the file. A version marker
	# alone must never allow a malformed save to replace a healthy slot.
	var normalized := migrate_payload(payload)
	if normalized.is_empty():
		return ERR_INVALID_DATA

	var file := FileAccess.open(SLOT_PATH_TEMPLATE % slot, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()

	file.store_string(JSON.stringify(normalized))
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
	return migrate_payload(parsed)


static func migrate_payload(payload: Dictionary) -> Dictionary:
	var migrated: Dictionary = payload.duplicate(true)
	var version_value: Variant = migrated.get("version", -1)
	if not version_value is int:
		return {}
	var version := int(version_value)
	var hero_key := "player" if migrated.get("player", null) is Dictionary else "hero"
	var hero_value: Variant = migrated.get(hero_key, null)
	# A version marker alone is not a save. Reject payloads without a valid
	# hero record instead of silently upgrading malformed/empty data.
	if not hero_value is Dictionary:
		return {}
	if version == SAVE_VERSION:
		return migrated
	if version != PREVIOUS_SAVE_VERSION:
		return {}
	# v17 already stores the full hero/world payload. v18 adds optional
	# progression fields; preserve all existing fields and initialize only
	# missing containers so old campaign progress is never discarded.
	var hero: Dictionary = hero_value
	if not hero.get("campaignKills", {}) is Dictionary: hero["campaignKills"] = {}
	if not hero.get("campaignClaimed", {}) is Dictionary: hero["campaignClaimed"] = {}
	if not hero.get("storyShards", {}) is Dictionary: hero["storyShards"] = {}
	if not hero.get("riftClearedLocations", []) is Array: hero["riftClearedLocations"] = []
	if not hero.get("towerBest", 0) is int: hero["towerBest"] = 0
	if not hero.get("riftBest", 0) is int: hero["riftBest"] = 0
	migrated[hero_key] = hero
	migrated["version"] = SAVE_VERSION
	return migrated
