# Lightweight native turn-based combat loop. Core damage and rewards are explicit and testable.
class_name WorldCombatEngine
extends RefCounted

const WorldState = preload("res://godot/scripts/world_state.gd")
const ClassCatalog = preload("res://godot/scripts/world_class_catalog.gd")
const ItemCatalog = preload("res://godot/scripts/world_item_catalog.gd")
const EnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
const RandomScript = preload("res://godot/scripts/world_random.gd")
const EncounterGenerator = preload("res://godot/scripts/world_encounter_generator.gd")

static func ensure_hero(world: Dictionary) -> Dictionary:
	var hero: Dictionary = world.get("hero", {}) if world.get("hero", {}) is Dictionary else {}
	hero["class"] = str(hero.get("class", "warrior"))
	hero["classChosen"] = bool(hero.get("classChosen", false))
	if not ClassCatalog.CLASSES.has(hero.class):
		hero["class"] = "warrior"
	var class_data: Dictionary = ClassCatalog.CLASSES[hero.class]
	hero["level"] = clampi(int(hero.get("level", 1)), 1, 100)
	hero["expNext"] = progression_exp_next(int(hero.level))
	hero["statPoints"] = maxi(0, int(hero.get("statPoints", 0)))
	hero["passivePoints"] = maxi(0, int(hero.get("passivePoints", 0)))
	hero["luck"] = clampf(float(hero.get("luck", 5.0 + (int(hero.level) - 1) * 0.5)), 0.0, 100.0)
	hero["maxHp"] = clampi(int(hero.get("maxHp", class_data.maxHp)), 1, 999999)
	hero["maxMp"] = clampi(int(hero.get("maxMp", class_data.maxMp)), 0, 999999)
	for stat_name in ["str", "int", "wis", "con", "dex"]:
		hero[stat_name] = clampi(int(hero.get(stat_name, int(class_data.get(stat_name, 0)))), 0, 999999)
	hero["mp"] = clampi(int(hero.get("mp", hero.maxMp)), 0, hero.maxMp)
	hero["inventory"] = hero.get("inventory", []) if hero.get("inventory", []) is Array else []
	hero["equipped"] = hero.get("equipped", {}) if hero.get("equipped", {}) is Dictionary else {}
	hero["pendingLoot"] = hero.get("pendingLoot", []) if hero.get("pendingLoot", []) is Array else []
	hero["talents"] = hero.get("talents", []) if hero.get("talents", []) is Array else []
	var PassiveEngine = preload("res://godot/scripts/world_passive_engine.gd")
	PassiveEngine.ensure_passives(hero)
	if not bool(hero.get("inventoryInitialized", false)):
		for item_id in class_data.get("startingItems", []):
			add_item(hero, str(item_id), 1)
		hero["inventoryInitialized"] = true
	hero["cooldowns"] = hero.get("cooldowns", {}) if hero.get("cooldowns", {}) is Dictionary else {}
	hero["buffs"] = hero.get("buffs", []) if hero.get("buffs", []) is Array else []
	hero["effects"] = hero.get("effects", []) if hero.get("effects", []) is Array else []
	hero["spells"] = hero.get("spells", class_data.spells.duplicate()) if hero.get("spells", class_data.spells) is Array else class_data.spells.duplicate()
	hero["hp"] = clampi(int(hero.get("hp", hero.maxHp)), 0, hero.maxHp)
	hero["attack"] = clampi(int(hero.get("attack", class_data.attack)), 1, 99999)
	hero["defense"] = clampi(int(hero.get("defense", class_data.defense)), 0, 99999)
	hero["attack"] = int(hero.str)
	hero["magic"] = int(hero.int)
	hero["defense"] = int(floor(float(hero.con) / 2.0))
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
	var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
	var enemy_armor := maxi(0, int(enemy.get("defense", 0)) - int(passive_bonus.get("armorPen", 0)))
	var damage := maxi(1, int(round(float(effective_stat(hero, "attack") - int(floor(float(enemy_armor) / 2.0))) * float(passive_bonus.get("dmgMult", 1.0))))
	enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
	var lines: Array[String] = ["Вы нанесли %d урона." % damage]
	lines.append_array(_update_boss_phase(enemy))
	if int(enemy.hp) <= 0:
		enemy["dead"] = true
		enemy["state"] = "dead"
		enemy["hp"] = 0
		lines.append(_award_victory(world, enemy))
		combat["over"] = true
		combat["result"] = "victory"
		combat["turn"] = "over"
	else:
		combat["turn"] = "enemy"
		var incoming := maxi(1, int(round(float(enemy.get("attack", 1)) * float(enemy.get("phaseAttackMult", 1.0)))) - int(floor(float(effective_stat(hero, "defense")) / 2.0)))
		var turn_count := int(enemy.get("turnCount", 0)) + 1
		enemy["turnCount"] = turn_count
		var special: Dictionary = enemy.get("special", {})
		var every := maxi(1, int(enemy.get("phaseSpecialEvery", special.get("every", 3))))
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
		var modifier_message := _apply_enemy_modifier(enemy, hero, incoming)
		if not modifier_message.is_empty():
			lines.append(modifier_message)
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

static func grant_experience(hero: Dictionary,amount: int) -> int:
	return _grant_experience(hero,amount)


static func progression_exp_next(level: int) -> int:
	if level < 1:
		return 125
	if level >= 100:
		return 2147483647
	if level <= 10:
		return 125
	if level <= 20:
		return 259
	if level <= 30:
		return 269
	if level <= 40:
		return 369
	if level <= 50:
		return 535
	return int(floor(535.0 * pow(float(level) / 50.0, 1.5)))


static func _grant_experience(hero: Dictionary, amount: int) -> int:
	if amount > 0:
		hero["exp"] = mini(2147483647, maxi(0, int(hero.get("exp", 0))) + amount)
	var levels_gained := 0
	while int(hero.get("level", 1)) < 100:
		var required := progression_exp_next(int(hero.level))
		if int(hero.get("exp", 0)) < required:
			break
		hero["exp"] = int(hero.exp) - required
		hero["level"] = int(hero.level) + 1
		hero["luck"] = minf(100.0, float(hero.get("luck", 5.0)) + 0.5)
		match str(hero.get("class", "warrior")):
			"warrior":
				hero["maxHp"] = int(hero.maxHp) + 14
				hero["maxMp"] = int(hero.maxMp) + 5
				hero["str"] = int(hero.str) + 2
				hero["con"] = int(hero.con) + 1
				hero["dex"] = int(hero.dex) + 1
			"mage", "priest":
				hero["maxHp"] = int(hero.maxHp) + 8
				hero["maxMp"] = int(hero.maxMp) + 13
				hero["int"] = int(hero.int) + 2
				hero["wis"] = int(hero.wis) + 1
				hero["con"] = int(hero.con) + 1
			"archer":
				hero["maxHp"] = int(hero.maxHp) + 10
				hero["maxMp"] = int(hero.maxMp) + 7
				hero["dex"] = int(hero.dex) + 2
				hero["str"] = int(hero.str) + 1
				hero["con"] = int(hero.con) + 1
		hero["statPoints"] = int(hero.get("statPoints", 0)) + 1
		hero["passivePoints"] = int(hero.get("passivePoints", 0)) + 1
		hero["hp"] = int(hero.maxHp)
		hero["attack"] = int(hero.str)
		hero["magic"] = int(hero.int)
		hero["defense"] = int(floor(float(hero.con) / 2.0))
		if str(hero.get("class", "")) in ["mage", "priest"]:
			hero["mp"] = int(hero.maxMp)
		levels_gained += 1
	hero["expNext"] = progression_exp_next(int(hero.get("level", 1)))
	return levels_gained


static func _consume_combat_effect(hero: Dictionary,effect_id: String,field: String) -> bool:
	var entries: Array=hero.get(field,[])
	var found:=false
	var remaining: Array=[]
	for entry in entries:
		if entry is Dictionary and str(entry.get("id",""))==effect_id and int(entry.get("duration",0))>0 and not found:
			found=true
			var duration:=int(entry.get("duration",0))-1
			if duration>0: remaining.append({"id":effect_id,"duration":duration})
		else:
			if entry is Dictionary: remaining.append(entry)
	hero[field]=remaining
	return found


static func _award_victory(world: Dictionary, enemy: Dictionary) -> String:
	var hero := ensure_hero(world)
	var reward_exp := maxi(0, int(enemy.get("exp", 0)))
	if bool(enemy.get("riftMode", false)):
		reward_exp = int(round(float(reward_exp) * float(enemy.get("riftExpMult", 1.0))))
	var exp_multiplier := 1.0
	if bool(enemy.get("elite",false)): exp_multiplier *= 1.5
	if _consume_combat_effect(hero,"elderBlessing","effects"): exp_multiplier *= 1.2
	if _consume_combat_effect(hero,"bardBuff","buffs"): exp_multiplier *= 1.1
	reward_exp = int(round(float(reward_exp)*exp_multiplier))
	var reward_gold := maxi(0, int(enemy.get("gold", 0)))
	if bool(enemy.get("riftMode", false)):
		reward_gold = int(round(float(reward_gold) * float(enemy.get("riftGoldMult", 1.0))))
	var tower_mode := bool(enemy.get("towerMode", false))
	if not tower_mode:
		preload("res://godot/scripts/world_daily_quest_engine.gd").update_progress(world,"kill",str(enemy.get("enemyId","")))
	var campaign_message := "" if bool(enemy.get("riftMode", false)) or tower_mode else preload("res://godot/scripts/world_campaign_engine.gd").record_kill(world,str(world.get("currentRegionId","")),str(enemy.get("enemyId","")) )
	var dragon_reward_message := "" if bool(enemy.get("riftMode", false)) or tower_mode else _claim_story_dragon_reward(world, hero, str(enemy.get("enemyId","")), str(world.get("currentRegionId","")) )
	var level_ups := _grant_experience(hero, reward_exp)
	hero["gold"] = mini(2147483647, int(hero.gold) + reward_gold)
	var enemy_definition: Dictionary = EnemyCatalog.get_enemy(str(enemy.get("enemyId", "")))
	var drops: Array = enemy.get("drops", enemy_definition.get("drops", []))
	var difficulty := str(world.get("difficulty", "normal"))
	var base_drop_chance := EncounterGenerator.base_drop_chance(difficulty, bool(enemy.get("elite", false)))
	var luck := clampf(float(hero.get("luck", 5.0 + (int(hero.level) - 1) * 0.5)), 0.0, 100.0)
	var drop_chance := minf(1.0, base_drop_chance * (1.0 + luck * 0.005))
	var drop_rng := RandomScript.new(int(enemy.get("dropSeed", RandomScript.derive_seed([world.get("seed", 1), enemy.get("persistentId", "")]))))
	var dropped_names: Array[String] = []
	for drop_index in range(drops.size()):
		var should_drop := bool(enemy.get("boss", false)) and drop_index == 0
		if not should_drop:
			should_drop = drop_rng.next_float() < drop_chance
		if should_drop:
			var item_id := str(drops[drop_index])
			if add_item(hero, item_id, 1):
				var item_definition := ItemCatalog.get_item(item_id)
				if not item_definition.is_empty():
					dropped_names.append(str(item_definition.get("name", item_id)))

	var region_id := str(world.get("currentRegionId", "village"))
	var persistent_id := str(enemy.get("persistentId", ""))
	if not tower_mode:
		if bool(enemy.get("boss", false)):
			WorldState.mark_boss_defeated(world, region_id, persistent_id)
		else:
			WorldState.mark_enemy_defeated(world, region_id, persistent_id, float(world.get("clockMinutes", 0.0)) + EncounterGenerator.respawn_minutes(str(world.get("difficulty", "normal"))))
	world["hero"] = hero
	var message := "Победа! +%d опыта, +%d золота." % [reward_exp, reward_gold]
	if not campaign_message.is_empty(): message += "\n" + campaign_message
	if not dragon_reward_message.is_empty(): message += "\n" + dragon_reward_message
	if level_ups > 0:
		message += "\nПолучено уровней: %d." % level_ups
	if not dropped_names.is_empty():
		message += "\nДобыча: %s." % ", ".join(dropped_names)
	return message


static func _claim_story_dragon_reward(world: Dictionary, hero: Dictionary, enemy_id: String, location_id: String) -> String:
	var dragons := {
		"flame-lord": {"id":"ash-herald","location":"obsidian-fields","mission":"a3-m5","shard":"flame","item":"shard-flame","name":"Осколок Пламени"},
		"ice-queen": {"id":"ice-grasp","location":"frost-citadel","mission":"a4-m5","shard":"ice","item":"shard-ice","name":"Осколок Льда"},
		"ancient-dragon": {"id":"blood-crown","location":"dragon-lair","mission":"a5-m5","shard":"blood","item":"shard-blood","name":"Осколок Крови"}
	}
	var dragon: Dictionary = dragons.get(enemy_id, {})
	if dragon.is_empty() or location_id != str(dragon.location) or str(hero.get("activeCampaignMission","")) != str(dragon.mission):
		return ""
	var flags: Dictionary = world.get("storyDragons", {}) if world.get("storyDragons", {}) is Dictionary else {}
	if flags.get(str(dragon.id), false) == true:
		return ""
	var item_id := str(dragon.item)
	# Never mark a story dragon defeated until its guaranteed quest item is valid
	# and has been added. This keeps the reward retryable if item data is missing.
	if ItemCatalog.get_item(item_id).is_empty() or not add_item(hero, item_id, 1):
		return ""
	flags[str(dragon.id)] = true
	world["storyDragons"] = flags
	var shards: Dictionary = hero.get("storyShards", {}) if hero.get("storyShards", {}) is Dictionary else {}
	shards[str(dragon.shard)] = true
	hero["storyShards"] = shards
	# Keep the world-level mirror used by the browser-compatible story state.
	world["storyShards"] = shards.duplicate(true)
	return "Получен сюжетный предмет: %s." % str(dragon.name)


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
	var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
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
			damage = effective_stat(hero, "attack")
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
		var enemy_armor := maxi(0, int(enemy.get("defense", 0)) - int(passive_bonus.get("armorPen", 0)))
		var ability_multiplier := float(passive_bonus.get("spellMult", 1.0)) if kind == "meteor" else float(passive_bonus.get("dmgMult", 1.0))
		damage = maxi(1, int(round(float(damage - int(floor(float(enemy_armor) / 2.0))) * ability_multiplier)))
		enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
		var lines := ["%s: %d урона." % [str(ability.name), damage]]
		lines.append_array(_update_boss_phase(enemy))
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
			combat["log"] += "\n" + _award_victory(world, enemy)
		else:
			var incoming := maxi(1, int(round(float(enemy.get("attack", 1)) * float(enemy.get("phaseAttackMult", 1.0)))) - int(floor(float(hero.defense) / 2.0)))
			hero["hp"] = maxi(1, int(hero.hp) - incoming)
			combat["log"] += "\nПротивник отвечает: %d урона." % incoming
			var modifier_message := _apply_enemy_modifier(enemy, hero, incoming)
			if not modifier_message.is_empty():
				combat["log"] += "\n" + modifier_message
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
		var heal_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
		var restored := mini(int(round(float(spell.heal) * float(heal_bonus.get("healMult", 1.0)))), int(hero.maxHp) - int(hero.hp))
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
		var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
		var enemy_armor := maxi(0, int(enemy.get("defense", 0)) - int(passive_bonus.get("armorPen", 0)))
		var raw_damage := int(spell.get("damage", 0)) + effective_stat(hero, "magic") - int(floor(float(enemy_armor) / 2.0))
		var damage := maxi(1, int(round(float(raw_damage) * float(passive_bonus.get("spellMult", 1.0)))))
		if str(spell.get("element", "")) == "lightning" and _has_effect(enemy, "slow"):
			damage = int(round(float(damage) * 1.2))
			_remove_effect(enemy, "slow")
		enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
		lines.append("Нанесено %d урона." % damage)
		lines.append_array(_update_boss_phase(enemy))
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
			lines.append(_award_victory(world, enemy))
		else:
			var incoming := maxi(1, int(enemy.get("attack", 1)) - int(floor(float(hero.defense) / 2.0)))
			hero["hp"] = maxi(1, int(hero.hp) - incoming)
			lines.append("Противник отвечает: %d урона." % incoming)
			var modifier_message := _apply_enemy_modifier(enemy, hero, incoming)
			if not modifier_message.is_empty():
				lines.append(modifier_message)
	combat["log"] = "\n".join(lines)
	world["hero"] = hero
	return {"ok":true,"message":combat.log,"result":combat.get("result","")}


static func _update_boss_phase(enemy: Dictionary) -> Array[String]:
	var messages: Array[String] = []
	var phases: Variant = enemy.get("phases", [])
	if not phases is Array or phases.is_empty():
		return messages
	var index := maxi(0, int(enemy.get("phase", 0)))
	var ratio := float(enemy.get("hp", 0)) / float(maxi(1, int(enemy.get("maxHp", 1))))
	while index < phases.size():
		var phase: Variant = phases[index]
		if not phase is Dictionary or ratio > float(phase.get("atHp", 0.0)):
			break
		index += 1
		enemy["phase"] = index
		enemy["phaseAttackMult"] = maxf(1.0, float(phase.get("atkMult", 1.0)))
		enemy["phaseSpecialEvery"] = maxi(1, int(phase.get("specialEvery", enemy.get("special", {}).get("every", 3))))
		messages.append("⚠️ " + str(phase.get("msg", "Босс меняет тактику!")))
	return messages


static func _apply_enemy_modifier(enemy: Dictionary, hero: Dictionary, incoming: int) -> String:
	match str(enemy.get("modifierEffect", "")):
		"poison":
			apply_effect(hero, "poison")
			return "Ядовитая атака накладывает отравление."
		"vampiric":
			var healed := mini(maxi(1, int(round(float(incoming) * 0.3))), int(enemy.get("maxHp", enemy.get("hp", 0))) - int(enemy.get("hp", 0)))
			enemy["hp"] = int(enemy.get("hp", 0)) + maxi(0, healed)
			return "Вампирский враг поглощает %d HP." % healed if healed > 0 else ""
		"regenerate":
			var healed := mini(5, int(enemy.get("maxHp", enemy.get("hp", 0))) - int(enemy.get("hp", 0)))
			enemy["hp"] = int(enemy.get("hp", 0)) + maxi(0, healed)
			return "Враг восстанавливает %d HP." % healed if healed > 0 else ""
	return ""


static func _has_effect(target: Dictionary, effect_id: String) -> bool:
	for effect in target.get("effects", []):
		if str(effect.get("id", "")) == effect_id:
			return true
	return false


static func _remove_effect(target: Dictionary, effect_id: String) -> void:
	var effects: Array = target.get("effects", [])
	effects = effects.filter(func(effect): return str(effect.get("id", "")) != effect_id)
	target["effects"] = effects



static func select_class(world: Dictionary, class_id: String) -> Dictionary:
	if not ClassCatalog.CLASSES.has(class_id):
		return {"ok":false,"message":"Неизвестный класс."}
	var current: Dictionary = world.get("hero", {})
	if bool(current.get("classChosen", false)):
		return {"ok":false,"message":"Класс уже выбран для этого персонажа."}
	var definition: Dictionary = ClassCatalog.get_class(class_id)
	world["hero"] = {
		"class":class_id,"classChosen":true,"level":1,
		"maxHp":int(definition.maxHp),"hp":int(definition.maxHp),
		"maxMp":int(definition.maxMp),"mp":int(definition.maxMp),
		"attack":int(definition.attack),"defense":int(definition.defense),
		"str":int(definition.get("str",0)),"int":int(definition.get("int",0)),"wis":int(definition.get("wis",0)),"con":int(definition.get("con",0)),"dex":int(definition.get("dex",0)),
		"exp":0,"expNext":125,"statPoints":0,"passivePoints":0,"luck":5.0,"gold":0,"talents":[],"passives":["start"],"spells":definition.spells.duplicate(),
		"inventory":[],"equipped":{},"inventoryInitialized":false,
		"effects":[],"buffs":[],"cooldowns":{}
	}
	ensure_hero(world)
	return {"ok":true,"message":"Выбран класс: %s." % str(definition.name)}


static func effective_stat(hero: Dictionary, stat: String) -> int:
	var PassiveEngine = preload("res://godot/scripts/world_passive_engine.gd")
	var passive_bonus: Dictionary = PassiveEngine.get_bonus(hero)
	var total := int(hero.get(stat, 0))
	match stat:
		"attack":
			total = int(hero.get("str", total)) + int(passive_bonus.get("atkFlat", 0))
		"magic":
			total = int(hero.get("int", hero.get("magic", total))) + int(passive_bonus.get("magFlat", 0))
		"defense":
			total = int(floor(float(hero.get("con", total * 2)) / 2.0)) + int(passive_bonus.get("defFlat", 0))
	var equipped: Dictionary = hero.get("equipped", {})
	for instance in equipped.values():
		if instance == null:
			continue
		var item_id := str(instance if instance is String else instance.get("id", ""))
		var item: Dictionary = ItemCatalog.get_item(item_id)
		var bonus: Dictionary = item.get("bonus", {}).duplicate(true)
		if instance is Dictionary:
			for key in instance.get("bonus", {}):
				bonus[key] = int(bonus.get(key, 0)) + int(instance.bonus[key])
		for key in bonus:
			if str(key) == stat:
				total += int(bonus[key])
	if stat == "defense":
		total = int(floor(float(total) * float(passive_bonus.get("defMult", 1.0))))
	return total

static func add_item(hero: Dictionary, item_id: String, quantity: int = 1, rarity: String = "") -> bool:
	var item := ItemCatalog.get_item(item_id)
	if item.is_empty() or quantity < 1:
		return false
	var inventory: Array = hero.get("inventory", [])
	var stackable := str(item.get("type", "")) in ["consumable","scroll","quest","material","rune"]
	if stackable:
		for instance in inventory:
			if str(instance.get("id", "")) == item_id and str(instance.get("rarity", "")) == rarity:
				instance["qty"] = int(instance.get("qty", 1)) + quantity
				hero["inventory"] = inventory
				return true
		var stack: Dictionary = {"id":item_id,"qty":quantity}
		if not rarity.is_empty(): stack["rarity"] = rarity
		inventory.append(stack)
	else:
		for index in range(quantity):
			inventory.append({"id":item_id,"qty":1,"bonus":item.get("bonus",{}).duplicate(true),"runes":[],"sockets":int(item.get("sockets",0))})
	hero["inventory"] = inventory
	return true

static func remove_item(hero: Dictionary, item_id: String, quantity: int = 1) -> bool:
	var inventory: Array = hero.get("inventory", [])
	var total := 0
	for instance in inventory:
		if str(instance.get("id","")) == item_id:
			total += int(instance.get("qty",1))
	if quantity < 1 or total < quantity:
		return false
	var remaining := quantity
	for index in range(inventory.size()-1,-1,-1):
		var instance: Dictionary = inventory[index]
		if str(instance.get("id","")) != item_id:
			continue
		var count := int(instance.get("qty",1))
		var used := mini(count,remaining)
		remaining -= used
		if used == count:
			inventory.remove_at(index)
		else:
			instance["qty"] = count-used
	hero["inventory"] = inventory
	return remaining == 0

static func use_item(world: Dictionary, item_id: String) -> Dictionary:
	var hero := ensure_hero(world)
	var item := ItemCatalog.get_item(item_id)
	if item.is_empty() or not ["consumable","scroll"].has(str(item.get("type",""))):
		return {"ok":false,"message":"Этот предмет нельзя использовать."}
	if bool(item.get("combatOnly",false)):
		return {"ok":false,"message":"Этот предмет можно использовать только в бою."}
	if str(item.get("type","")) == "scroll":
		var spell_id := str(item.get("spellId",""))
		var spells: Array = hero.get("spells",[])
		if spell_id.is_empty() or spells.has(spell_id):
			return {"ok":false,"message":"Этот свиток уже изучен."}
		spells.append(spell_id)
		hero["spells"] = spells
	elif item_id.contains("health-potion"):
		var amount := 360 if item_id == "greater-health-potion" else 200 if item_id == "strong-health-potion" else 80
		hero["hp"] = mini(int(hero.maxHp), int(hero.hp)+amount)
	elif item_id.contains("mana-potion"):
		var amount := 220 if item_id == "greater-mana-potion" else 120 if item_id == "strong-mana-potion" else 50
		hero["mp"] = mini(int(hero.maxMp), int(hero.mp)+amount)
	else:
		return {"ok":false,"message":"Эффект предмета пока не поддерживается."}
	remove_item(hero,item_id)
	world["hero"] = hero
	return {"ok":true,"message":"Использовано: %s." % str(item.name)}

static func equip_item(world: Dictionary, inventory_index: int) -> Dictionary:
	var hero := ensure_hero(world)
	var inventory: Array = hero.get("inventory", [])
	if inventory_index < 0 or inventory_index >= inventory.size():
		return {"ok":false,"message":"Предмет не найден."}
	var instance: Dictionary = inventory[inventory_index]
	var item := ItemCatalog.get_item(str(instance.get("id","")))
	var item_type := str(item.get("type",""))
	var slot := ""
	for candidate in ItemCatalog.SLOT_TYPES:
		if ItemCatalog.SLOT_TYPES[candidate].has(item_type):
			slot = str(candidate)
			break
	if item_type == "ring":
		slot = "ring1" if hero.equipped.get("ring1",null) == null else "ring2"
	if slot.is_empty():
		return {"ok":false,"message":"Этот предмет нельзя надеть."}
	var equipped: Dictionary = hero.get("equipped", {})
	var previous = equipped.get(slot,null)
	inventory.remove_at(inventory_index)
	if previous != null:
		inventory.append(previous)
	equipped[slot] = instance
	hero["inventory"] = inventory
	hero["equipped"] = equipped
	world["hero"] = hero
	return {"ok":true,"message":"Экипировано: %s." % str(item.name)}


static func retreat(combat: Dictionary) -> bool:
	if combat.is_empty() or combat.get("over", true):
		return false
	combat["over"] = true
	combat["turn"] = "over"
	combat["result"] = "retreat"
	combat["log"] = "Вы отступили. Противник не побеждён."
	return true
