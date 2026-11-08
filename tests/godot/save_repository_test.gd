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
	if SaveRepo.save_slot(TEST_SLOT, {"version": 18}) != ERR_INVALID_DATA:
		failures.append("v18 payload without a hero record must be rejected before writing")
	if SaveRepo.save_slot(TEST_SLOT, {"version": 18.5, "player": {"name": "Bad version"}}) != ERR_INVALID_DATA:
		failures.append("fractional versions must be rejected by save_slot")
	if SaveRepo.save_slot(TEST_SLOT, {"version": "18", "player": {"name": "String version"}}) != ERR_INVALID_DATA:
		failures.append("string versions must be rejected by save_slot")

	var legacy_payload := {"version":17,"player":{"name":"Legacy hero","level":27,"gold":900,"campaignClaimed":{"a1-m1":true},"customFlag":"keep"},"worldSeed":9876}
	var migrated := SaveRepo.migrate_payload(legacy_payload)
	var migrated_player: Dictionary = migrated.get("player", {})
	if int(migrated.get("version", -1)) != 18 or int(migrated_player.get("level", 0)) != 27 or int(migrated_player.get("gold", 0)) != 900:
		failures.append("v17 migration must preserve existing player progress")
	if migrated_player.get("customFlag", "") != "keep" or migrated_player.get("campaignClaimed", {}).get("a1-m1", false) != true:
		failures.append("v17 migration must preserve unknown fields and campaign claims")
	if not migrated_player.get("storyShards", {}) is Dictionary or not migrated_player.get("campaignKills", {}) is Dictionary:
		failures.append("v17 migration must initialize missing progression containers")
	if not SaveRepo.migrate_payload({"version":16}).is_empty():
		failures.append("unsupported v16 payload must not be migrated blindly")
	if not SaveRepo.migrate_payload({"version":18.5,"player":{"name":"Fractional version"}}).is_empty():
		failures.append("fractional save versions must be rejected")
	if not SaveRepo.migrate_payload({"version":"18","player":{"name":"String version"}}).is_empty():
		failures.append("string save versions must be rejected")
	if not SaveRepo.migrate_payload({"version":17,"worldSeed":9876}).is_empty():
		failures.append("v17 payload without a hero record must be rejected")
	if not SaveRepo.migrate_payload({"version":17,"player":"corrupt"}).is_empty():
		failures.append("v17 payload with a malformed player record must be rejected")
	if not SaveRepo.migrate_payload({"version":18,"player":null}).is_empty():
		failures.append("v18 payload without a valid player record must be rejected")
	var hero_alias := SaveRepo.migrate_payload({"version":17,"hero":{"name":"Legacy alias","level":9}})
	if int(hero_alias.get("version",-1)) != 18 or hero_alias.get("hero",{}).get("name","") != "Legacy alias":
		failures.append("v17 hero alias must migrate without renaming or losing its data")


	var browser_payload := {
		"version": 18,
		"worldSeed": 123456,
		"worldGeneratorVersion": 1,
		"player": {
			"name": "Browser fixture", "class": "mage", "level": 12, "ngPlus": 0, "gold": 250,
			"hp": 80, "maxHp": 100, "mp": 40, "maxMp": 60,
			"str": 5, "int": 20, "wis": 12, "con": 8, "dex": 10, "luck": 10.5,
			"exp": 120, "statPoints": 2, "passivePoints": 3,
			"inventory": [{"id": "health-potion", "qty": 2}], "spells": ["fireball"],
			"equipped": {}, "stats": {"kills": {}}, "campaignKills": {},
			"campaignClaimed": {}, "activeCampaignByBranch": {}, "activeCampaignMission": null
		},
		"storyShards": {}, "storyDragons": {},
		"world": {"seed": 123456, "generatorVersion": 1, "discoveredRegions": ["village"], "unlockedRoutes": []},
		"factions": {"reputation": {}, "changeLog": []}
	}
	if not SaveRepo.is_browser_v18_payload(browser_payload):
		failures.append("complete browser v18 contract fixture must be accepted")
	var incomplete_browser_payload := browser_payload.duplicate(true)
	incomplete_browser_payload.world.erase("unlockedRoutes")
	if SaveRepo.is_browser_v18_payload(incomplete_browser_payload):
		failures.append("browser v18 payload missing world routes must be rejected")
	var fractional_browser_version := browser_payload.duplicate(true)
	fractional_browser_version.version = 18.5
	if SaveRepo.is_browser_v18_payload(fractional_browser_version):
		failures.append("browser v18 contract must reject fractional versions")
	var invalid_browser_item := browser_payload.duplicate(true)
	invalid_browser_item.player.inventory = [{"qty": 0}]
	if SaveRepo.is_browser_v18_payload(invalid_browser_item):
		failures.append("browser v18 contract must reject inventory entries without valid ids")

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
		var replacement := payload.duplicate(true)
		replacement.player.name = "Replacement hero"
		if SaveRepo.save_slot(TEST_SLOT, replacement) != OK:
			failures.append("valid replacement save must succeed")
		var replaced := SaveRepo.load_slot(TEST_SLOT)
		if str(replaced.get("player", {}).get("name", "")) != "Replacement hero":
			failures.append("atomic replacement must expose the complete new save")
		if SaveRepo.save_slot(TEST_SLOT, {"version": 18}) != ERR_INVALID_DATA:
			failures.append("invalid replacement must be rejected")
		var preserved := SaveRepo.load_slot(TEST_SLOT)
		if str(preserved.get("player", {}).get("name", "")) != "Replacement hero":
			failures.append("rejected replacement must leave the previous healthy slot intact")

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
