# Passive allocation and bonus aggregation from systems/talents.js.
class_name WorldPassiveEngine
extends RefCounted
const Tree = preload("res://godot/scripts/world_passive_tree.gd")
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
static func get_bonus(hero: Dictionary) -> Dictionary:
	var bonus := {"dmgMult":1.0,"healMult":1.0,"spellMult":1.0,"defMult":1.0,"critChance":0.0,"critMult":1.5,"lifesteal":0.0,"manaRegen":0.0,"hpRegen":0.0,"abilityCdDelta":0.0,"meteorMult":1.0,"prayerMult":1.0,"resurrectPct":0.3,"dodgeChance":0.0,"blockChance":0.0,"blockPower":0.0,"armorPen":0.0,"atkFlat":0.0,"magFlat":0.0,"defFlat":0.0,"dexFlat":0.0}
	if hero.is_empty(): return bonus
	var nodes: Dictionary = Tree.get_tree(str(hero.get("class","warrior"))).nodes
	for node_id in hero.get("passives",[]):
		if nodes.has(str(node_id)): _add_effects(bonus,nodes[str(node_id)].get("effects",{}))
	return bonus
static func _add_effects(bonus: Dictionary,effects: Dictionary) -> void:
	for key in MULTIPLIER_KEYS:
		if effects.has(key): bonus[key]=float(bonus.get(key,1.0))*float(effects[key])
	for key in ADDITIVE_KEYS:
		if effects.has(key): bonus[key]=float(bonus.get(key,0.0))+float(effects[key])
	if effects.has("critMult"): bonus["critMult"]=maxf(float(bonus.critMult),float(effects.critMult))
	if effects.has("blockPower"): bonus["blockPower"]=float(bonus.blockPower)+float(effects.blockPower)
	if effects.has("resurrectPct"): bonus["resurrectPct"]=maxf(float(bonus.resurrectPct),float(effects.resurrectPct))
