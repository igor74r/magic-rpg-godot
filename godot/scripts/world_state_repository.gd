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
	browser_world["location"] = str(payload.get("location", browser_world.get("location", "village")))
	# Browser ensureWorldState falls back to the top-level game location when
	# the nested world snapshot has no valid currentRegionId. Preserve that
	# behavior for imports instead of silently resetting exploration to village.
	var saved_region: Variant = browser_world.get("currentRegionId", null)
	var location_region: Variant = payload.get("location", null)
	if not WorldGraph.region_ids().has(saved_region) and location_region is String and WorldGraph.region_ids().has(location_region):
		browser_world["currentRegionId"] = location_region
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
	var payload: Dictionary = source_value.duplicate(true) if source_value is Dictionary else {}
	var hero_value: Variant = world.get("hero", {})
	if not hero_value is Dictionary or hero_value.is_empty():
		return {}
	var player: Dictionary = hero_value.duplicate(true)
	# Native-first games have no browser source document. Build the required
	# v18 envelope so a new Godot save can still be exported to the browser.
	player["name"] = str(player.get("name", "Герой"))
	player["class"] = str(player.get("class", "warrior"))
	player["level"] = clampi(int(player.get("level", 1)), 1, 100)
	player["ngPlus"] = maxi(0, int(player.get("ngPlus", 0)))
	player["gold"] = maxi(0, int(player.get("gold", 0)))
	player["exp"] = maxi(0, int(player.get("exp", 0)))
	player["statPoints"] = maxi(0, int(player.get("statPoints", 0)))
	player["passivePoints"] = maxi(0, int(player.get("passivePoints", 0)))
	for stat_key in ["hp", "maxHp", "mp", "maxMp", "str", "int", "wis", "con", "dex", "luck"]:
		if not player.has(stat_key):
			player[stat_key] = 5 if stat_key == "luck" else (100 if stat_key in ["hp", "maxHp"] else 50 if stat_key in ["mp", "maxMp"] else 10)
	player["inventory"] = player.get("inventory", []) if player.get("inventory", []) is Array else []
	player["spells"] = player.get("spells", []) if player.get("spells", []) is Array else []
	player["equipped"] = player.get("equipped", {}) if player.get("equipped", {}) is Dictionary else {}
	player["stats"] = player.get("stats", {}) if player.get("stats", {}) is Dictionary else {}
	if not player.stats.get("kills", null) is Dictionary:
		player.stats["kills"] = {}
	for key in ["campaignKills", "campaignClaimed", "activeCampaignByBranch"]:
		if not player.get(key, {}) is Dictionary:
			player[key] = {}
	if not player.has("activeCampaignMission"):
		player["activeCampaignMission"] = null
	var browser_world: Dictionary = world.duplicate(true)
	for runtime_key in ["hero", "factions", "storyShards", "storyDragons", "_browserSourcePayload", "location"]:
		browser_world.erase(runtime_key)
	# Runtime normalization intentionally keeps only fields understood by
	# Godot. Merge the authoritative normalized state over the original browser
	# world document so opaque extension fields at every dictionary depth survive.
	var source_world_value: Variant = payload.get("world", {})
	if source_world_value is Dictionary:
		browser_world = _merge_preserving_unknown(source_world_value, browser_world)
	payload["version"] = SaveRepositoryScript.SAVE_VERSION
	payload["player"] = player
	payload["location"] = str(world.get("location", payload.get("location", "village")))
	payload["world"] = browser_world
	payload["worldSeed"] = int(world.get("seed", payload.get("worldSeed", 1)))
	payload["worldGeneratorVersion"] = int(world.get("generatorVersion", payload.get("worldGeneratorVersion", 1)))
	var factions_value: Variant = world.get("factions", payload.get("factions", {}))
	payload["factions"] = factions_value.duplicate(true) if factions_value is Dictionary else {}
	if not payload.factions.has("reputation") or not payload.factions.reputation is Dictionary:
		payload.factions["reputation"] = {}
	if not payload.factions.has("changeLog") or not payload.factions.changeLog is Array:
		payload.factions["changeLog"] = []
	var shards_value: Variant = world.get("storyShards", payload.get("storyShards", {}))
	payload["storyShards"] = shards_value.duplicate(true) if shards_value is Dictionary else {}
	var dragons_value: Variant = world.get("storyDragons", payload.get("storyDragons", {}))
	payload["storyDragons"] = dragons_value.duplicate(true) if dragons_value is Dictionary else {}
	return payload if SaveRepositoryScript.is_browser_v18_payload(payload) else {}


# Recursively preserve source-only dictionary keys while runtime values win.
# Arrays are replaced by the authoritative runtime array to avoid resurrecting
# stale gameplay entries that were intentionally removed during normalization.
static func _merge_preserving_unknown(source: Dictionary, authoritative: Dictionary) -> Dictionary:
	var merged: Dictionary = source.duplicate(true)
	for key in authoritative:
		var source_value: Variant = merged.get(key, null)
		var runtime_value: Variant = authoritative[key]
		if source_value is Dictionary and runtime_value is Dictionary:
			merged[key] = _merge_preserving_unknown(source_value, runtime_value)
		else:
			merged[key] = runtime_value.duplicate(true) if runtime_value is Dictionary or runtime_value is Array else runtime_value
	return merged


# Export through the same crash-safe writer used by native world saves.
static func export_browser_payload(path: String, world: Dictionary) -> Error:
	if path.is_empty():
		return ERR_INVALID_PARAMETER
	var payload := to_browser_payload(world)
	if payload.is_empty() or not SaveRepositoryScript.is_browser_v18_payload(payload):
		return ERR_INVALID_DATA
	return _write_json_atomically(path, JSON.stringify(payload, "\t"))


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
		if not had_previous or _read_dictionary(path).is_empty():
			# The backup may be the only valid world snapshot after an interrupted
			# replacement. Restore it before rotating files, even if a corrupt
			# primary path still exists.
			if had_previous:
				var remove_error := DirAccess.remove_absolute(absolute_path)
				if remove_error != OK:
					DirAccess.remove_absolute(absolute_temporary)
					return remove_error
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
