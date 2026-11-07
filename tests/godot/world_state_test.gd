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

	var normalized := WorldStateScript.normalize(world, 123456)
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
	world["riftRun"] = {"active": true, "locationId": "rift-01", "floor": 12, "enemy": {"hp": 15, "maxHp": 40, "riftMode": true, "riftLocationId": "rift-01", "riftFloor": 12}}
	var normalized_rift: Dictionary = WorldStateScript.normalize(world, 123456)
	if int(normalized_rift.hero.riftBest) != 12 or normalized_rift.hero.riftClearedLocations != ["rift-01"] or not bool(normalized_rift.riftRun.active):
		failures.append("valid Rift record and active encounter must survive normalization")
	world["riftRun"] = {"active": true, "locationId": "rift-99", "floor": -1, "enemy": {}}
	var sanitized_rift: Dictionary = WorldStateScript.normalize(world, 123456)
	if bool(sanitized_rift.riftRun.get("active", false)):
		failures.append("invalid Rift runtime state must be discarded")
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
