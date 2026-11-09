# Main story campaign progression ported from systems/campaign.js.
class_name WorldCampaignEngine
extends RefCounted
const Catalog = preload("res://godot/scripts/world_campaign_catalog.gd")
const MATERIALS := ["root-fiber","grave-salt","ember-core","frost-essence","void-dust"]
const ACT_GOLD := [18,32,50,72,100]
const ACT_EXP := [70,145,250,390,570]

const RIFT_LOCATIONS := [
	{"id":"rift-01","name":"Пепельный порог","sourceId":"forest","minLevel":1},
	{"id":"rift-02","name":"Лес обратных корней","sourceId":"briar-hollow","minLevel":1},
	{"id":"rift-03","name":"Затонувший двор","sourceId":"ruins","minLevel":1},
	{"id":"rift-04","name":"Топь без отражений","sourceId":"swamp","minLevel":1},
	{"id":"rift-05","name":"Кладбище забытых имён","sourceId":"graveyard","minLevel":1},
	{"id":"rift-06","name":"Пустошь стеклянного ветра","sourceId":"wasteland","minLevel":1},
	{"id":"rift-07","name":"Библиотека шёпота","sourceId":"library","minLevel":1},
	{"id":"rift-08","name":"Поля чёрного стекла","sourceId":"obsidian-fields","minLevel":1},
	{"id":"rift-09","name":"Ледяные катакомбы","sourceId":"ice-peaks","minLevel":1},
	{"id":"rift-10","name":"Площадь павших башен","sourceId":"sunken-necropolis","minLevel":1},
	{"id":"rift-11","name":"Грот гаснущего света","sourceId":"shadow","minLevel":1},
	{"id":"rift-12","name":"Кузня пустого солнца","sourceId":"volcano","minLevel":1},
	{"id":"rift-13","name":"Зал костяных приливов","sourceId":"sunken-necropolis","minLevel":1},
	{"id":"rift-14","name":"Долина пепельных крыльев","sourceId":"obsidian-fields","minLevel":1},
	{"id":"rift-15","name":"Сад ледяных масок","sourceId":"frost-citadel","minLevel":1},
	{"id":"rift-16","name":"Тропа расколотой луны","sourceId":"wasteland","minLevel":1},
	{"id":"rift-17","name":"Архив живой пыли","sourceId":"library","minLevel":1},
	{"id":"rift-18","name":"Болото кровавых звёзд","sourceId":"swamp","minLevel":1},
	{"id":"rift-19","name":"Трон без короля","sourceId":"graveyard","minLevel":1},
	{"id":"rift-20","name":"Порог драконьей памяти","sourceId":"dragon-lair","minLevel":1},
	{"id":"rift-21","name":"Обсерватория пустоты","sourceId":"void-crater","minLevel":50},
	{"id":"rift-22","name":"Лабиринт красного стекла","sourceId":"obsidian-fields","minLevel":50},
	{"id":"rift-23","name":"Безмолвная цитадель","sourceId":"frost-citadel","minLevel":50},
	{"id":"rift-24","name":"Некрополь последнего часа","sourceId":"sunken-necropolis","minLevel":50},
	{"id":"rift-25","name":"Сердце чёрного вулкана","sourceId":"volcano","minLevel":50},
	{"id":"rift-26","name":"Лес по ту сторону времени","sourceId":"briar-hollow","minLevel":50},
	{"id":"rift-27","name":"Крипта первых магов","sourceId":"ruins","minLevel":50},
	{"id":"rift-28","name":"Предел драконьего сна","sourceId":"dragon-lair","minLevel":50},
	{"id":"rift-29","name":"Грань немого моря","sourceId":"swamp","minLevel":50},
	{"id":"rift-30","name":"Сердцевина Разлома","sourceId":"void-crater","minLevel":50}
]

static func ensure_state(hero: Dictionary) -> void:
	if not hero.get("campaignKills",{}) is Dictionary: hero["campaignKills"]={}
	if not hero.get("campaignClaimed",{}) is Dictionary: hero["campaignClaimed"]={}
	var kills: Dictionary=hero.campaignKills
	var claimed: Dictionary=hero.campaignClaimed
	for mission in Catalog.all_missions():
		var id:=str(mission.id)
		var raw_kills: Variant = kills.get(id, 0)
		kills[id] = int(raw_kills) if _is_safe_integer(raw_kills) and int(raw_kills) >= 0 else 0
		claimed[id] = claimed.get(id, false) == true
	hero["campaignKills"]=kills
	hero["campaignClaimed"]=claimed
	if not hero.get("activeCampaignMission",null) is String: hero["activeCampaignMission"]=""


static func _is_safe_integer(value: Variant) -> bool:
	if value is int:
		return int(value) >= 0 and int(value) <= 9007199254740991
	if value is float:
		var number := float(value)
		return is_finite(number) and number >= 0.0 and number <= 9007199254740991.0 and floor(number) == number
	return false
static func get_mission(mission_id: String) -> Dictionary:
	return Catalog.find_mission(mission_id)
