extends SceneTree
const Tower=preload("res://godot/scripts/world_tower_engine.gd")
const WorldState=preload("res://godot/scripts/world_state.gd")
func _initialize()->void:
	var failures:Array[String]=[]
	if Tower.multipliers(1).hpMult!=1.0 or Tower.multipliers(40).hpMult<4.0: failures.append("tower multiplier curve")
	if not bool(Tower.floor_definition(5).guardian) or bool(Tower.floor_definition(4).guardian): failures.append("guardian every fifth floor")
	var EnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
	var RegionCatalog = preload("res://godot/scripts/world_region_catalog.gd")
	for floor_number in range(1, Tower.MAX_FLOOR + 1):
		var definition: Dictionary = Tower.floor_definition(floor_number)
		if not RegionCatalog.REGIONS.has(str(definition.get("sourceId", ""))):
			failures.append("floor %d must reference a real region" % floor_number)
		for enemy_id in definition.get("enemyIds", []):
			if EnemyCatalog.get_enemy(str(enemy_id)).is_empty():
				failures.append("floor %d references missing enemy %s" % [floor_number, str(enemy_id)])
		if bool(definition.get("guardian", false)) and definition.get("enemyIds", []).size() != 5:
			failures.append("guardian floor %d must contain four regular enemies and one guardian" % floor_number)
		if not bool(definition.get("guardian", false)) and definition.get("enemyIds", []).size() != 4:
			failures.append("regular floor %d must contain exactly four enemies" % floor_number)
	var world:=WorldState.create(4455)
	world["hero"]={"level":1,"classChosen":true,"towerBest":0,"class":"warrior","hp":100,"maxHp":100,"attack":1000,"defense":10,"inventory":[],"gold":0,"exp":0}
	var entered:=Tower.begin_floor(world)
	if not bool(entered.get("ok",false)) or int(entered.get("floor",0))!=1: failures.append("new hero enters floor one")
	var run:=Tower.get_run(world)
	if not bool(run.get("active",false)) or run.get("enemies",[]).is_empty(): failures.append("floor queue persisted")
	var enemy:Dictionary=run.enemies[0]
	if not Tower.sync_encounter(world,enemy): failures.append("enemy state sync")
	enemy["hp"]=0
	var result:=Tower.complete_encounter(world,enemy)
	if not bool(result.get("ok",false)): failures.append("victory advances floor queue")
	var resumed_state:=WorldState.normalize(world,4455)
	if not bool(resumed_state.towerRun.get("active",false)) or int(resumed_state.towerRun.get("enemyIndex",0))!=1:
		failures.append("active tower save must allow already defeated enemies in its queue")
	var corrupted := resumed_state.duplicate(true)
	corrupted.towerRun.enemies[0]["hp"] = 1
	corrupted.towerRun.enemies[0]["dead"] = false
	var rejected := WorldState.normalize(corrupted, 4455)
	if bool(rejected.towerRun.get("active", false)):
		failures.append("tower save must reject a queue whose prior encounter is not defeated")
	var guardian_world:=WorldState.create(5566)
	guardian_world["hero"]={"level":10,"classChosen":true,"towerBest":4,"class":"warrior","hp":100,"maxHp":100,"attack":100,"defense":10,"inventory":[],"gold":0,"exp":0}
	var guardian_entry:=Tower.begin_floor(guardian_world)
	if not bool(guardian_entry.get("ok",false)) or not bool(Tower.get_run(guardian_world).get("guardian",false)):
		failures.append("fifth floor must include a guardian encounter")
	var bad:=WorldState.create(7788)
	bad["hero"]={"towerBest":99}
	bad["towerRun"]={"active":true,"floor":99,"enemyIndex":0,"enemies":[]}
	var normalized:=WorldState.normalize(bad,7788)
	if int(normalized.hero.towerBest)!=40 or bool(normalized.towerRun.get("active",false)): failures.append("invalid tower save sanitized")
	if failures.is_empty():
		print("PASS: tower floor scaling, guardians, queue and save validation")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)
