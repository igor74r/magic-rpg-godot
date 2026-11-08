# Persistent regional events ported from systems/world-events.js.
class_name WorldEventEngine
extends RefCounted

const WorldRandomScript = preload("res://godot/scripts/world_random.gd")
const WorldGraphScript = preload("res://godot/scripts/world_graph.gd")
const RegionCatalogScript = preload("res://godot/scripts/world_region_catalog.gd")
const FactionEngineScript = preload("res://godot/scripts/world_faction_engine.gd")
const WorldStateScript = preload("res://godot/scripts/world_state.gd")

const MIN_INTERVAL := 480.0
const INTERVAL_VARIANCE := 240
const DURATION := 180.0
const MAX_ACTIVE := 2
const HISTORY_LIMIT := 50

const TEMPLATES := [
	{"id":"hub-patrol","name":"Засада на патруль","regions":["forest","briar-hollow","ruins"],"factionId":"hub-guardians","goldMin":30,"goldMax":50,"reputationReward":8,"failureReputationDelta":-5,"objectiveType":"enemy-kill","targetCount":3,"objectiveText":"Победите 3 противников, угрожающих патрулю."},
	{"id":"hub-outpost-defense","name":"Оборона пограничной заставы","regions":["forest","briar-hollow","ruins"],"factionId":"hub-guardians","goldMin":50,"goldMax":75,"reputationReward":10,"failureReputationDelta":-6,"objectiveType":"defend-region","targetCount":3,"objectiveText":"Удерживайте заставу в этом регионе 3 игровых минуты. Если покинете регион, оборона приостановится."},
	{"id":"free-trader-caravan","name":"Караван торговцев","regions":["forest","briar-hollow","swamp","graveyard","wasteland"],"factionId":"free-traders","goldMin":35,"goldMax":60,"reputationReward":8,"failureReputationDelta":-5,"objectiveType":"enemy-kill","targetCount":2,"objectiveText":"Отразите 2 нападения на торговый караван."},
	{"id":"rift-breach","name":"Локальный прорыв Разлома","regions":["shadow","graveyard","sunken-necropolis","void-crater"],"factionId":"rift-cult","goldMin":40,"goldMax":65,"reputationReward":-8,"failureReputationDelta":8,"objectiveType":"enemy-kill","targetCount":4,"objectiveText":"Победите 4 существа, вышедших из прорыва."},
	{"id":"ash-nomad-scouts","name":"Следы пепельного отряда","regions":["wasteland","volcano","obsidian-fields"],"factionId":"ash-nomads","goldMin":35,"goldMax":60,"reputationReward":8,"failureReputationDelta":-5,"objectiveType":"elite-kill","targetCount":2,"objectiveText":"Победите 2 элитных противников."},
	{"id":"ash-warband-scouting","name":"I. Следы военного отряда","regions":["wasteland","volcano","obsidian-fields"],"factionId":"ash-nomads","minFactionReputation":50,"campaignId":"ash-nomad-warband","campaignStage":1,"goldMin":45,"goldMax":60,"reputationReward":8,"failureReputationDelta":-4,"objectiveType":"elite-kill","targetCount":2,"objectiveText":"Победите двух элитных разведчиков пепельного отряда."},
	{"id":"ash-warband-champion","name":"II. Вызов предводителю","regions":["wasteland","volcano","obsidian-fields"],"factionId":"ash-nomads","campaignId":"ash-nomad-warband","campaignStage":2,"goldMin":100,"goldMax":140,"reputationReward":12,"failureReputationDelta":-8,"objectiveType":"boss-kill","targetCount":1,"objectiveText":"Найдите и победите предводителя пепельного отряда."},
	{"id":"regional-boss-bounty","name":"Охота на регионального босса","regions":["shadow","sunken-necropolis","volcano","obsidian-fields","void-crater"],"factionId":"rift-cult","minFactionReputation":30,"goldMin":90,"goldMax":130,"reputationReward":-12,"failureReputationDelta":6,"objectiveType":"boss-kill","targetCount":1,"objectiveText":"Найдите и победите регионального босса."},
	{"id":"frontier-survey","name":"Разведка неизведанной границы","regions":["forest","briar-hollow","ruins","shadow","swamp","graveyard","library","sunken-necropolis","wasteland","volcano","obsidian-fields","ice-peaks","frost-citadel","dragon-lair","void-crater"],"factionId":"free-traders","goldMin":55,"goldMax":80,"reputationReward":10,"failureReputationDelta":-4,"objectiveType":"region-discovery","targetCount":1,"objectiveText":"Откройте соседний неизведанный регион."},
	{"id":"elite-hunt","name":"Охота на элиту","regions":["forest","briar-hollow","ruins","shadow","swamp","graveyard","library","sunken-necropolis","wasteland","volcano","obsidian-fields","ice-peaks","frost-citadel","dragon-lair","void-crater"],"factionId":"","goldMin":25,"goldMax":45,"reputationReward":0,"failureReputationDelta":0,"objectiveType":"elite-kill","targetCount":1,"objectiveText":"Победите элитного противника."}
]


