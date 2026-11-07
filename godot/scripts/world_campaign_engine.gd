# Main story campaign progression ported from systems/campaign.js.
class_name WorldCampaignEngine
extends RefCounted
const Catalog = preload("res://godot/scripts/world_campaign_catalog.gd")
const MATERIALS := ["root-fiber","grave-salt","ember-core","frost-essence","void-dust"]
const ACT_GOLD := [18,32,50,72,100]
const ACT_EXP := [70,145,250,390,570]
static func ensure_state(hero: Dictionary) -> void:
	if not hero.get("campaignKills",{}) is Dictionary: hero["campaignKills"]={}
	if not hero.get("campaignClaimed",{}) is Dictionary: hero["campaignClaimed"]={}
	var kills: Dictionary=hero.campaignKills
	var claimed: Dictionary=hero.campaignClaimed
	for mission in Catalog.all_missions():
		var id:=str(mission.id)
		kills[id]=maxi(0,int(kills.get(id,0)))
		claimed[id]=claimed.get(id,false)==true
	hero["campaignKills"]=kills
	hero["campaignClaimed"]=claimed
	if not hero.get("activeCampaignMission",null) is String: hero["activeCampaignMission"]=""
static func get_mission(mission_id: String) -> Dictionary:
	return Catalog.find_mission(mission_id)
static func get_active(hero: Dictionary) -> Dictionary:
	ensure_state(hero)
	var id:=str(hero.get("activeCampaignMission",""))
	if id.is_empty() or bool(hero.campaignClaimed.get(id,false)): return {}
	return Catalog.find_mission(id)
static func get_next(hero: Dictionary) -> Dictionary:
	ensure_state(hero)
	var active:=get_active(hero)
	if not active.is_empty(): return active
	for mission in Catalog.all_missions():
		if not bool(hero.campaignClaimed.get(str(mission.id),false)): return mission
	return {}
static func accept(hero: Dictionary,mission_id: String="") -> bool:
	ensure_state(hero)
	var active:=get_active(hero)
	if not active.is_empty(): return mission_id.is_empty() or str(active.id)==mission_id
	var next:=get_next(hero)
	if next.is_empty() or (not mission_id.is_empty() and str(next.id)!=mission_id): return false
	hero["activeCampaignMission"]=str(next.id)
	return true
static func progress(hero: Dictionary,mission: Dictionary) -> Dictionary:
	ensure_state(hero)
	var id:=str(mission.get("id",""))
	var required:=maxi(1,int(mission.get("count",1)))
	var kills:=maxi(0,int(hero.campaignKills.get(id,0)))
	var shard_id:=str(mission.get("shardId",""))
	var shards: Dictionary=hero.get("storyShards",{})
	var shard_found:=shard_id.is_empty() or bool(shards.get(shard_id,false))
	return {"current":mini(kills,required),"kills":kills,"required":required,"complete":kills>=required and shard_found,"claimed":bool(hero.campaignClaimed.get(id,false)),"shardFound":shard_found}
static func record_kill(world: Dictionary,location_id: String,enemy_id: String) -> String:
	var hero: Dictionary=world.get("hero",{})
	if hero.is_empty(): return ""
	ensure_state(hero)
	var mission:=get_active(hero)
	if mission.is_empty() or str(mission.get("locationId",""))!=location_id or str(mission.get("enemyId",""))!=enemy_id: return ""
	var p:=progress(hero,mission)
	if bool(p.complete): return ""
	var id:=str(mission.id)
	hero.campaignKills[id]=mini(int(p.required),int(p.kills)+1)
	world["hero"]=hero
	var now:=progress(hero,mission)
	return "Сюжет: %s (%d/%d)" % [str(mission.title),int(now.current),int(now.required)]
static func reward_for(mission: Dictionary) -> Dictionary:
	var parts:=str(mission.get("id","a1-m1")).split("-")
	var act:=clampi(int(str(parts[0]).trim_prefix("a")),1,5)
	var stage:=clampi(int(str(parts[1]).trim_prefix("m")),1,5)
	var bonus:=1.2 if stage>=4 else 1.0
	return {"gold":int(round(float(ACT_GOLD[act-1]+(stage-1)*5)*bonus)),"exp":ACT_EXP[act-1]+(stage-1)*int(round(float(ACT_EXP[act-1])*0.12)),"itemId":MATERIALS[act-1]}
static func claim(hero: Dictionary) -> Dictionary:
	ensure_state(hero)
	var mission:=get_active(hero)
	if mission.is_empty(): return {"ok":false,"message":"Нет активного сюжетного задания"}
	var p:=progress(hero,mission)
	if not bool(p.complete): return {"ok":false,"message":"Сначала выполните цель задания"}
	var reward:=reward_for(mission)
	var id:=str(mission.id)
	hero.campaignClaimed[id]=true
	hero.activeCampaignMission=""
	return {"ok":true,"mission":mission,"reward":reward,"message":"Задание завершено: %s" % str(mission.title)}
static func story_location_progression() -> Array:
	var locations: Array = []
	var seen: Dictionary = {}
	var previous_mission_id := ""
	var act_base_levels := [1, 11, 21, 31, 41]
	for mission in Catalog.all_missions():
		var mission_id := str(mission.get("id", ""))
		var parts := mission_id.split("-")
		if parts.size()!=2:
			continue
		var act_number := clampi(int(str(parts[0]).trim_prefix("a")),1,5)
		var mission_index := maxi(0,int(str(parts[1]).trim_prefix("m"))-1)
		var location_id := str(mission.get("locationId",""))
		if location_id.is_empty():
			continue
		if not seen.has(location_id):
			var required_level := mini(100,int(act_base_levels[act_number-1])+mission_index*2)
			locations.append({
				"id":location_id,
				"sequence":locations.size()+1,
				"actNumber":act_number,
				"requiredLevel":required_level,
				"unlockAfterMissionId":previous_mission_id,
				"unlockMissionId":mission_id
			})
			seen[location_id]=true
		previous_mission_id=mission_id
	return locations


static func story_location_requirement(location_id: String) -> Dictionary:
	for requirement in story_location_progression():
		if str(requirement.get("id",""))==location_id:
			return requirement
	return {}


static func can_enter_location(hero: Dictionary, location_id: String) -> Dictionary:
	ensure_state(hero)
	var requirement := story_location_requirement(location_id)
	var current_level := maxi(1,int(hero.get("level",1)))
	if requirement.is_empty():
		return {"allowed":true,"requirement":{},"currentLevel":current_level,"reason":""}
	var level_allowed := current_level>=int(requirement.requiredLevel)
	var previous_mission_id := str(requirement.get("unlockAfterMissionId",""))
	var campaign_allowed := previous_mission_id.is_empty() or hero.campaignClaimed.get(previous_mission_id,false)==true
	var reason := "" if level_allowed and campaign_allowed else "level" if not level_allowed else "campaign"
	return {
		"allowed":level_allowed and campaign_allowed,
		"requirement":requirement,
		"currentLevel":current_level,
		"reason":reason,
		"requiredMissionId":"" if campaign_allowed else previous_mission_id
	}


static func campaign_progress(hero: Dictionary) -> Dictionary:
	ensure_state(hero)
	var completed:=0
	for mission in Catalog.all_missions():
		if bool(hero.campaignClaimed.get(str(mission.id),false)): completed+=1
	return {"completed":completed,"total":25,"percent":int(round(float(completed)/25.0*100.0)),"complete":completed==25}
