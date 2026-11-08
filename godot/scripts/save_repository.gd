class_name SaveRepository
extends RefCounted

const SAVE_VERSION := 18
const PREVIOUS_SAVE_VERSION := 17
const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const WorldCampaignCatalogScript = preload("res://godot/scripts/world_campaign_catalog.gd")
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
	if version < 0 or version > PREVIOUS_SAVE_VERSION:
		return {}
	if version < PREVIOUS_SAVE_VERSION:
		_migrate_browser_legacy_versions(migrated, hero_key, version)
		migrated["version"] = PREVIOUS_SAVE_VERSION
	hero_value = migrated.get(hero_key, null)
	if not hero_value is Dictionary:
		return {}
	# Browser v17 -> v18 migration. Match systems/save.js: derive the stable
	# per-save seed, create legacy-fast-travel world state when absent, normalize
	# factions and campaign branches, then rebase XP without losing fractional
	# progress toward the next level.
	var hero: Dictionary = hero_value
	if not hero.get("campaignKills", {}) is Dictionary: hero["campaignKills"] = {}
	if not hero.get("campaignClaimed", {}) is Dictionary: hero["campaignClaimed"] = {}
	if not hero.get("activeCampaignByBranch", {}) is Dictionary: hero["activeCampaignByBranch"] = {}
	if not hero.get("storyShards", {}) is Dictionary: hero["storyShards"] = {}
	if not hero.get("riftClearedLocations", []) is Array: hero["riftClearedLocations"] = []
	if not hero.get("towerBest", 0) is int: hero["towerBest"] = 0
	if not hero.get("riftBest", 0) is int: hero["riftBest"] = 0

	var source_seed := int(migrated.get("worldSeed", 0))
	if source_seed < 1 or source_seed > 4294967295:
		source_seed = _derive_legacy_world_seed(hero, str(migrated.get("location", "village")))
	migrated["worldSeed"] = source_seed
	var generator_value: Variant = migrated.get("worldGeneratorVersion", 1)
	migrated["worldGeneratorVersion"] = int(generator_value) if generator_value is int and int(generator_value) >= 1 else 1

	var world_value: Variant = migrated.get("world", null)
	var world: Dictionary = WorldStateScript.create(source_seed, true) if not world_value is Dictionary else world_value.duplicate(true)
	world = WorldStateScript.normalize(world, source_seed, true)
	migrated["world"] = world

	var factions_value: Variant = migrated.get("factions", null)
	var factions: Dictionary = factions_value.duplicate(true) if factions_value is Dictionary else {}
	var reputation_value: Variant = factions.get("reputation", {})
	var reputation: Dictionary = reputation_value.duplicate(true) if reputation_value is Dictionary else {}
	for faction_id in ["hub-guardians", "rift-cult", "free-traders", "ash-nomads"]:
		var reputation_number := float(reputation.get(faction_id, 0))
		reputation[faction_id] = clampi(roundi(reputation_number), -100, 100) if is_finite(reputation_number) else 0
	factions["schemaVersion"] = 1
	factions["reputation"] = reputation
	var log_value: Variant = factions.get("changeLog", [])
	var change_log: Array = log_value.duplicate(true) if log_value is Array else []
	if change_log.size() > 50:
		change_log = change_log.slice(change_log.size() - 50)
	factions["changeLog"] = change_log
	migrated["factions"] = factions

	_normalize_campaign_branches(hero)
	migrated[hero_key] = hero
	_rebase_legacy_experience(hero)
	if not hero.get("ngPlus", null) is int or int(hero.get("ngPlus", 0)) < 0:
		hero["ngPlus"] = 0
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

static func _derive_legacy_world_seed(hero: Dictionary, location: String) -> int:
	var source := "%d|%s|%s|%s" % [
		int(hero.get("createdAt", 0)) if hero.get("createdAt", 0) is int else 0,
		str(hero.get("name", "")) if hero.get("name", "") is String else "",
		str(hero.get("class", "")) if hero.get("class", "") is String else "",
		location if not location.is_empty() else "village"
	]
	var hash_value: int = 2166136261
	# Browser save.js hashes JavaScript UTF-16 code units (charCodeAt), not
	# Unicode scalar values. Iterate the same 16-bit units so names containing
	# supplementary characters produce exactly the same world seed in Godot.
	var utf16 := source.to_utf16_buffer()
	for byte_offset in range(0, utf16.size(), 2):
		hash_value = int((hash_value ^ utf16.decode_u16(byte_offset)) * 16777619) & 0xffffffff
	return hash_value if hash_value != 0 else 1


