# Lightweight native turn-based combat loop. Core damage and rewards are explicit and testable.
class_name WorldCombatEngine
extends RefCounted

const FactionEngine = preload("res://godot/scripts/world_faction_engine.gd")

const WorldState = preload("res://godot/scripts/world_state.gd")
const ClassCatalog = preload("res://godot/scripts/world_class_catalog.gd")
const ItemCatalog = preload("res://godot/scripts/world_item_catalog.gd")
const EnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
const RandomScript = preload("res://godot/scripts/world_random.gd")
const EncounterGenerator = preload("res://godot/scripts/world_encounter_generator.gd")
const FORGE_BONUS := [0, 2, 4, 7]
const MAGIC_WEAK_ENEMIES := ["skeleton", "skeleton-archer", "dark-knight", "magma-golem", "grave-king"]
const MAGIC_RESIST_ENEMIES := ["ghost", "wraith", "shadow-mage"]
const PHYSICAL_WEAK_ENEMIES := ["ghost", "wraith", "shadow-mage", "fire-elemental", "flame-lord"]
const PHYSICAL_RESIST_ENEMIES := ["magma-golem", "dark-knight", "grave-king"]

static func enemy_damage_multiplier(enemy: Dictionary, style: String) -> float:
	var enemy_id := str(enemy.get("enemyId", ""))
	if enemy_id.is_empty() or not ["melee", "ranged", "magic"].has(style):
		return 1.0
	var weak := false
	var resistant := false
	if style == "melee" or style == "ranged":
		weak = PHYSICAL_WEAK_ENEMIES.has(enemy_id)
		resistant = PHYSICAL_RESIST_ENEMIES.has(enemy_id)
	else:
		weak = MAGIC_WEAK_ENEMIES.has(enemy_id)
		resistant = MAGIC_RESIST_ENEMIES.has(enemy_id)
	if weak and resistant:
		return 1.0
	return 1.25 if weak else (0.8 if resistant else 1.0)


static func enemy_defense_for_style(enemy: Dictionary, armor_pen: float = 0.0, style: String = "melee") -> int:
	var safe_armor_pen := maxf(0.0, armor_pen)
	var penetration := clampf(safe_armor_pen * 0.025, 0.0, 0.75)
	var base := maxi(0, int(floor(float(enemy.get("defense", 0)) * (1.0 - penetration) - safe_armor_pen * 0.5)))
	var counter: Variant = enemy.get("adaptiveCounter", null)
	if not counter is Dictionary or str(counter.get("style", "")) != style or int(counter.get("remaining", 0)) <= 0:
		return base
	var reduction := 0.12 if bool(enemy.get("boss", false)) else 0.20
	return base + int(floor(float(maxi(1, base)) * reduction))


static func record_player_style(combat: Dictionary, style: String) -> void:
	if not ["melee", "ranged", "magic"].has(style):
		return
	var history: Array = combat.get("playerStyleHistory", []) if combat.get("playerStyleHistory", []) is Array else []
	history.append(style)
	if history.size() > 4:
		history.pop_front()
	combat["playerStyleHistory"] = history


static func consume_enemy_adaptation(enemy: Dictionary, style: String) -> bool:
	var counter: Variant = enemy.get("adaptiveCounter", null)
	if not counter is Dictionary or str(counter.get("style", "")) != style or int(counter.get("remaining", 0)) <= 0:
		return false
	counter["remaining"] = int(counter.get("remaining", 0)) - 1
	if int(counter.remaining) <= 0:
		enemy["adaptiveCounter"] = null
	else:
		enemy["adaptiveCounter"] = counter
	return true


static func prepare_enemy_adaptation(combat: Dictionary, enemy: Dictionary) -> String:
	var history: Variant = combat.get("playerStyleHistory", [])
	if not history is Array or history.size() < 3:
		return ""
	var recent: Array = history.slice(maxi(0, history.size() - 3))
	var selected_style := ""
	for candidate in ["melee", "ranged", "magic"]:
		var count := 0
		for recorded_style in recent:
			if recorded_style == candidate:
				count += 1
		if count >= 2:
			selected_style = candidate
			break
	if selected_style.is_empty():
		return ""
	var existing: Variant = enemy.get("adaptiveCounter", null)
	if existing is Dictionary and int(existing.get("remaining", 0)) > 0:
		return ""
	enemy["adaptiveCounter"] = {"style": selected_style, "remaining": 2 if bool(enemy.get("boss", false)) else 1}
	var label := "ближнему бою" if selected_style == "melee" else ("дальним атакам" if selected_style == "ranged" else "магии")
	var message := "🧠 Противник приспособился к вашему стилю (%s)!" % label
	if bool(enemy.get("boss", false)):
		message += " Босс изучает ваши действия, но его защита слабее."
	return message


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
	"slow": {"atkMult": 0.75, "duration": 2, "name": "Замедление"},
	"atkBuff": {"atkMult": 1.3, "duration": 2, "name": "Боевой клич"},
	"defBuff": {"defMult": 1.5, "duration": 2, "name": "Щит маны"},
	"lifesteal": {"lifestealPct": 0.5, "duration": 2, "name": "Кровожадность"},
	"strength": {"atkFlat": 5, "duration": 3, "name": "Эликсир силы"},
	"manaShield": {"duration": 2, "name": "Эликсир маны"},
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
	return {"enemy": enemy, "turn": "player", "over": false, "blocking": false, "playerResurrectionUsed": false, "log": "Бой начался: %s" % str(enemy.get("name", "Противник")), "result": ""}

