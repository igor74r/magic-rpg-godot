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

	return _write_json_atomically(SLOT_PATH_TEMPLATE % slot, JSON.stringify(normalized))


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


static func load_slot(slot: int) -> Dictionary:
	if slot < 1 or slot > 3:
		return {}
	var path := SLOT_PATH_TEMPLATE % slot
	var backup_path := path + ".bak"
	var primary := _read_slot_payload(path)
	if not primary.is_empty():
		return primary

	# Recover the last complete save after a crash between the backup and
	# replacement renames. Never replace a valid primary with a backup.
	var backup := _read_slot_payload(backup_path)
	if backup.is_empty():
		return {}
	var absolute_path := ProjectSettings.globalize_path(path)
	var absolute_backup := ProjectSettings.globalize_path(backup_path)
	if FileAccess.file_exists(path):
		var remove_error := DirAccess.remove_absolute(absolute_path)
		if remove_error != OK:
			return {}
	var restore_error := DirAccess.rename_absolute(absolute_backup, absolute_path)
	if restore_error != OK:
		return {}
	return backup


static func _read_slot_payload(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	file.close()
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



# Browser v18 is a separate, richer contract than the native Godot slot
# envelope. Keep this validator explicit so a minimal native save is never
# mistaken for a losslessly importable browser save.
static func is_browser_v18_payload(payload: Dictionary) -> bool:
	if payload.get("version", null) is not int or int(payload.version) != SAVE_VERSION:
		return false
	var player_value: Variant = payload.get("player", null)
	var world_value: Variant = payload.get("world", null)
	var factions_value: Variant = payload.get("factions", null)
	if not player_value is Dictionary or not world_value is Dictionary or not factions_value is Dictionary:
		return false
	var player: Dictionary = player_value
	var world: Dictionary = world_value
	var factions: Dictionary = factions_value
	for key in ["hp", "maxHp", "mp", "maxMp", "str", "int", "wis", "con", "dex", "luck"]:
		if not _is_finite_number(player.get(key, null)):
			return false
	if float(player.hp) < 0.0 or float(player.maxHp) <= 0.0 or float(player.mp) < 0.0 or float(player.maxMp) <= 0.0:
		return false
	if float(player.luck) < 0.0 or float(player.luck) > 100.0:
		return false
	for key in ["exp", "statPoints", "passivePoints", "level", "ngPlus", "gold"]:
		if not player.get(key, null) is int:
			return false
	if int(player.exp) < 0 or int(player.statPoints) < 0 or int(player.passivePoints) < 0 or int(player.level) < 1 or int(player.level) > 100 or int(player.ngPlus) < 0 or int(player.gold) < 0:
		return false
	if not player.get("name", null) is String or str(player.name).strip_edges().is_empty():
		return false
	if not ["warrior", "mage", "archer", "priest"].has(player.get("class", "")):
		return false
	if not player.get("inventory", null) is Array or not player.get("spells", null) is Array:
		return false
	for item in player.inventory:
		if not item is Dictionary or not item.get("id", null) is String or str(item.id).strip_edges().is_empty():
			return false
		if item.has("qty") and (not item.qty is int or int(item.qty) <= 0):
			return false
	for spell_id in player.spells:
		if not spell_id is String:
			return false
	for key in ["equipped", "stats", "campaignKills", "campaignClaimed", "activeCampaignByBranch"]:
		if not player.get(key, null) is Dictionary:
			return false
	if not player.stats.get("kills", null) is Dictionary:
		return false
	if not (player.get("activeCampaignMission", null) == null or player.activeCampaignMission is String):
		return false
	if not payload.get("storyShards", null) is Dictionary or not payload.get("storyDragons", null) is Dictionary:
		return false
	if not payload.get("worldSeed", null) is int or int(payload.worldSeed) < 1 or int(payload.worldSeed) > 4294967295:
		return false
	if payload.get("worldGeneratorVersion", null) != 1:
		return false
	if not world.get("seed", null) is int or int(world.seed) <= 0:
		return false
	if not world.get("generatorVersion", null) is int or int(world.generatorVersion) < 0:
		return false
	if not world.get("discoveredRegions", null) is Array or not world.get("unlockedRoutes", null) is Array:
		return false
	if not factions.get("reputation", null) is Dictionary or not factions.get("changeLog", null) is Array:
		return false
	return true


# Browser exports are accepted only when they satisfy the complete v18
# browser contract. Unknown fields are deliberately retained by save_slot.
static func import_browser_save(slot: int, serialized: String) -> Error:
	if slot < 1 or slot > 3:
		return ERR_INVALID_PARAMETER
	var parsed: Variant = JSON.parse_string(serialized)
	if not parsed is Dictionary or not is_browser_v18_payload(parsed):
		return ERR_INVALID_DATA
	return save_slot(slot, parsed)


static func export_browser_save(slot: int) -> String:
	var payload := load_slot(slot)
	if payload.is_empty() or not is_browser_v18_payload(payload):
		return ""
	return JSON.stringify(payload)


static func _is_finite_number(value: Variant) -> bool:
	return (value is int or value is float) and is_finite(float(value))
