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

	var browser_payload := {
		"version": 18,
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
			"browserOnlyPlayerFlag": {"keep": true}
		},
		"storyShards": {"flame": true, "ice": false, "blood": false},
		"storyDragons": {"ash-herald": true},
		"world": {
			"seed": 424242, "generatorVersion": 1, "discoveredRegions": ["village", "forest"],
			"unlockedRoutes": [], "currentRegionId": "forest",
			"browserWorldExtension": {"keep": 77}
		},
		"factions": {"reputation": {"wardens": 35}, "changeLog": [{"faction": "wardens", "delta": 5}]},
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
		if int(native_world.get("factions", {}).get("reputation", {}).get("wardens", 0)) != 35:
			failures.append("browser faction reputation must remain available in native state")
		if not bool(native_world.get("storyShards", {}).get("flame", false)):
			failures.append("browser story shard progress must map into native state")
		hero["gold"] = 10001
		native_world["hero"] = hero
		native_world["clockMinutes"] = 210
		var exported := Repository.to_browser_payload(native_world)
		if exported.is_empty() or int(exported.get("player", {}).get("gold", 0)) != 10001:
			failures.append("native hero changes must be reflected in browser export")
		if exported.get("browserRootExtension", {}).get("opaque", "") != "preserve":
			failures.append("unknown browser root fields must survive native round-trip")
		if exported.get("player", {}).get("browserOnlyPlayerFlag", {}).get("keep", false) != true:
			failures.append("unknown browser player fields must survive native round-trip")
		if exported.get("world", {}).get("browserWorldExtension", {}).get("keep", 0) != 77:
			failures.append("unknown browser world fields must survive native round-trip")
		if int(exported.get("world", {}).get("clockMinutes", 0)) != 210:
			failures.append("native world changes must be reflected in browser export")
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
