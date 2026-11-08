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
static func get_quests(world: Dictionary, now_ms: int = -1) -> Array:
	var current_ms := int(Time.get_unix_time_from_system() * 1000.0) if now_ms < 0 else now_ms
	var key := today_key()
	var saved: Dictionary = world.get("dailyQuests",{}) if world.get("dailyQuests",{}) is Dictionary else {}
	var list: Array = saved.get("list",[]) if saved.get("list",[]) is Array else []
	# Browser saves persist Date.now() milliseconds and rotate quests only after
	# a rolling 24-hour window. Accept the old native YYYY-MM-DD key once.
	var raw_date: Variant = saved.get("date", 0)
	var last_ms := 0
	if raw_date is int or raw_date is float:
		var date_number := float(raw_date)
		if is_finite(date_number) and floor(date_number) == date_number and date_number >= 0.0 and date_number <= float(current_ms) and date_number <= 9007199254740991.0:
			last_ms = int(date_number)
	elif raw_date is String and str(raw_date) == key:
		last_ms = current_ms
	var expired := last_ms == 0 or current_ms - last_ms > 86400000
	if expired or list.size() != 3:
		var shuffled: Array = POOL.duplicate(true)
		var rng := RandomNumberGenerator.new()
		rng.seed = int(WorldRandom.derive_seed([world.get("seed",1),current_ms,"daily-quests"]))
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
		world["dailyQuests"]={"date":current_ms,"list":list}
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
			var raw_current: Variant = entry.get("current",0)
			var progress := 0
			if raw_current is int:
				progress = int(raw_current) if abs(float(raw_current)) <= 9007199254740991.0 else 0
			elif raw_current is float and is_finite(raw_current) and floor(raw_current) == raw_current and abs(raw_current) <= 9007199254740991.0:
				progress = int(raw_current)
			quest["current"]=clampi(progress,0,int(definition.max))
			quest["completed"]=int(quest.current)>=int(quest.max)
			quest["claimed"]=entry.get("claimed",false)==true and bool(quest.completed)
			normalized.append(quest)
		world["dailyQuests"]={"date":last_ms,"list":normalized}
		if normalized.size()!=3:
			world["dailyQuests"]={"date":current_ms,"list":[]}
			return get_quests(world,current_ms)
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
# Set a cumulative objective (such as the deepest Rift floor reached) without
# incrementing it once per UI refresh or allowing progress to move backwards.
static func set_progress(world: Dictionary,kind: String,target: String,value: int) -> void:
	if value < 0:return
	var quests := get_quests(world)
	for quest in quests:
		if bool(quest.completed) or bool(quest.claimed) or str(quest.type)!=kind:continue
		if str(quest.target)!="any" and str(quest.target)!=target:continue
		quest["current"]=mini(int(quest.max),maxi(int(quest.current),value))
		quest["completed"]=int(quest.current)>=int(quest.max)

static func claim(world: Dictionary,quest_id: String) -> Dictionary:
	var hero: Dictionary=world.get("hero",{})
	if hero.is_empty():return {"ok":false,"message":"Нет персонажа"}
	for quest in get_quests(world):
		if str(quest.id)!=quest_id:continue
		if not bool(quest.completed) or bool(quest.claimed):return {"ok":false,"message":"Задание ещё не выполнено или награда уже получена"}
		var gold := int(quest.gold)
		var current_gold := hero.get("gold", 0)
		if not (current_gold is int) or int(current_gold) < 0 or int(current_gold) > 9007199254740991 - gold:
			return {"ok": false, "message": "Невозможно выдать награду: проверьте баланс золота."}
		var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
		var current_earned: Variant = stats.get("goldEarned", 0)
		if not (current_earned is int) or int(current_earned) < 0 or int(current_earned) > 9007199254740991 - gold:
			return {"ok": false, "message": "Невозможно обновить статистику заработанного золота."}
		var exp := int(quest.exp)
		# Mirror the browser reward transaction: balance, lifetime-earned gold,
		# experience, and claimed state are updated together only after validation.
		hero["gold"] = int(current_gold) + gold
		stats["goldEarned"] = int(current_earned) + gold
		hero["stats"] = stats
		var level_ups := WorldCombatEngine.grant_experience(hero, exp)
		quest["claimed"] = true
		world["hero"] = hero
		var achievements: Array = preload("res://godot/scripts/world_achievement_engine.gd").evaluate(world)
		return {"ok": true, "message": "Награда: +%d золота, +%d опыта" % [gold, exp], "levelUps": level_ups, "achievements": achievements}
	return {"ok":false,"message":"Задание не найдено"}


# Browser parity: the daily chest is available once per rolling 24-hour period.
# Timestamps stay in milliseconds so imported browser v18 saves remain compatible.
static func can_open_daily(world: Dictionary, now_ms: int = -1) -> bool:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	if hero.is_empty():
		return false
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	var current_ms := now_ms if now_ms >= 0 else int(Time.get_unix_time_from_system() * 1000.0)
	var last_ms := maxi(0, int(stats.get("dailyChestAt", 0)))
	return current_ms >= last_ms and current_ms - last_ms >= 86400000


static func daily_chest_time_remaining(world: Dictionary, now_ms: int = -1) -> int:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	var current_ms := now_ms if now_ms >= 0 else int(Time.get_unix_time_from_system() * 1000.0)
	var last_ms := maxi(0, int(stats.get("dailyChestAt", 0)))
	if last_ms == 0 or current_ms < last_ms:
		return 0
	return maxi(0, 86400000 - (current_ms - last_ms))


static func open_daily_chest(world: Dictionary, now_ms: int = -1) -> Dictionary:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	if hero.is_empty():
		return {"ok": false, "message": "Нет персонажа."}
	var current_ms := now_ms if now_ms >= 0 else int(Time.get_unix_time_from_system() * 1000.0)
	if not can_open_daily(world, current_ms):
		return {"ok": false, "message": "Ежедневный сундук ещё не готов.", "remainingMs": daily_chest_time_remaining(world, current_ms)}
	var gold := int(hero.get("gold", 0))
	if gold < 0 or gold > 2147483639:
		return {"ok": false, "message": "Невозможно выдать награду: проверьте баланс золота."}
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	var daily_count := int(stats.get("dailyChestsOpened", 0))
	var earned := int(stats.get("goldEarned", 0))
	if daily_count < 0 or daily_count >= 2147483647 or earned < 0 or earned > 2147483639:
		return {"ok": false, "message": "Счётчик ежедневных сундуков или заработанного золота переполнен."}
	var pool := ["health-potion", "mana-potion", "strong-health-potion", "strong-mana-potion"]
	var rng := RandomNumberGenerator.new()
	rng.seed = int(WorldRandom.derive_seed([world.get("seed", 1), current_ms, "daily-chest"]))
	var item_id := str(pool[rng.randi_range(0, pool.size() - 1)])
	if not WorldCombatEngine.add_item(hero, item_id, 1):
		return {"ok": false, "message": "Не удалось подготовить предмет ежедневной награды."}
	hero["gold"] = gold + 8
	stats["goldEarned"] = earned + 8
	stats["dailyChestAt"] = current_ms
	stats["dailyChestsOpened"] = daily_count + 1
	hero["stats"] = stats
	world["hero"] = hero
	var achievements: Array = preload("res://godot/scripts/world_achievement_engine.gd").evaluate(world)
	return {"ok": true, "message": "Ежедневный сундук открыт: +8 золота и %s." % item_id, "itemId": item_id, "gold": 8, "achievements": achievements}