static func get_visible(world: Dictionary, region_id: String) -> Array:
	var events: Dictionary = world.get("events", {})
	var result: Array = []
	for event_value in events.get("active", []):
		if not event_value is Dictionary:
			continue
		var active_event: Dictionary = event_value
		if str(active_event.get("regionId", "")) == region_id and active_event.get("status") == "active":
			result.append(active_event)
	for event_value in events.get("history", []):
		if not event_value is Dictionary:
			continue
		var history_event: Dictionary = event_value
		if str(history_event.get("regionId", "")) == region_id and history_event.get("status") == "completed" and not bool(history_event.get("rewardClaimed", false)):
			result.append(history_event)
	return result


static func advance_time(world: Dictionary, delta_minutes: float, region_id: String) -> Dictionary:
	if not WorldGraphScript.region_ids().has(region_id) or not is_finite(delta_minutes) or delta_minutes <= 0.0:
		return {"changed":false,"started":[],"finished":[]}
	# Browser updateOverworld caps each frame to 15 frames (0.25 game minutes).
	var delta := minf(delta_minutes, 0.25)
	var events: Dictionary = world.get("events", {})
	if events.is_empty():
		events = {"active":[],"cooldowns":{},"history":[],"sequence":0,"nextSpawnAt":MIN_INTERVAL}
	world["events"] = events
	var now := maxf(0.0, float(world.get("clockMinutes", 0.0))) + delta
	world["clockMinutes"] = now
	var finished: Array = []
	var progressed := false
	for event_value in events.get("active", []).duplicate():
		if not event_value is Dictionary:
			continue
		var event: Dictionary = event_value
		if event.get("status") != "active":
			continue
		if bool(event.get("accepted", false)) and event.get("objectiveType") == "defend-region" and str(event.get("regionId", "")) == region_id and now < float(event.get("expiresAt", 0.0)):
			var previous_progress := int(event.get("progress", 0))
			var elapsed := minf(float(event.get("targetCount", 1)), float(event.get("holdElapsedMinutes", 0.0)) + delta)
			event["holdElapsedMinutes"] = elapsed
			event["progress"] = mini(int(event.get("targetCount", 1)), int(floor(elapsed + 0.000000001)))
			progressed = progressed or int(event.progress) > previous_progress
			event["phase"] = event.progress
			if int(event.progress) >= int(event.targetCount):
				finished.append(_finish(world, event, "completed", now))
				continue
		if now >= float(event.get("expiresAt", 0.0)):
			finished.append(_finish(world, event, "failed" if bool(event.get("accepted", false)) else "expired", now))
	for key in events.get("cooldowns", {}).keys():
		if float(events.cooldowns[key]) <= now:
			events.cooldowns.erase(key)
	var started: Array = []
	var active: Array = []
	for active_value in events.get("active", []):
		if active_value is Dictionary:
			active.append(active_value)
	var occupied := false
	for item in active:
		if str(item.get("regionId", "")) == region_id and item.get("status") == "active":
			occupied = true
	if now >= float(events.get("nextSpawnAt", MIN_INTERVAL)) and active.size() < MAX_ACTIVE and not occupied:
		var candidates: Array = []
		var discovered: Array = world.get("discoveredRegions", [])
		var campaigns: Dictionary = world.get("factionCampaigns", {})
		for template in TEMPLATES:
			if not template.regions.has(region_id):
				continue
			if template.objectiveType == "region-discovery":
				var undiscovered := false
				for neighbor in WorldGraphScript.neighbors(region_id):
					if not discovered.has(neighbor): undiscovered = true
				if not undiscovered: continue
			var campaign_id := str(template.get("campaignId", ""))
			if not campaign_id.is_empty():
				var campaign: Dictionary = campaigns.get(campaign_id, {})
				if int(template.get("campaignStage", 1)) == 1 and not campaign.is_empty(): continue
				if int(template.get("campaignStage", 1)) > 1 and (campaign.get("status") != "active" or int(campaign.get("stage", 0)) != int(template.campaignStage)): continue
			var faction_id := str(template.get("factionId", ""))
			if not faction_id.is_empty() and FactionEngineScript.get_reputation(world, faction_id) < int(template.get("minFactionReputation", -100)): continue
			if float(events.get("cooldowns", {}).get(template.id, 0.0)) > now: continue
			candidates.append(template)
		var campaign_candidates: Array = []
		for candidate in candidates:
			if not str(candidate.get("campaignId", "")).is_empty(): campaign_candidates.append(candidate)
		if not campaign_candidates.is_empty(): candidates = campaign_candidates
		if not candidates.is_empty():
			var sequence := int(events.get("sequence", 0))
			var rng := WorldRandomScript.new(WorldRandomScript.derive_seed([world.get("seed", 1), "world-event", sequence, region_id]))
			var template: Dictionary = candidates[rng.next_int(candidates.size())]
			var event_seed := WorldRandomScript.derive_seed([world.get("seed", 1), template.id, sequence, region_id])
			var reward_rng := WorldRandomScript.new(event_seed)
			var target_region := ""
			if template.objectiveType == "region-discovery":
				var choices: Array = []
				for neighbor in WorldGraphScript.neighbors(region_id):
					if not discovered.has(neighbor): choices.append(neighbor)
				if not choices.is_empty(): target_region = str(choices[reward_rng.next_int(choices.size())])
			var event := {"id":"world-event-%d" % (sequence + 1),"campaignId":template.get("campaignId", ""),"campaignStage":int(template.get("campaignStage", 0)),"templateId":template.id,"name":template.name,"factionId":template.get("factionId", ""),"requiredFactionReputation":template.get("minFactionReputation", -999),"regionId":region_id,"seed":event_seed,"status":"active","accepted":false,"phase":0,"maxPhases":int(template.targetCount),"startedAt":now,"expiresAt":now + DURATION,"rewardClaimed":false,"reputationReward":int(template.reputationReward),"failureReputationDelta":int(template.failureReputationDelta),"objectiveType":template.objectiveType,"objectiveText":("Откройте регион «%s»." % str(RegionCatalogScript.get_region(target_region).get("name", target_region))) if not target_region.is_empty() else str(template.objectiveText),"targetRegionId":target_region,"targetCount":int(template.targetCount),"progress":0,"reward":{"gold":int(template.goldMin) + reward_rng.next_int(int(template.goldMax) - int(template.goldMin) + 1)}}
			if template.objectiveType == "defend-region": event["holdElapsedMinutes"] = 0.0
			if not str(template.get("campaignId", "")).is_empty() and int(template.get("campaignStage", 1)) == 1:
				campaigns[str(template.campaignId)] = {"status":"active","stage":1,"startedAt":now}
				world["factionCampaigns"] = campaigns
			active.append(event)
			started.append(event)
			events["sequence"] = sequence + 1
			events["nextSpawnAt"] = now + MIN_INTERVAL + rng.next_int(INTERVAL_VARIANCE)
		else:
			events["nextSpawnAt"] = now + 30.0
	events["active"] = active
	return {"changed":progressed or not started.is_empty() or not finished.is_empty(),"started":started,"finished":finished}


