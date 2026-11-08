# Deterministic ambient encounter generation for authored world regions.
class_name WorldEncounterGenerator
extends RefCounted

const Catalog = preload("res://godot/scripts/world_region_catalog.gd")
const Enemies = preload("res://godot/scripts/world_enemy_catalog.gd")
const RandomScript = preload("res://godot/scripts/world_random.gd")
const FactionEngine = preload("res://godot/scripts/world_faction_engine.gd")
const MapGenerator = preload("res://godot/scripts/world_map_generator.gd")
const TILE_SIZE := 32
const ELITE_HP_MULT := 1.5
const ELITE_ATTACK_MULT := 1.3
const MODIFIER_CHANCE := 0.10
const MODIFIERS := {
	"poisonous": {"hpMult": 1.0, "atkMult": 1.15, "defMult": 1.0, "effect": "poison"},
	"armored": {"hpMult": 1.3, "atkMult": 1.0, "defMult": 1.5, "effect": ""},
	"swift": {"hpMult": 0.9, "atkMult": 1.2, "defMult": 1.0, "effect": ""},
	"vampiric": {"hpMult": 1.0, "atkMult": 1.0, "defMult": 1.0, "effect": "vampiric"},
	"regenerating": {"hpMult": 1.1, "atkMult": 1.0, "defMult": 1.0, "effect": "regenerate"},
	"berserk": {"hpMult": 0.9, "atkMult": 1.25, "defMult": 1.0, "effect": ""}
}

static func elite_chance(difficulty: String, security_threat: int = 0) -> float:
	var base := 0.15 if difficulty == "easy" else 0.35 if difficulty == "hard" else 0.20
	return minf(0.5, base + float(clampi(security_threat, 0, 3)) * 0.05)

static func respawn_minutes(difficulty: String) -> float:
	var seconds := 15.0 if difficulty == "easy" else 60.0 if difficulty == "hard" else 30.0
	return seconds / 60.0

static func base_drop_chance(difficulty: String, elite: bool = false) -> float:
	if elite:
		return 0.85
	return 0.70 if difficulty == "easy" else 0.30 if difficulty == "hard" else 0.50

static func ambient_gold_reward(base_gold: int, is_elite: bool = false, ng_plus: int = 0, act_multiplier: float = 1.0) -> int:
	var elite_multiplier := 2.0 if is_elite else 1.0
	var ng_multiplier := 1.0 + 0.3 * float(maxi(0, ng_plus))
	var safe_act_multiplier := maxf(0.0, act_multiplier)
	return maxi(0, int(round(float(maxi(0, base_gold)) * 0.15 * elite_multiplier * ng_multiplier * safe_act_multiplier)))

# Browser loot modifiers: Luck, optional personal reputation and Ash Nomad standing.
static func loot_drop_chance(base_chance: float, hero: Dictionary, world: Dictionary = {}) -> float:
	var base := clampf(base_chance, 0.0, 1.0)
	var level := maxi(1, int(hero.get("level", 1)))
	var luck := clampf(float(hero.get("luck", 5.0 + float(level - 1) * 0.5)), 0.0, 100.0)
	var reputation_modifier := float(hero.get("reputationModifier", 0.0))
	var personal_reputation: Variant = hero.get("reputation", {})
	if personal_reputation is Dictionary:
		reputation_modifier = float(personal_reputation.get("lootModifier", reputation_modifier))
	reputation_modifier = clampf(reputation_modifier, -0.9, 1.0)
	var faction_bonus := FactionEngine.get_loot_bonus(world)
	return clampf(base * (1.0 + luck * 0.005) * (1.0 + reputation_modifier) * (1.0 + faction_bonus), 0.0, 1.0)


static func herb_drop_chance(is_boss: bool = false, is_elite: bool = false) -> float:
	if is_boss:
		return 0.875
	return 0.70 if is_elite else 0.30

static func herb_drop_quantity(is_boss: bool = false, is_elite: bool = false) -> int:
	return 2 if is_boss or is_elite else 1

static func build_persistent_id(enemy_id: String, is_boss: bool, occurrence: int = 1, spawn_index: int = 0) -> String:
	if is_boss:
		var safe_occurrence := maxi(1, occurrence)
		return "boss-%s%s" % [enemy_id, "" if safe_occurrence == 1 else "-%d" % safe_occurrence]
	return "enemy-%d" % maxi(0, spawn_index)

static func persistent_id_for_spawn(enemy_id: String, is_boss: bool, occurrence: int, spawn_index: int) -> String:
	return build_persistent_id(enemy_id, is_boss, occurrence, spawn_index)

const STORY_DRAGONS := {
	"flame-lord": {"locationId": "obsidian-fields", "missionId": "a3-m5"},
	"ice-queen": {"locationId": "frost-citadel", "missionId": "a4-m5"},
	"ancient-dragon": {"locationId": "dragon-lair", "missionId": "a5-m5"}
}
const STORY_MINI_BOSS_LEVELS := {
	"root-court-executioner": 8,
	"drowned-queen": 18,
	"oath-forge-warden": 28,
	"mirror-icekeeper": 38,
	"echo-devourer": 48
}

