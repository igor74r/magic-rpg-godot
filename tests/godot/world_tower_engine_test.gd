extends SceneTree
const Tower=preload("res://godot/scripts/world_tower_engine.gd")
const WorldState=preload("res://godot/scripts/world_state.gd")
func _initialize()->void:
	var failures:Array[String]=[]
	if Tower.multipliers(1).hpMult!=1.0 or Tower.multipliers(40).hpMult<4.0: failures.append("tower multiplier curve")
	if not bool(Tower.floor_definition(5).guardian) or bool(Tower.floor_definition(4).guardian): failures.append("guardian every fifth floor")
	var world:=WorldState.create(4455)
	world["hero"]={"level":1,"classChosen":true,"towerBest":0,"class":"warrior","hp":100,"maxHp":100,"attack":1000,"defense":10,"inventory":[],"gold":0,"exp":0}
	var entered:=Tower.begin_floor(world)
	if not bool(entered.get("ok",false)) or int(entered.get("floor",0))!=1: failures.append("new hero enters floor one")
	var run:=Tower.get_run(world)
	if not bool(run.get("active",false)) or run.get("enemies",[]).is_empty(): failures.append("floor queue persisted")
	var enemy:Dictionary=run.enemies[0]
	if not Tower.sync_encounter(world,enemy): failures.append("enemy state sync")
	var result:=Tower.complete_encounter(world,enemy)
	if not bool(result.get("ok",false)): failures.append("victory advances floor queue")
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