static func _normalize_campaign_branches(hero: Dictionary) -> void:
	var branches := ["intro", "ash", "ice", "blood"]
	var value: Variant = hero.get("activeCampaignByBranch", {})
	var active: Dictionary = value.duplicate(true) if value is Dictionary else {}
	for branch in branches:
		if not active.has(branch):
			active[branch] = null
		var mission := str(active[branch]) if active[branch] is String else ""
		if not mission.is_empty() and _campaign_branch_for_mission(mission) != branch:
			active[branch] = null
	var legacy_mission := str(hero.get("activeCampaignMission", "")) if hero.get("activeCampaignMission", null) is String else ""
	var legacy_branch := _campaign_branch_for_mission(legacy_mission)
	if not legacy_branch.is_empty() and not active.get(legacy_branch, null):
		active[legacy_branch] = legacy_mission
	hero["activeCampaignByBranch"] = active


static func _campaign_branch_for_mission(mission_id: String) -> String:
	if not mission_id.begins_with("a") or not mission_id.contains("-m"):
		return ""
	var parts := mission_id.split("-m")
	if parts.size() != 2 or not parts[1].is_valid_int():
		return ""
	var act_text := parts[0].trim_prefix("a")
	if not act_text.is_valid_int():
		return ""
	var act := int(act_text)
	if act < 1 or act > 5:
		return ""
	if act <= 2:
		return "intro"
	if act == 3:
		return "ash"
	if act == 4:
		return "ice"
	return "blood"


static func _rebase_legacy_experience(hero: Dictionary) -> void:
	var level_value: Variant = hero.get("level", null)
	if not level_value is int or int(level_value) < 1 or int(level_value) >= 100:
		return
	var level := int(level_value)
	var next_exp := _experience_to_next_level(level)
	var previous_next_value: Variant = hero.get("expNext", null)
	var previous_next := int(previous_next_value) if previous_next_value is int and int(previous_next_value) > 0 else int(floor(100.0 * pow(float(level), 1.6)))
	var previous_exp_value: Variant = hero.get("exp", 0)
	var previous_exp := int(previous_exp_value) if previous_exp_value is int and int(previous_exp_value) >= 0 else 0
	if previous_next != next_exp:
		var progress := minf(1.0, float(previous_exp) / float(previous_next)) if previous_next > 0 else 0.0
		hero["exp"] = mini(next_exp - 1, int(floor(progress * next_exp)))
	hero["expNext"] = next_exp


static func _experience_to_next_level(level: int) -> int:
	if level <= 10:
		return 125
	if level <= 20:
		return 259
	if level <= 30:
		return 269
	if level <= 40:
		return 369
	if level <= 50:
		return 535
	return int(floor(535.0 * pow(float(level) / 50.0, 1.5)))