static func accept_event(world: Dictionary, event_id: String) -> bool:
	for event in world.get("events", {}).get("active", []):
		if not event is Dictionary:
			continue
		if str(event.get("id", "")) == event_id and event.get("status") == "active" and not bool(event.get("accepted", false)):
			event["accepted"] = true
			return true
	return false


static func record_kill(world: Dictionary, region_id: String, enemy: Dictionary) -> Array:
	if enemy.is_empty() or not WorldGraphScript.region_ids().has(region_id): return []
	var completed: Array = []
	for event in world.get("events", {}).get("active", []).duplicate():
		if not event is Dictionary:
			continue
		if event.get("status") != "active" or not bool(event.get("accepted", false)) or str(event.get("regionId", "")) != region_id: continue
		var objective := str(event.get("objectiveType", ""))
		if objective == "elite-kill" and not bool(enemy.get("elite", false)) and not bool(enemy.get("boss", false)): continue
		if objective == "boss-kill" and not bool(enemy.get("boss", false)): continue
		if not ["enemy-kill","elite-kill","boss-kill"].has(objective): continue
		event["progress"] = mini(int(event.get("targetCount", 1)), int(event.get("progress", 0)) + 1)
		event["phase"] = event.progress
		if int(event.progress) >= int(event.targetCount): completed.append(_finish(world, event, "completed", float(world.get("clockMinutes", 0.0))))
	return completed


