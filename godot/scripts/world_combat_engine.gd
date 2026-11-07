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

const EFFECTS := {
	"poison": {"damage": 5, "duration": 3, "name": "Отравление"},
	"burn": {"damage": 8, "duration": 2, "name": "Ожог"},
	"bleed": {"damage": 6, "duration": 3, "name": "Кровотечение"},
	"stun": {"skipTurn": true, "duration": 1, "name": "Оглушение"}
}

static func apply_effect(target: Dictionary, effect_id: String) -> void:
	if not EFFECTS.has(effect_id):
		return
	var effects: Array = target.get("effects", [])
	for effect in effects:
		if str(effect.get("id", "")) == effect_id:
			effect["duration"] = int(EFFECTS[effect_id].duration)
			target["effects"] = effects
			return
	effects.append({"id": effect_id, "duration": int(EFFECTS[effect_id].duration)})
	target["effects"] = effects

static func tick_effects(target: Dictionary) -> Dictionary:
	var damage := 0
	var remaining: Array = []
	for effect in target.get("effects", []):
		var effect_id := str(effect.get("id", ""))
		if not EFFECTS.has(effect_id):
			continue
		var definition: Dictionary = EFFECTS[effect_id]
		damage += int(definition.get("damage", 0))
		var duration := int(effect.get("duration", definition.get("duration", 1))) - 1
		if duration > 0:
			remaining.append({"id": effect_id, "duration": duration})
	target["effects"] = remaining
	return {"damage": damage}

static func begin(enemy: Dictionary) -> Dictionary:
	if enemy.is_empty() or bool(enemy.get("dead", false)) or int(enemy.get("hp", 0)) <= 0:
		return {}
	return {"enemy": enemy, "turn": "player", "over": false, "log": "Бой начался: %s" % str(enemy.get("name", "Противник")), "result": ""}

static func player_attack(world: Dictionary, combat: Dictionary) -> Dictionary:
	if combat.is_empty() or combat.get("over", true) or combat.get("turn", "") != "player":
		return {"ok": false, "message": "Сейчас нельзя атаковать."}
	var hero := ensure_hero(world)
	var enemy: Dictionary = combat.get("enemy", {})
	var damage := maxi(1, int(hero.attack) - int(floor(float(enemy.get("defense", 0)) / 2.0)))
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
		var incoming := maxi(1, int(enemy.get("attack", 1)) - int(floor(float(hero.defense) / 2.0)))
		var turn_count := int(enemy.get("turnCount", 0)) + 1
		enemy["turnCount"] = turn_count
		var special: Dictionary = enemy.get("special", {})
		var every := maxi(1, int(special.get("every", 3)))
		var special_ready := not special.is_empty() and turn_count % every == 0
		var special_type := str(special.get("type", ""))
		if special_ready and special_type == "snipe":
			incoming = maxi(1, int(round(float(incoming) * float(special.get("mult", 1.8)))))
		elif special_ready and special_type == "double":
			incoming = maxi(1, int(floor(float(incoming) * 0.6))) * 2
		hero["hp"] = maxi(0, int(hero.hp) - incoming)
		lines.append("%s наносит вам %d урона." % [str(enemy.get("name", "Противник")), incoming])
		if special_ready:
			lines.append("Особый приём: %s!" % str(special.get("name", "Атака")))
			var effect_id := str(special.get("effect", ""))
			if not effect_id.is_empty() and EFFECTS.has(effect_id):
				apply_effect(hero, effect_id)
				lines.append("Наложен эффект: %s." % str(EFFECTS[effect_id].name))
		if special_ready and special_type == "drain":
			var healed := mini(incoming, int(enemy.get("maxHp", enemy.hp)) - int(enemy.hp))
			enemy["hp"] = int(enemy.hp) + maxi(0, healed)
			lines.append("Противник восстановил %d HP." % maxi(0, healed))
		var effect_tick := tick_effects(hero)
		if int(effect_tick.damage) > 0:
			hero["hp"] = maxi(0, int(hero.hp) - int(effect_tick.damage))
			lines.append("Эффекты наносят вам %d урона." % int(effect_tick.damage))
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