# Port of the browser save.js v1-v17 migration chain. Each block mirrors the
# original version boundary so legacy equipment, campaign claims and shard
# progress are transformed in the same order before the v18 world migration.
static func _migrate_browser_legacy_versions(game: Dictionary, hero_key: String, source_version: int) -> void:
	var player: Dictionary = game[hero_key]
	var version := source_version
	for slot in ["weapon", "armor"]:
		if player.get("equipped", {}) is Dictionary:
			var equipped_early: Dictionary = player.equipped
			if equipped_early.get(slot, null) is String:
				equipped_early[slot] = {"id": equipped_early[slot], "qty": 1}
	if version < 2:
		if not player.get("spells", null) is Array: player["spells"] = []
		if not player.get("inventory", null) is Array: player["inventory"] = []
		if not player.get("equipped", null) is Dictionary: player["equipped"] = {"weapon": null, "armor": null}
		version = 2
	if version < 3:
		if not player.get("statPoints", null) is int and not player.get("statPoints", null) is float: player["statPoints"] = 0
		if not game.get("shards", null) is Dictionary: game["shards"] = {"forest": false, "ruins": false, "shadow": false}
		if not game.get("quests", null) is Dictionary: game["quests"] = {}
		version = 3
	if version < 4:
		if not player.get("stats", null) is Dictionary: player["stats"] = {"kills": {}, "deaths": 0, "goldEarned": 0, "chestsOpened": 0, "dailyChestAt": 0, "dailyChestsOpened": 0}
		if not player.get("achievements", null) is Array: player["achievements"] = []
		if not player.get("weaponLevel", null) is int: player["weaponLevel"] = 0
		if not player.get("armorLevel", null) is int: player["armorLevel"] = 0
		if not player.get("herbs", null) is Dictionary: player["herbs"] = {}
		if not player.get("cooldowns", null) is Dictionary: player["cooldowns"] = {}
		if not player.get("effects", null) is Array: player["effects"] = []
		version = 4
	if version < 5:
		if not player.get("ngPlus", null) is int and not player.get("ngPlus", null) is float: player["ngPlus"] = 0
		version = 5
	if version < 6:
		if not player.get("riftBest", null) is int and not player.get("riftBest", null) is float: player["riftBest"] = 0
		version = 6
	if version < 7:
		if not player.get("playtimeSec", null) is int and not player.get("playtimeSec", null) is float: player["playtimeSec"] = 0
		if not player.get("createdAt", null) is int and not player.get("createdAt", null) is float: player["createdAt"] = int(Time.get_unix_time_from_system() * 1000.0)
		version = 7
	if version < 8:
		if not player.get("talents", null) is Array: player["talents"] = []
		version = 8
	if version < 9:
		if not player.get("dailyQuests", null) is Dictionary: player["dailyQuests"] = {"date": 0, "list": []}
		if not player.get("buffs", null) is Array: player["buffs"] = []
		version = 9
	if version < 10:
		if not player.get("dex", null) is int and not player.get("dex", null) is float: player["dex"] = 0
		var passives: Variant = player.get("passives", null)
		if not passives is Array: player["passives"] = ["start"]
		elif not passives.has("start"): passives.push_front("start")
		if not player.get("passivePoints", null) is int and not player.get("passivePoints", null) is float:
			player["passivePoints"] = maxi(0, int(player.get("level", 1)) - 1)
		if not player.get("statPoints", null) is int and not player.get("statPoints", null) is float: player["statPoints"] = 0
		if not player.get("stats", null) is Dictionary: player["stats"] = {"kills": {}, "deaths": 0, "goldEarned": 0, "chestsOpened": 0}
		if not player.stats.get("kills", null) is Dictionary: player.stats["kills"] = {}
		version = 10
	if version < 11:
		var defaults := {"warrior": 6, "mage": 8, "archer": 18, "priest": 7}
		var dex_value: Variant = player.get("dex", null)
		if not (dex_value is int or dex_value is float) or not is_finite(float(dex_value)) or float(dex_value) <= 0.0:
			player["dex"] = int(defaults.get(str(player.get("class", "")), 10))
		if not player.get("campaignKills", null) is Dictionary: player["campaignKills"] = {}
		var kills: Dictionary = player.campaignKills
		for enemy_id in kills.keys():
			var amount := float(kills[enemy_id])
			kills[enemy_id] = maxi(0, int(floor(amount))) if is_finite(amount) else 0
		version = 11
	if version < 12:
		var equipped_v12: Dictionary = player.get("equipped", {}) if player.get("equipped", {}) is Dictionary else {}
		for slot in ["weapon", "armor", "helmet", "gloves", "boots", "amulet", "ring1", "ring2"]:
			if not equipped_v12.has(slot): equipped_v12[slot] = null
		for slot in equipped_v12.keys():
			var instance_v12: Variant = equipped_v12[slot]
			if instance_v12 is Dictionary and not instance_v12.get("runes", null) is Array: instance_v12["runes"] = []
		player["equipped"] = equipped_v12
		if not player.get("campaignClaimed", null) is Dictionary: player["campaignClaimed"] = {}
		var claimed: Dictionary = player.campaignClaimed
		var campaign_kills: Dictionary = player.get("campaignKills", {})
		for mission in WorldCampaignCatalogScript.MISSIONS:
			var mission_id_claim := str(mission.get("id", ""))
			if float(campaign_kills.get(mission_id_claim, 0)) >= float(mission.get("count", 0)):
				claimed[mission_id_claim] = true
		if not player.get("activeCampaignMission", null) is String:
			player["activeCampaignMission"] = null
			for mission in WorldCampaignCatalogScript.MISSIONS:
				var mission_id_active := str(mission.get("id", ""))
				if not bool(claimed.get(mission_id_active, false)) and float(campaign_kills.get(mission_id_active, 0)) > 0.0:
					player["activeCampaignMission"] = mission_id_active
					break
		version = 12
	if version < 13:
		var inventory_v13: Array = player.get("inventory", []) if player.get("inventory", []) is Array else []
		var equipped_v13: Dictionary = player.get("equipped", {}) if player.get("equipped", {}) is Dictionary else {}
		for mapping in [["helmet", "head"], ["armor", "chest"], ["gloves", "hands"], ["boots", "legs"]]:
			var old_slot_v13: String = mapping[0]
			var default_slot_v13: String = mapping[1]
			var instance_v13: Variant = equipped_v13.get(old_slot_v13, null)
			if instance_v13 == null:
				equipped_v13.erase(old_slot_v13)
				continue
			var item_id_v13 := str(instance_v13) if instance_v13 is String else str(instance_v13.get("id", "")) if instance_v13 is Dictionary else ""
			var destination_v13 := "amulet" if item_id_v13 == "crystal-amulet" else "back" if item_id_v13 == "ranger-cloak" else default_slot_v13
			if not equipped_v13.get(destination_v13, null): equipped_v13[destination_v13] = instance_v13
			else: inventory_v13.append(instance_v13)
			equipped_v13.erase(old_slot_v13)
		for slot in ["weapon", "head", "shoulders", "chest", "back", "wrists", "hands", "legs", "ring1", "ring2", "amulet", "seal"]:
			if not equipped_v13.has(slot): equipped_v13[slot] = null
			var instance_slot_v13: Variant = equipped_v13[slot]
			if instance_slot_v13 is String: equipped_v13[slot] = {"id": instance_slot_v13, "qty": 1, "runes": []}
			elif instance_slot_v13 is Dictionary and not instance_slot_v13.get("runes", null) is Array: instance_slot_v13["runes"] = []
		for inventory_instance_v13 in inventory_v13:
			if inventory_instance_v13 is Dictionary and inventory_instance_v13.has("id") and not inventory_instance_v13.has("qty"): inventory_instance_v13["qty"] = 1
		if not player.get("campaignShards", null) is Dictionary: player["campaignShards"] = {}
		for shard in ["forest", "ruins", "shadow"]:
			if bool(game.get("shards", {}).get(shard, false)): player.campaignShards[shard] = true
		player["inventory"] = inventory_v13
		player["equipped"] = equipped_v13
		version = 13
	if version < 14:
		var dragons: Dictionary = game.get("storyDragons", {}) if game.get("storyDragons", {}) is Dictionary else {}
		for id in ["ash-herald", "ice-grasp", "blood-crown"]:
			if dragons.get(id, false) != true: dragons[id] = false
		game["storyDragons"] = dragons
		var shards: Dictionary = game.get("storyShards", {}) if game.get("storyShards", {}) is Dictionary else {}
		for id in ["flame", "ice", "blood"]:
			if shards.get(id, false) != true: shards[id] = false
		game["storyShards"] = shards
		version = 14
	if version < 15:
		var level := maxi(1, int(floor(float(player.get("level", 1)))))
		player["luck"] = minf(100.0, 5.0 + float(level - 1) * 0.5)
		version = 15
	if version < 16:
		var inventory_v16: Array = player.get("inventory", []) if player.get("inventory", []) is Array else []
		var equipped_v16: Dictionary = player.get("equipped", {}) if player.get("equipped", {}) is Dictionary else {}
		for mapping in [["back", "cloak"], ["wrists", "gloves"], ["seal", "amulet"]]:
			var old_slot_v16: String = mapping[0]
			var new_slot_v16: String = mapping[1]
			var instance_move_v16: Variant = equipped_v16.get(old_slot_v16, null)
			if instance_move_v16 == null:
				equipped_v16.erase(old_slot_v16)
				continue
			if not equipped_v16.get(new_slot_v16, null): equipped_v16[new_slot_v16] = instance_move_v16
			else: inventory_v16.append(instance_move_v16)
			equipped_v16.erase(old_slot_v16)
		for old_slot_special_v16 in ["hands", "legs"]:
			var instance_special_v16: Variant = equipped_v16.get(old_slot_special_v16, null)
			if instance_special_v16 == null:
				equipped_v16.erase(old_slot_special_v16)
				continue
			var item_id_v16 := str(instance_special_v16) if instance_special_v16 is String else str(instance_special_v16.get("id", "")) if instance_special_v16 is Dictionary else ""
			var new_slot_v16 := ("shield" if item_id_v16 == "tower-shield" else "gloves") if old_slot_special_v16 == "hands" else ("boots" if item_id_v16 == "windstep-boots" else "legs")
			if not equipped_v16.get(new_slot_v16, null): equipped_v16[new_slot_v16] = instance_special_v16
			else: inventory_v16.append(instance_special_v16)
			equipped_v16.erase(old_slot_special_v16)
		for slot in ["weapon", "head", "shoulders", "chest", "gloves", "legs", "boots", "shield", "ring1", "ring2", "amulet", "cloak"]:
			if not equipped_v16.has(slot): equipped_v16[slot] = null
			var instance_slot_v16: Variant = equipped_v16[slot]
			if instance_slot_v16 is String: equipped_v16[slot] = {"id": instance_slot_v16, "qty": 1, "runes": [], "sockets": 0}
			elif instance_slot_v16 is Dictionary and not instance_slot_v16.get("runes", null) is Array: instance_slot_v16["runes"] = []
		player["inventory"] = inventory_v16
		player["equipped"] = equipped_v16
		version = 16
	if version < 17:
		var inventory: Array = player.get("inventory", []) if player.get("inventory", []) is Array else []
		for index in range(inventory.size()):
			var entry: Variant = inventory[index]
			if entry == "mana-crystal": inventory[index] = {"id": "old-archive-seal", "qty": 1}
			elif entry is Dictionary and entry.get("id", "") == "mana-crystal": entry["id"] = "old-archive-seal"
		player["inventory"] = inventory
		version = 17
	game[hero_key] = player
	game["version"] = version
