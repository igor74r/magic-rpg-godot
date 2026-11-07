# Passive allocation and bonus aggregation from systems/talents.js.
class_name WorldPassiveEngine
extends RefCounted
const Tree = preload("res://godot/scripts/world_passive_tree.gd")
const TalentCatalog = preload("res://godot/scripts/world_talent_catalog.gd")
const MULTIPLIER_KEYS := ["dmgMult","healMult","spellMult","defMult","meteorMult","prayerMult"]
const ADDITIVE_KEYS := ["critChance","lifesteal","manaRegen","hpRegen","abilityCdDelta","dodgeChance","blockChance","armorPen","atkFlat","magFlat","defFlat","dexFlat"]
static func ensure_passives(hero: Dictionary) -> void:
	var passives: Array = hero.get("passives",[]) if hero.get("passives",[]) is Array else []
	if passives.is_empty(): passives=["start"]
	elif not passives.has("start"): passives.push_front("start")
	hero["passives"]=passives
	hero["passivePoints"]=maxi(0,int(hero.get("passivePoints",0)))
static func can_allocate(hero: Dictionary,node_id: String) -> bool:
	if hero.is_empty() or node_id.is_empty() or node_id=="start": return false
	var nodes: Dictionary = Tree.get_tree(str(hero.get("class","warrior"))).nodes
	if not nodes.has(node_id): return false
	ensure_passives(hero)
	var node: Dictionary = nodes[node_id]
	if hero.passives.has(node_id) or int(hero.passivePoints)<=0 or int(hero.get("level",1))<int(node.levelReq): return false
	for parent_id in node.conn:
		if hero.passives.has(parent_id): return true
	return false
static func node_status(hero: Dictionary,node_id: String) -> String:
	if hero.is_empty(): return "Нет данных персонажа"
	if node_id=="start": return "Стартовый узел"
	var nodes: Dictionary = Tree.get_tree(str(hero.get("class","warrior"))).nodes
	if not nodes.has(node_id): return "Узел не найден"
	ensure_passives(hero)
	var node: Dictionary = nodes[node_id]
	if hero.passives.has(node_id): return "Уже изучено"
	if int(hero.passivePoints)<=0: return "Нет свободных очков навыков"
	if int(hero.get("level",1))<int(node.levelReq): return "Требуется уровень %d (текущий: %d)" % [int(node.levelReq),int(hero.level)]
	for parent_id in node.conn:
		if hero.passives.has(parent_id): return "Доступно для изучения"
	return "Сначала изучите соединённый узел"
static func allocate(hero: Dictionary,node_id: String) -> Dictionary:
	if not can_allocate(hero,node_id): return {"ok":false,"message":node_status(hero,node_id)}
	var node: Dictionary = Tree.get_node(str(hero.get("class","warrior")),node_id)
	var passives: Array = hero.passives.duplicate()
	passives.append(node_id)
	hero["passives"]=passives
	hero["passivePoints"]=maxi(0,int(hero.passivePoints)-1)
	return {"ok":true,"message":"Изучено: %s" % str(node.get("name",node_id)),"node":node}
static func reset(hero: Dictionary) -> Dictionary:
	if hero.is_empty(): return {"ok":false,"message":"Нет персонажа"}
	ensure_passives(hero)
	var allocated: Array = hero.passives.filter(func(id): return str(id)!="start")
	if allocated.is_empty(): return {"ok":false,"message":"Нет изученных пассивных навыков"}
	if int(hero.get("gold",0))<500: return {"ok":false,"message":"Нужно 500 золота"}
	hero["gold"]=int(hero.gold)-500
	hero["passivePoints"]=int(hero.passivePoints)+allocated.size()
	hero["passives"]=["start"]
	return {"ok":true,"refunded":allocated.size(),"cost":500}

static func can_take_talent(hero: Dictionary,talent_id: String) -> bool:
	if hero.is_empty(): return false
	var talent: Dictionary = TalentCatalog.find_talent(str(hero.get("class","warrior")),talent_id)
	if talent.is_empty(): return false
	var taken: Array = hero.get("talents",[]) if hero.get("talents",[]) is Array else []
	if taken.has(talent_id) or int(hero.get("level",1))<int(talent.tier): return false
	for old_id in taken:
		var old: Dictionary = TalentCatalog.find_talent(str(hero.get("class","warrior")),str(old_id))
		if not old.is_empty() and int(old.tier)==int(talent.tier): return false
	return true

