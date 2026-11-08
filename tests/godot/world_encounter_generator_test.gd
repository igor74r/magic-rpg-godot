extends SceneTree

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const EnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
const MapGenerator = preload("res://godot/scripts/world_map_generator.gd")
const Encounter = preload("res://godot/scripts/world_encounter_generator.gd")

func _initialize() -> void:
	var failures: Array[String] = []
	if not is_equal_approx(Encounter.elite_chance("easy", 0), 0.15) or not is_equal_approx(Encounter.elite_chance("normal", 0), 0.20) or not is_equal_approx(Encounter.elite_chance("hard", 0), 0.35):
		failures.append("elite chance must match easy, normal and hard browser values")
	if not is_equal_approx(Encounter.elite_chance("hard", 3), 0.50) or not is_equal_approx(Encounter.elite_chance("normal", 99), 0.35) or not is_equal_approx(Encounter.elite_chance("unknown", 0), 0.20):
		failures.append("regional threat must add five percent per level and cap elite chance at fifty percent")
	if not is_equal_approx(Encounter.respawn_minutes("easy"), 0.25) or not is_equal_approx(Encounter.respawn_minutes("normal"), 0.5) or not is_equal_approx(Encounter.respawn_minutes("hard"), 1.0) or not is_equal_approx(Encounter.respawn_minutes("unknown"), 0.5):
		failures.append("respawn duration must match 15/30/60 second difficulty settings")
	if not is_equal_approx(Encounter.base_drop_chance("easy"), 0.70) or not is_equal_approx(Encounter.base_drop_chance("normal"), 0.50) or not is_equal_approx(Encounter.base_drop_chance("hard"), 0.30) or not is_equal_approx(Encounter.base_drop_chance("hard", true), 0.85) or not is_equal_approx(Encounter.base_drop_chance("unknown"), 0.50):
		failures.append("drop chance must match browser difficulty and elite bonuses")
	if Encounter.build_persistent_id("shadow-mage", true, 1, 4) != "boss-shadow-mage" or Encounter.build_persistent_id("shadow-mage", true, 3, 4) != "boss-shadow-mage-3" or Encounter.build_persistent_id("goblin", false, 1, 4) != "enemy-4":
		failures.append("spawn persistent IDs must match browser boss occurrence and regular spawn formats")
	if not is_equal_approx(Encounter.herb_drop_chance(), 0.30) or not is_equal_approx(Encounter.herb_drop_chance(false, true), 0.70) or not is_equal_approx(Encounter.herb_drop_chance(true, false), 0.875):
		failures.append("herb drop chances must match regular, elite and boss browser values")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0}), 0.5):
		failures.append("loot chance without modifiers must preserve its base probability")
	if not is_equal_approx(Encounter.loot_drop_chance(Encounter.base_drop_chance("normal", true), {"luck":0.0}), 0.85):
		failures.append("elite item drops must retain the browser's eighty-five percent base chance")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":100.0}), 0.75):
		failures.append("loot luck must add up to fifty percent at one hundred Luck")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0,"reputationModifier":0.2}), 0.6):
		failures.append("personal loot reputation must multiply drop probability")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0}, {"factions":{"reputation":{"ash-nomads":70}}}), 0.55):
		failures.append("Ash Nomad reputation must apply its browser-aligned ten percent loot bonus")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0}, {"factions":{"reputation":{"ash-nomads":90}}}), 0.575):
		failures.append("maximum Ash Nomad reputation must apply its fifteen percent loot bonus")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0,"reputationModifier":-2.0}), 0.05):
		failures.append("negative loot reputation must clamp to the browser minimum multiplier")

	if Encounter.herb_drop_quantity() != 1 or Encounter.herb_drop_quantity(false, true) != 2 or Encounter.herb_drop_quantity(true, false) != 2:
		failures.append("elite and boss herb drops must award two herbs while regular enemies award one")
	if Encounter.ambient_gold_reward(15) != 2 or Encounter.ambient_gold_reward(15, true) != 5 or Encounter.ambient_gold_reward(-10) != 0 or Encounter.ambient_gold_reward(15, false, 2) != 4 or Encounter.ambient_gold_reward(15, true, 2) != 7 or Encounter.ambient_gold_reward(15, false, 0, 1.8) != 4 or Encounter.ambient_gold_reward(15, true, 2, 1.8) != 13:
		failures.append("ambient gold rewards must apply the browser 0.15 base and elite double multiplier safely")
	for region_id in Catalog.region_ids():
		for enemy_id in Catalog.enemy_roster(region_id):
			if EnemyCatalog.get_enemy(enemy_id).is_empty():
				failures.append("missing combat definition: %s" % enemy_id)
	var grid := MapGenerator.generate_map("forest", 40, 30, 123456, 1, 1)
	var first := Encounter.generate("forest", grid, 123456, 1, 1)
	var second := Encounter.generate("forest", grid, 123456, 1, 1)
	if first.size() != 4:
		failures.append("forest should spawn four authored encounters")
	if first != second:
		failures.append("same seed and visit must produce identical encounters")
	if not Encounter.generate("village", grid, 123456).is_empty():
		failures.append("safe village must not spawn enemies")
	var ng_plus := Encounter.generate("forest", grid, 123456, 1, 1, Vector2i(20, 15), 3, "hard", 2)
	if ng_plus.size() != first.size():
		failures.append("NG+ must retain the authored encounter count")
	for enemy in ng_plus:
		if int(enemy.hp) < 1 or int(enemy.attack) < 1 or int(enemy.exp) < 1 or int(enemy.gold) < 0:
			failures.append("NG+ scaling must preserve valid combat stats and rewards")
		if not str(enemy.get("modifier", "")).is_empty() and not Encounter.MODIFIERS.has(str(enemy.modifier)):
			failures.append("enemy modifier must map to a canonical modifier")
	for enemy in first:
		if enemy.hp <= 0 or enemy.maxHp != enemy.hp or enemy.cell.x < 0:
			failures.append("spawned enemy has invalid stats or position")
		if int(enemy.get("dropSeed", -1)) < 0 or str(enemy.get("persistentId", "")).is_empty():
			failures.append("every spawned enemy must have a stable identity and deterministic loot seed")
		if bool(enemy.get("boss", false)) and (bool(enemy.get("elite", false)) or not str(enemy.get("modifier", "")).is_empty()):
			failures.append("bosses must not also roll ambient elite or modifier variants")
		if Vector2(enemy.cell - Vector2i(20, 15)).length() < 5.0:
			failures.append("enemy spawned too close to player")
	if not failures.is_empty():
		for failure in failures:
			push_error(failure)
		quit(1)
		return
	print("World encounter generation checks passed")
	quit(0)