static func critical_chance(hero: Dictionary, extra_bonus: float = 0.0) -> float:
	var class_data: Dictionary = ClassCatalog.get_class_definition(str(hero.get("class", "warrior")))
	var class_combat: Dictionary = class_data.get("combat", {})
	var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
	var chance := float(class_combat.get("critChance", 0.05)) + float(passive_bonus.get("critChance", 0.0)) + extra_bonus
	var effective_dex := float(hero.get("dex", 0.0)) + float(passive_bonus.get("dexFlat", 0.0))
	var equipped: Dictionary = hero.get("equipped", {})
	for instance in equipped.values():
		if instance == null:
			continue
		var item_id := str(instance if instance is String else instance.get("id", ""))
		var item: Dictionary = ItemCatalog.get_item(item_id)
		var bonus: Dictionary = item.get("bonus", {}).duplicate(true)
		if instance is Dictionary:
			# Browser getEffStats merges instance bonuses over catalog defaults;
			# it does not add the same base item bonus a second time.
			for key in instance.get("bonus", {}):
				bonus[key] = instance.bonus[key]
			for rune_id in instance.get("runes", []):
				var rune: Dictionary = ItemCatalog.get_item(str(rune_id))
				for key in rune.get("runeBonus", {}):
					bonus[key] = float(bonus.get(key, 0.0)) + float(rune.runeBonus[key])
		chance += float(bonus.get("critChance", 0.0))
		effective_dex += float(bonus.get("dex", 0.0))
	# Browser stats add one tenth of a percentage point per Dexterity point.
	chance += effective_dex * 0.001
	return clampf(maxf(0.01, chance), 0.0, 0.75)


static func player_attack(world: Dictionary, combat: Dictionary) -> Dictionary:
	if combat.is_empty() or combat.get("over", true) or combat.get("turn", "") != "player":
		return {"ok": false, "message": "Сейчас нельзя атаковать."}
	var hero := ensure_hero(world)
	var enemy: Dictionary = combat.get("enemy", {})
	var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
	var attack_style := "ranged" if str(hero.get("class", "")) == "archer" else "melee"
	var enemy_armor := enemy_defense_for_style(enemy, float(passive_bonus.get("armorPen", 0)), attack_style)
	var charge_multiplier := 2.0 if _consume_combat_effect(hero, "double_next", "buffs") else 1.0
	var attack_index := int(combat.get("playerAttackCount", 0))
	combat["playerAttackCount"] = attack_index + 1
	var damage_seed := RandomScript.derive_seed([world.get("seed", 1), "combat-damage", enemy.get("persistentId", ""), attack_index])
	var damage_rng := RandomScript.new(damage_seed)
	var damage_roll := damage_rng.next_int(5)
	var raw_damage := effective_stat(hero, "attack") + damage_roll - int(floor(float(enemy_armor) / 2.0))
	var damage := maxi(1, int(floor(float(raw_damage) * float(passive_bonus.get("dmgMult", 1.0)) * _effect_multiplier(hero, "atkMult") * enemy_damage_multiplier(enemy, attack_style))))
	consume_enemy_adaptation(enemy, attack_style)
	record_player_style(combat, attack_style)
	var cat_luck_bonus := 0.05 if _has_combat_effect(hero, "catLuck", "buffs") else 0.0
	var crit_chance := critical_chance(hero, cat_luck_bonus)
	var crit_seed := RandomScript.derive_seed([world.get("seed", 1), "combat-crit", enemy.get("persistentId", ""), attack_index])
	var crit_rng := RandomScript.new(crit_seed)
	var is_critical := crit_rng.next_float() < crit_chance
	if is_critical:
		damage = int(floor(float(damage) * clampf(float(passive_bonus.get("critMult", 1.5)), 1.25, 2.5)))
	if charge_multiplier > 1.0:
		damage = int(floor(float(damage) * charge_multiplier))
	var actual_damage := mini(maxi(0, int(enemy.get("hp", 0))), damage)
	enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
	var lifesteal_healed := _apply_lifesteal(hero, actual_damage)
	var lines: Array[String] = ["Вы нанесли %d урона.%s" % [damage, " КРИТ!" if is_critical else ""]]
	if lifesteal_healed > 0:
		lines.append("Кровожадность восстанавливает %d HP." % lifesteal_healed)
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
		if not _tick_enemy_effects(world, combat, enemy, lines):
			combat["turn"] = "enemy"
			var adaptation_message := prepare_enemy_adaptation(combat, enemy)
			if not adaptation_message.is_empty():
				lines.append(adaptation_message)
			var response_lines: Array[String] = []
			_resolve_enemy_response(world, combat, hero, enemy, response_lines)
			lines.append_array(response_lines)
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


