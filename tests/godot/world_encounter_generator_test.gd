extends SceneTree

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const EnemyCatalog = preload("res://godot/scripts/world_enemy_catalog.gd")
const MapGenerator = preload("res://godot/scripts/world_map_generator.gd")
const Encounter = preload("res://godot/scripts/world_encounter_generator.gd")
const WorldRandom = preload("res://godot/scripts/world_random.gd")

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
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0}, {"factions":{"reputation":{"ash-nomads":29.6}}}), 0.525):
		failures.append("faction reputation must round like the browser save normalizer before applying loot thresholds")
	if not is_equal_approx(Encounter.loot_drop_chance(0.5, {"luck":0.0}, {"factions":{"reputation":{"ash-nomads":69.6}}}), 0.55):
		failures.append("rounded faction reputation must cross the next loot threshold consistently")
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
	# Browser parity: canonical story dragons are mission/location gated, and
	# optional act mini-bosses cannot leak into early visits to shared regions.
	var obsidian_roster: Array = Catalog.enemy_roster("obsidian-fields")
	var inactive_obsidian := Encounter.eligible_enemy_ids(obsidian_roster, "obsidian-fields", "", 50)
	if inactive_obsidian.has("flame-lord"):
		failures.append("Ash Herald must not appear in ambient Obsidian Fields encounters before mission a3-m5")
	var active_obsidian := Encounter.eligible_enemy_ids(obsidian_roster, "obsidian-fields", "a3-m5", 50)
	if not active_obsidian.has("flame-lord"):
		failures.append("Ash Herald must be eligible in Obsidian Fields during its exact finale mission")
	if Encounter.eligible_enemy_ids(obsidian_roster, "volcano", "a3-m5", 50).has("flame-lord"):
		failures.append("story dragons must not spawn outside their authored finale region")
	if Encounter.eligible_enemy_ids(obsidian_roster, "obsidian-fields", "a3-m5", 50, true, false).has("flame-lord") or Encounter.eligible_enemy_ids(obsidian_roster, "obsidian-fields", "a3-m5", 50, false, true).has("flame-lord"):
		failures.append("story dragons must stay out of Rift and Tower encounter modes")
	var story_dragon_gates := {
		"flame-lord": ["obsidian-fields", "a3-m5"],
		"ice-queen": ["frost-citadel", "a4-m5"],
		"ancient-dragon": ["dragon-lair", "a5-m5"]
	}
	for dragon_id in story_dragon_gates:
		var dragon_gate: Array = story_dragon_gates[dragon_id]
		var dragon_region := str(dragon_gate[0])
		var dragon_mission := str(dragon_gate[1])
		var dragon_roster: Array = Catalog.enemy_roster(dragon_region)
		if not dragon_roster.has(dragon_id):
			failures.append("story dragon %s must exist in its authored region roster" % dragon_id)
		if Encounter.eligible_enemy_ids(dragon_roster, dragon_region, "", 100).has(dragon_id):
			failures.append("story dragon %s must remain hidden without its finale mission" % dragon_id)
		if not Encounter.eligible_enemy_ids(dragon_roster, dragon_region, dragon_mission, 100).has(dragon_id):
			failures.append("story dragon %s must appear for its exact finale mission" % dragon_id)
	var mini_boss_levels := {
		"root-court-executioner": [8, "briar-hollow"],
		"drowned-queen": [18, "sunken-necropolis"],
		"oath-forge-warden": [28, "obsidian-fields"],
		"mirror-icekeeper": [38, "frost-citadel"],
		"echo-devourer": [48, "void-crater"]
	}
	for mini_boss_id in mini_boss_levels:
		var mini_boss_data: Array = mini_boss_levels[mini_boss_id]
		var required_level := int(mini_boss_data[0])
		var mini_region := str(mini_boss_data[1])
		var mini_roster: Array = Catalog.enemy_roster(mini_region)
		if Encounter.eligible_enemy_ids(mini_roster, mini_region, "", required_level - 1).has(mini_boss_id):
			failures.append("mini-boss %s must remain gated below level %d" % [mini_boss_id, required_level])
		if not Encounter.eligible_enemy_ids(mini_roster, mini_region, "", required_level).has(mini_boss_id):
			failures.append("mini-boss %s must unlock at level %d" % [mini_boss_id, required_level])
	var obsidian_grid := MapGenerator.generate_map("obsidian-fields", 40, 30, 99117, 1, 1)
	var ambient_obsidian := Encounter.generate("obsidian-fields", obsidian_grid, 99117, 1, 1, Vector2i(20, 15), 0, "normal", 0, "", 50)
	for spawned in ambient_obsidian:
		if str(spawned.get("enemyId", "")) == "flame-lord":
			failures.append("ambient encounter generation must apply story-dragon gating before roster selection")
	var finale_obsidian := Encounter.generate("obsidian-fields", obsidian_grid, 99117, 1, 1, Vector2i(20, 15), 0, "normal", 0, "a3-m5", 50)
	var finale_has_dragon := false
	for spawned in finale_obsidian:
		if str(spawned.get("enemyId", "")) == "flame-lord":
			finale_has_dragon = true
	if not finale_has_dragon:
		failures.append("the accepted finale mission must include its guaranteed story dragon in the encounter roster")
	# Browser isBlocked allows tile 3 in lava, poison, and trapped-water
	# regions. Encounter placement must use those same per-region rules.
	var hazard_grid := [[MapGenerator.TILE_STONE]]
	var hazard_cell := Encounter._find_free_cell(hazard_grid, [], Vector2i(100, 100), WorldRandom.new(1), "volcano")
	if hazard_cell != Vector2i(0, 0):
		failures.append("volcano encounter placement must allow browser-walkable hazard terrain")
	var ordinary_cell := Encounter._find_free_cell(hazard_grid, [], Vector2i(100, 100), WorldRandom.new(1), "forest")
	if ordinary_cell != Vector2i(-1, -1):
		failures.append("ordinary regions must continue to reject stone hazard tiles")
	for hazard_region in ["volcano", "dragon", "obsidian-fields", "swamp", "briar-hollow", "ruins", "sunken-necropolis"]:
		if MapGenerator.is_blocked_for_region(hazard_grid, 0, 0, hazard_region):
			failures.append("browser hazard tile must be walkable for region %s" % hazard_region)

	# Generate and validate the complete authored region catalog, not just one sample.
	for region_id in Catalog.region_ids():
		var region_grid := MapGenerator.generate_map(str(region_id), 40, 30, 77123, 1, 1)
		var region_first := Encounter.generate(str(region_id), region_grid, 77123, 1, 1)
		var region_second := Encounter.generate(str(region_id), region_grid, 77123, 1, 1)
		if region_first != region_second:
			failures.append("region %s encounter generation must be deterministic for the same seed and visit" % str(region_id))
		if region_first.size() > 7:
			failures.append("region %s must never exceed the browser seven-enemy spawn cap" % str(region_id))
		var region_spawn_ids: Dictionary = {}
		var occupied_cells: Dictionary = {}
		for spawned in region_first:
			var spawned_id := str(spawned.get("persistentId", ""))
			var spawned_cell: Vector2i = spawned.get("cell", Vector2i(-1, -1))
			if spawned_id.is_empty() or region_spawn_ids.has(spawned_id):
				failures.append("region %s must produce unique stable enemy identities" % str(region_id))
			region_spawn_ids[spawned_id] = true
			if MapGenerator.is_blocked_for_region(region_grid, spawned_cell.x, spawned_cell.y, str(region_id)):
				failures.append("region %s enemy %s must occupy a walkable map cell" % [str(region_id), spawned_id])
			if occupied_cells.has(spawned_cell):
				failures.append("region %s must not place two enemies in the same cell" % str(region_id))
			occupied_cells[spawned_cell] = true
			if Vector2(spawned_cell - Vector2i(20, 15)).length() < 5.0:
				failures.append("region %s enemy spawn must respect the player safety radius" % str(region_id))
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
