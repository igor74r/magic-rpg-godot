# Lightweight native turn-based combat loop. Core damage and rewards are explicit and testable.
class_name WorldCombatEngine
extends RefCounted

const WorldState = preload("res://godot/scripts/world_state.gd")
const ClassCatalog = preload("res://godot/scripts/world_class_catalog.gd")

static func ensure_hero(world: Dictionary) -> Dictionary:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	hero["class"] = str(hero.get("class", "warrior"))
	if not ClassCatalog.CLASSES.has(hero.class):
		hero["class"] = "warrior"
	var class_data: Dictionary = ClassCatalog.CLASSES[hero.class]
	hero["level"] = clampi(int(hero.get("level", 1)), 1, 99)
	hero["maxHp"] = clampi(int(hero.get("maxHp", class_data.maxHp)), 1, 999999)
	hero["maxMp"] = clampi(int(hero.get("maxMp", class_data.maxMp)), 0, 999999)
	hero["mp"] = clampi(int(hero.get("mp", hero.maxMp)), 0, hero.maxMp)
	hero["cooldowns"] = hero.get("cooldowns", {}) if hero.get("cooldowns", {}) is Dictionary else {}
	hero["buffs"] = hero.get("buffs", []) if hero.get("buffs", []) is Array else []
	hero["spells"] = hero.get("spells", class_data.spells.duplicate()) if hero.get("spells", class_data.spells) is Array else class_data.spells.duplicate()
	hero["hp"] = clampi(int(hero.get("hp", hero.maxHp)), 0, hero.maxHp)
	hero["attack"] = clampi(int(hero.get("attack", class_data.attack)), 1, 99999)
	hero["defense"] = clampi(int(hero.get("defense", class_data.defense)), 0, 99999)
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

static func use_ability(world: Dictionary, combat: Dictionary, ability_id: String) -> Dictionary:
	if combat.is_empty() or combat.get("over", true) or combat.get("turn", "") != "player":
		return {"ok": false, "message": "Сейчас нельзя применить способность."}
	var hero := ensure_hero(world)
	var class_data: Dictionary = ClassCatalog.get_class(str(hero.get("class", "warrior")))
	var ability: Dictionary = {}
	for candidate in class_data.get("abilities", []):
		if str(candidate.id) == ability_id:
			ability = candidate
			break
	if ability.is_empty():
		return {"ok": false, "message": "Эта способность недоступна классу."}
	var cooldowns: Dictionary = hero.get("cooldowns", {})
	if int(cooldowns.get(ability_id, 0)) > 0:
		return {"ok": false, "message": "Способность ещё перезаряжается."}
	var cost := int(ability.get("cost", 0))
	if int(hero.mp) < cost:
		return {"ok": false, "message": "Недостаточно ресурса."}
	hero["mp"] = int(hero.mp) - cost
	cooldowns[ability_id] = int(ability.get("cooldown", 0))
	hero["cooldowns"] = cooldowns
	var enemy: Dictionary = combat.get("enemy", {})
	var damage := 0
	var kind := str(ability.get("kind", ""))
	match kind:
		"next_double":
			hero["buffs"].append({"id":"double_next","duration":1})
			combat["log"] = "Следующая атака будет усилена."
			world["hero"] = hero
			return {"ok":true,"message":combat.log}
		"attack_buff":
			hero["buffs"].append({"id":"attack_buff","duration":2})
			combat["log"] = "Боевой клич усиливает атаку на 2 хода."
			world["hero"] = hero
			return {"ok":true,"message":combat.log}
		"lifesteal":
			hero["buffs"].append({"id":"lifesteal","duration":2})
			combat["log"] = "Кровожадность активна: часть урона вернётся здоровьем."
			world["hero"] = hero
			return {"ok":true,"message":combat.log}
		"defense_buff":
			hero["buffs"].append({"id":"defense_buff","duration":2})
			combat["log"] = "Магический барьер повышает защиту на 2 хода."
			world["hero"] = hero
			return {"ok":true,"message":combat.log}
		"dodge":
			hero["buffs"].append({"id":"dodge","duration":1})
			combat["log"] = "Вы готовы уклониться от следующей атаки."
			world["hero"] = hero
			return {"ok":true,"message":combat.log}
		_:
			damage = int(hero.attack)
			if kind == "meteor":
				damage = int(round(float(damage) * 2.5))
			elif kind == "critical":
				damage = int(round(float(damage) * 2.0))
			elif kind == "pierce":
				damage = int(round(float(damage) * 1.5))
			elif kind == "poison_strike":
				apply_effect(enemy, "poison")
			elif kind == "stun":
				apply_effect(enemy, "stun")
		damage = maxi(1, damage - int(floor(float(enemy.get("defense", 0)) / 2.0)))
		enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
		var lines := ["%s: %d урона." % [str(ability.name), damage]]
		if kind == "meteor":
			apply_effect(enemy, "burn")
		if kind == "poison_strike":
			lines.append("Противник отравлен.")
		if kind == "stun":
			lines.append("Противник оглушён.")
		combat["enemy"] = enemy
		combat["log"] = "\n".join(lines)
		if int(enemy.hp) <= 0:
			combat["over"] = true
			combat["turn"] = "over"
			combat["result"] = "victory"
			enemy["dead"] = true
			enemy["state"] = "dead"
			var region_id := str(world.get("currentRegionId", "village"))
			var persistent_id := str(enemy.get("persistentId", ""))
			if bool(enemy.get("boss", false)):
				WorldState.mark_boss_defeated(world, region_id, persistent_id)
			else:
				WorldState.mark_enemy_defeated(world, region_id, persistent_id, float(world.get("clockMinutes", 0.0)) + 0.5)
			combat["log"] += "\nПобеда!"
		else:
			var incoming := maxi(1, int(enemy.get("attack", 1)) - int(floor(float(hero.defense) / 2.0)))
			hero["hp"] = maxi(1, int(hero.hp) - incoming)
			combat["log"] += "\nПротивник отвечает: %d урона." % incoming
		combat["enemy"] = enemy
	world["hero"] = hero
	return {"ok":true,"message":combat.log,"result":combat.get("result","")}


