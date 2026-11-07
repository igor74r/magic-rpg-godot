# Native NPC service actions and dialogue state.
class_name WorldNpcEngine
extends RefCounted
const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const Catalog = preload("res://godot/scripts/world_npc_catalog.gd")
static func talk(npc_id: String) -> Dictionary:
	var npc := Catalog.get_npc(npc_id)
	if npc.is_empty(): return {"ok":false,"message":"Персонаж не найден."}
	var greetings: Array=npc.get("greetings",[])
	var greeting:=str(greetings[0]) if not greetings.is_empty() else "..."
	return {"ok":true,"npc":npc,"message":"%s\n«%s»" % [str(npc.name),greeting]}
static func hero_for(world: Dictionary) -> Dictionary:
	return Combat.ensure_hero(world)
static func has_entry(hero: Dictionary,key: String,field: String="buffs") -> bool:
	var entries: Array=hero.get(field,[])
	for entry in entries:
		if entry is Dictionary and str(entry.get("id",""))==key and int(entry.get("duration",0))>0: return true
	return false
static func heal(world: Dictionary) -> Dictionary:
	var hero:=hero_for(world)
	if int(hero.hp)>=int(hero.maxHp) and int(hero.mp)>=int(hero.maxMp): return {"ok":false,"message":"Вы уже полностью здоровы."}
	if int(hero.gold)<8: return {"ok":false,"message":"Нужно 8 золота."}
	hero["gold"]=int(hero.gold)-8
	hero["hp"]=int(hero.maxHp)
	hero["mp"]=int(hero.maxMp)
	world["hero"]=hero
	return {"ok":true,"message":"Лекарь Мирра восстановила здоровье и ресурс за 8 золота."}
static func use_well(world: Dictionary,now: int=-1) -> Dictionary:
	var hero:=hero_for(world)
	var current:=int(Time.get_unix_time_from_system()) if now<0 else now
	var last:=maxi(0,int(hero.get("lastWellUse",0)))
	if current-last<86400: return {"ok":false,"message":"Колодец снова исцелит через 24 часа."}
	if int(hero.hp)>=int(hero.maxHp) and (str(hero.get("class",""))=="warrior" or int(hero.mp)>=int(hero.maxMp)): return {"ok":false,"message":"Вы уже полностью здоровы."}
	hero["hp"]=int(hero.maxHp)
	if str(hero.get("class",""))!="warrior": hero["mp"]=int(hero.maxMp)
	hero["lastWellUse"]=current
	world["hero"]=hero
	return {"ok":true,"message":"Древний колодец полностью восстановил ваши силы."}
static func pay_bard(world: Dictionary) -> Dictionary:
	var hero:=hero_for(world)
	if has_entry(hero,"bardBuff"): return {"ok":false,"message":"Песня барда уже действует."}
	if int(hero.gold)<15: return {"ok":false,"message":"Бард просит 15 золота."}
	hero["gold"]=int(hero.gold)-15
	var buffs: Array=hero.get("buffs",[])
	buffs.append({"id":"bardBuff","duration":3})
	hero["buffs"]=buffs
	world["hero"]=hero
	return {"ok":true,"message":"Бард вдохновил вас: +10% опыта на 3 победы."}
static func take_blessing(world: Dictionary) -> Dictionary:
	var hero:=hero_for(world)
	if has_entry(hero,"elderBlessing","effects"): return {"ok":false,"message":"Благословение уже действует."}
	var effects: Array=hero.get("effects",[])
	effects.append({"id":"elderBlessing","duration":10})
	hero["effects"]=effects
	world["hero"]=hero
	return {"ok":true,"message":"Благословение старейшины: +20% опыта на 10 побед."}
static func campaign_action(world: Dictionary,claim_reward: bool=false) -> Dictionary:
	var hero:=hero_for(world)
	if not claim_reward:
		var next:=Campaign.get_next(hero)
		if next.is_empty(): return {"ok":false,"message":"Все сюжетные поручения завершены."}
		if not Campaign.accept(hero,str(next.id)): return {"ok":false,"message":"Не удалось принять поручение."}
		world["hero"]=hero
		return {"ok":true,"message":"Принято поручение: %s" % str(next.title)}
	var result:=Campaign.claim(hero)
	if not bool(result.get("ok",false)): return result
	var reward: Dictionary=result.reward
	hero["gold"]=mini(2147483647,int(hero.get("gold",0))+int(reward.gold))
	Combat.grant_experience(hero,int(reward.exp))
	Combat.add_item(hero,str(reward.itemId),1)
	world["hero"]=hero
	return {"ok":true,"message":"%s · +%d золота, +%d опыта, материал %s" % [str(result.message),int(reward.gold),int(reward.exp),str(reward.itemId)]}
