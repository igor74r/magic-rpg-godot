# Native achievement rules ported from data/achievements.js.
class_name WorldAchievementEngine
extends RefCounted

const DEFINITIONS := [
	{"id":"first-blood","name":"Первая кровь","desc":"Убей первого врага","reward":3,"target":1,"metric":"total_kills","key":""},
	{"id":"goblin-slayer","name":"Гроза гоблинов","desc":"Убей 10 гоблинов","reward":8,"target":10,"metric":"kill","key":"goblin"},
	{"id":"skeleton-slayer","name":"Костолом","desc":"Убей 10 скелетов","reward":8,"target":10,"metric":"kill","key":"skeleton"},
	{"id":"wolf-hunter","name":"Охотник на волков","desc":"Убей 5 волков","reward":9,"target":5,"metric":"kill","key":"wolf"},
	{"id":"treasure-hunter","name":"Кладоискатель","desc":"Открой 10 сундуков","reward":12,"target":10,"metric":"stat","key":"chestsOpened"},
	{"id":"rich","name":"Богач","desc":"Заработай 1000 золота за всё время","reward":15,"target":1000,"metric":"stat","key":"goldEarned"},
	{"id":"level-5","name":"Опытный боец","desc":"Достигни 5 уровня","reward":8,"target":5,"metric":"level","key":""},
	{"id":"level-10","name":"Ветеран","desc":"Достигни 10 уровня","reward":22,"target":10,"metric":"level","key":""},
	{"id":"shard-flame","name":"Осколок Пламени","desc":"Получи осколок после победы над Пепельным Вестником","reward":15,"target":1,"metric":"shard","key":"flame"},
	{"id":"shard-ice","name":"Осколок Льда","desc":"Получи осколок после победы над Ледяной Хваткой","reward":22,"target":1,"metric":"shard","key":"ice"},
	{"id":"shard-blood","name":"Осколок Крови","desc":"Получи осколок после победы над Кровавой Короной","reward":30,"target":1,"metric":"shard","key":"blood"},
	{"id":"elite-slayer","name":"Охотник на элиту","desc":"Убей 5 элитных врагов","reward":18,"target":5,"metric":"stat","key":"eliteKills"},
	{"id":"boss-slayer","name":"Убийца боссов","desc":"Убей 2 мини-боссов","reward":27,"target":2,"metric":"stat","key":"bossKills"},
	{"id":"daily-devotee","name":"Каждый день","desc":"Открой 3 ежедневных сундука","reward":22,"target":3,"metric":"stat","key":"dailyChestsOpened"},
	{"id":"completionist","name":"Завершение","desc":"Собери все три осколка Кристалла Разлома","reward":75,"target":1,"metric":"all_shards","key":""},
	{"id":"rift-10","name":"Покоритель Разлома","desc":"Достигни 10 этажа Разлома","reward":30,"target":10,"metric":"rift","key":""},
	{"id":"rift-25","name":"Хозяин Разлома","desc":"Достигни 25 этажа Разлома","reward":60,"target":25,"metric":"rift","key":""},
	{"id":"rift-50","name":"Легенда Разлома","desc":"Достигни 50 этажа Разлома","reward":150,"target":50,"metric":"rift","key":""},
	{"id":"dragon-slayer","name":"Убийца драконов","desc":"Победи Кровавую Корону","reward":150,"target":1,"metric":"kill","key":"ancient-dragon"}
]


const ICONS := {
	"first-blood":"🩸", "goblin-slayer":"👺", "skeleton-slayer":"💀",
	"wolf-hunter":"🐺", "treasure-hunter":"📦", "rich":"💰",
	"level-5":"⬆️", "level-10":"🌟", "shard-flame":"🔥", "shard-ice":"❄️",
	"shard-blood":"🩸", "elite-slayer":"★", "boss-slayer":"☠️",
	"daily-devotee":"🎁", "completionist":"🏆", "rift-10":"🌀",
	"rift-25":"🌀", "rift-50":"🌀", "dragon-slayer":"🐲"
}


static func progress_value(world: Dictionary, definition: Dictionary) -> int:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	return _progress(world, hero, definition)


static func get_progress(world: Dictionary, definition: Dictionary) -> Dictionary:
	var current := progress_value(world, definition)
	var target := maxi(1, int(definition.get("target", 1)))
	return {"current": mini(target, current), "target": target, "complete": current >= target}


static func evaluate(world: Dictionary) -> Array:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var unlocked: Array = hero.get("achievements", []) if hero.get("achievements", []) is Array else []
	var newly_unlocked: Array = []
	var gold := int(hero.get("gold", 0))
	if gold < 0 or gold > 2147483647:
		return newly_unlocked
	for definition in DEFINITIONS:
		var id := str(definition.id)
		if unlocked.has(id):
			continue
		var progress := _progress(world, hero, definition)
		if progress < int(definition.target):
			continue
		var reward := int(definition.reward)
		if gold > 2147483647 - reward:
			continue
		gold += reward
		unlocked.append(id)
		newly_unlocked.append({"id":id,"name":str(definition.name),"desc":str(definition.desc),"reward":reward})
	hero["gold"] = gold
	hero["achievements"] = unlocked
	world["hero"] = hero
	return newly_unlocked


static func unlocked_count(hero: Dictionary) -> int:
	var unlocked: Array = hero.get("achievements", []) if hero.get("achievements", []) is Array else []
	var known := {}
	for definition in DEFINITIONS:
		if unlocked.has(str(definition.id)):
			known[str(definition.id)] = true
	return known.size()


static func _progress(world: Dictionary, hero: Dictionary, definition: Dictionary) -> int:
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	var metric := str(definition.metric)
	var key := str(definition.key)
	match metric:
		"total_kills":
			var kills: Dictionary = stats.get("kills", {}) if stats.get("kills", {}) is Dictionary else {}
			var total := 0
			for value in kills.values():
				total = mini(2147483647, total + maxi(0, int(value)))
			return total
		"kill":
			var kills: Dictionary = stats.get("kills", {}) if stats.get("kills", {}) is Dictionary else {}
			return maxi(0, int(kills.get(key, 0)))
		"stat":
			return maxi(0, int(stats.get(key, 0)))
		"level":
			return maxi(1, int(hero.get("level", 1)))
		"shard":
			var shards: Dictionary = hero.get("storyShards", world.get("storyShards", {})) if hero.get("storyShards", world.get("storyShards", {})) is Dictionary else {}
			return 1 if shards.get(key, false) == true else 0
		"all_shards":
			var shards: Dictionary = hero.get("storyShards", world.get("storyShards", {})) if hero.get("storyShards", world.get("storyShards", {})) is Dictionary else {}
			return 1 if shards.get("flame", false) == true and shards.get("ice", false) == true and shards.get("blood", false) == true else 0
		"rift":
			return maxi(0, int(hero.get("riftBest", 0)))
	return 0