static func _has_combat_effect(hero: Dictionary, effect_id: String, field: String = "buffs") -> bool:
	for effect in hero.get(field, []):
		if effect is Dictionary and str(effect.get("id", "")) == effect_id and int(effect.get("duration", 0)) > 0:
			return true
	return false


static func _award_victory(world: Dictionary, enemy: Dictionary) -> String:
	var hero := ensure_hero(world)
	var reward_exp := maxi(0, int(enemy.get("exp", 0)))
	if bool(enemy.get("riftMode", false)):
		reward_exp = int(round(float(reward_exp) * float(enemy.get("riftExpMult", 1.0))))
	var exp_multiplier := 1.0
	if bool(enemy.get("elite",false)): exp_multiplier *= 1.5
	if _consume_combat_effect(hero,"elderBlessing","effects"): exp_multiplier *= 1.2
	if _consume_combat_effect(hero,"bardBuff","buffs"): exp_multiplier *= 1.1
	# Cat luck lasts for one victorious encounter, matching the browser.
	_consume_combat_effect(hero, "catLuck", "buffs")
	reward_exp = int(round(float(reward_exp)*exp_multiplier))
	var reward_gold := maxi(0, int(enemy.get("gold", 0)))
	if not bool(enemy.get("riftMode", false)) and not bool(enemy.get("towerMode", false)):
		reward_gold = EncounterGenerator.ambient_gold_reward(reward_gold, bool(enemy.get("elite", false)), int(enemy.get("ngPlus", hero.get("ngPlus", 0))), preload("res://godot/scripts/world_campaign_engine.gd").act_price_multiplier(hero))
	if bool(enemy.get("riftMode", false)):
		reward_gold = int(round(float(reward_gold) * float(enemy.get("riftGoldMult", 1.0))))
	var tower_mode := bool(enemy.get("towerMode", false))
	if not tower_mode:
		preload("res://godot/scripts/world_daily_quest_engine.gd").update_progress(world,"kill",str(enemy.get("enemyId","")))
	var campaign_message := "" if bool(enemy.get("riftMode", false)) or tower_mode else preload("res://godot/scripts/world_campaign_engine.gd").record_kill(world,str(world.get("currentRegionId","")),str(enemy.get("enemyId","")) )
	var dragon_reward_message := "" if bool(enemy.get("riftMode", false)) or tower_mode else _claim_story_dragon_reward(world, hero, str(enemy.get("enemyId","")), str(world.get("currentRegionId","")) )
	var level_ups := _grant_experience(hero, reward_exp)
	hero["gold"] = mini(2147483647, int(hero.gold) + reward_gold)
	# Persist lifetime counters before evaluating achievements, matching browser checks.
	var lifetime_stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	var lifetime_kills: Dictionary = lifetime_stats.get("kills", {}) if lifetime_stats.get("kills", {}) is Dictionary else {}
	var enemy_id_for_stats := str(enemy.get("enemyId", ""))
	lifetime_kills[enemy_id_for_stats] = mini(2147483647, maxi(0, int(lifetime_kills.get(enemy_id_for_stats, 0))) + 1)
	lifetime_stats["kills"] = lifetime_kills
	lifetime_stats["goldEarned"] = mini(2147483647, maxi(0, int(lifetime_stats.get("goldEarned", 0))) + reward_gold)
	if bool(enemy.get("elite", false)):
		lifetime_stats["eliteKills"] = mini(2147483647, maxi(0, int(lifetime_stats.get("eliteKills", 0))) + 1)
	if bool(enemy.get("boss", false)):
		lifetime_stats["bossKills"] = mini(2147483647, maxi(0, int(lifetime_stats.get("bossKills", 0))) + 1)
	hero["stats"] = lifetime_stats
	var enemy_definition: Dictionary = EnemyCatalog.get_enemy(str(enemy.get("enemyId", "")))
	var drops: Array = enemy.get("drops", enemy_definition.get("drops", []))
	var difficulty := str(world.get("difficulty", "normal"))
	var base_drop_chance := EncounterGenerator.base_drop_chance(difficulty, bool(enemy.get("elite", false)))
	var drop_chance := EncounterGenerator.loot_drop_chance(base_drop_chance, hero, world)
	var drop_rng := RandomScript.new(int(enemy.get("dropSeed", RandomScript.derive_seed([world.get("seed", 1), enemy.get("persistentId", "")]))))
	var dropped_names: Array[String] = []
	for drop_index in range(drops.size()):
		# Match the browser: bosses guarantee their first signature drop and
		# roll any additional drops at normal difficulty odds; elites use 85%.
		var should_drop := bool(enemy.get("boss", false)) and drop_index == 0
		if not should_drop:
			var roll_chance := EncounterGenerator.loot_drop_chance(EncounterGenerator.base_drop_chance(difficulty), hero, world) if bool(enemy.get("boss", false)) else drop_chance
			should_drop = drop_rng.next_float() < roll_chance
		if should_drop:
			var item_id := str(drops[drop_index])
			if add_item(hero, item_id, 1):
				var item_definition := ItemCatalog.get_item(item_id)
				if not item_definition.is_empty():
					dropped_names.append(str(item_definition.get("name", item_id)))

	var herb_chance := EncounterGenerator.herb_drop_chance(bool(enemy.get("boss", false)), bool(enemy.get("elite", false)))
	if drop_rng.next_float() < herb_chance:
		var herb_id := "herb-life" if drop_rng.next_float() < 0.5 else "herb-moon"
		var herb_quantity := EncounterGenerator.herb_drop_quantity(bool(enemy.get("boss", false)), bool(enemy.get("elite", false)))
		if add_item(hero, herb_id, herb_quantity):
			var herb_definition := ItemCatalog.get_item(herb_id)
			if not herb_definition.is_empty():
				dropped_names.append("%s x%d" % [str(herb_definition.get("name", herb_id)), herb_quantity])

	var region_id := str(world.get("currentRegionId", "village"))
	var persistent_id := str(enemy.get("persistentId", ""))
	if not tower_mode:
		if bool(enemy.get("boss", false)):
			WorldState.mark_boss_defeated(world, region_id, persistent_id)
		else:
			WorldState.mark_enemy_defeated(world, region_id, persistent_id, float(world.get("clockMinutes", 0.0)) + EncounterGenerator.respawn_minutes(str(world.get("difficulty", "normal"))))
	world["hero"] = hero
	var achievement_unlocks: Array = preload("res://godot/scripts/world_achievement_engine.gd").evaluate(world)
	hero = world.get("hero", hero)
	var message := "Победа! +%d опыта, +%d золота." % [reward_exp, reward_gold]
	for achievement in achievement_unlocks:
		message += "\n🏆 %s (+%d золота)." % [str(achievement.get("name", "")), int(achievement.get("reward", 0))]
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