static func cast_spell(world: Dictionary, combat: Dictionary, spell_id: String) -> Dictionary:
	if combat.is_empty() or combat.get("over", true) or combat.get("turn", "") != "player":
		return {"ok":false,"message":"Сейчас нельзя произнести заклинание."}
	var hero := ensure_hero(world)
	if not (hero.get("spells", []) as Array).has(spell_id):
		return {"ok":false,"message":"Заклинание неизвестно герою."}
	var spell: Dictionary = ClassCatalog.get_spell(spell_id)
	if spell.is_empty() or int(hero.mp) < int(spell.get("cost", 0)):
		return {"ok":false,"message":"Недостаточно маны."}
	hero["mp"] = int(hero.mp) - int(spell.get("cost", 0))
	var enemy: Dictionary = combat.get("enemy", {})
	var lines: Array[String] = [str(spell.name)]
	if spell.has("heal"):
		var restored := mini(int(spell.heal), int(hero.maxHp) - int(hero.hp))
		hero["hp"] = int(hero.hp) + maxi(0, restored)
		lines.append("Восстановлено %d HP." % maxi(0, restored))
	elif spell.has("selfDamagePct"):
		var hp_cost := int(ceil(float(hero.maxHp) * float(spell.selfDamagePct)))
		if int(hero.hp) <= hp_cost:
			return {"ok":false,"message":"Недостаточно здоровья для Жертвы."}
		hero["hp"] = int(hero.hp) - hp_cost
		hero["mp"] = mini(int(hero.maxMp), int(hero.mp) + int(spell.get("restoreMp", 0)))
		lines.append("Здоровье обменено на ману.")
	elif spell.has("selfEffect"):
		hero["buffs"].append({"id":"defense_buff","duration":2})
		lines.append("Защита усилена на 2 хода.")
	else:
		var damage := maxi(1, int(spell.get("damage", 0)) - int(floor(float(enemy.get("defense", 0)) / 2.0)))
		if str(spell.get("element", "")) == "lightning" and _has_effect(enemy, "slow"):
			damage = int(round(float(damage) * 1.2))
			_remove_effect(enemy, "slow")
		enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
		lines.append("Нанесено %d урона." % damage)
		var effect_id := str(spell.get("effect", ""))
		if not effect_id.is_empty():
			apply_effect(enemy, effect_id)
			lines.append("Наложен эффект: %s." % effect_id)
		combat["enemy"] = enemy
		if int(enemy.hp) <= 0:
			enemy["dead"] = true
			enemy["state"] = "dead"
			combat["over"] = true
			combat["turn"] = "over"
			combat["result"] = "victory"
			var region_id := str(world.get("currentRegionId", "village"))
			var persistent_id := str(enemy.get("persistentId", ""))
			if bool(enemy.get("boss", false)):
				WorldState.mark_boss_defeated(world, region_id, persistent_id)
			else:
				WorldState.mark_enemy_defeated(world, region_id, persistent_id, float(world.get("clockMinutes", 0.0)) + 0.5)
			lines.append("Победа!")
		else:
			var incoming := maxi(1, int(enemy.get("attack", 1)) - int(floor(float(hero.defense) / 2.0)))
			hero["hp"] = maxi(1, int(hero.hp) - incoming)
			lines.append("Противник отвечает: %d урона." % incoming)
	combat["log"] = "\n".join(lines)
	world["hero"] = hero
	return {"ok":true,"message":combat.log,"result":combat.get("result","")}


static func _has_effect(target: Dictionary, effect_id: String) -> bool:
	for effect in target.get("effects", []):
		if str(effect.get("id", "")) == effect_id:
			return true
	return false


static func _remove_effect(target: Dictionary, effect_id: String) -> void:
	var effects: Array = target.get("effects", [])
	effects = effects.filter(func(effect): return str(effect.get("id", "")) != effect_id)
	target["effects"] = effects


static func retreat(combat: Dictionary) -> bool:
	if combat.is_empty() or combat.get("over", true):
		return false
	combat["over"] = true
	combat["turn"] = "over"
	combat["result"] = "retreat"
	combat["log"] = "Вы отступили. Противник не побеждён."
	return true