static func take_talent(hero: Dictionary,talent_id: String) -> Dictionary:
	if not can_take_talent(hero,talent_id): return {"ok":false,"message":"Талант недоступен: проверьте уровень и тир."}
	var talent: Dictionary = TalentCatalog.find_talent(str(hero.get("class","warrior")),talent_id)
	var taken: Array = hero.get("talents",[]) if hero.get("talents",[]) is Array else []
	taken.append(talent_id)
	hero["talents"]=taken
	var effects: Dictionary = talent.get("effects",{})
	if effects.has("hpMult"):
		var old_hp := int(hero.get("maxHp",1))
		hero["maxHp"]=maxi(1,int(round(float(old_hp)*float(effects.hpMult))))
		hero["hp"]=mini(int(hero.maxHp),int(round(float(hero.get("hp",old_hp))*float(effects.hpMult))))
	if effects.has("mpMult"):
		var old_mp := int(hero.get("maxMp",0))
		hero["maxMp"]=maxi(0,int(round(float(old_mp)*float(effects.mpMult))))
		hero["mp"]=mini(int(hero.maxMp),int(round(float(hero.get("mp",old_mp))*float(effects.mpMult))))
	return {"ok":true,"message":"Выбран талант: %s" % str(talent.name),"talent":talent}

static func reset_talents(hero: Dictionary) -> Dictionary:
	var taken: Array = hero.get("talents",[]) if hero.get("talents",[]) is Array else []
	if taken.is_empty(): return {"ok":false,"message":"Нет выбранных талантов"}
	if int(hero.get("gold",0))<500: return {"ok":false,"message":"Нужно 500 золота"}
	var hp_mult := 1.0
	var mp_mult := 1.0
	for talent_id in taken:
		var talent: Dictionary = TalentCatalog.find_talent(str(hero.get("class","warrior")),str(talent_id))
		var effects: Dictionary = talent.get("effects",{})
		if effects.has("hpMult"): hp_mult*=float(effects.hpMult)
		if effects.has("mpMult"): mp_mult*=float(effects.mpMult)
	hero["gold"]=int(hero.gold)-500
	hero["maxHp"]=maxi(1,int(round(float(hero.get("maxHp",1))/maxf(0.0001,hp_mult))))
	hero["hp"]=mini(int(hero.maxHp),int(hero.get("hp",1)))
	hero["maxMp"]=maxi(0,int(round(float(hero.get("maxMp",0))/maxf(0.0001,mp_mult))))
	hero["mp"]=mini(int(hero.maxMp),int(hero.get("mp",0)))
	hero["talents"]=[]
	return {"ok":true,"refunded":taken.size(),"cost":500,"message":"Таланты сброшены."}

static func available_talents(hero: Dictionary) -> Array:
	var available: Array = []
	for talent in TalentCatalog.get_class_talents(str(hero.get("class","warrior"))):
		if can_take_talent(hero,str(talent.id)): available.append(talent)
	return available

static func get_bonus(hero: Dictionary) -> Dictionary:
	var bonus := {"dmgMult":1.0,"healMult":1.0,"spellMult":1.0,"defMult":1.0,"critChance":0.0,"critMult":1.5,"lifesteal":0.0,"manaRegen":0.0,"hpRegen":0.0,"abilityCdDelta":0.0,"meteorMult":1.0,"prayerMult":1.0,"resurrectPct":0.3,"dodgeChance":0.0,"blockChance":0.0,"blockPower":0.0,"armorPen":0.0,"atkFlat":0.0,"magFlat":0.0,"defFlat":0.0,"dexFlat":0.0}
	if hero.is_empty(): return bonus
	var nodes: Dictionary = Tree.get_tree(str(hero.get("class","warrior"))).nodes
	for node_id in hero.get("passives",[]):
		if nodes.has(str(node_id)): _add_effects(bonus,nodes[str(node_id)].get("effects",{}))
	for talent_id in hero.get("talents",[]):
		var talent: Dictionary = TalentCatalog.find_talent(str(hero.get("class","warrior")),str(talent_id))
		if not talent.is_empty(): _add_effects(bonus,talent.get("effects",{}))
	return bonus
static func _add_effects(bonus: Dictionary,effects: Dictionary) -> void:
	for key in MULTIPLIER_KEYS:
		if effects.has(key): bonus[key]=float(bonus.get(key,1.0))*float(effects[key])
	for key in ADDITIVE_KEYS:
		if effects.has(key): bonus[key]=float(bonus.get(key,0.0))+float(effects[key])
	if effects.has("critMult"): bonus["critMult"]=maxf(float(bonus.critMult),float(effects.critMult))
	if effects.has("blockPower"): bonus["blockPower"]=float(bonus.blockPower)+float(effects.blockPower)
	if effects.has("resurrectPct"): bonus["resurrectPct"]=maxf(float(bonus.resurrectPct),float(effects.resurrectPct))
