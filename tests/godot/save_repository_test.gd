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
	if not migrated.get("world", {}) is Dictionary or not bool(migrated.world.get("legacyFastTravel", false)):
		failures.append("v17 migration must initialize legacy world exploration and fast travel")
	if not migrated.get("factions", {}).get("reputation", {}) is Dictionary or migrated.factions.reputation.get("free-traders", -1) != 0:
		failures.append("v17 migration must initialize all faction reputation records")
	var faction_migration := SaveRepo.migrate_payload({"version":17,"player":{"name":"Faction migration","level":1},"factions":{"reputation":{"hub-guardians":12.6,"rift-cult":-1.5,"free-traders":"42","ash-nomads":"not-a-number","unknown":99},"changeLog":[{"factionId":"rift-cult","delta":2},"invalid",{"factionId":"unknown"}]}})
	var migrated_factions: Dictionary = faction_migration.get("factions", {})
	var migrated_reputation: Dictionary = migrated_factions.get("reputation", {})
	var migrated_log: Array = migrated_factions.get("changeLog", [])
	if migrated_reputation.get("hub-guardians", 0) != 13 or migrated_reputation.get("rift-cult", 0) != -1 or migrated_reputation.get("free-traders", 0) != 42 or migrated_reputation.get("ash-nomads", 1) != 0:
		failures.append("v17 faction migration must match runtime Number/Math.round normalization for numeric, string, and invalid values")
	if migrated_reputation.has("unknown") or migrated_log.size() != 1 or migrated_log[0].get("factionId", "") != "rift-cult":
		failures.append("v17 faction migration must discard unknown reputation keys and invalid change-log entries")
	if migrated_player.get("activeCampaignByBranch", {}).get("intro", "") != "a1-m1":
		failures.append("v17 migration must preserve the legacy active campaign mission in its branch")
	if int(migrated_player.get("expNext", 0)) != 269:
		failures.append("v17 migration must rebase XP thresholds to the current level curve")
	var stable_seed_a := SaveRepo.migrate_payload({"version":17,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	var stable_seed_b := SaveRepo.migrate_payload({"version":17,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	if int(stable_seed_a.get("worldSeed", 0)) != int(stable_seed_b.get("worldSeed", -1)) or int(stable_seed_a.get("worldSeed", 0)) <= 0:
		failures.append("v17 migration must derive a stable non-zero world seed")
	var unicode_seed := SaveRepo.migrate_payload({"version":17,"player":{"name":"Hero 😀","class":"mage","createdAt":12345,"level":1},"location":"village"})
	if int(unicode_seed.get("worldSeed", 0)) != 2033595329:
		failures.append("v17 migration must hash supplementary Unicode names using browser-compatible UTF-16 code units")
	var invalid_seed_string := SaveRepo.migrate_payload({"version":17,"worldSeed":"9876","player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	var invalid_seed_fraction := SaveRepo.migrate_payload({"version":17,"worldSeed":9876.5,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	var invalid_location_type := SaveRepo.migrate_payload({"version":17,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":42})
	var default_location := SaveRepo.migrate_payload({"version":17,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	if int(invalid_seed_string.get("worldSeed", 0)) != int(default_location.get("worldSeed", -1)) or int(invalid_seed_fraction.get("worldSeed", 0)) != int(default_location.get("worldSeed", -1)):
		failures.append("v18 migration must derive a seed instead of coercing string or fractional worldSeed values")
	if int(invalid_location_type.get("worldSeed", 0)) != int(default_location.get("worldSeed", -1)):
		failures.append("v18 migration must use the browser village fallback for non-string locations")
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
	var version_one := SaveRepo.migrate_payload({
		"version": 1,
		"location": "village",
		"shards": {"forest": true},
		"player": {
			"name": "Ancient hero", "class": "warrior", "level": 10, "gold": 75,
			"hp": 50, "maxHp": 50, "mp": 0, "maxMp": 0,
			"equipped": {"helmet": "iron-helm", "hands": "tower-shield"},
			"inventory": ["mana-crystal"], "campaignKills": {"a1-m1": 3},
			"activeCampaignMission": "a1-m2"
		}
	})
	var version_one_player: Dictionary = version_one.get("player", {})
	if int(version_one.get("version", -1)) != 18:
		failures.append("v1 browser save must migrate through every schema boundary to v18")
	if version_one_player.get("equipped", {}).get("head", {}).get("id", "") != "iron-helm":
		failures.append("legacy equipment slots must be normalized without losing equipped items")
	if version_one_player.get("equipped", {}).get("shield", {}).get("id", "") != "tower-shield":
		failures.append("legacy hand equipment must identify and preserve the tower shield")
	if version_one_player.get("inventory", []).is_empty() or version_one_player.inventory[0].get("id", "") != "old-archive-seal":
		failures.append("v17 token migration must rename Mana Crystal to the archive seal")
	if float(version_one_player.get("luck", 0)) != 9.5:
		failures.append("v15 migration must backfill level-scaled luck")
	if version_one_player.get("campaignShards", {}).get("forest", false) != true:
		failures.append("v13 migration must preserve legacy campaign shard progress")
	if version_one_player.get("activeCampaignByBranch", {}).get("intro", "") != "a1-m2":
		failures.append("v18 migration must map the legacy active mission to its campaign branch")
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
	browser_payload["extensionData"] = {"customQuestFlag": true, "opaqueCounter": 73}
	if SaveRepo.import_browser_save(TEST_SLOT, JSON.stringify(browser_payload)) != OK:
		failures.append("valid browser v18 payload must import into a Godot slot")
	var imported_browser := SaveRepo.load_slot(TEST_SLOT)
	if imported_browser.get("extensionData", {}).get("customQuestFlag", false) != true or int(imported_browser.get("extensionData", {}).get("opaqueCounter", 0)) != 73:
		failures.append("browser import must preserve unknown extension data")
	var exported_browser_text := SaveRepo.export_browser_save(TEST_SLOT)
	var exported_browser: Variant = JSON.parse_string(exported_browser_text)
	if not exported_browser is Dictionary or not SaveRepo.is_browser_v18_payload(exported_browser):
		failures.append("browser export must produce a valid v18 payload")
	elif exported_browser.get("extensionData", {}).get("customQuestFlag", false) != true:
		failures.append("browser export must preserve extension data")
	if exported_browser is Dictionary and exported_browser != browser_payload:
		failures.append("browser import/export must preserve the complete payload, including nested and unknown fields")
	var interrupted_save := browser_payload.duplicate(true)
	interrupted_save.player.name = "Recovered browser hero"
	var backup_path := TEST_PATH + ".bak"
	var primary_file := FileAccess.open(TEST_PATH, FileAccess.WRITE)
	if primary_file != null:
		primary_file.store_string("{corrupt")
		primary_file.close()
	var backup_file := FileAccess.open(backup_path, FileAccess.WRITE)
	if backup_file != null:
		backup_file.store_string(JSON.stringify(interrupted_save))
		backup_file.close()
	var recovered := SaveRepo.load_slot(TEST_SLOT)
	if str(recovered.get("player", {}).get("name", "")) != "Recovered browser hero":
		failures.append("save slot must recover the last valid backup after an interrupted replacement")
	if FileAccess.file_exists(TEST_PATH) and FileAccess.file_exists(backup_path):
		failures.append("successful save recovery must restore the primary and consume the backup")
	var invalid_import := browser_payload.duplicate(true)
	invalid_import.world.erase("unlockedRoutes")
	if SaveRepo.import_browser_save(TEST_SLOT, JSON.stringify(invalid_import)) != ERR_INVALID_DATA:
		failures.append("invalid browser payload must be rejected during import")
	if SaveRepo.load_slot(TEST_SLOT).get("extensionData", {}).get("customQuestFlag", false) != true:
		failures.append("rejected browser import must not overwrite the healthy slot")


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

	for candidate in [TEST_PATH, TEST_PATH + ".tmp", TEST_PATH + ".bak"]:
		if FileAccess.file_exists(candidate):
			var remove_error := DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))
			if remove_error != OK:
				failures.append("test save file cleanup failed (error %d)" % remove_error)

	if failures.is_empty():
		print("PASS: save repository slot bounds, version guard and JSON field round-trip")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
