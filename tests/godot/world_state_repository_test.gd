extends SceneTree

const Repository = preload("res://godot/scripts/world_state_repository.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")
const SaveRepository = preload("res://godot/scripts/save_repository.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var path: String = Repository.WORLD_PATH
	var backup_path := path + ".bak"
	var temporary_path := path + ".tmp"
	for candidate in [path, backup_path, temporary_path, "user://shards_browser_export_test.json", "user://shards_browser_export_test.json.bak", "user://shards_browser_export_test.json.tmp"]:
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

	var browser_payload := {
		"version": 18,
		"location": "camp",
		"worldSeed": 424242,
		"worldGeneratorVersion": 1,
		"player": {
			"name": "Imported mage", "class": "mage", "level": 23, "ngPlus": 2, "gold": 9876,
			"hp": 180, "maxHp": 220, "mp": 140, "maxMp": 160,
			"str": 8, "int": 44, "wis": 21, "con": 15, "dex": 19, "luck": 17.5,
			"exp": 321, "statPoints": 4, "passivePoints": 6, "playtimeSec": 12345,
			"inventory": [{"id": "health-potion", "qty": 7}], "spells": ["fireball"],
			"equipped": {"weapon": {"id": "oak-staff", "qty": 1}},
			"stats": {"kills": {"wolf": 12}, "deaths": 2},
			"campaignKills": {"wolf": 8}, "campaignClaimed": {"chapter-1": true},
			"activeCampaignByBranch": {"main": "chapter-2"}, "activeCampaignMission": "chapter-2",
			"browserOnlyPlayerFlag": {"keep": true},
			"craftingJobs": [{"id": "pending-camp-order", "result": "health-potion", "qty": 2, "readyAt": 987654321}]
		},
		"storyShards": {"flame": true, "ice": false, "blood": false},
		"storyDragons": {"ash-herald": true},
		"world": {
			"seed": 424242, "generatorVersion": 1, "discoveredRegions": ["village", "forest"],
			"unlockedRoutes": [], "currentRegionId": "forest",
			"browserWorldExtension": {"keep": 77}
		},
		"factions": {"reputation": {"hub-guardians": 35}, "changeLog": [{"faction": "wardens", "delta": 5}]},
		"browserRootExtension": {"opaque": "preserve"}
	}
	var native_world := Repository.from_browser_payload(browser_payload)
	if native_world.is_empty():
		failures.append("valid browser v18 snapshot must map into native runtime state")
	else:
		var hero: Dictionary = native_world.get("hero", {})
		if str(hero.get("name", "")) != "Imported mage" or int(hero.get("level", 0)) != 23 or int(hero.get("gold", 0)) != 9876:
			failures.append("browser player progression must become the native hero without loss")
		if int(native_world.get("seed", 0)) != 424242 or str(native_world.get("currentRegionId", "")) != "forest":
			failures.append("browser world seed and exploration position must map into native world")
		if str(native_world.get("location", "")) != "camp" or native_world.get("hero", {}).get("craftingJobs", []).size() != 1:
			failures.append("camp location and pending crafting orders must survive browser save import")
		if int(native_world.get("factions", {}).get("reputation", {}).get("hub-guardians", 0)) != 35:
			failures.append("browser faction reputation must remain available in native state")
		if not bool(native_world.get("storyShards", {}).get("flame", false)):
			failures.append("browser story shard progress must map into native state")
		hero["gold"] = 10001
		native_world["hero"] = hero
		native_world["clockMinutes"] = 210
		var exported := Repository.to_browser_payload(native_world)
		if exported.is_empty() or int(exported.get("player", {}).get("gold", 0)) != 10001:
			failures.append("native hero changes must be reflected in browser export")
		if str(exported.get("location", "")) != "camp" or exported.get("player", {}).get("craftingJobs", []).size() != 1:
			failures.append("camp location and pending crafting orders must survive native browser export")
		if exported.get("world", {}).has("location"):
			failures.append("top-level browser location must not leak into the world-state extension object")
		if exported.get("browserRootExtension", {}).get("opaque", "") != "preserve":
			failures.append("unknown browser root fields must survive native round-trip")
		if exported.get("player", {}).get("browserOnlyPlayerFlag", {}).get("keep", false) != true:
			failures.append("unknown browser player fields must survive native round-trip")
		if exported.get("world", {}).get("browserWorldExtension", {}).get("keep", 0) != 77:
			failures.append("unknown browser world fields must survive native round-trip")
		if int(exported.get("world", {}).get("clockMinutes", 0)) != 210:
			failures.append("native world changes must be reflected in browser export")
		if Repository.save_world(native_world) != OK:
			failures.append("browser-imported native state must persist to the world repository")
		else:
			var persisted_world := Repository.load_world()
			var persisted_export := Repository.to_browser_payload(persisted_world)
			if not SaveRepository.is_browser_v18_payload(persisted_export):
				failures.append("browser payload must remain valid after native disk save/load")
			if persisted_export.get("browserRootExtension", {}).get("opaque", "") != "preserve":
				failures.append("unknown browser fields must survive native disk save/load")
			if int(persisted_export.get("player", {}).get("gold", 0)) != 10001:
				failures.append("native hero progression must survive disk save/load and browser export")

	var native_first_world := WorldState.create(8675309)
	native_first_world["hero"] = {
		"name": "New native hero", "class": "warrior", "level": 1, "ngPlus": 0, "gold": 25,
		"hp": 120, "maxHp": 120, "mp": 30, "maxMp": 30,
		"str": 12, "int": 5, "wis": 5, "con": 12, "dex": 7, "luck": 5,
		"exp": 0, "statPoints": 0, "passivePoints": 0,
		"inventory": [], "spells": [], "equipped": {}, "stats": {"kills": {}},
		"campaignKills": {}, "campaignClaimed": {}, "activeCampaignByBranch": {},
		"activeCampaignMission": null
	}
	var native_first_export := Repository.to_browser_payload(native_first_world)
	if not SaveRepository.is_browser_v18_payload(native_first_export):
		failures.append("a new native-first game must export as a valid browser v18 save")
	elif str(native_first_export.get("player", {}).get("name", "")) != "New native hero":
		failures.append("native-first export must preserve the current hero identity")
	var export_path := "user://shards_browser_export_test.json"
	if Repository.export_browser_payload(export_path, native_first_world) != OK:
		failures.append("browser export must write through the atomic repository path")
	else:
		var export_file := FileAccess.open(export_path, FileAccess.READ)
		var exported_text := export_file.get_as_text() if export_file != null else ""
		if export_file != null:
			export_file.close()
		var disk_export: Variant = JSON.parse_string(exported_text)
		if not disk_export is Dictionary or not SaveRepository.is_browser_v18_payload(disk_export):
			failures.append("atomic browser export must produce a complete valid v18 file")
		if disk_export is Dictionary and str(disk_export.get("player", {}).get("name", "")) != "New native hero":
			failures.append("atomic browser export must preserve the native hero")
	if Repository.export_browser_payload("", native_first_world) != ERR_INVALID_PARAMETER:
		failures.append("browser export must reject an empty destination path")
	var invalid_browser := browser_payload.duplicate(true)
	invalid_browser.world.erase("unlockedRoutes")
	if not Repository.from_browser_payload(invalid_browser).is_empty():
		failures.append("invalid browser payload must not enter the native runtime")

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
		print("PASS: atomic world saves, browser/native save mapping and interrupted-write recovery")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