static func mitigate_incoming_damage(attack: float, defense: float) -> int:
	var safe_attack := maxf(0.0, attack)
	var safe_defense := maxf(0.0, defense)
	return maxi(1, int(floor(safe_attack * (100.0 / (100.0 + safe_defense * 1.5)))))


static func _calculate_incoming_damage(world: Dictionary, hero: Dictionary, enemy: Dictionary, turn_count: int) -> int:
	var attack := maxf(0.0, float(enemy.get("attack", 1)) * float(enemy.get("phaseAttackMult", 1.0)))
	var damage_seed := RandomScript.derive_seed([world.get("seed", 1), "combat-incoming", enemy.get("persistentId", ""), turn_count])
	var damage_rng := RandomScript.new(damage_seed)
	attack += float(damage_rng.next_int(5))
	var defense := float(effective_stat(hero, "defense"))
	var base_damage := mitigate_incoming_damage(attack, defense)
	var difficulty := 0.7 if str(world.get("difficulty", "normal")) == "easy" else (1.4 if str(world.get("difficulty", "normal")) == "hard" else 1.0)
	base_damage = maxi(1, int(floor(float(base_damage) * difficulty)))
	var defense_multiplier := _effect_multiplier(hero, "defMult")
	if defense_multiplier > 1.0:
		base_damage = maxi(1, int(floor(float(base_damage) / defense_multiplier)))
	return base_damage


static func _combat_defense_stats(hero: Dictionary) -> Dictionary:
	var class_data: Dictionary = ClassCatalog.get_class_definition(str(hero.get("class", "warrior")))
	var combat_data: Dictionary = class_data.get("combat", {})
	var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
	var dodge := float(combat_data.get("dodgeChance", 0.0))
	var block := float(combat_data.get("blockChance", 0.0))
	var block_power := float(combat_data.get("blockPower", 0.4))
	var equipped: Dictionary = hero.get("equipped", {})
	for slot in equipped:
		var instance: Variant = equipped[slot]
		if instance == null:
			continue
		var item_id := str(instance if instance is String else instance.get("id", ""))
		var item: Dictionary = ItemCatalog.get_item(item_id)
		if item.is_empty():
			continue
		var bonus: Dictionary = item.get("bonus", {}).duplicate(true)
		if instance is Dictionary:
			var instance_bonus: Variant = instance.get("bonus", {})
			if instance_bonus is Dictionary:
				for key in instance_bonus:
					bonus[key] = instance_bonus[key]
			var runes: Variant = instance.get("runes", [])
			if runes is Array:
				for rune_id in runes:
					var rune: Dictionary = ItemCatalog.get_item(str(rune_id))
					var rune_bonus: Dictionary = rune.get("runeBonus", {})
					for key in rune_bonus:
						bonus[key] = float(bonus.get(key, 0.0)) + float(rune_bonus[key])
		dodge += float(bonus.get("dodgeChance", 0.0))
		block += float(bonus.get("blockChance", 0.0))
		block_power += float(bonus.get("blockPower", 0.0))
	dodge = clampf(dodge + float(effective_stat(hero, "dex")) * 0.002 + float(passive_bonus.get("dodgeChance", 0.0)), 0.0, 0.65)
	block = clampf(block + float(passive_bonus.get("blockChance", 0.0)), 0.0, 0.6)
	block_power = clampf(block_power + float(passive_bonus.get("blockPower", 0.0)), 0.3, 0.9)
	return {"dodgeChance": dodge, "blockChance": block, "blockPower": block_power}


