class_name WorldTowerEngine
extends RefCounted
const Regions=preload("res://godot/scripts/world_region_catalog.gd")
const Enemies=preload("res://godot/scripts/world_enemy_catalog.gd")
const Random=preload("res://godot/scripts/world_random.gd")
const MAX_FLOOR:=40
const REGIONS:=["forest","ruins","swamp","graveyard","volcano","ice-peaks","wasteland","library","sunken-necropolis","obsidian-fields","frost-citadel","void-crater"]
const GUARDIANS:=["grave-king","sand-king","archmage","elder-treant","bone-tyrant","bone-colossus","void-harbinger","shadow-mage"]
static func multipliers(floor:int)->Dictionary:
	var f:=clampi(floor,1,MAX_FLOOR)
	return {"hpMult":1.0+float(f-1)*0.08,"atkMult":1.0+float(f-1)*0.055,"goldMult":1.0+float(f-1)*0.08,"expMult":1.0+float(f-1)*0.07}
static func best_floor(hero:Dictionary)->int:
	return clampi(int(hero.get("towerBest",0)),0,MAX_FLOOR)
static func start_floor(hero:Dictionary)->int:
	return 1 if best_floor(hero)>=MAX_FLOOR else best_floor(hero)+1
static func floor_definition(floor:int)->Dictionary:
	var f:=clampi(floor,1,MAX_FLOOR)
	var region:=REGIONS[(f-1)%REGIONS.size()]
	var ids:Array=[]
	for id in Regions.enemy_roster(region):
		var def:=Enemies.get_enemy(str(id))
		if not def.is_empty() and not bool(def.get("boss",false)) and not ids.has(str(id)):
			ids.append(str(id))
			if ids.size()==4: break
	if ids.size()<4:
		for region_id in REGIONS:
			for enemy_id in Regions.enemy_roster(region_id):
				var fallback_def:=Enemies.get_enemy(str(enemy_id))
				if not fallback_def.is_empty() and not bool(fallback_def.get("boss",false)) and not ids.has(str(enemy_id)):
					ids.append(str(enemy_id))
					if ids.size()==4: break
			if ids.size()==4: break
	var guardian:=f%5==0
	if guardian: ids.append(GUARDIANS[(int(f/5)-1)%GUARDIANS.size()])
	return {"floor":f,"sourceId":region,"guardian":guardian,"enemyIds":ids}
static func _enemy(world:Dictionary,id:String,floor:int,index:int)->Dictionary:
	var base:=Enemies.get_enemy(id)
	if base.is_empty(): return {}
	var mult:=multipliers(floor)
	var enemy:=base.duplicate(true)
	enemy["enemyId"]=id
	enemy["persistentId"]="tower-%02d-%02d-%s"%[floor,index,id]
	enemy["hp"]=maxi(1,int(round(float(base.get("hp",1))*mult.hpMult)))
	enemy["maxHp"]=enemy.hp
	enemy["attack"]=maxi(1,int(round(float(base.get("attack",1))*mult.atkMult)))
	enemy["exp"]=maxi(1,int(round(float(base.get("exp",0))*mult.expMult)))
	enemy["gold"]=maxi(0,int(round(float(base.get("gold",0))*mult.goldMult)))
	enemy["towerMode"]=true
	enemy["towerFloor"]=floor
	enemy["towerSeed"]=Random.derive_seed([world.get("seed",1),"tower",floor,index,id])
	enemy["dead"]=false
	enemy["state"]="idle"
	enemy["turnCount"]=0
	return enemy
static func get_run(world:Dictionary)->Dictionary:
	var run:Variant=world.get("towerRun",{})
	return run if run is Dictionary else {}
static func begin_floor(world:Dictionary)->Dictionary:
	var hero:Dictionary=world.get("hero",{})
	if hero.is_empty(): return {"ok":false,"message":"Сначала создайте героя."}
	if bool(get_run(world).get("active",false)): return {"ok":false,"message":"Башня уже активна."}
	var floor:=start_floor(hero)
	if floor>MAX_FLOOR: floor=1
	var def:=floor_definition(floor)
	var queue:Array=[]
	for i in range(def.enemyIds.size()):
		var enemy:=_enemy(world,str(def.enemyIds[i]),floor,i)
		if not enemy.is_empty(): queue.append(enemy)
	if queue.is_empty(): return {"ok":false,"message":"Не удалось сформировать этаж."}
	world["towerRun"]={"active":true,"floor":floor,"sourceId":def.sourceId,"enemyIndex":0,"enemies":queue,"guardian":def.guardian}
	return {"ok":true,"floor":floor,"enemy":queue[0],"message":"Вы вошли на этаж %d."%floor}
static func sync_encounter(world:Dictionary,enemy:Dictionary)->bool:
	var run:=get_run(world)
	var queue:Array=run.get("enemies",[])
	var index:=int(run.get("enemyIndex",-1))
	if not bool(run.get("active",false)) or index<0 or index>=queue.size() or not bool(enemy.get("towerMode",false)) or str(queue[index].get("persistentId","")).is_empty() or str(queue[index].get("persistentId",""))!=str(enemy.get("persistentId","")) or str(queue[index].get("enemyId",""))!=str(enemy.get("enemyId","")) or int(enemy.get("towerFloor",0))!=int(run.get("floor",0)): return false
	queue[index]=enemy.duplicate(true)
	run["enemies"]=queue
	world["towerRun"]=run
	return true
static func complete_encounter(world:Dictionary,enemy:Dictionary)->Dictionary:
	var run:=get_run(world)
	var queue:Array=run.get("enemies",[])
	var index:=int(run.get("enemyIndex",-1))
	if not bool(run.get("active",false)) or index<0 or index>=queue.size() or not bool(enemy.get("towerMode",false)) or str(queue[index].get("persistentId","")).is_empty() or str(queue[index].get("enemyId","")).is_empty() or str(queue[index].get("persistentId",""))!=str(enemy.get("persistentId","")) or str(queue[index].get("enemyId",""))!=str(enemy.get("enemyId","")) or int(enemy.get("towerFloor",0))!=int(run.get("floor",0)):
		return {"ok":false,"message":"Противник не относится к активному этажу."}
	if not bool(enemy.get("dead",false)) and int(enemy.get("hp",1))>0:
		return {"ok":false,"message":"Сначала победите противника Башни."}
	var defeated: Dictionary = queue[index].duplicate(true)
	defeated["hp"] = 0
	defeated["dead"] = true
	defeated["state"] = "dead"
	queue[index] = defeated
	index+=1
	if index<queue.size():
		run["enemyIndex"]=index
		world["towerRun"]=run
		return {"ok":true,"floorComplete":false,"enemy":queue[index],"message":"Следующий противник выходит на арену."}
	var floor:=int(run.floor)
	var hero:Dictionary=world.get("hero",{})
	hero["towerBest"]=maxi(best_floor(hero),floor)
	world["hero"]=hero
	world["towerRun"]={"active":false,"completedFloor":floor}
	return {"ok":true,"floorComplete":true,"best":int(hero.towerBest),"completed":floor>=MAX_FLOOR,"message":"Этаж %d пройден%s."%[floor," · Башня покорена!" if floor>=MAX_FLOOR else ""]}
static func abandon(world:Dictionary)->bool:
	var run:=get_run(world)
	if not bool(run.get("active",false)): return false
	world["towerRun"]={"active":false,"abandoned":true,"floor":int(run.get("floor",0))}
	return true