static func record_discovery(world: Dictionary, region_id: String) -> Array:
	if not WorldGraphScript.region_ids().has(region_id): return []
	var completed: Array = []
	for event_value in world.get("events", {}).get("active", []).duplicate():
		if not event_value is Dictionary:
			continue
		var event: Dictionary = event_value
		if event.get("status") != "active" or not bool(event.get("accepted", false)) or event.get("objectiveType") != "region-discovery" or str(event.get("targetRegionId", "")) != region_id:
			continue
		event["progress"] = mini(int(event.get("targetCount", 1)), int(event.get("progress", 0)) + 1)
		event["phase"] = event.progress
		if int(event.progress) >= int(event.targetCount):
			completed.append(_finish(world, event, "completed", float(world.get("clockMinutes", 0.0))))
	return completed


static func claim_reward(world: Dictionary, event_id: String) -> Dictionary:
	for event in world.get("events", {}).get("history", []):
		if not event is Dictionary:
			continue
		if str(event.get("id", "")) != event_id or event.get("status") != "completed" or bool(event.get("rewardClaimed", false)): continue
		event["rewardClaimed"] = true
		var reward: Dictionary = event.get("reward", {}).duplicate(true)
		var faction_id := str(event.get("factionId", ""))
		var reward_gold: Variant = reward.get("gold", 0)
		# Browser claimWorldEventReward applies faction scaling only to positive
		# Number.isSafeInteger values; preserve imported fractional/unsafe rewards.
		var safe_integer_gold := (reward_gold is int or reward_gold is float) and is_finite(float(reward_gold)) and floor(float(reward_gold)) == float(reward_gold) and abs(float(reward_gold)) <= 9007199254740991.0
		if safe_integer_gold and float(reward_gold) > 0.0 and not faction_id.is_empty():
			reward["gold"] = maxi(1, roundi(float(reward_gold) * (1.0 + FactionEngineScript.get_event_gold_bonus(world, faction_id))))
		return reward
	return {}


static func _finish(world: Dictionary, event: Dictionary, status: String, now: float) -> Dictionary:
	var events: Dictionary = world.get("events", {})
	var completed := event.duplicate(true)
	completed["status"] = status
	completed["finishedAt"] = now
	completed["rewardClaimed"] = false
	var campaign_id := str(event.get("campaignId", ""))
	if not campaign_id.is_empty():
		var campaigns: Dictionary = world.get("factionCampaigns", {})
		var campaign: Dictionary = campaigns.get(campaign_id, {})
		if campaign.get("status") == "active" and int(campaign.get("stage", 0)) == int(event.get("campaignStage", 0)):
			if status == "completed" and int(event.get("campaignStage", 0)) < 2:
				campaign["stage"] = int(event.campaignStage) + 1
			else:
				campaign["status"] = "completed" if status == "completed" else "failed"
			campaigns[campaign_id] = campaign
			world["factionCampaigns"] = campaigns
	var faction_id := str(event.get("factionId", ""))
	if status == "completed" and not faction_id.is_empty() and int(event.get("reputationReward", 0)) != 0:
		FactionEngineScript.change_reputation(world, faction_id, int(event.reputationReward), str(event.name), "world-event")
	elif status == "failed" and bool(event.get("accepted", false)) and not faction_id.is_empty() and int(event.get("failureReputationDelta", 0)) != 0:
		FactionEngineScript.change_reputation(world, faction_id, int(event.failureReputationDelta), "Провал: %s" % str(event.name), "world-event")
	if faction_id == "hub-guardians" and status in ["completed","failed"]:
		var region: Dictionary = WorldStateScript.get_region_record(world, str(event.regionId))
		if not region.is_empty(): region["securityThreat"] = clampi(int(region.get("securityThreat", 0)) + (-1 if status == "completed" else 1), 0, 3)
	events["history"].append(completed)
	while events.history.size() > HISTORY_LIMIT:
		var remove_index := -1
		for index in range(events.history.size()):
			var old_value: Variant = events.history[index]
			if not old_value is Dictionary:
				remove_index = index
				break
			var old: Dictionary = old_value
			if old.get("status") != "completed" or bool(old.get("rewardClaimed", false)):
				remove_index = index
				break
		if remove_index < 0: break
		events.history.remove_at(remove_index)
	var cooldown_rng := WorldRandomScript.new(WorldRandomScript.derive_seed([world.get("seed", 1), "world-event-cooldown", event.id]))
	events["cooldowns"][str(event.templateId)] = now + MIN_INTERVAL + cooldown_rng.next_int(INTERVAL_VARIANCE)
	var remaining: Array = []
	for active_value in events.get("active", []):
		if not active_value is Dictionary:
			continue
		var active_event: Dictionary = active_value
		if str(active_event.get("id", "")) != str(event.id):
			remaining.append(active_event)
	events["active"] = remaining
	return completed

