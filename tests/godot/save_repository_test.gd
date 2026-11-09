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

	# Exercise every supported browser schema entry point, not only the
	# immediately previous version. Each fixture must reach v18 while keeping
	# opaque top-level extension data intact.
	for source_version in range(0, SaveRepo.SAVE_VERSION):
		var matrix_fixture := {
			"version": source_version,
			"player": {"name": "Legacy v%d hero" % source_version, "class": "warrior", "level": 1},
			"migrationFixture": {"sourceVersion": source_version, "opaque": true}
		}
		var matrix_result := SaveRepo.migrate_payload(matrix_fixture)
		if int(matrix_result.get("version", -1)) != SaveRepo.SAVE_VERSION:
			failures.append("browser save version %d must migrate to v18" % source_version)
		if matrix_result.get("migrationFixture", {}).get("sourceVersion", -1) != source_version or matrix_result.get("migrationFixture", {}).get("opaque", false) != true:
			failures.append("browser save version %d must preserve unknown top-level extension data" % source_version)
		if not matrix_result.get("player", null) is Dictionary or not matrix_result.get("world", null) is Dictionary:
			failures.append("browser save version %d must produce a native-compatible v18 hero and world" % source_version)

	var legacy_payload := {"version":17,"player":{"name":"Legacy hero","level":27,"gold":900,"campaignClaimed":{"a1-m1":true},"activeCampaignMission":"a1-m2","customFlag":"keep"},"worldSeed":9876}
	var migrated := SaveRepo.migrate_payload(legacy_payload)
	var migrated_player: Dictionary = migrated.get("player", {})
	var integral_float_timestamp := legacy_payload.duplicate(true)
	integral_float_timestamp.erase("worldSeed")
	integral_float_timestamp.player.createdAt = 1700000000000.0
	var integer_timestamp := legacy_payload.duplicate(true)
	integer_timestamp.erase("worldSeed")
	integer_timestamp.player.createdAt = 1700000000000
	var float_timestamp_migration := SaveRepo.migrate_payload(integral_float_timestamp)
	var integer_timestamp_migration := SaveRepo.migrate_payload(integer_timestamp)
	if int(float_timestamp_migration.get("worldSeed", 0)) != int(integer_timestamp_migration.get("worldSeed", -1)):
		failures.append("legacy seed derivation must treat browser-safe integral float timestamps like integer timestamps")
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
	# Existing v18 browser saves must receive the same normalization as the
	# browser runtime, not bypass the migration pipeline merely because their
	# version marker is current.
	var current_v18 := {
		"version":18,
		"worldSeed":123456,
		"worldGeneratorVersion":1,
		"player":{
			"name":"Current v18 hero","class":"mage","level":12,"exp":150,"expNext":300,"ngPlus":-2,
			"activeCampaignMission":"a3-m2","activeCampaignByBranch":{"intro":"a1-m1"}
		},
		"world":{"seed":123456,"generatorVersion":1,"discoveredRegions":["village"],"unlockedRoutes":[]},
		"factions":{"reputation":{"hub-guardians":12.6,"rift-cult":-1.5,"free-traders":"42","ash-nomads":"bad"},"changeLog":["opaque-v18-entry"]}
	}
	var normalized_v18 := SaveRepo.migrate_payload(current_v18)
	var integral_float_experience_v18 := current_v18.duplicate(true)
	integral_float_experience_v18.player.level = 12.0
	integral_float_experience_v18.player.exp = 150.0
	integral_float_experience_v18.player.expNext = 300.0
	integral_float_experience_v18.player.ngPlus = 2.0
	var normalized_integral_float_experience_v18 := SaveRepo.migrate_payload(integral_float_experience_v18)
	var stale_world_metadata_v18 := SaveRepo.migrate_payload({
		"version":18,"worldSeed":999,"worldGeneratorVersion":9,
		"player":{"name":"Stale metadata hero","class":"mage","level":1},
		"world":{"seed":456789,"generatorVersion":1,"discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if int(stale_world_metadata_v18.get("worldSeed", 0)) != 456789 or int(stale_world_metadata_v18.get("worldGeneratorVersion", 0)) != 1:
		failures.append("current v18 normalization must synchronize root seed and generator metadata with the normalized world")

	var missing_world_generator_v18 := SaveRepo.migrate_payload({
		"version":18,
		"worldSeed":456789,
		"worldGeneratorVersion":3.0,
		"player":{"name":"Missing world generator hero","class":"mage","level":1},
		"world":{"seed":456789,"currentRegionId":"village","discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if int(missing_world_generator_v18.get("worldGeneratorVersion", 0)) != 3 or int(missing_world_generator_v18.get("world", {}).get("generatorVersion", 0)) != 3:
		failures.append("v18 migration must use the root generator fallback when the saved world version is missing")
	var fractional_world_generator_v18 := SaveRepo.migrate_payload({
		"version":18,
		"worldSeed":456789,
		"worldGeneratorVersion":3,
		"player":{"name":"Fractional world generator hero","class":"mage","level":1},
		"world":{"seed":456789,"generatorVersion":2.5,"currentRegionId":"village","discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if int(fractional_world_generator_v18.get("worldGeneratorVersion", 0)) != 2 or int(fractional_world_generator_v18.get("world", {}).get("generatorVersion", 0)) != 2:
		failures.append("v18 migration must floor fractional world generator versions and mirror the normalized integer")
	var unsafe_nested_generator_v18 := SaveRepo.migrate_payload({
		"version":18,
		"worldSeed":456789,
		"worldGeneratorVersion":4,
		"player":{"name":"Unsafe nested generator hero","class":"mage","level":1},
		"world":{"seed":456789,"generatorVersion":9007199254740992.0,"currentRegionId":"village","discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if int(unsafe_nested_generator_v18.get("worldGeneratorVersion", 0)) != 4 or int(unsafe_nested_generator_v18.get("world", {}).get("generatorVersion", 0)) != 4:
		failures.append("v18 migration must use the safe root generator fallback when nested metadata is unsafe")
	var fractional_root_seed_v18 := SaveRepo.migrate_payload({
		"version":18,"worldSeed":123.5,
		"player":{"name":"Fractional root seed hero","class":"mage","level":1}
	})
	var missing_root_seed_v18 := SaveRepo.migrate_payload({
		"version":18,
		"player":{"name":"Fractional root seed hero","class":"mage","level":1}
	})
	if int(fractional_root_seed_v18.get("worldSeed", 0)) != int(missing_root_seed_v18.get("worldSeed", -1)):
		failures.append("current v18 migration must not truncate a fractional root world seed into a valid seed")
	var unsafe_root_seed_v18 := SaveRepo.migrate_payload({
		"version":18,"worldSeed":9007199254740992.0,
		"player":{"name":"Unsafe root seed hero","class":"mage","level":1}
	})
	var missing_unsafe_root_seed_v18 := SaveRepo.migrate_payload({
		"version":18,
		"player":{"name":"Unsafe root seed hero","class":"mage","level":1}
	})
	if int(unsafe_root_seed_v18.get("worldSeed", 0)) != int(missing_unsafe_root_seed_v18.get("worldSeed", -1)):
		failures.append("current v18 migration must reject unsafe root world seeds instead of overflowing integer conversion")
	var normalized_v18_player: Dictionary = normalized_v18.get("player", {})
	var normalized_v18_world: Dictionary = normalized_v18.get("world", {})
	var normalized_v18_factions: Dictionary = normalized_v18.get("factions", {})
	if int(normalized_v18_world.get("schemaVersion", 0)) != 1 or bool(normalized_v18_world.get("legacyFastTravel", true)):
		failures.append("current v18 world state must be normalized without enabling legacy fast travel")
	if normalized_v18_player.get("activeCampaignByBranch", {}).get("ash", "") != "a3-m2" or normalized_v18_player.get("activeCampaignByBranch", {}).get("intro", "") != "a1-m1":
		failures.append("current v18 campaign branches must preserve existing branch state and recover the legacy active mission")
	if int(normalized_v18_player.get("expNext", 0)) != 259 or int(normalized_v18_player.get("exp", -1)) != 129 or int(normalized_v18_player.get("ngPlus", -1)) != 0:
		failures.append("current v18 saves must rebase XP and normalize malformed NG+ values")
	var normalized_float_experience_player: Dictionary = normalized_integral_float_experience_v18.get("player", {})
	if int(normalized_float_experience_player.get("expNext", 0)) != 259 or int(normalized_float_experience_player.get("exp", -1)) != 129:
		failures.append("current v18 migration must rebase browser-safe integral float level, exp, and expNext values")
	if int(normalized_float_experience_player.get("ngPlus", -1)) != 2:
		failures.append("current v18 migration must preserve browser-safe integral float NG+ values")
	var normalized_v18_reputation: Dictionary = normalized_v18_factions.get("reputation", {})
	if normalized_v18_reputation.get("hub-guardians", 0) != 13 or normalized_v18_reputation.get("rift-cult", 0) != -1 or normalized_v18_reputation.get("free-traders", 0) != 42 or normalized_v18_reputation.get("ash-nomads", 1) != 0:
		failures.append("current v18 faction reputation must use browser-compatible normalization")
	if normalized_v18_factions.get("changeLog", []) != ["opaque-v18-entry"]:
		failures.append("current v18 faction history must preserve opaque legacy entries")
	var current_v18_without_world := current_v18.duplicate(true)
	current_v18_without_world.erase("world")
	var normalized_v18_without_world := SaveRepo.migrate_payload(current_v18_without_world)
	if not bool(normalized_v18_without_world.get("world", {}).get("legacyFastTravel", false)):
		failures.append("current v18 payload without world state must initialize the legacy travel compatibility mode")

	# Browser ensureWorldState falls back to the legacy root location whenever
	# the saved world has no valid currentRegionId; a valid saved region wins.
	var legacy_location_fallback_v17 := SaveRepo.migrate_payload({
		"version":17,
		"location":"forest",
		"player":{"name":"Legacy location hero","class":"mage","level":1}
	})
	var legacy_location_world: Dictionary = legacy_location_fallback_v17.get("world", {})
	if legacy_location_world.get("currentRegionId", "") != "forest" or int(legacy_location_world.get("regionVisits", {}).get("forest", 0)) != 1:
		failures.append("v17 migration must restore the root legacy location when creating world state")
	var invalid_world_location_fallback_v18 := SaveRepo.migrate_payload({
		"version":18,
		"worldSeed":123456,
		"location":"ruins",
		"player":{"name":"Invalid world location hero","class":"mage","level":1},
		"world":{"seed":123456,"generatorVersion":1,"currentRegionId":"missing-region","discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	var invalid_world_location: Dictionary = invalid_world_location_fallback_v18.get("world", {})
	if invalid_world_location.get("currentRegionId", "") != "ruins" or int(invalid_world_location.get("regionVisits", {}).get("ruins", 0)) != 1:
		failures.append("v18 migration must fall back to root location when saved currentRegionId is invalid")
	var valid_world_location_priority_v18 := SaveRepo.migrate_payload({
		"version":18,
		"worldSeed":123456,
		"location":"forest",
		"player":{"name":"Saved world location hero","class":"mage","level":1},
		"world":{"seed":123456,"generatorVersion":1,"currentRegionId":"village","discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if valid_world_location_priority_v18.get("world", {}).get("currentRegionId", "") != "village":
		failures.append("v18 migration must prefer a valid saved world location over the legacy root location")

	var faction_migration := SaveRepo.migrate_payload({"version":17,"player":{"name":"Faction migration","level":1},"factions":{"reputation":{"hub-guardians":12.6,"rift-cult":-1.5,"free-traders":"42","ash-nomads":"not-a-number","unknown":99},"changeLog":[{"factionId":"rift-cult","delta":2},"invalid",{"factionId":"unknown"}]}})
	var migrated_factions: Dictionary = faction_migration.get("factions", {})
	var migrated_reputation: Dictionary = migrated_factions.get("reputation", {})
	var migrated_log: Array = migrated_factions.get("changeLog", [])
	if migrated_reputation.get("hub-guardians", 0) != 13 or migrated_reputation.get("rift-cult", 0) != -1 or migrated_reputation.get("free-traders", 0) != 42 or migrated_reputation.get("ash-nomads", 1) != 0:
		failures.append("v17 faction migration must match runtime Number/Math.round normalization for numeric, string, and invalid values")
	if migrated_reputation.has("unknown") or migrated_log.size() != 3 or migrated_log[0].get("factionId", "") != "rift-cult" or migrated_log[1] != "invalid" or migrated_log[2].get("factionId", "") != "unknown":
		failures.append("v17 faction migration must discard unknown reputation keys while preserving every legacy change-log entry")
	if migrated_player.get("activeCampaignByBranch", {}).get("intro", "") != "a1-m2":
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
	var integral_float_seed := SaveRepo.migrate_payload({"version":17,"worldSeed":9876.0,"worldGeneratorVersion":2.0,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	var invalid_location_type := SaveRepo.migrate_payload({"version":17,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":42})
	var default_location := SaveRepo.migrate_payload({"version":17,"player":{"name":"Seed hero","class":"mage","createdAt":12345,"level":1},"location":"village"})
	if int(invalid_seed_string.get("worldSeed", 0)) != int(default_location.get("worldSeed", -1)) or int(invalid_seed_fraction.get("worldSeed", 0)) != int(default_location.get("worldSeed", -1)):
		failures.append("v18 migration must derive a seed instead of coercing string or fractional worldSeed values")
	if int(integral_float_seed.get("worldSeed", 0)) != 9876 or int(integral_float_seed.get("worldGeneratorVersion", 0)) != 1:
		failures.append("legacy migration must mirror the canonical generator version of a newly created world")

	var existing_world_generator_v17 := SaveRepo.migrate_payload({
		"version":17,
		"worldSeed":9876,
		"worldGeneratorVersion":3.0,
		"player":{"name":"Existing world generator hero","class":"mage","createdAt":12345,"level":1},
		"world":{"seed":9876,"generatorVersion":2.0,"discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if int(existing_world_generator_v17.get("worldGeneratorVersion", 0)) != 2 or int(existing_world_generator_v17.get("world", {}).get("generatorVersion", 0)) != 2:
		failures.append("legacy migration must mirror the saved world's valid generator version over stale root metadata")

	var root_generator_fraction_v17 := SaveRepo.migrate_payload({
		"version":17,
		"worldSeed":9876,
		"worldGeneratorVersion":3.5,
		"player":{"name":"Root generator fallback hero","class":"mage","level":1},
		"world":{"seed":9876,"currentRegionId":"village","discoveredRegions":["village"],"unlockedRoutes":[]}
	})
	if int(root_generator_fraction_v17.get("worldGeneratorVersion", 0)) != 3 or int(root_generator_fraction_v17.get("world", {}).get("generatorVersion", 0)) != 3:
		failures.append("legacy migration must floor a finite fractional root generator fallback when nested version is missing")
	if int(invalid_location_type.get("worldSeed", 0)) != int(default_location.get("worldSeed", -1)):
		failures.append("v18 migration must use the browser village fallback for non-string locations")
	if not SaveRepo.migrate_payload({"version":16}).is_empty():
		failures.append("unsupported v16 payload must not be migrated blindly")
	if not SaveRepo.migrate_payload({"version":18.5,"player":{"name":"Fractional version"}}).is_empty():
		failures.append("fractional save versions must be rejected")
	var numeric_string_version := SaveRepo.migrate_payload({"version":"17","player":{"name":"Numeric string version","level":1}})
	if int(numeric_string_version.get("version", -1)) != 18:
		failures.append("legacy migration must coerce numeric string versions like browser Number()")
	var integral_float_version := SaveRepo.migrate_payload({"version":17.0,"player":{"name":"Integral float version","level":1}})
	if int(integral_float_version.get("version", -1)) != 18:
		failures.append("legacy migration must accept integral numeric versions like browser Number()")
	var hexadecimal_version := SaveRepo.migrate_payload({"version":"0x11","player":{"name":"Hexadecimal version","level":1}})
	if int(hexadecimal_version.get("version", -1)) != 18:
		failures.append("legacy migration must accept hexadecimal numeric strings like browser Number()")
	var binary_version := SaveRepo.migrate_payload({"version":"0b10001","player":{"name":"Binary version","level":1}})
	var octal_version := SaveRepo.migrate_payload({"version":"0o21","player":{"name":"Octal version","level":1}})
	if int(binary_version.get("version", -1)) != 18 or int(octal_version.get("version", -1)) != 18:
		failures.append("legacy migration must accept binary and octal numeric strings like browser Number()")
	if not SaveRepo.migrate_payload({"version":"0b102","player":{"name":"Invalid binary version","level":1}}).is_empty() or not SaveRepo.migrate_payload({"version":"0o18","player":{"name":"Invalid octal version","level":1}}).is_empty():
		failures.append("legacy migration must reject invalid binary and octal version digits")
	var empty_string_version := SaveRepo.migrate_payload({"version":"","player":{"name":"Empty string version","level":1}})
	var whitespace_version := SaveRepo.migrate_payload({"version":"  ","player":{"name":"Whitespace version","level":1}})
	var null_version := SaveRepo.migrate_payload({"version":null,"player":{"name":"Null version","level":1}})
	if int(empty_string_version.get("version", -1)) != 18 or int(whitespace_version.get("version", -1)) != 18 or int(null_version.get("version", -1)) != 18:
		failures.append("legacy migration must treat empty, whitespace, and null versions as browser Number() zero")
	if not SaveRepo.migrate_payload({"version":"eighteen","player":{"name":"Invalid string version"}}).is_empty():
		failures.append("legacy migration must reject non-numeric version strings")
	if not SaveRepo.migrate_payload({"version":true,"player":{"name":"Boolean version"}}).is_empty():
		failures.append("legacy migration must reject boolean versions")
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

	# Exercise every remaining legacy schema entry point independently. The
	# browser migration suite covers v1-v17; native migration must also accept
	# each starting version and preserve opaque extension data.
	for legacy_version in range(1, 17):
		var legacy_matrix_payload := {
			"version": legacy_version,
			"legacyExtension": {"versionMarker": legacy_version},
			"player": {
				"name": "Version %d hero" % legacy_version,
				"class": "mage",
				"level": 8,
				"gold": 321,
				"playerExtension": {"opaque": "retain"}
			}
		}
		var migrated_matrix_payload := SaveRepo.migrate_payload(legacy_matrix_payload)
		var migrated_matrix_player: Dictionary = migrated_matrix_payload.get("player", {})
		if int(migrated_matrix_payload.get("version", -1)) != 18:
			failures.append("legacy v%d payload must migrate sequentially to v18" % legacy_version)
		if str(migrated_matrix_player.get("name", "")) != "Version %d hero" % legacy_version:
			failures.append("legacy v%d migration must preserve the player identity" % legacy_version)
		if migrated_matrix_payload.get("legacyExtension", {}).get("versionMarker", -1) != legacy_version:
			failures.append("legacy v%d migration must preserve unknown root extensions" % legacy_version)
		if migrated_matrix_player.get("playerExtension", {}).get("opaque", "") != "retain":
			failures.append("legacy v%d migration must preserve unknown player extensions" % legacy_version)
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
	var browser_float_integers := browser_payload.duplicate(true)
	browser_float_integers.worldSeed = 123456.0
	browser_float_integers.player.exp = 120.0
	browser_float_integers.player.inventory = [{"id": "health-potion", "qty": 2.0}]
	browser_float_integers.world.seed = 123456.0
	browser_float_integers.world.generatorVersion = 2.0
	browser_float_integers.worldGeneratorVersion = 2.0
	if not SaveRepo.is_browser_v18_payload(browser_float_integers):
		failures.append("browser v18 contract must accept finite integral JSON numbers represented as floats")
	var integral_float_browser_version := browser_payload.duplicate(true)
	integral_float_browser_version.version = 18.0
	if not SaveRepo.is_browser_v18_payload(integral_float_browser_version):
		failures.append("browser v18 contract must accept integral float schema versions like JavaScript Number.isSafeInteger")
	var nullable_browser_quantity := browser_payload.duplicate(true)
	nullable_browser_quantity.player.inventory = [{"id": "health-potion", "qty": null}]
	if not SaveRepo.is_browser_v18_payload(nullable_browser_quantity):
		failures.append("browser v18 contract must accept null inventory quantities as the browser does")
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
	var unsafe_browser_exp := browser_payload.duplicate(true)
	unsafe_browser_exp.player.exp = 9007199254740992
	if SaveRepo.is_browser_v18_payload(unsafe_browser_exp):
		failures.append("browser v18 contract must reject integers outside JavaScript's safe range")
	var unsafe_browser_quantity := browser_payload.duplicate(true)
	unsafe_browser_quantity.player.inventory = [{"id":"health-potion","qty":9007199254740992}]
	if SaveRepo.is_browser_v18_payload(unsafe_browser_quantity):
		failures.append("browser v18 contract must reject inventory quantities outside JavaScript's safe integer range")
	var unsafe_browser_world := browser_payload.duplicate(true)
	unsafe_browser_world.world.seed = 9007199254740992
	if SaveRepo.is_browser_v18_payload(unsafe_browser_world):
		failures.append("browser v18 contract must reject world seeds outside JavaScript's safe integer range")
	var unsafe_negative_browser_world := browser_payload.duplicate(true)
	unsafe_negative_browser_world.world.seed = -9007199254740992
	if SaveRepo.is_browser_v18_payload(unsafe_negative_browser_world):
		failures.append("browser v18 contract must reject negative world seeds outside JavaScript's safe integer range")
	var large_safe_browser_world_seed := browser_payload.duplicate(true)
	large_safe_browser_world_seed.world.seed = 4294967296
	if not SaveRepo.is_browser_v18_payload(large_safe_browser_world_seed):
		failures.append("browser v18 contract must accept positive safe-integer world seeds above the unsigned 32-bit limit")
	var supported_browser_generator_extension := browser_payload.duplicate(true)
	supported_browser_generator_extension.world.generatorVersion = 2
	supported_browser_generator_extension.worldGeneratorVersion = 2
	if not SaveRepo.is_browser_v18_payload(supported_browser_generator_extension):
		failures.append("browser v18 contract must accept synchronized positive safe-integer generator versions")
	var mismatched_browser_generator := browser_payload.duplicate(true)
	mismatched_browser_generator.world.generatorVersion = 2
	if SaveRepo.is_browser_v18_payload(mismatched_browser_generator):
		failures.append("browser v18 contract must reject mismatched root and nested generator versions")
	var negative_browser_generator := browser_payload.duplicate(true)
	negative_browser_generator.world.generatorVersion = -1
	if SaveRepo.is_browser_v18_payload(negative_browser_generator):
		failures.append("browser v18 contract must reject negative nested generator versions")
	browser_payload["extensionData"] = {"customQuestFlag": true, "opaqueCounter": 73, "nested": {"marker": "opaque-v18", "flags": [true, false, null]}}
	browser_payload.player["browserExtension"] = {"skillNote": "preserve-player-extension", "flags": [1, 2, 3]}
	browser_payload.world["browserExtension"] = {"mapNote": "preserve-world-extension", "seen": ["forest", "ruins"]}
	browser_payload.factions["browserExtension"] = {"historyMarker": "preserve-faction-extension"}
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
	if exported_browser is Dictionary:
		print("ROUNDTRIP_DIAGNOSTIC root=", exported_browser.get("extensionData", {}) == browser_payload.extensionData,
			" player=", exported_browser.get("player", {}).get("browserExtension", {}) == browser_payload.player.browserExtension,
			" world=", exported_browser.get("world", {}).get("browserExtension", {}) == browser_payload.world.browserExtension,
			" factions=", exported_browser.get("factions", {}).get("browserExtension", {}) == browser_payload.factions.browserExtension,
			" name=", exported_browser.get("player", {}).get("name", "") == browser_payload.player.name,
			" inventory=", exported_browser.get("player", {}).get("inventory", []) == browser_payload.player.inventory,
			" exported-valid=", SaveRepo.is_browser_v18_payload(exported_browser))
	if exported_browser is Dictionary and (exported_browser.get("extensionData", {}) != browser_payload.extensionData or exported_browser.get("player", {}).get("browserExtension", {}) != browser_payload.player.browserExtension or exported_browser.get("world", {}).get("browserExtension", {}) != browser_payload.world.browserExtension or exported_browser.get("factions", {}).get("browserExtension", {}) != browser_payload.factions.browserExtension or exported_browser.get("player", {}).get("name", "") != browser_payload.player.name or exported_browser.get("player", {}).get("inventory", []) != browser_payload.player.inventory):
		failures.append("browser import/export must preserve supplied known fields and nested unknown extension data while applying runtime defaults")
	# Exercise the actual browser import -> native slot -> browser export path
	# for every legacy schema boundary, not only the in-memory migrator.
	for legacy_import_version in range(1, 18):
		var legacy_round_trip := browser_payload.duplicate(true)
		legacy_round_trip["version"] = legacy_import_version
		legacy_round_trip.erase("worldSeed")
		legacy_round_trip.erase("worldGeneratorVersion")
		legacy_round_trip.erase("world")
		legacy_round_trip.erase("factions")
		legacy_round_trip["extensionData"] = {
			"nullableMarker": null,
			"nested": {"opaque": "v%d" % legacy_import_version, "flags": [true, false, null]}
		}
		if SaveRepo.import_browser_save(TEST_SLOT, JSON.stringify(legacy_round_trip)) != OK:
			failures.append("legacy browser v%d payload must import through the native slot" % legacy_import_version)
			continue
		var round_trip_payload: Variant = JSON.parse_string(SaveRepo.export_browser_save(TEST_SLOT))
		if not round_trip_payload is Dictionary or not SaveRepo.is_browser_v18_payload(round_trip_payload):
			failures.append("legacy browser v%d import must export a valid v18 browser payload" % legacy_import_version)
			continue
		var round_trip_extension: Dictionary = round_trip_payload.get("extensionData", {})
		if round_trip_extension.get("nullableMarker", "missing") != null or round_trip_extension.get("nested", {}).get("opaque", "") != "v%d" % legacy_import_version or round_trip_extension.get("nested", {}).get("flags", []) != [true, false, null]:
			failures.append("legacy browser v%d round-trip must preserve nested unknown values and explicit nulls" % legacy_import_version)
		if str(round_trip_payload.get("player", {}).get("name", "")) != "Browser fixture":
			failures.append("legacy browser v%d round-trip must preserve player identity" % legacy_import_version)
	var legacy_browser_payload := browser_payload.duplicate(true)
	legacy_browser_payload["version"] = 17
	legacy_browser_payload.erase("worldSeed")
	legacy_browser_payload.erase("worldGeneratorVersion")
	legacy_browser_payload.erase("world")
	legacy_browser_payload.erase("factions")
	legacy_browser_payload["extensionData"] = {"legacyQuestFlag":true}
	if SaveRepo.import_browser_save(TEST_SLOT, JSON.stringify(legacy_browser_payload)) != OK:
		failures.append("valid legacy browser v17 save must migrate and import through the sequential compatibility pipeline")
	var migrated_browser_import := SaveRepo.load_slot(TEST_SLOT)
	if int(migrated_browser_import.get("version", 0)) != 18 or not migrated_browser_import.get("world", {}) is Dictionary or not migrated_browser_import.get("factions", {}).get("reputation", {}) is Dictionary:
		failures.append("legacy browser import must produce the complete v18 world and faction contract")
	if migrated_browser_import.get("extensionData", {}).get("legacyQuestFlag", false) != true:
		failures.append("legacy browser import must preserve unknown extension fields")
	var migrated_browser_export: Variant = JSON.parse_string(SaveRepo.export_browser_save(TEST_SLOT))
	if not migrated_browser_export is Dictionary or migrated_browser_export.get("extensionData", {}).get("legacyQuestFlag", false) != true:
		failures.append("migrated legacy browser save must remain exportable without losing extension data")
	var backup_path := TEST_PATH + ".bak"
	# A backup can be the only surviving copy after a crash. The next save
	# must restore it before rotating files for another atomic replacement.
	var orphaned_backup := browser_payload.duplicate(true)
	orphaned_backup.player.name = "Backup-only hero"
	var orphaned_backup_file := FileAccess.open(backup_path, FileAccess.WRITE)
	if orphaned_backup_file != null:
		orphaned_backup_file.store_string(JSON.stringify(orphaned_backup))
		orphaned_backup_file.close()
	if FileAccess.file_exists(TEST_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_PATH))
	var backup_recovery_error: Error = SaveRepo._write_json_atomically(TEST_PATH, JSON.stringify(browser_payload))
	if backup_recovery_error != OK:
		failures.append("a backup-only slot must be preserved before a new atomic save (error %d)" % backup_recovery_error)
	if str(SaveRepo.load_slot(TEST_SLOT).get("player", {}).get("name", "")) != str(browser_payload.player.name):
		failures.append("a new atomic save must replace a recovered backup-only slot with the new complete payload")

	# A malformed primary must not cause the only valid backup to be discarded.
	var corrupt_primary := FileAccess.open(TEST_PATH, FileAccess.WRITE)
	if corrupt_primary != null:
		corrupt_primary.store_string("{corrupt")
		corrupt_primary.close()
	var valid_backup_payload := browser_payload.duplicate(true)
	valid_backup_payload.player.name = "Validated backup hero"
	var valid_backup_file := FileAccess.open(backup_path, FileAccess.WRITE)
	if valid_backup_file != null:
		valid_backup_file.store_string(JSON.stringify(valid_backup_payload))
		valid_backup_file.close()
	if not SaveRepo._read_slot_payload(TEST_PATH).is_empty() or SaveRepo._read_slot_payload(backup_path).is_empty():
		failures.append("backup recovery fixture must contain a malformed primary and a valid backup")
	var corrupt_primary_recovery: Error = SaveRepo._write_json_atomically(TEST_PATH, JSON.stringify(browser_payload))
	if corrupt_primary_recovery != OK or str(SaveRepo.load_slot(TEST_SLOT).get("player", {}).get("name", "")) != str(browser_payload.player.name):
		failures.append("atomic replacement must recover a validated backup before replacing a malformed primary")

	var interrupted_save := browser_payload.duplicate(true)
	interrupted_save.player.name = "Recovered browser hero"
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
