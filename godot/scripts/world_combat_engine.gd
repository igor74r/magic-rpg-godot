# Lightweight native turn-based combat loop. Core damage and rewards are explicit and testable.
class_name WorldCombatEngine
extends RefCounted

const WorldState = preload("res://godot/scripts/world_state.gd")

static func ensure_hero(world: Dictionary) -> Dictionary:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	hero["level"] = clampi(int(hero.get("level", 1)), 1, 99)
	hero["maxHp"] = clampi(int(hero.get("maxHp", 120)), 1, 999999)
	hero["hp"] = clampi(int(hero.get("hp", hero.maxHp)), 0, hero.maxHp)
	hero["attack"] = clampi(int(hero.get("attack", 22)), 1, 99999)
	hero["defense"] = clampi(int(hero.get("defense", 6)), 0, 99999)
	hero["exp"] = maxi(0, int(hero.get("exp", 0)))
	hero["gold"] = maxi(0, int(hero.get("gold", 0)))
	world["hero"] = hero
	return hero

static func begin(enemy: Dictionary) -> Dictionary:
	if enemy.is_empty() or bool(enemy.get("dead", false)) or int(enemy.get("hp", 0)) <= 0:
		return {}
	return {"enemy": enemy, "turn": "player", "over": false, "log": "Бой начался: %s" % str(enemy.get("name", "Противник")), "result": ""}

static func player_attack(world: Dictionary, combat: Dictionary) -> Dictionary:
	if combat.is_empty() or combat.get("over", true) or combat.get("turn", "") != "player":
		return {"ok": false, "message": "Сейчас нельзя атаковать."}
	var hero := ensure_hero(world)
	var enemy: Dictionary = combat.get("enemy", {})
	var damage := maxi(1, int(hero.attack) - int(enemy.get("defense", 0)) / 2)
	enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
	var lines: Array[String] = ["Вы нанесли %d урона." % damage]
	if int(enemy.hp) <= 0:
		enemy["dead"] = true
		enemy["state"] = "dead"
		enemy["hp"] = 0
		var reward_exp := maxi(0, int(enemy.get("exp", 0)))
		var reward_gold := maxi(0, int(enemy.get("gold", 0)))
		hero["exp"] = int(hero.exp) + reward_exp
		hero["gold"] = int(hero.gold) + reward_gold
		while int(hero.exp) >= int(hero.level) * 100 and int(hero.level) < 99:
			hero["exp"] = int(hero.exp) - int(hero.level) * 100
			hero["level"] = int(hero.level) + 1
			hero["maxHp"] = int(hero.maxHp) + 12
			hero["attack"] = int(hero.attack) + 2
			hero["defense"] = int(hero.defense) + 1
			hero["hp"] = int(hero.maxHp)
			lines.append("Новый уровень: %d!" % int(hero.level))
		var region_id := str(world.get("currentRegionId", "village"))
		var persistent_id := str(enemy.get("persistentId", ""))
		if bool(enemy.get("boss", false)):
			WorldState.mark_boss_defeated(world, region_id, persistent_id)
		else:
			WorldState.mark_enemy_defeated(world, region_id, persistent_id, float(world.get("clockMinutes", 0.0)) + 0.5)
		combat["over"] = true
		combat["result"] = "victory"
		combat["turn"] = "over"
		lines.append("Победа! +%d опыта, +%d золота." % [reward_exp, reward_gold])
	else:
		combat["turn"] = "enemy"
		var incoming := maxi(1, int(enemy.get("attack", 1)) - int(hero.defense) / 2)
		hero["hp"] = maxi(0, int(hero.hp) - incoming)
		lines.append("%s наносит вам %d урона." % [str(enemy.get("name", "Противник")), incoming])
		if int(hero.hp) <= 0:
			hero["hp"] = 1
			combat["over"] = true
			combat["result"] = "defeat"
			combat["turn"] = "over"
			lines.append("Вы потерпели поражение и отступили. Противник остался жив.")
		else:
			combat["turn"] = "player"
	world["hero"] = hero
	combat["enemy"] = enemy
	combat["log"] = "\n".join(lines)
	return {"ok": true, "message": combat.log, "result": combat.get("result", "")}

static func retreat(combat: Dictionary) -> bool:
	if combat.is_empty() or combat.get("over", true):
		return false
	combat["over"] = true
	combat["turn"] = "over"
	combat["result"] = "retreat"
	combat["log"] = "Вы отступили. Противник не побеждён."
	return true
