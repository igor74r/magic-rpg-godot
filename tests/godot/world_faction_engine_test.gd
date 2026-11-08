extends SceneTree
const Factions = preload("res://godot/scripts/world_faction_engine.gd")
const World = preload("res://godot/scripts/world_state.gd")
func _initialize() -> void:
	var failures: Array[String] = []
	var world := World.create(77)
	if Factions.get_reputation(world, "free-traders") != 0: failures.append("new world faction reputation defaults to neutral")
	var change := Factions.change_reputation(world, "free-traders", 30, "quest reward", "campaign")
	if int(change.get("value", -1)) != 30 or Factions.get_trade_discount(world) != 0.05: failures.append("30 reputation unlocks the 5 percent merchant discount")
	Factions.change_reputation(world, "hub-guardians", 90)
	Factions.change_reputation(world, "ash-nomads", 70)
	Factions.change_reputation(world, "rift-cult", 30)
	if Factions.get_damage_reduction(world) != 0.15 or Factions.get_loot_bonus(world) != 0.10 or Factions.get_event_gold_bonus(world, "rift-cult") != 0.05: failures.append("faction tiers grant the correct combat, loot and event bonuses")
	if Factions.get_event_gold_bonus(world, "free-traders") != 0.0: failures.append("event gold bonus is restricted to Rift Cult")
	Factions.change_reputation(world, "free-traders", 1000)
	if Factions.get_reputation(world, "free-traders") != 100: failures.append("reputation is capped at plus 100")
	Factions.change_reputation(world, "free-traders", -1000)
	if Factions.get_reputation(world, "free-traders") != -100: failures.append("reputation is capped at minus 100")
	for i in range(60): Factions.change_reputation(world, "hub-guardians", 1, "log", "test")
	if world.factions.changeLog.size() != Factions.LOG_LIMIT: failures.append("faction history is bounded to the newest 50 entries")
	var restored := World.normalize(world, 77)
	if restored.factions.reputation["free-traders"] != -100: failures.append("faction reputation survives world normalization")
	if not failures.is_empty():
		for failure in failures: push_error(failure)
		quit(1)
	else:
		print("PASS: faction reputation, caps, bounded history, save normalization and bonuses")
		quit(0)
