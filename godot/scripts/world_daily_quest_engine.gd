# Daily kill/chest/rift objectives ported from systems/dailyQuests.js.
class_name WorldDailyQuestEngine
extends RefCounted
const POOL := [
	{"id":"q-kill-any","type":"kill","text":"Убей 10 врагов","target":"any","max":10,"gold":8,"exp":50},
	{"id":"q-kill-goblin","type":"kill","text":"Убей 5 гоблинов","target":"goblin","max":5,"gold":6,"exp":30},
	{"id":"q-kill-skeleton","type":"kill","text":"Убей 5 скелетов","target":"skeleton","max":5,"gold":6,"exp":30},
	{"id":"q-kill-wolf","type":"kill","text":"Убей 3 волков","target":"wolf","max":3,"gold":5,"exp":20},
	{"id":"q-rift-floor","type":"rift","text":"Достигни 3 этажа Разлома","target":"floor","max":3,"gold":16,"exp":100},
	{"id":"q-chest","type":"chest","text":"Открой 3 сундука","target":"chest","max":3,"gold":6,"exp":25}
]
static func today_key() -> String:
	var date: Dictionary = Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [int(date.year),int(date.month),int(date.day)]
static func get_quests(world: Dictionary) -> Array:
	var key := today_key()
	var saved: Dictionary = world.get("dailyQuests",{}) if world.get("dailyQuests",{}) is Dictionary else {}
	var list: Array = saved.get("list",[]) if saved.get("list",[]) is Array else []
	if str(saved.get("date","")) != key or list.size()!=3:
		var shuffled: Array = POOL.duplicate(true)
		var rng := RandomNumberGenerator.new()
		rng.seed = int(WorldRandom.derive_seed([world.get("seed",1),key,"daily-quests"]))
		for i in range(shuffled.size()-1,0,-1):
			var j := rng.randi_range(0,i)
			var temp: Variant = shuffled[i]
			shuffled[i]=shuffled[j]
			shuffled[j]=temp
		list=[]
		for i in range(3):
			var quest: Dictionary = shuffled[i].duplicate(true)
			quest["current"]=0
			quest["completed"]=false
			quest["claimed"]=false
			list.append(quest)
		world["dailyQuests"]={"date":key,"list":list}
	else:
		var normalized: Array=[]
		var seen: Array=[]
		for entry in list:
			if not entry is Dictionary: continue
			var definition: Dictionary={}
			for candidate in POOL:
				if str(candidate.id)==str(entry.get("id","")): definition=candidate;break
			if definition.is_empty() or seen.has(definition.id): continue
			seen.append(definition.id)
			var quest: Dictionary=definition.duplicate(true)
			quest["current"]=clampi(int(entry.get("current",0)),0,int(definition.max))
			quest["completed"]=int(quest.current)>=int(quest.max)
			quest["claimed"]=bool(entry.get("claimed",false)) and bool(quest.completed)
			normalized.append(quest)
		world["dailyQuests"]={"date":key,"list":normalized}
		if normalized.size()!=3: return get_quests_with_reset(world,key)
	return world.dailyQuests.list
static func get_quests_with_reset(world: Dictionary,key: String) -> Array:
	world.erase("dailyQuests")
	return get_quests(world)
static func update_progress(world: Dictionary,kind: String,target: String,amount: int=1) -> void:
	if amount<=0:return
	var quests := get_quests(world)
	for quest in quests:
		if bool(quest.completed) or bool(quest.claimed) or str(quest.type)!=kind:continue
		if str(quest.target)!="any" and str(quest.target)!=target:continue
		quest["current"]=mini(int(quest.max),int(quest.current)+amount)
		quest["completed"]=int(quest.current)>=int(quest.max)
static func claim(world: Dictionary,quest_id: String) -> Dictionary:
	var hero: Dictionary=world.get("hero",{})
	if hero.is_empty():return {"ok":false,"message":"Нет персонажа"}
	for quest in get_quests(world):
		if str(quest.id)!=quest_id:continue
		if not bool(quest.completed) or bool(quest.claimed):return {"ok":false,"message":"Задание ещё не выполнено или награда уже получена"}
		var gold:=int(quest.gold)
		if int(hero.get("gold",0))>2147483647-gold:return {"ok":false,"message":"Слишком много золота"}
		hero["gold"]=int(hero.get("gold",0))+gold
		var exp:=int(quest.exp)
		var level_ups:=WorldCombatEngine.grant_experience(hero,exp)
		quest["claimed"]=true
		world["hero"]=hero
		return {"ok":true,"message":"Награда: +%d золота, +%d опыта" % [gold,exp],"levelUps":level_ups}
	return {"ok":false,"message":"Задание не найдено"}