static func eligible_enemy_ids(enemy_ids: Array, region_id: String, active_campaign_mission: String = "", player_level: int = 1, rift_mode: bool = false, tower_mode: bool = false) -> Array:
	var eligible: Array = []
	var safe_level := maxi(1, player_level)
	for raw_id in enemy_ids:
		var enemy_id := str(raw_id)
		if enemy_id.is_empty() or not Enemies.ENEMIES.has(enemy_id):
			continue
		if STORY_MINI_BOSS_LEVELS.has(enemy_id) and safe_level < int(STORY_MINI_BOSS_LEVELS[enemy_id]):
			continue
		if STORY_DRAGONS.has(enemy_id):
			var dragon: Dictionary = STORY_DRAGONS[enemy_id]
			if rift_mode or tower_mode or str(dragon.locationId) != region_id or str(dragon.missionId) != active_campaign_mission:
				continue
		eligible.append(enemy_id)
	return eligible

static func generate(region_id: String, grid: Array, world_seed: int, generator_version: int = 1, visit_index: int = 1, player_cell: Vector2i = Vector2i(20, 15), security_threat: int = 0, difficulty: String = "normal", ng_plus: int = 0, active_campaign_mission: String = "", player_level: int = 1, rift_mode: bool = false, tower_mode: bool = false) -> Array:
	if Catalog.is_safe(region_id) or grid.is_empty():
		return []
	var region_rng := RandomScript.for_region(world_seed, generator_version, region_id, visit_index)
	var roster: Array = eligible_enemy_ids(Catalog.enemy_roster(region_id), region_id, active_campaign_mission, player_level, rift_mode, tower_mode)
	if roster.is_empty():
		return []
	var count := mini(maxi(roster.size(), 4), 7)
	for i in range(roster.size() - 1, 0, -1):
		var j := region_rng.next_int(i + 1)
		var swap = roster[i]
		roster[i] = roster[j]
		roster[j] = swap
	var spawn_roster := roster.slice(0, count)
	while spawn_roster.size() < count:
		spawn_roster.append(roster[region_rng.next_int(roster.size())])
	var elite_roll_chance := elite_chance(difficulty, security_threat)
	var used_cells: Array[Vector2i] = []
	var enemies: Array = []
	var boss_occurrences := {}
	for index in range(spawn_roster.size()):
		var cell := _find_free_cell(grid, used_cells, player_cell, region_rng)
		if cell.x < 0:
			continue
		used_cells.append(cell)
		var enemy_id := str(spawn_roster[index])
		var definition := Enemies.get_enemy(enemy_id)
		if definition.is_empty():
			continue
		var is_boss := bool(definition.get("boss", false))
		var occurrence := 0
		if is_boss:
			occurrence = int(boss_occurrences.get(enemy_id, 0)) + 1
			boss_occurrences[enemy_id] = occurrence
		var elite := not is_boss and region_rng.next_float() < elite_roll_chance
		var modifier_id := ""
		if not is_boss and not elite and region_rng.next_float() < MODIFIER_CHANCE:
			var modifier_keys: Array = MODIFIERS.keys()
			modifier_id = str(modifier_keys[region_rng.next_int(modifier_keys.size())])
		var modifier: Dictionary = MODIFIERS.get(modifier_id, {})
		var ng := maxi(0, ng_plus)
		var hp := int(round(float(definition.hp) * (ELITE_HP_MULT if elite else 1.0) * float(modifier.get("hpMult", 1.0)) * (1.0 + 0.5 * ng)))
		var attack := int(round(float(definition.attack) * (ELITE_ATTACK_MULT if elite else 1.0) * float(modifier.get("atkMult", 1.0)) * (1.0 + 0.3 * ng)))
		var defense := int(round(float(definition.defense) * float(modifier.get("defMult", 1.0))))
		var persistent_id := persistent_id_for_spawn(enemy_id, is_boss, occurrence, index)
		enemies.append({
			"id": index, "persistentId": persistent_id, "enemyId": enemy_id,
			"name": definition.name, "emoji": definition.emoji,
			"x": cell.x * TILE_SIZE + TILE_SIZE / 2, "y": cell.y * TILE_SIZE + TILE_SIZE / 2,
			"cell": cell, "hp": hp, "maxHp": hp, "attack": attack,
			"defense": defense, "exp": int(round(float(definition.exp) * (1.0 + 0.3 * ng))), "gold": int(round(float(definition.gold) * (1.0 + 0.3 * ng))),
			"modifier": modifier_id, "modifierEffect": str(modifier.get("effect", "")),
			"special": definition.get("special", {}).duplicate(true),
			"drops": definition.get("drops", []).duplicate(),
			"dropSeed": region_rng.next_int(2147483647), "ngPlus": ng,
			"elite": elite, "boss": is_boss, "effects": [], "phase": 0,
			"state": "idle", "dead": false, "respawnAt": 0
		})
	return enemies

static func _find_free_cell(grid: Array, used: Array[Vector2i], player_cell: Vector2i, rng: WorldRandom) -> Vector2i:
	var candidates: Array[Vector2i] = []
	for y in range(grid.size()):
		for x in range(grid[y].size()):
			var cell := Vector2i(x, y)
			if MapGenerator.is_blocked(grid, x, y):
				continue
			if Vector2(cell - player_cell).length() < 5.0:
				continue
			var occupied := false
			for other in used:
				if Vector2(cell - other).length() < 3.0:
					occupied = true
					break
			if not occupied:
				candidates.append(cell)
	if candidates.is_empty():
		return Vector2i(-1, -1)
	return candidates[rng.next_int(candidates.size())]
