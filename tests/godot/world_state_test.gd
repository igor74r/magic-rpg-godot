extends SceneTree

const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const DailyQuestEngine = preload("res://godot/scripts/world_daily_quest_engine.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var shard_world := WorldStateScript.create(9090)
	shard_world["hero"] = {"level":1,"storyShards":{"flame":true,"ice":"yes","blood":false}}
	shard_world["storyShards"] = {"ice":true,"blood":true,"unknown":true}
	shard_world["storyDragons"] = {"ash-herald":true,"ice-grasp":"yes","unknown-dragon":true}
	var clean_shard_world := WorldStateScript.normalize(shard_world,9090)
	if clean_shard_world.hero.storyShards != {"flame":true,"ice":true,"blood":true} or clean_shard_world.storyShards != clean_shard_world.hero.storyShards:
		failures.append("story shard flags must merge valid legacy mirrors and remain canonical")
	if clean_shard_world.storyDragons != {"ash-herald":true,"ice-grasp":false,"blood-crown":false}:
		failures.append("story dragon flags must accept only known literal booleans")
	var numeric_parity_world := WorldStateScript.normalize({
		"seed": "9876",
		"generatorVersion": 1.5,
		"clockMinutes": "12.5"
	}, 77)
	if int(numeric_parity_world.seed) != 77:
		failures.append("world seed normalization must reject numeric strings instead of coercing them")
	if int(numeric_parity_world.generatorVersion) != 1:
		failures.append("world generator version normalization must floor finite fractional numbers like the browser")
	if float(numeric_parity_world.clockMinutes) != 0.0:
		failures.append("world clock normalization must reject numeric strings instead of coercing them")
	var wrapped_seed_world := WorldStateScript.normalize({"seed": -1}, 77)
	if int(wrapped_seed_world.seed) != 4294967295:
		failures.append("world seed normalization must match JavaScript unsigned 32-bit wrapping")
	var visit_number_parity := WorldStateScript.normalize({
		"regionVisits": {"village": "4", "forest": true, "shadow": 3.9, "ruins": -2}
	}, 77)
	if int(visit_number_parity.regionVisits.get("village", -1)) != 0 or int(visit_number_parity.regionVisits.get("forest", -1)) != 0:
		failures.append("region visit normalization must reject numeric strings and booleans like browser Number.isFinite")
	if int(visit_number_parity.regionVisits.get("shadow", -1)) != 3 or int(visit_number_parity.regionVisits.get("ruins", -1)) != 0:
		failures.append("region visit normalization must floor finite numbers and clamp negative counts to zero")
	var campaign_event_world := WorldStateScript.create(78)
	campaign_event_world["factionCampaigns"] = {
		"unknown-campaign": {"status":"active","stage":1,"startedAt":10},
		"ash-nomad-warband": {"status":"invalid","stage":9,"startedAt":-5}
	}
	campaign_event_world.events.active = [
		"invalid-event",
		{"id":"bad-region","regionId":"not-a-region"},
		{
			"id":"sanitized-defense","regionId":"forest","status":"active","objectiveType":"defend-region",
			"targetCount":2000,"progress":1500,"holdElapsedMinutes":2001.0,"phase":0,
			"objectiveText":"x".repeat(260),"accepted":"yes","campaignId":"wrong-campaign","campaignStage":1
		},
		{
			"id":"sanitized-survey","regionId":"forest","objectiveType":"region-discovery",
			"targetRegionId":"void-crater","targetCount":1,"progress":0,"objectiveText":"old"
		}
	]
	campaign_event_world.events.history = [null, {"id":"bad-history","regionId":"unknown"}]
	var sanitized_campaign_events := WorldStateScript.normalize(campaign_event_world, 78)
	if sanitized_campaign_events.events.active.size() != 2 or not sanitized_campaign_events.events.history.is_empty():
		failures.append("world normalization must discard malformed active and historical event entries")
	var sanitized_defense: Dictionary = sanitized_campaign_events.events.active[0]
	if int(sanitized_defense.targetCount) != 1000 or int(sanitized_defense.progress) != 1000 or int(sanitized_defense.phase) != 1000:
		failures.append("world event progress must clamp to a safe target count and synchronize phase")
	if float(sanitized_defense.holdElapsedMinutes) != 1000.0 or sanitized_defense.objectiveText.length() != 240 or bool(sanitized_defense.accepted):
		failures.append("defense event elapsed time, objective text and accepted flag must be normalized")
	if sanitized_defense.campaignId != null or sanitized_defense.campaignStage != null:
		failures.append("unknown event campaign references must be cleared")
	var sanitized_survey: Dictionary = sanitized_campaign_events.events.active[1]
	if sanitized_survey.targetRegionId != null or sanitized_survey.objectiveText != "Цель разведки недоступна. Обратитесь к доске объявлений.":
		failures.append("region survey events must reject non-adjacent targets with browser-compatible guidance")
	if sanitized_campaign_events.factionCampaigns.has("unknown-campaign") or sanitized_campaign_events.factionCampaigns["ash-nomad-warband"].status != "failed" or int(sanitized_campaign_events.factionCampaigns["ash-nomad-warband"].stage) != 2 or float(sanitized_campaign_events.factionCampaigns["ash-nomad-warband"].startedAt) != 0.0:
		failures.append("faction campaign records must match browser key, status, stage and start-time normalization")

	var world := WorldStateScript.create(123456)
	if world.seed != 123456 or world.currentRegionId != "village":
		failures.append("new world must preserve its seed and start in village")
	if world.regionVisits.get("village", 0) != 1:
		failures.append("new world must record its initial village visit")
	if not WorldStateScript.can_travel(world, "village", "forest"):
		failures.append("starting village-to-forest route must be unlocked")
	if WorldStateScript.can_travel(world, "forest", "shadow"):
		failures.append("undiscovered forest exit must remain locked")

	if not WorldStateScript.enter_region(world, "forest", "village"):
		failures.append("travel over a starting route must succeed")
	if not world.discoveredRegions.has("forest"):
		failures.append("entering a region must discover it")
	if not WorldStateScript.can_travel(world, "forest", "shadow"):
		failures.append("discovering forest must reveal its outgoing routes")
	if world.regionVisits.get("forest", 0) != 1:
		failures.append("first entry must increment the visit counter")
	if not WorldStateScript.enter_region(world, "village", "forest"):
		failures.append("return over an opened route must succeed")
	if world.regionVisits.get("village", 0) != 2:
		failures.append("return visit must increment the counter")

	var before_seed := WorldStateScript.region_visit_seed(world, "forest", 1)
	var after_seed := WorldStateScript.region_visit_seed(world, "forest", 2)
	if before_seed == after_seed:
		failures.append("different visit indices must produce distinct generation seeds")

	world.events["nextSpawnAt"] = 1234.75
	var normalized := WorldStateScript.normalize(world, 123456)
	if absf(float(normalized.events.get("nextSpawnAt", -1.0)) - 1234.75) > 0.000001:
		failures.append("fractional world-event spawn deadline must survive save normalization")
	if normalized.seed != 123456 or normalized.currentRegionId != "village":
		failures.append("normalization must preserve valid save state")
	if not normalized.unlockedRoutes.has(WorldGraph.route_key("forest", "shadow")):
		failures.append("normalization must preserve unlocked routes")

	var legacy := WorldStateScript.create(77, true)
	if not WorldStateScript.can_travel(legacy, "village", "void-crater"):
		failures.append("legacy fast travel must preserve access to every region")

	# Region persistence: chests, enemy respawn deadlines and boss state survive normalization.
	world["dailyQuests"] = {"date": DailyQuestEngine.today_key(), "list": [
		{"id":"q-chest","current":0,"claimed":false},
		{"id":"q-kill-any","current":0,"claimed":false},
		{"id":"q-kill-goblin","current":0,"claimed":false}
	]}
	if not WorldStateScript.mark_chest_opened(world, "forest", "chest-01"):
		failures.append("first chest open must be recorded")
	if WorldStateScript.mark_chest_opened(world, "forest", "chest-01"):
		failures.append("the same chest must not be recorded twice")
	var chest_achievement_world := WorldStateScript.create(654)
	chest_achievement_world["hero"] = {"level": 1, "gold": 0, "stats": {}}
	for chest_index in range(10):
		if not WorldStateScript.mark_chest_opened(chest_achievement_world, "forest", "achievement-chest-%02d" % chest_index):
			failures.append("each unique chest must be counted once for achievements")
	if not chest_achievement_world.hero.get("achievements", []).has("treasure-hunter") or int(chest_achievement_world.hero.gold) != 12:
		failures.append("opening ten unique chests must unlock and pay the treasure hunter achievement")
	var chest_quest: Dictionary = {}
	for quest in DailyQuestEngine.get_quests(world):
		if str(quest.get("id", "")) == "q-chest": chest_quest = quest
	if int(chest_quest.get("current", 0)) != 1:
		failures.append("opening a unique chest must advance the daily chest objective exactly once")
	if not WorldStateScript.mark_enemy_defeated(world, "forest", "wolf-01", 900.0):
		failures.append("enemy defeat and respawn deadline must be recorded")
	if not WorldStateScript.is_enemy_defeated(world, "forest", "wolf-01", 899.0):
		failures.append("enemy must remain defeated before its respawn time")
	if WorldStateScript.is_enemy_defeated(world, "forest", "wolf-01", 900.0):
		failures.append("enemy must respawn at its deadline")
	if not WorldStateScript.set_boss_progress(world, "forest", "forest-warden", 0.45, 2, 7, true):
		failures.append("valid boss progress must be saved")
	if WorldStateScript.set_boss_progress(world, "forest", "bad-boss", 1.5, 0, 0):
		failures.append("invalid boss health ratio must be rejected")
	var saved_region: Dictionary = WorldStateScript.normalize(world, 123456).regions.get("forest", {})
	if not saved_region.get("openedChests", []).has("chest-01"):
		failures.append("opened chest state must survive normalization")
	if float(saved_region.get("defeatedEnemies", {}).get("wolf-01", -1)) != 900.0:
		failures.append("enemy respawn state must survive normalization")
	var saved_boss: Dictionary = saved_region.get("bossProgress", {}).get("forest-warden", {})
	if float(saved_boss.get("hpRatio", 0.0)) != 0.45 or int(saved_boss.get("phase", -1)) != 2 or not saved_boss.get("pendingSpecial", false):
		failures.append("boss progress must survive normalization")
	if not WorldStateScript.mark_boss_defeated(world, "forest", "forest-warden"):
		failures.append("boss defeat must be recorded")
	if not world.regions.forest.defeatedBosses.has("forest-warden") or world.regions.forest.bossProgress.has("forest-warden"):
		failures.append("defeating a boss must clear its partial progress")

		# Region threat, resolved encounters and discovered secrets are save-scoped.
	if not WorldStateScript.set_security_threat(world, "forest", 3):
		failures.append("valid security threat must be stored")
	if WorldStateScript.set_security_threat(world, "forest", 4):
		failures.append("security threat above the supported range must be rejected")
	if not WorldStateScript.mark_event_resolved(world, "forest", "ambush-01"):
		failures.append("resolved region event must be recorded")
	if WorldStateScript.mark_event_resolved(world, "forest", "ambush-01"):
		failures.append("the same resolved event must not be recorded twice")
	if not WorldStateScript.mark_secret_discovered(world, "forest", "hidden-cache"):
		failures.append("discovered secret must be recorded")
	if WorldStateScript.mark_secret_discovered(world, "forest", "hidden-cache"):
		failures.append("the same secret must not be recorded twice")
	world["hero"] = {"riftBest": 12, "riftClearedLocations": ["rift-01", "rift-01", "invalid"]}
	world["riftRun"] = {"active": true, "locationId": "rift-01", "floor": 12, "enemy": {"persistentId": "rift-test-enemy", "enemyId": "goblin", "hp": 15, "maxHp": 40, "dead": false, "riftMode": true, "riftLocationId": "rift-01", "riftFloor": 12}}
	var normalized_rift: Dictionary = WorldStateScript.normalize(world, 123456)
	if int(normalized_rift.hero.riftBest) != 12 or normalized_rift.hero.riftClearedLocations != ["rift-01"] or not bool(normalized_rift.riftRun.active):
		failures.append("valid Rift record and active encounter must survive normalization")
	world["riftRun"] = {"active": true, "locationId": "rift-99", "floor": -1, "enemy": {}}
	var sanitized_rift: Dictionary = WorldStateScript.normalize(world, 123456)
	if bool(sanitized_rift.riftRun.get("active", false)):
		failures.append("invalid Rift runtime state must be discarded")
	var forged_rift := world.duplicate(true)
	forged_rift["riftRun"] = {"active": true, "locationId": "rift-01", "floor": 12, "enemy": {"enemyId": "missing-enemy", "persistentId": "", "hp": 15, "maxHp": 40, "dead": false, "riftMode": true, "riftLocationId": "rift-01", "riftFloor": 12}}
	if bool(WorldStateScript.normalize(forged_rift, 123456).riftRun.get("active", false)):
		failures.append("active Rift save must reject unknown or missing enemy identity")
	var saved_exploration: Dictionary = WorldStateScript.normalize(world, 123456).regions.get("forest", {})
	if int(saved_exploration.get("securityThreat", -1)) != 3:
		failures.append("security threat must survive normalization")
	if not saved_exploration.get("resolvedEvents", []).has("ambush-01"):
		failures.append("resolved events must survive normalization")
	if not saved_exploration.get("discoveredSecrets", []).has("hidden-cache"):
		failures.append("discovered secrets must survive normalization")

	# Secret layouts are generated once, validated, and retained by the save.
	var secret_chests := [{"id": "secret-chest-01", "x": 120.5, "y": 88.0}]
	var secret_walls := [{"id": "secret-wall-01", "tx": 4, "ty": 5, "wx": 128, "wy": 160, "ax": 0, "ay": 1, "rewardType": "loot"}]
	if not WorldStateScript.set_secret_layout(world, "forest", secret_chests, secret_walls):
		failures.append("valid secret layout must be stored")
	if WorldStateScript.set_secret_layout(world, "forest", [], []):
		failures.append("generated secret layout must not be rerolled")
	if WorldStateScript.set_secret_layout(world, "forest", [{"id": "bad"}], []):
		failures.append("invalid secret chest coordinates must be rejected")
	var loaded_layout: Dictionary = WorldStateScript.get_secret_layout(WorldStateScript.normalize(world, 123456), "forest")
	if not loaded_layout.generated or loaded_layout.chests.size() != 1 or loaded_layout.walls.size() != 1:
		failures.append("secret layout must survive normalization")
	if loaded_layout.walls[0].rewardType != "loot":
		failures.append("secret wall reward type must survive normalization")

	# Browser-compatible APIs store discovered secret chests separately from the wall layout.
	var extra_world := WorldStateScript.create(654321)
	if not WorldStateScript.record_secret_layout(extra_world, "forest", secret_walls):
		failures.append("browser-compatible secret wall layout must be recorded")
	if WorldStateScript.record_secret_layout(extra_world, "forest", []):
		failures.append("browser-compatible secret layout must only be recorded once")
	if not WorldStateScript.record_secret_discovered(extra_world, "forest", "cache-hidden", {"id": "cache-chest", "x": 32.0, "y": 48.0}):
		failures.append("discovered secret with a chest reward must be recorded")
	var extra_record: Dictionary = WorldStateScript.normalize(extra_world, 654321).regions.get("forest", {})
	if extra_record.secretChests.size() != 1 or extra_record.secretChests[0].id != "cache-chest":
		failures.append("secret chest coordinates must survive normalization")

	# Applying region persistence restores opened chests, hides resolved events,
	# and reconstructs enemy/boss state when the region is entered again.
	var runtime_world := WorldStateScript.create(777)
	runtime_world.clockMinutes = 100
	WorldStateScript.mark_chest_opened(runtime_world, "forest", "chest-a")
	WorldStateScript.mark_event_resolved(runtime_world, "forest", "event-a")
	WorldStateScript.mark_enemy_defeated(runtime_world, "forest", "enemy-a", 110.0)
	WorldStateScript.set_boss_progress(runtime_world, "forest", "boss-a", 0.4, 2, 9, true)
	WorldStateScript.mark_boss_defeated(runtime_world, "forest", "boss-dead")
	var runtime_chests := [{"id": "chest-a", "opened": false}, {"id": "chest-b", "opened": false}]
	var runtime_events := [{"id": "event-a"}, {"id": "event-b"}]
	var runtime_enemies := [
		{"persistentId": "enemy-a", "hp": 0, "maxHp": 50, "dead": false, "state": "idle", "effects": []},
		{"persistentId": "boss-a", "boss": true, "hp": 100, "maxHp": 100, "phase": 0, "state": "idle"},
		{"persistentId": "boss-dead", "boss": true, "hp": 100, "maxHp": 100, "dead": false, "state": "combat"}
	]
	if not WorldStateScript.apply_region_persistence(runtime_world, "forest", runtime_enemies, runtime_chests, runtime_events, 5000.0):
		failures.append("region persistence must apply to runtime entities")
	if not runtime_chests[0].opened or runtime_chests[1].opened:
		failures.append("only previously opened chests must restore as opened")
	if runtime_events.size() != 1 or runtime_events[0].id != "event-b":
		failures.append("resolved region events must be removed from the active map")
	if not runtime_enemies[0].dead or runtime_enemies[0].respawnAt != 605000.0:
		failures.append("defeated enemies must remain dead until their world-clock deadline")
	if runtime_enemies[1].hp != 40 or runtime_enemies[1].phase != 2 or not runtime_enemies[1].tacticalSpecialPending:
		failures.append("boss progress must restore health, phase and pending special")
	if not runtime_enemies[2].dead or runtime_enemies[2].state != "dead":
		failures.append("defeated bosses must not respawn")

	if failures.is_empty():
		print("PASS: save-scoped discovery, route unlocking, visits and legacy travel")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