static func _try_priest_resurrection(combat: Dictionary, hero: Dictionary, lines: Array[String]) -> bool:
	if str(hero.get("class", "")) != "priest" or bool(combat.get("playerResurrectionUsed", false)):
		return false
	var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
	var restore := ceili(float(hero.get("maxHp", 1)) * float(passive_bonus.get("resurrectPct", 0.3)))
	hero["hp"] = clampi(restore, 1, int(hero.get("maxHp", 1)))
	combat["playerResurrectionUsed"] = true
	combat["over"] = false
	combat["result"] = ""
	combat["turn"] = "player"
	combat["blocking"] = false
	lines.append("Воскрешение! Вы возвращаетесь в бой с %d HP." % int(hero.hp))
	return true


static func _resolve_enemy_response(world: Dictionary, combat: Dictionary, hero: Dictionary, enemy: Dictionary, lines: Array[String]) -> void:
	if _has_effect(enemy, "stun"):
		_remove_effect(enemy, "stun")
		lines.append("%s оглушён и пропускает ход." % str(enemy.get("name", "Противник")))
		# A stunned enemy still consumes a complete combat round: both sides'
		# ongoing effects tick, player cooldowns advance, and turn counters stay aligned.
		var enemy_tick := tick_effects(enemy)
		if int(enemy_tick.damage) > 0:
			enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - int(enemy_tick.damage))
			lines.append("Эффекты наносят противнику %d урона." % int(enemy_tick.damage))
		if int(enemy.get("hp", 0)) <= 0:
			enemy["hp"] = 0
			enemy["dead"] = true
			enemy["state"] = "dead"
			lines.append(_award_victory(world, enemy))
			combat["over"] = true
			combat["result"] = "victory"
			combat["turn"] = "over"
		else:
			var hero_tick := tick_effects(hero)
			if int(hero_tick.damage) > 0:
				hero["hp"] = maxi(0, int(hero.get("hp", 0)) - int(hero_tick.damage))
				lines.append("Эффекты наносят вам %d урона." % int(hero_tick.damage))
			if int(hero.get("hp", 0)) <= 0:
				if not _try_priest_resurrection(combat, hero, lines):
					hero["hp"] = 1
					combat["over"] = true
					combat["result"] = "defeat"
					combat["turn"] = "over"
					lines.append("Вы потерпели поражение и отступили. Противник остался жив.")
			else:
				_decrease_cooldowns(hero)
				combat["turn"] = "player"
				enemy["turnCount"] = int(enemy.get("turnCount", 0)) + 1
				combat["turnCount"] = int(combat.get("turnCount", 0)) + 1
		combat["blocking"] = false
		combat["enemy"] = enemy
		world["hero"] = hero
		return
	var turn_count := int(enemy.get("turnCount", 0)) + 1
	enemy["turnCount"] = turn_count
	var special: Dictionary = enemy.get("special", {})
	var every := maxi(1, int(enemy.get("phaseSpecialEvery", special.get("every", 3))))
	var special_ready := not special.is_empty() and turn_count % every == 0
	var special_type := str(special.get("type", ""))
	var dodge_ready := _consume_combat_effect(hero, "dodge", "buffs")
	var defense_stats := _combat_defense_stats(hero)
	var defense_seed := RandomScript.derive_seed([world.get("seed", 1), "combat-defense", enemy.get("persistentId", ""), turn_count])
	var defense_rng := RandomScript.new(defense_seed)
	var automatic_dodge := defense_rng.next_float() < float(defense_stats.dodgeChance)
	var manual_block := bool(combat.get("blocking", false))
	if dodge_ready or automatic_dodge:
		lines.append("Вы уклонились от атаки — урон полностью предотвращён.")
		combat["blocking"] = false
	else:
		var incoming := _calculate_incoming_damage(world, hero, enemy, turn_count)
		var automatic_block := not manual_block and defense_rng.next_float() < float(defense_stats.blockChance)
		if manual_block or automatic_block:
			var reduction := maxf(0.5, float(defense_stats.blockPower)) if manual_block else maxf(0.35, float(defense_stats.blockPower))
			incoming = maxi(1, int(floor(float(incoming) * (1.0 - minf(0.9, reduction)))))
			lines.append("Вы приняли удар в защитную стойку — урон снижен." if manual_block else "Сработал автоматический блок — урон снижен.")
			if manual_block and (bool(enemy.get("boss", false)) or bool(enemy.get("elite", false))):
				var counter_damage := maxi(1, int(floor(float(effective_stat(hero, "attack")) * (0.28 + minf(0.25, float(defense_stats.blockPower) * 0.25)))))
				enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - counter_damage)
				lines.append("Контратака из блока: %d урона." % counter_damage)
				if int(enemy.hp) <= 0:
					enemy["dead"] = true
					enemy["state"] = "dead"
					lines.append(_award_victory(world, enemy))
					combat["over"] = true
					combat["result"] = "victory"
					combat["turn"] = "over"
					combat["blocking"] = false
					combat["enemy"] = enemy
					world["hero"] = hero
					return
		if special_ready and special_type == "snipe":
			incoming = maxi(1, int(round(float(incoming) * float(special.get("mult", 1.8)))))
		elif special_ready and special_type == "double":
			incoming = maxi(1, int(floor(float(incoming) * 0.6))) * 2
		incoming = maxi(1, int(floor(float(incoming) * (1.0 - FactionEngine.get_damage_reduction(world)))))
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
		if not _try_priest_resurrection(combat, hero, lines):
			hero["hp"] = 1
			combat["over"] = true
			combat["result"] = "defeat"
			combat["turn"] = "over"
			lines.append("Вы потерпели поражение и отступили. Противник остался жив.")
	else:
		_decrease_cooldowns(hero)
		combat["turn"] = "player"
		combat["turnCount"] = int(combat.get("turnCount", 0)) + 1
	combat["blocking"] = false
	combat["enemy"] = enemy
	world["hero"] = hero


