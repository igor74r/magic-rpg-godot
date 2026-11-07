# Playable post-campaign Rift runs. Each cleared area advances the endless floor record.
class_name WorldRiftEngine
extends RefCounted

const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Regions = preload("res://godot/scripts/world_region_catalog.gd")
const Enemies = preload("res://godot/scripts/world_enemy_catalog.gd")
const STORY_DRAGONS := ["flame-lord", "ice-queen", "ancient-dragon"]

static func is_available(world: Dictionary) -> bool:
	return Campaign.is_rift_ready(world)

static func get_locations(world: Dictionary) -> Array:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	return Campaign.rift_locations(maxi(1, int(hero.get("level", 1))))

static func get_run(world: Dictionary) -> Dictionary:
	var value: Variant = world.get("riftRun", {})
	if not value is Dictionary:
		return {}
	return value.duplicate(true)

static func begin_area(world: Dictionary, location_id: String) -> Dictionary:
	if not is_available(world):
		return {"ok": false, "message": "Разлом ещё закрыт сюжетной печатью."}
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var location := Campaign.get_rift_location(location_id)
	if location.is_empty():
		return {"ok": false, "message": "Неизвестная область Разлома."}
	if int(hero.get("level", 1)) < int(location.get("minLevel", 1)):
		return {"ok": false, "message": "Для этой области нужен уровень %d." % int(location.minLevel)}
	var floor := maxi(1, int(hero.get("riftBest", 0)) + 1)
	var run := {"active": true, "locationId": location_id, "sourceId": str(location.sourceId), "floor": floor, "startedAt": int(world.get("clockMinutes", 0))}
	world["riftRun"] = run
	var enemy := create_encounter(world)
	if enemy.is_empty():
		world.erase("riftRun")
		return {"ok": false, "message": "В этой области не удалось создать противника."}
	run["enemy"] = enemy.duplicate(true)
	world["riftRun"] = run
	return {"ok": true, "run": run.duplicate(true), "enemy": enemy, "message": "Разлом · этаж %d · %s" % [floor, str(location.name)]}

static func create_encounter(world: Dictionary) -> Dictionary:
	var run := get_run(world)
	if not bool(run.get("active", false)):
		return {}
	var source_id := str(run.get("sourceId", ""))
	var roster: Array = Regions.enemy_roster(source_id)
	var eligible: Array = []
	for enemy_id in roster:
		if enemy_id is String and not STORY_DRAGONS.has(enemy_id) and not Enemies.get_enemy(str(enemy_id)).is_empty():
			eligible.append(str(enemy_id))
	if eligible.is_empty():
		return {}
	var floor := maxi(1, int(run.get("floor", 1)))
	var area_index := maxi(0, int(str(run.get("locationId", "rift-01")).trim_prefix("rift-").to_int()) - 1)
	var enemy_id := str(eligible[(floor - 1 + area_index) % eligible.size()])
	var definition := Enemies.get_enemy(enemy_id)
	var mult := Campaign.get_rift_multiplier(floor)
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var ng_cycle := maxi(0, int(hero.get("ngPlus", 0)))
	var ng_hp := 1.0 + 0.5 * ng_cycle
	var ng_other := 1.0 + 0.3 * ng_cycle
	var hp := maxi(1, int(round(float(definition.get("hp", 1)) * float(mult.hpMult) * ng_hp)))
	var attack := maxi(1, int(round(float(definition.get("attack", 1)) * float(mult.atkMult) * ng_other)))
	return {
		"id": "rift-%s-%d" % [str(run.locationId), floor],
		"persistentId": "rift-%s-%d-%s" % [str(run.locationId), floor, enemy_id],
		"enemyId": enemy_id, "name": str(definition.get("name", enemy_id)), "emoji": str(definition.get("emoji", "🌀")),
		"hp": hp, "maxHp": hp, "attack": attack, "defense": int(definition.get("defense", 0)),
		"exp": maxi(1, int(definition.get("exp", 0))),
		"gold": maxi(0, int(definition.get("gold", 0))),
		"special": definition.get("special", {}).duplicate(true), "drops": definition.get("drops", []).duplicate(),
		"dropSeed": floor * 7919 + area_index * 104729, "boss": bool(definition.get("boss", false)),
		"elite": false, "dead": false, "state": "idle", "effects": [],
		"riftMode": true, "riftLocationId": str(run.locationId), "riftFloor": floor,
		"riftExpMult": float(mult.expMult) * ng_other, "riftGoldMult": float(mult.goldMult) * ng_other
	}

static func sync_encounter(world: Dictionary, enemy: Dictionary) -> bool:
	var run := get_run(world)
	if not bool(run.get("active", false)) or not bool(enemy.get("riftMode", false)):
		return false
	if str(enemy.get("riftLocationId", "")) != str(run.get("locationId", "")) or int(enemy.get("riftFloor", 0)) != int(run.get("floor", -1)):
		return false
	run["enemy"] = enemy.duplicate(true)
	world["riftRun"] = run
	return true

static func complete_area(world: Dictionary, enemy: Dictionary) -> Dictionary:
	var run := get_run(world)
	if not bool(run.get("active", false)) or not bool(enemy.get("riftMode", false)):
		return {"ok": false, "message": "Нет активного прохождения Разлома."}
	if str(enemy.get("riftLocationId", "")) != str(run.get("locationId", "")) or int(enemy.get("riftFloor", 0)) != int(run.get("floor", -1)):
		return {"ok": false, "message": "Награда Разлома не совпадает с текущим прохождением."}
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	var cleared: Variant = hero.get("riftClearedLocations", [])
	if not cleared is Array:
		cleared = []
	if not cleared.has(str(run.locationId)):
		cleared.append(str(run.locationId))
	hero["riftClearedLocations"] = cleared
	var new_record := Campaign.record_rift_floor(hero, int(run.floor))
	preload("res://godot/scripts/world_daily_quest_engine.gd").set_progress(world, "rift", "floor", int(run.floor))
	world["hero"] = hero
	world["riftRun"] = {"active": false, "locationId": str(run.locationId), "floor": int(run.floor), "completed": true}
	return {"ok": true, "newRecord": new_record, "floor": int(run.floor), "message": "Область Разлома очищена · этаж %d%s" % [int(run.floor), " · новый рекорд!" if new_record else ""]}

static func abandon(world: Dictionary) -> bool:
	var run := get_run(world)
	if not bool(run.get("active", false)):
		return false
	world["riftRun"] = {"active": false, "locationId": str(run.get("locationId", "")), "floor": int(run.get("floor", 0)), "completed": false}
	return true
