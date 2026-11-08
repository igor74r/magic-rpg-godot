extends SceneTree

const WorldState = preload("res://godot/scripts/world_state.gd")
const EventEngine = preload("res://godot/scripts/world_event_engine.gd")
const Factions = preload("res://godot/scripts/world_faction_engine.gd")


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
	EventEngine.accept_event(defend_world, str(defense.get("id", "")))
	var defense_result := EventEngine.advance_time(defend_world, 3.0, "forest")
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
	var expiry := EventEngine.advance_time(failed_world, EventEngine.DURATION + 1.0, "forest")
	if expiry.finished.size() != 1 or expiry.finished[0].get("status") != "failed" or Factions.get_reputation(failed_world, "hub-guardians") != -5:
		failures.append("accepted event expiry applies the failure reputation penalty")

	if failures.is_empty():
		print("PASS: regional event generation, acceptance, objectives, timed defense, expiry, faction rewards, claims and persistence")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)