static func block(world: Dictionary, combat: Dictionary) -> Dictionary:
	if combat.is_empty() or bool(combat.get("over", true)) or str(combat.get("turn", "")) != "player":
		return {"ok": false, "message": "Сейчас нельзя принять защитную стойку."}
	var hero := ensure_hero(world)
	var enemy: Dictionary = combat.get("enemy", {})
	combat["blocking"] = true
	var lines: Array[String] = ["Вы принимаете защитную стойку."]
	if not _tick_enemy_effects(world, combat, enemy, lines):
		combat["turn"] = "enemy"
		_resolve_enemy_response(world, combat, hero, enemy, lines)
	combat["blocking"] = false
	combat["log"] = "\n".join(lines)
	combat["enemy"] = enemy
	world["hero"] = hero
	return {"ok": true, "message": str(combat.log), "result": str(combat.get("result", ""))}


static func use_ability(world: Dictionary, combat: Dictionary, ability_id: String) -> Dictionary:
	if combat.is_empty() or combat.get("over", true) or combat.get("turn", "") != "player":
		return {"ok": false, "message": "Сейчас нельзя применить способность."}
	var hero := ensure_hero(world)
	var class_data: Dictionary = ClassCatalog.get_class_definition(str(hero.get("class", "warrior")))
	var ability: Dictionary = {}
	for candidate in class_data.get("abilities", []):
		if str(candidate.id) == ability_id:
			ability = candidate
			break
	if ability.is_empty() or bool(ability.get("passive", false)):
		return {"ok": false, "message": "Эта способность недоступна для ручного применения."}
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
		"prayer":
			var heal := int(floor((50.0 + floor(float(effective_stat(hero, "magic")) / 2.0)) * float(passive_bonus.get("prayerMult", 1.0)) * float(passive_bonus.get("healMult", 1.0))))
			hero["hp"] = mini(int(hero.get("maxHp", 1)), int(hero.get("hp", 0)) + heal)
			var debuffs: Array = ["burn", "poison", "bleed", "stun", "slow"]
			var effects: Array = hero.get("effects", [])
			hero["effects"] = effects.filter(func(effect): return not debuffs.has(str(effect.get("id", ""))))
		"sanctify":
			damage = int(floor((25.0 + floor(float(effective_stat(hero, "magic")) / 2.0)) * float(passive_bonus.get("spellMult", 1.0))))
		"next_double":
			hero["buffs"].append({"id":"double_next","duration":1})
		"attack_buff":
			apply_effect(hero, "atkBuff")
		"lifesteal":
			apply_effect(hero, "lifesteal")
		"defense_buff":
			apply_effect(hero, "defBuff")
		"dodge":
			hero["buffs"].append({"id":"dodge","duration":1})
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
	if ["next_double", "attack_buff", "lifesteal", "defense_buff", "dodge", "prayer"].has(kind):
		var buff_message := ""
		match kind:
			"next_double": buff_message = "Следующая атака будет усилена."
			"attack_buff": buff_message = "Боевой клич усиливает атаку на 2 хода."
			"lifesteal": buff_message = "Кровожадность активна: часть урона вернётся здоровьем."
			"defense_buff": buff_message = "Магический барьер повышает защиту на 2 хода."
			"dodge": buff_message = "Вы готовы уклониться от следующей атаки."
			"prayer": buff_message = "Молитва исцеляет и снимает отрицательные эффекты."
		var buff_lines: Array[String] = [buff_message]
		if not _tick_enemy_effects(world, combat, enemy, buff_lines):
			combat["turn"] = "enemy"
			var adaptation_message := prepare_enemy_adaptation(combat, enemy)
			if not adaptation_message.is_empty():
				buff_lines.append(adaptation_message)
			_resolve_enemy_response(world, combat, hero, enemy, buff_lines)
		combat["log"] = "\n".join(buff_lines)
		world["hero"] = hero
		return {"ok":true,"message":combat.log,"result":combat.get("result","")}
	var ability_style := "magic" if kind in ["meteor", "sanctify"] else ("ranged" if str(hero.get("class", "")) == "archer" else "melee")
	if kind != "sanctify":
		var enemy_armor := enemy_defense_for_style(enemy, float(passive_bonus.get("armorPen", 0)), ability_style)
		var ability_multiplier := float(passive_bonus.get("meteorMult", 1.0)) * float(passive_bonus.get("spellMult", 1.0)) if kind == "meteor" else float(passive_bonus.get("dmgMult", 1.0))
		damage = maxi(1, int(floor(float(damage - int(floor(float(enemy_armor) / 2.0))) * ability_multiplier * enemy_damage_multiplier(enemy, ability_style))))
	else:
		apply_effect(enemy, "burn")
	consume_enemy_adaptation(enemy, ability_style)
	record_player_style(combat, ability_style)
	var actual_damage := mini(maxi(0, int(enemy.get("hp", 0))), damage)
	enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
	var lifesteal_healed := _apply_lifesteal(hero, actual_damage)
	var lines := ["%s: %d урона." % [str(ability.name), damage]]
	if lifesteal_healed > 0:
		lines.append("Кровожадность восстанавливает %d HP." % lifesteal_healed)
	lines.append_array(_update_boss_phase(enemy))
	if kind == "meteor":
		apply_effect(enemy, "burn")
	elif kind == "sanctify":
		lines.append("Освящение накладывает ожог.")
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
		var tick_lines: Array[String] = []
		if not _tick_enemy_effects(world, combat, enemy, tick_lines):
			var adaptation_message := prepare_enemy_adaptation(combat, enemy)
			if not adaptation_message.is_empty():
				tick_lines.append(adaptation_message)
			combat["turn"] = "enemy"
			var response_lines: Array[String] = []
			_resolve_enemy_response(world, combat, hero, enemy, response_lines)
			tick_lines.append_array(response_lines)
		if not tick_lines.is_empty():
			combat["log"] += "\n" + "\n".join(tick_lines)
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
	var non_damage_spell := spell.has("heal") or spell.has("selfDamagePct") or spell.has("selfEffect")
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
		apply_effect(hero, "defBuff")
		lines.append("Защита усилена на 2 хода.")
	else:
		var passive_bonus: Dictionary = preload("res://godot/scripts/world_passive_engine.gd").get_bonus(hero)
		var armor_pen := float(passive_bonus.get("armorPen", 0))
		var enemy_armor := enemy_defense_for_style(enemy, armor_pen, "magic")
		var matchup_multiplier := enemy_damage_multiplier(enemy, "magic")
		var raw_damage := int(spell.get("damage", 0)) + int(floor(float(effective_stat(hero, "magic")) / 2.0)) - int(floor(float(enemy_armor) / 2.0))
		var damage := maxi(1, int(floor(float(raw_damage) * float(passive_bonus.get("spellMult", 1.0)) * matchup_multiplier)))
		consume_enemy_adaptation(enemy, "magic")
		record_player_style(combat, "magic")
		var element := str(spell.get("element", ""))
		if element == "lightning" and _has_effect(enemy, "slow"):
			damage = int(floor(float(damage) * 1.2))
			_remove_effect(enemy, "slow")
		elif element == "fire" and _has_effect(enemy, "slow"):
			_remove_effect(enemy, "slow")
		elif element == "ice" and _has_effect(enemy, "burn"):
			_remove_effect(enemy, "burn")
		# Browser combat spells share the weapon critical formula.
		var attack_index := int(combat.get("playerAttackCount", 0))
		combat["playerAttackCount"] = attack_index + 1
		var crit_seed := RandomScript.derive_seed([world.get("seed", 1), "combat-crit", enemy.get("persistentId", ""), attack_index])
		var crit_rng := RandomScript.new(crit_seed)
		var is_critical := crit_rng.next_float() < critical_chance(hero)
		if is_critical:
			damage = int(floor(float(damage) * clampf(float(passive_bonus.get("critMult", 1.5)), 1.25, 2.5)))
		var actual_damage := mini(maxi(0, int(enemy.get("hp", 0))), damage)
		enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - damage)
		var lifesteal_healed := _apply_lifesteal(hero, actual_damage)
		lines.append("Нанесено %d урона.%s" % [damage, " КРИТ!" if is_critical else ""])
		if lifesteal_healed > 0:
			lines.append("Кровожадность восстанавливает %d HP." % lifesteal_healed)
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
			if not _tick_enemy_effects(world, combat, enemy, lines):
				var adaptation_message := prepare_enemy_adaptation(combat, enemy)
				if not adaptation_message.is_empty():
					lines.append(adaptation_message)
				combat["turn"] = "enemy"
				_resolve_enemy_response(world, combat, hero, enemy, lines)
	if non_damage_spell:
		if not _tick_enemy_effects(world, combat, enemy, lines):
			combat["turn"] = "enemy"
			var adaptation_message := prepare_enemy_adaptation(combat, enemy)
			if not adaptation_message.is_empty():
				lines.append(adaptation_message)
			_resolve_enemy_response(world, combat, hero, enemy, lines)
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