static func get_active(hero: Dictionary) -> Dictionary:
	ensure_state(hero)
	var id:=str(hero.get("activeCampaignMission",""))
	if id.is_empty():
		return {}
	var mission := Catalog.find_mission(id)
	if mission.is_empty() or hero.campaignClaimed.get(id, false) == true:
		hero["activeCampaignMission"] = ""
		return {}
	return mission
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
	var shard_found: bool =shard_id.is_empty() or shards.get(shard_id,false)==true
	return {"current":mini(kills,required),"kills":kills,"required":required,"complete":kills>=required and shard_found,"claimed":bool(hero.campaignClaimed.get(id,false)),"shardFound":shard_found}

static func record_shard(hero: Dictionary, shard_id: String) -> bool:
	if not ["flame", "ice", "blood"].has(shard_id):
		return false
	if not hero.get("storyShards", {}) is Dictionary:
		hero["storyShards"] = {}
	var shards: Dictionary = hero.storyShards
	shards[shard_id] = true
	hero["storyShards"] = shards
	return true

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
# Browser economy: ambient enemy gold follows the currently active campaign act.
static func act_price_multiplier(hero: Dictionary) -> float:
	var claimed: Dictionary = hero.get("campaignClaimed", {}) if hero.get("campaignClaimed", {}) is Dictionary else {}
	var multipliers := [1.0, 1.2, 1.4, 1.6, 1.8]
	for act_index in range(5):
		var act_complete := true
		for mission_index in range(1, 6):
			if claimed.get("a%d-m%d" % [act_index + 1, mission_index], false) != true:
				act_complete = false
				break
		if not act_complete:
			return multipliers[act_index]
	return multipliers[4]


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
	var campaign_allowed: bool = previous_mission_id.is_empty() or hero.campaignClaimed.get(previous_mission_id,false)==true
	var reason := "" if level_allowed and campaign_allowed else "level" if not level_allowed else "campaign"
	return {
		"allowed":level_allowed and campaign_allowed,
		"requirement":requirement,
		"currentLevel":current_level,
		"reason":reason,
		"requiredMissionId":"" if campaign_allowed else previous_mission_id
	}



static func can_complete_main_quest(world: Dictionary) -> bool:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var shards: Dictionary = hero.get("storyShards", {}) if hero.get("storyShards", {}) is Dictionary else {}
	var dragons: Dictionary = world.get("storyDragons", {}) if world.get("storyDragons", {}) is Dictionary else {}
	var progress_data := campaign_progress(hero)
	return shards.get("flame", false) == true and shards.get("ice", false) == true and shards.get("blood", false) == true and dragons.get("blood-crown", false) == true and bool(progress_data.complete)

static func is_rift_unlocked_by_story(world: Dictionary) -> bool:
	var dragons: Dictionary = world.get("storyDragons", {}) if world.get("storyDragons", {}) is Dictionary else {}
	return dragons.get("blood-crown", false) == true

static func is_rift_ready(world: Dictionary) -> bool:
	return is_rift_unlocked_by_story(world) and str(world.get("riftEnding", "")) != "closed"

static func rift_locations(level: int = 1) -> Array:
	var result: Array = []
	for location in RIFT_LOCATIONS:
		var entry: Dictionary = location.duplicate(true)
		entry["unlocked"] = maxi(1, level) >= int(entry.minLevel)
		result.append(entry)
	return result

static func get_rift_location(location_id: String) -> Dictionary:
	for location in RIFT_LOCATIONS:
		if str(location.id) == location_id:
			return location.duplicate(true)
	return {}

static func get_rift_multiplier(floor: int) -> Dictionary:
	var safe_floor := maxi(1, floor)
	return {
		"hpMult": 1.0 + float(safe_floor - 1) * 0.15,
		"atkMult": 1.0 + float(safe_floor - 1) * 0.10,
		"goldMult": 1.0 + float(safe_floor - 1) * 0.25,
		"expMult": 1.0 + float(safe_floor - 1) * 0.20
	}

static func get_rift_cleared_count(hero: Dictionary) -> int:
	var cleared: Variant = hero.get("riftClearedLocations", [])
	if not cleared is Array:
		return 0
	var valid: Dictionary = {}
	for location in RIFT_LOCATIONS:
		valid[str(location.id)] = true
	var unique: Dictionary = {}
	for id in cleared:
		if id is String and valid.has(id):
			unique[id] = true
	return unique.size()

static func record_rift_floor(hero: Dictionary, floor: int) -> bool:
	if floor < 1:
		return false
	var previous: Variant = hero.get("riftBest", 0)
	var best := int(previous) if previous is int and previous >= 0 else 0
	if floor <= best:
		return false
	hero["riftBest"] = floor
	return true


static func campaign_progress(hero: Dictionary) -> Dictionary:
	ensure_state(hero)
	var completed:=0
	for mission in Catalog.all_missions():
		if bool(hero.campaignClaimed.get(str(mission.id),false)): completed+=1
	return {"completed":completed,"total":25,"percent":int(round(float(completed)/25.0*100.0)),"complete":completed==25}
