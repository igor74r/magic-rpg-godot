extends SceneTree

const WorldState = preload("res://godot/scripts/world_state.gd")
const EventEngine = preload("res://godot/scripts/world_event_engine.gd")
const Factions = preload("res://godot/scripts/world_faction_engine.gd")
const WorldGraph = preload("res://godot/scripts/world_graph.gd")


func _initialize() -> void:
	var failures: Array[String] = []
	var world := WorldState.create(441122)
	world["discoveredRegions"] = WorldGraph.region_ids()
	var events: Dictionary = world.events
	for template in EventEngine.TEMPLATES:
		if str(template.id) != "hub-patrol":
			events.cooldowns[str(template.id)] = 999999.0
	events["nextSpawnAt"] = 0
	var tick := EventEngine.advance_time(world, 1.0, "forest")
	if tick.started.size() != 1:
		failures.append("due regional event must spawn one deterministic event")
	var event: Dictionary = tick.started[0] if not tick.started.is_empty() else {}
	if str(event.get("templateId", "")) != "hub-patrol" or str(event.get("objectiveType", "")) != "enemy-kill":
		failures.append("regional template filter must select the eligible Hub patrol event")
	if EventEngine.get_visible(world, "forest").size() != 1:
		failures.append("active regional event must be visible in its region")
	if not EventEngine.accept_event(world, str(event.get("id", ""))) or EventEngine.accept_event(world, str(event.get("id", ""))):
		failures.append("event can be accepted exactly once")
	var normal_enemy := {"elite":false,"boss":false}
	EventEngine.record_kill(world, "forest", normal_enemy)
	if int(world.events.active[0].get("progress", -1)) != 1:
		failures.append("accepted enemy-kill objective advances on a normal victory")
	EventEngine.record_kill(world, "forest", normal_enemy)
	var completed := EventEngine.record_kill(world, "forest", normal_enemy)
	if completed.size() != 1 or completed[0].get("status") != "completed":
		failures.append("objective completion moves the event to history")
	if Factions.get_reputation(world, "hub-guardians") != 8:
		failures.append("successful Hub event grants its faction reputation")
	if EventEngine.get_visible(world, "forest").size() != 1:
		failures.append("unclaimed completed event remains visible")
	var reward := EventEngine.claim_reward(world, str(event.get("id", "")))
	if int(reward.get("gold", 0)) < 30 or int(reward.get("gold", 0)) > 50:
		failures.append("claim returns the deterministic event gold reward")
	if not EventEngine.claim_reward(world, str(event.get("id", ""))).is_empty():
		failures.append("event reward cannot be claimed twice")

	var safe_reward_world := WorldState.create(77221)
	safe_reward_world["factions"] = {"schemaVersion":1,"reputation":{"rift-cult":90}}
	safe_reward_world.events.history = [
		{"id":"fractional-gold","status":"completed","rewardClaimed":false,"factionId":"rift-cult","reward":{"gold":10.5}},
		{"id":"safe-gold","status":"completed","rewardClaimed":false,"factionId":"rift-cult","reward":{"gold":10}}
	]
	var fractional_reward := EventEngine.claim_reward(safe_reward_world, "fractional-gold")
	var safe_integer_reward := EventEngine.claim_reward(safe_reward_world, "safe-gold")
	if not is_equal_approx(float(fractional_reward.get("gold", 0.0)), 10.5):
		failures.append("fractional legacy event gold must not receive a faction bonus unlike browser Number.isSafeInteger")
	if int(safe_integer_reward.get("gold", 0)) != 12:
		failures.append("positive safe-integer event gold must receive the Rift Cult faction bonus")
	if EventEngine.get_visible(world, "forest").size() != 0:
		failures.append("claimed event is removed from visible regional events")
	var restored := WorldState.normalize(world, 441122)
	if restored.events.history.size() != 1 or bool(restored.events.history[0].get("rewardClaimed", false)) != true:
		failures.append("event history and claim state survive save normalization")

	var defend_world := WorldState.create(99117)
	defend_world["discoveredRegions"] = WorldGraph.region_ids()
	for template in EventEngine.TEMPLATES:
		if str(template.id) != "hub-outpost-defense":
			defend_world.events.cooldowns[str(template.id)] = 999999.0
	defend_world.events["nextSpawnAt"] = 0
	var defense_tick := EventEngine.advance_time(defend_world, 1.0, "forest")
	var defense: Dictionary = defense_tick.started[0] if not defense_tick.started.is_empty() else {}
	if defense.get("objectiveType") != "defend-region":
		failures.append("defense template spawns in eligible region")
	if not str(defense.get("objectiveText", "")).contains("Если покинете регион, оборона приостановится"):
		failures.append("defense objective explains that leaving the region pauses progress")
	EventEngine.accept_event(defend_world, str(defense.get("id", "")))
	var defense_result: Dictionary = {"finished":[]}
	for _minute_step in range(12):
		defense_result = EventEngine.advance_time(defend_world, 0.25, "forest")
	if defense_result.finished.size() != 1 or Factions.get_reputation(defend_world, "hub-guardians") != 10:
		failures.append("holding the region completes defense and grants reputation")

	var failed_world := WorldState.create(8822)
	failed_world["discoveredRegions"] = WorldGraph.region_ids()
	for template in EventEngine.TEMPLATES:
		if str(template.id) != "hub-patrol":
			failed_world.events.cooldowns[str(template.id)] = 999999.0
	failed_world.events["nextSpawnAt"] = 0
	var failed_tick := EventEngine.advance_time(failed_world, 1.0, "forest")
	var failed_event: Dictionary = failed_tick.started[0] if not failed_tick.started.is_empty() else {}
	EventEngine.accept_event(failed_world, str(failed_event.get("id", "")))
	failed_world["clockMinutes"] = float(failed_event.get("expiresAt", 0.0))
	var expiry := EventEngine.advance_time(failed_world, 0.25, "forest")
	if expiry.finished.size() != 1 or expiry.finished[0].get("status") != "failed" or Factions.get_reputation(failed_world, "hub-guardians") != -5:
		failures.append("accepted event expiry applies the failure reputation penalty")

	var discovery_world := WorldState.create(6677)
	discovery_world.events.active.append({"id":"event-discovery","templateId":"frontier-survey","name":"Разведка","regionId":"village","status":"active","accepted":true,"objectiveType":"region-discovery","targetRegionId":"forest","targetCount":1,"progress":0,"phase":0,"factionId":"free-traders","reputationReward":10,"failureReputationDelta":-4,"reward":{"gold":55}})
	if not EventEngine.record_discovery(discovery_world, "shadow").is_empty():
		failures.append("discovery objective must ignore a different region")
	var discovery_result := EventEngine.record_discovery(discovery_world, "forest")
	if discovery_result.size() != 1 or Factions.get_reputation(discovery_world, "free-traders") != 10:
		failures.append("discovering the target region completes the survey and grants trader reputation")

	var malformed_discovery_world := WorldState.create(6689)
	malformed_discovery_world.events.active = ["invalid", null, 42, {
		"id":"valid-discovery","status":"active","accepted":true,"objectiveType":"region-discovery",
		"targetRegionId":"forest","targetCount":1,"progress":0,"phase":0,
		"factionId":"free-traders","reputationReward":3,"reward":{"gold":5}
	}]
	if EventEngine.get_visible(malformed_discovery_world, "forest").size() != 1:
		failures.append("visible-event lookup must ignore malformed imported entries")
	var safe_discovery := EventEngine.record_discovery(malformed_discovery_world, "forest")
	if safe_discovery.size() != 1 or Factions.get_reputation(malformed_discovery_world, "free-traders") != 3:
		failures.append("discovery progress must ignore malformed imported entries and complete valid objectives")

	var mixed_completion_world := WorldState.create(6690)
	mixed_completion_world.events.active = ["stale-entry", null, {
		"id":"mixed-valid-event","templateId":"elite-hunt","name":"Элитная цель","regionId":"forest",
		"status":"active","accepted":true,"objectiveType":"elite-kill","targetCount":1,"progress":0,
		"phase":0,"factionId":"","reputationReward":0,"failureReputationDelta":0,"reward":{"gold":25}
	}]
	var mixed_completion := EventEngine.record_kill(mixed_completion_world, "forest", {"elite":true,"boss":false})
	if mixed_completion.size() != 1 or not mixed_completion_world.events.active.is_empty():
		failures.append("completing a valid event must safely remove it while ignoring malformed sibling entries")

	var campaign_world := WorldState.create(6688)
	campaign_world["factionCampaigns"] = {"ash-nomad-warband":{"status":"active","stage":1}}
	campaign_world.events.active.append({"id":"event-campaign","templateId":"ash-warband-scouting","name":"Разведчики","regionId":"wasteland","status":"active","accepted":true,"objectiveType":"elite-kill","targetCount":1,"progress":0,"phase":0,"factionId":"ash-nomads","campaignId":"ash-nomad-warband","campaignStage":1,"reputationReward":8,"failureReputationDelta":-4,"reward":{"gold":50}})
	var campaign_result := EventEngine.record_kill(campaign_world, "wasteland", {"elite":true,"boss":false})
	if campaign_result.size() != 1 or int(campaign_world.factionCampaigns["ash-nomad-warband"].get("stage", 0)) != 2:
		failures.append("completed first faction campaign event unlocks its second stage")

	var malformed_world := WorldState.create(77)
	malformed_world.events.active = ["invalid", null, 42]
	malformed_world.events.history = ["invalid", null]
	EventEngine.advance_time(malformed_world, 0.1, "forest")
	if not EventEngine.record_kill(malformed_world, "forest", normal_enemy).is_empty() or not EventEngine.claim_reward(malformed_world, "missing").is_empty():
		failures.append("malformed imported event entries must be ignored safely")

	if failures.is_empty():
		print("PASS: regional event generation, acceptance, objectives, timed defense, expiry, faction rewards, claims and persistence")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)