static func _tick_enemy_effects(world: Dictionary, combat: Dictionary, enemy: Dictionary, lines: Array[String]) -> bool:
	var effect_tick := tick_effects(enemy)
	if int(effect_tick.damage) > 0:
		enemy["hp"] = maxi(0, int(enemy.get("hp", 0)) - int(effect_tick.damage))
		lines.append("Эффекты наносят противнику %d урона." % int(effect_tick.damage))
	if int(enemy.get("hp", 0)) <= 0:
		enemy["hp"] = 0
		enemy["dead"] = true
		enemy["state"] = "dead"
		lines.append(_award_victory(world, enemy))
		combat["over"] = true
		combat["result"] = "victory"
		combat["turn"] = "over"
		return true
	return false


static func _decrease_cooldowns(hero: Dictionary) -> void:
	var cooldowns: Dictionary = hero.get("cooldowns", {}) if hero.get("cooldowns", {}) is Dictionary else {}
	for cooldown_id in cooldowns.keys():
		cooldowns[cooldown_id] = maxi(0, int(cooldowns.get(cooldown_id, 0)) - 1)
	hero["cooldowns"] = cooldowns


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
	if not ClassCatalog.CLASSES.has(class_id) or class_id == "priest":
		return {"ok":false,"message":"Неизвестный класс."}
	var current: Dictionary = world.get("hero", {})
	if bool(current.get("classChosen", false)):
		return {"ok":false,"message":"Класс уже выбран для этого персонажа."}
	var definition: Dictionary = ClassCatalog.get_class_definition(class_id)
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
		"dex":
			total = int(hero.get("dex", total)) + int(passive_bonus.get("dexFlat", 0))
	var equipped: Dictionary = hero.get("equipped", {})
	for slot in equipped:
		var instance: Variant = equipped[slot]
		if instance == null:
			continue
		var item_id := str(instance if instance is String else instance.get("id", ""))
		var item: Dictionary = ItemCatalog.get_item(item_id)
		if item.is_empty():
			continue
		var bonus: Dictionary = item.get("bonus", {}).duplicate(true)
		if instance is Dictionary:
			var instance_bonus: Variant = instance.get("bonus", {})
			if instance_bonus is Dictionary:
				for key in instance_bonus:
					bonus[key] = instance_bonus[key]
			var rune_ids: Variant = instance.get("runes", [])
			if rune_ids is Array:
				for rune_id in rune_ids:
					var rune: Dictionary = ItemCatalog.get_item(str(rune_id))
					var rune_bonus: Variant = rune.get("runeBonus", {})
					if rune_bonus is Dictionary:
						for key in rune_bonus:
							bonus[key] = float(bonus.get(key, 0.0)) + float(rune_bonus[key])
		match stat:
			"attack":
				total += int(bonus.get("attack", 0))
			"magic":
				total += int(bonus.get("magic", 0))
			"defense":
				# Browser stats use `defense || armor || 0`; a zero defense
				# value must not mask a non-zero legacy armor alias.
				var defense_bonus := int(bonus.get("defense", 0))
				if defense_bonus == 0:
					defense_bonus = int(bonus.get("armor", 0))
				total += defense_bonus
			"dex":
				total += int(bonus.get("dex", 0))
		var forge_level := clampi(int(instance.get("forgeLevel", 0)) if instance is Dictionary else 0, 0, FORGE_BONUS.size() - 1)
		var forge_bonus := int(FORGE_BONUS[forge_level])
		if forge_bonus > 0:
			if str(slot) == "weapon" and stat == "attack" and not item.get("bonus", {}).has("magic"):
				total += forge_bonus
			elif str(slot) == "weapon" and stat == "magic" and item.get("bonus", {}).has("magic"):
				total += forge_bonus
			elif str(slot) == "chest" and stat == "defense":
				total += forge_bonus
	# Browser getEffStats applies active flat status bonuses once, alongside equipment and passive bonuses.
	for effect in hero.get("effects", []):
		if not effect is Dictionary:
			continue
		var effect_data: Dictionary = EFFECTS.get(str(effect.get("id", "")), {})
		match stat:
			"attack":
				total += int(effect_data.get("atkFlat", 0))
			"magic":
				total += int(effect_data.get("magFlat", 0))
			"defense":
				total += int(effect_data.get("defFlat", 0))
	if stat == "defense":
		total = int(floor(float(total) * float(passive_bonus.get("defMult", 1.0))))
	return total


