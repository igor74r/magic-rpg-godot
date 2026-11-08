extends SceneTree

const PassiveEngine = preload("res://godot/scripts/world_passive_engine.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var failures: Array[String] = []
	var hero := {
		"class": "warrior",
		"level": 1,
		"passives": [],
		"passivePoints": 1,
		"talents": [],
		"gold": 1000,
		"maxHp": 100,
		"hp": 80,
		"maxMp": 30,
		"mp": 20
	}

	PassiveEngine.ensure_passives(hero)
	if hero.passives != ["start"]:
		failures.append("new heroes must receive the start passive exactly once")
	if int(hero.passivePoints) != 1:
		failures.append("passive point count must remain non-negative and unchanged")
	if PassiveEngine.can_allocate(hero, "warrior-might-1"):
		failures.append("passive nodes must respect their level requirement")
	if PassiveEngine.can_allocate(hero, "missing-node") or PassiveEngine.can_allocate(hero, "start"):
		failures.append("unknown and start nodes must never be allocatable")

	hero.level = 2
	var first_allocation: Dictionary = PassiveEngine.allocate(hero, "warrior-might-1")
	if not bool(first_allocation.get("ok", false)):
		failures.append("first connected warrior passive must be allocatable at its required level")
	if not hero.passives.has("warrior-might-1") or int(hero.passivePoints) != 0:
		failures.append("allocation must persist the node and consume exactly one point")
	if int(PassiveEngine.get_bonus(hero).get("atkFlat", 0)) != 3:
		failures.append("allocated passive bonuses must be aggregated")

	hero.level = 5
	hero.passivePoints = 1
	var second_allocation: Dictionary = PassiveEngine.allocate(hero, "warrior-might-2")
	if not bool(second_allocation.get("ok", false)):
		failures.append("a connected child passive must become available after its parent")
	if int(PassiveEngine.get_bonus(hero).get("atkFlat", 0)) != 8:
		failures.append("bonuses from multiple allocated passives must stack")
	var reset_result: Dictionary = PassiveEngine.reset(hero)
	if not bool(reset_result.get("ok", false)):
		failures.append("allocated passives must be resettable when the hero can pay")
	if hero.passives != ["start"] or int(hero.passivePoints) != 2 or int(hero.gold) != 500:
		failures.append("passive reset must refund all points, restore the start node and charge 500 gold")
	if bool(PassiveEngine.reset(hero).get("ok", false)):
		failures.append("reset must reject a tree with no allocated nodes")

	var talent_hero := {
		"class": "warrior",
		"level": 4,
		"talents": [],
		"gold": 1000,
		"maxHp": 100,
		"hp": 80,
		"maxMp": 30,
		"mp": 20
	}
	if PassiveEngine.can_take_talent(talent_hero, "w-guardian"):
		failures.append("class talents must respect their tier level requirement")
	talent_hero.level = 5
	var talent_result: Dictionary = PassiveEngine.take_talent(talent_hero, "w-guardian")
	if not bool(talent_result.get("ok", false)):
		failures.append("valid class talent must be selectable at its required level")
	if int(talent_hero.maxHp) != 120 or int(talent_hero.hp) != 96:
		failures.append("HP multiplier talents must update maximum and current HP consistently")
	if PassiveEngine.can_take_talent(talent_hero, "w-berserker"):
		failures.append("only one talent from the same tier may be selected")
	if PassiveEngine.can_take_talent(talent_hero, "unknown-talent"):
		failures.append("unknown talents must be rejected")
	if not bool(PassiveEngine.reset_talents(talent_hero).get("ok", false)):
		failures.append("selected talents must be resettable when the hero can pay")
	if int(talent_hero.maxHp) != 100 or int(talent_hero.gold) != 500 or not talent_hero.talents.is_empty():
		failures.append("talent reset must restore derived HP, clear selections and charge 500 gold")
	if bool(PassiveEngine.reset_talents(talent_hero).get("ok", false)):
		failures.append("talent reset must reject an empty selection")

	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("Passive allocation and talent checks passed")
	quit(0)
