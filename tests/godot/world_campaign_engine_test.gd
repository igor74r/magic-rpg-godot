extends SceneTree

const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Catalog = preload("res://godot/scripts/world_campaign_catalog.gd")
const Regions = preload("res://godot/scripts/world_region_catalog.gd")
const Enemies = preload("res://godot/scripts/world_enemy_catalog.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []

	var shard_hero: Dictionary = {}
	if Campaign.record_shard(shard_hero, "flame") != true or shard_hero.storyShards.flame != true:
		failures.append("valid story shard must be recorded")
	if Campaign.record_shard(shard_hero, "unknown") != false:
		failures.append("unknown story shard must be rejected")
	var shard_mission: Dictionary = {"id":"shard-gate","count":1,"shardId":"flame"}
	shard_hero["campaignKills"]={"shard-gate":1}
	shard_hero["storyShards"]={"flame":"yes"}
	if bool(Campaign.progress(shard_hero,shard_mission).complete):
		failures.append("non-boolean shard state must not complete a mission")
	shard_hero["storyShards"]={"flame":true}
	if not bool(Campaign.progress(shard_hero,shard_mission).complete):
		failures.append("valid shard and kill requirements must complete a mission")

	var hero: Dictionary = {"level": 1}

	var malformed_progress: Dictionary = {
		"campaignKills": {"a1-m1": "3", "a1-m2": true, "a1-m3": -2},
		"campaignClaimed": {"a1-m1": "yes"}
	}
	Campaign.ensure_state(malformed_progress)
	if int(malformed_progress.campaignKills.get("a1-m1", -1)) != 0:
		failures.append("string kill counters must be normalized to zero")
	if int(malformed_progress.campaignKills.get("a1-m2", -1)) != 0:
		failures.append("boolean kill counters must be normalized to zero")
	if int(malformed_progress.campaignKills.get("a1-m3", -1)) != 0:
		failures.append("negative kill counters must be normalized to zero")
	if bool(malformed_progress.campaignClaimed.get("a1-m1", false)):
		failures.append("non-boolean campaign claims must not be accepted")

	var browser_numeric_progress: Dictionary = {
		"campaignKills": {"a1-m1": 3.0, "a1-m2": 2.5, "a1-m3": 9007199254740992.0},
		"campaignClaimed": {}
	}
	Campaign.ensure_state(browser_numeric_progress)
	if int(browser_numeric_progress.campaignKills.get("a1-m1", -1)) != 3:
		failures.append("integral float campaign kill counters must match browser Number.isSafeInteger behavior")
	if int(browser_numeric_progress.campaignKills.get("a1-m2", -1)) != 0:
		failures.append("fractional campaign kill counters must normalize to zero")
	if int(browser_numeric_progress.campaignKills.get("a1-m3", -1)) != 0:
		failures.append("unsafe campaign kill counters must normalize to zero")

	var unknown_active_mission: Dictionary = {
		"campaignKills": {},
		"campaignClaimed": {},
		"activeCampaignMission": "missing-mission"
	}
	if not Campaign.get_active(unknown_active_mission).is_empty():
		failures.append("unknown active campaign mission IDs must not resolve")
	if str(unknown_active_mission.get("activeCampaignMission", "not-cleared")) != "":
		failures.append("unknown active campaign mission IDs must be cleared like the browser implementation")
	if str(Campaign.get_next(unknown_active_mission).get("id", "")) != "a1-m1":
		failures.append("clearing an unknown active mission must restore the next unclaimed mission")
	var claimed_active_mission: Dictionary = {
		"campaignKills": {},
		"campaignClaimed": {"a1-m1": true},
		"activeCampaignMission": "a1-m1"
	}
	if not Campaign.get_active(claimed_active_mission).is_empty() or str(claimed_active_mission.get("activeCampaignMission", "not-cleared")) != "":
		failures.append("already-claimed active campaign missions must be cleared instead of remaining stale")

	var first_region := Campaign.can_enter_location(hero, "briar-hollow")
	if not bool(first_region.get("allowed", false)):
		failures.append("the first story region must be available to a new level-1 hero")

	var forest_locked := Campaign.can_enter_location(hero, "forest")
	if bool(forest_locked.get("allowed", true)) or str(forest_locked.get("reason", "")) != "level":
		failures.append("forest must require its authored level before the first mission is claimed")

	hero["level"] = 3
	forest_locked = Campaign.can_enter_location(hero, "forest")
	if bool(forest_locked.get("allowed", true)) or str(forest_locked.get("reason", "")) != "campaign":
		failures.append("forest must remain locked until the preceding campaign mission is claimed")
	if str(forest_locked.get("requiredMissionId", "")) != "a1-m1":
		failures.append("forest must identify a1-m1 as its preceding mission")

	# Only a literal true may unlock the next story location.
	var claimed: Dictionary = {"a1-m1": "yes"}
	hero["campaignClaimed"] = claimed
	forest_locked = Campaign.can_enter_location(hero, "forest")
	if bool(forest_locked.get("allowed", true)):
		failures.append("malformed truthy campaign state must not unlock a story region")

	hero["campaignClaimed"] = {"a1-m1": true}
	var forest_open := Campaign.can_enter_location(hero, "forest")
	if not bool(forest_open.get("allowed", false)):
		failures.append("forest must unlock after level and preceding mission requirements are met")

	var unknown_region := Campaign.can_enter_location(hero, "village")
	if not bool(unknown_region.get("allowed", false)):
		failures.append("non-story locations must remain unrestricted by story progression")

	var progression: Array = Campaign.story_location_progression()
	if progression.is_empty() or str(progression[0].get("id", "")) != "briar-hollow":
		failures.append("story progression must begin with the first authored campaign location")
	if progression.size() < 2 or str(progression[1].get("unlockAfterMissionId", "")) != "a1-m1":
		failures.append("the second distinct story region must depend on the first mission")

	var missions: Array = Catalog.all_missions()
	if missions.size() != 25:
		failures.append("the native campaign catalog must contain all 25 browser story missions")
	var mission_ids: Dictionary = {}
	for mission in missions:
		var mission_id := str(mission.get("id", ""))
		var region_id := str(mission.get("locationId", ""))
		var enemy_id := str(mission.get("enemyId", ""))
		if mission_id.is_empty() or mission_ids.has(mission_id):
			failures.append("campaign mission IDs must be present and unique: %s" % mission_id)
		else:
			mission_ids[mission_id] = true
		if Regions.get_region(region_id).is_empty():
			failures.append("campaign mission %s references unknown region %s" % [mission_id, region_id])
		if Enemies.get_enemy(enemy_id).is_empty():
			failures.append("campaign mission %s references unknown enemy %s" % [mission_id, enemy_id])
		if int(mission.get("count", 0)) < 1:
			failures.append("campaign mission %s must require at least one kill" % mission_id)

	var act_hero: Dictionary = {}
	if not is_equal_approx(Campaign.act_price_multiplier(act_hero), 1.0):
		failures.append("first campaign act must use the base gold multiplier")
	act_hero["campaignClaimed"] = {"a1-m1":true,"a1-m2":true,"a1-m3":true,"a1-m4":true,"a1-m5":true}
	if not is_equal_approx(Campaign.act_price_multiplier(act_hero), 1.2):
		failures.append("second campaign act must use a 1.2 gold multiplier")
	for act_index in range(1, 5):
		for mission_index in range(1, 6):
			act_hero.campaignClaimed["a%d-m%d" % [act_index + 1, mission_index]] = true
	if not is_equal_approx(Campaign.act_price_multiplier(act_hero), 1.8):
		failures.append("completed campaign must retain the final 1.8 gold multiplier")
	act_hero.campaignClaimed["a3-m5"] = "yes"
	if not is_equal_approx(Campaign.act_price_multiplier(act_hero), 1.4):
		failures.append("malformed campaign claims must not advance the act multiplier")

	var finale_world := {"hero":{"level":50,"campaignClaimed":{},"storyShards":{"flame":true,"ice":true,"blood":true}},"storyDragons":{"blood-crown":true}}
	for mission in Catalog.all_missions():
		finale_world.hero.campaignClaimed[str(mission.id)] = true
	if not Campaign.can_complete_main_quest(finale_world):
		failures.append("main story finale must require all 25 claimed missions, all three shards and the Blood Crown")
	finale_world.hero.storyShards.erase("ice")
	if Campaign.can_complete_main_quest(finale_world):
		failures.append("main story finale must reject a missing ice shard")
	finale_world.hero.storyShards["ice"] = true
	finale_world.storyDragons["blood-crown"] = false
	if Campaign.can_complete_main_quest(finale_world) or Campaign.is_rift_unlocked_by_story(finale_world):
		failures.append("final story and Rift must remain locked until the Blood Crown flag is true")
	finale_world.storyDragons["blood-crown"] = true
	if not Campaign.is_rift_ready(finale_world):
		failures.append("Rift must unlock after the Blood Crown story flag")
	finale_world["riftEnding"] = "closed"
	if Campaign.is_rift_ready(finale_world):
		failures.append("closed Rift ending must override the dragon unlock")
	var rift_entries: Array = Campaign.rift_locations(49)
	if rift_entries.size() != 30 or not bool(rift_entries[19].unlocked) or bool(rift_entries[20].unlocked):
		failures.append("Rift must contain 30 areas and gate its final ten at level 50")
	if Campaign.get_rift_location("rift-30").is_empty() or not Campaign.get_rift_location("rift-31").is_empty():
		failures.append("Rift area lookup must reject unknown locations")
	var rift_mult: Dictionary = Campaign.get_rift_multiplier(5)
	if not is_equal_approx(float(rift_mult.hpMult),1.6) or not is_equal_approx(float(rift_mult.atkMult),1.4) or not is_equal_approx(float(rift_mult.goldMult),2.0) or not is_equal_approx(float(rift_mult.expMult),1.8):
		failures.append("Rift floor multipliers must match browser scaling")
	var rift_record: Dictionary = {"riftBest":5,"riftClearedLocations":["rift-01","rift-01","rift-30","invalid"]}
	if Campaign.record_rift_floor(rift_record,4) or not Campaign.record_rift_floor(rift_record,8) or int(rift_record.riftBest)!=8:
		failures.append("Rift best floor must only increase")
	if Campaign.get_rift_cleared_count(rift_record)!=2:
		failures.append("Rift cleared area count must deduplicate and ignore invalid IDs")

	if failures.is_empty():
		print("PASS: campaign mission ordering, strict claims, level gates and story-region unlocks")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