static func _effect_multiplier(hero: Dictionary, key: String) -> float:
	var multiplier := 1.0
	for effect in hero.get("effects", []):
		if not effect is Dictionary:
			continue
		var effect_data: Dictionary = EFFECTS.get(str(effect.get("id", "")), {})
		if effect_data.has(key):
			multiplier *= float(effect_data[key])
	return multiplier


static func _apply_lifesteal(hero: Dictionary, actual_damage: int) -> int:
	if actual_damage <= 0:
		return 0
	var healed := 0
	for effect in hero.get("effects", []):
		if not effect is Dictionary or str(effect.get("id", "")) != "lifesteal":
			continue
		var percentage := clampf(float(EFFECTS.get("lifesteal", {}).get("lifestealPct", 0.0)), 0.0, 1.0)
		healed = mini(maxi(0, int(hero.get("maxHp", 0)) - int(hero.get("hp", 0))), int(floor(float(actual_damage) * percentage)))
		hero["hp"] = int(hero.get("hp", 0)) + healed
		break
	return healed


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
			var instance: Dictionary = {"id":item_id,"qty":1,"bonus":item.get("bonus",{}).duplicate(true),"runes":[],"sockets":int(item.get("sockets",0))}
			if not rarity.is_empty():
				instance["rarity"] = rarity
			inventory.append(instance)
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
