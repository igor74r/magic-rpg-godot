extends Control

const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const WorldStateRepositoryScript = preload("res://godot/scripts/world_state_repository.gd")
const WorldMapGeneratorScript = preload("res://godot/scripts/world_map_generator.gd")
const WorldMapViewScript = preload("res://godot/scripts/world_map_view.gd")
const EncounterGeneratorScript = preload("res://godot/scripts/world_encounter_generator.gd")
const RegionCatalogScript = preload("res://godot/scripts/world_region_catalog.gd")
const CombatEngineScript = preload("res://godot/scripts/world_combat_engine.gd")
const ClassCatalogScript = preload("res://godot/scripts/world_class_catalog.gd")
const WorldItemCatalogScript = preload("res://godot/scripts/world_item_catalog.gd")

@onready var content: VBoxContainer = $MarginContainer/Content
@onready var status_label: Label = $MarginContainer/Content/StatusLabel

var world: Dictionary = {}
var routes_container: GridContainer
var region_label: Label
var detail_label: Label
var map_view: Control
var encounters_container: VBoxContainer
var combat_container: VBoxContainer
var inventory_container: VBoxContainer
var combat_state: Dictionary = {}


func _ready() -> void:
	world = WorldStateRepositoryScript.load_world()
	_build_exploration_ui()
	_refresh_exploration()


func _build_exploration_ui() -> void:
	region_label = Label.new()
	region_label.add_theme_font_size_override("font_size", 24)
	_insert_before_spacer(region_label)
	detail_label = Label.new()
	detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_insert_before_spacer(detail_label)

	map_view = WorldMapViewScript.new()
	map_view.custom_minimum_size = Vector2(320, 240)
	map_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_insert_before_spacer(map_view)

	var route_title := Label.new()
	route_title.text = "ДОСТУПНЫЕ ПУТИ"
	route_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(route_title)

	routes_container = GridContainer.new()
	routes_container.columns = 3
	routes_container.add_theme_constant_override("h_separation", 12)
	routes_container.add_theme_constant_override("v_separation", 12)
	_insert_before_spacer(routes_container)

	var encounter_title := Label.new()
	encounter_title.text = "ПРОТИВНИКИ РЕГИОНА"
	encounter_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(encounter_title)
	encounters_container = VBoxContainer.new()
	encounters_container.add_theme_constant_override("separation", 6)
	_insert_before_spacer(encounters_container)
	var inventory_title := Label.new()
	inventory_title.text = "ИНВЕНТАРЬ И СНАРЯЖЕНИЕ"
	inventory_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(inventory_title)
	inventory_container = VBoxContainer.new()
	inventory_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(inventory_container)
	combat_container = VBoxContainer.new()
	combat_container.add_theme_constant_override("separation", 6)
	_insert_before_spacer(combat_container)

	var hint := Label.new()
	hint.text = "Выбирай открытый путь, чтобы исследовать соседний регион. Прогресс сохраняется локально."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.add_theme_font_size_override("font_size", 13)
	_insert_before_spacer(hint)


func _insert_before_spacer(node: Control) -> void:
	content.add_child(node)
	var spacer := content.get_node("Spacer")
	content.move_child(node, spacer.get_index())


func _refresh_exploration() -> void:
	var current := str(world.get("currentRegionId", "village"))
	var visits: Dictionary = world.get("regionVisits", {})
	var discovered: Array = world.get("discoveredRegions", [])
	region_label.text = "Текущий регион: %s" % _region_title(current)
	detail_label.text = "Посещений: %d    Открыто регионов: %d / %d" % [
		int(visits.get(current, 0)), discovered.size(), WorldGraph.region_ids().size()
	]
	status_label.text = "Мир сохранён. Исследуй открытые направления и возвращайся в уже посещённые места."
	var world_seed := int(world.get("seed", 1))
	var visit_index := int(visits.get(current, 1))
	var map_grid := WorldMapGeneratorScript.generate_map(current, 40, 30, world_seed, int(world.get("generatorVersion", 1)), visit_index)
	map_view.call("set_map", map_grid)
	_refresh_encounters(current, map_grid, world_seed, visit_index)
	_refresh_inventory()
	for child in routes_container.get_children():
		child.queue_free()
	var exits := WorldGraph.neighbors(current)
	var available := 0
	for region_id in exits:
		if not WorldStateScript.can_travel(world, current, region_id):
			continue
		available += 1
		var route_button := Button.new()
		route_button.text = _region_title(region_id)
		route_button.custom_minimum_size = Vector2(190, 48)
		route_button.pressed.connect(_travel_to.bind(region_id))
		routes_container.add_child(route_button)
	if available == 0:
		var no_routes := Label.new()
		no_routes.text = "Нет открытых путей."
		routes_container.add_child(no_routes)


func _refresh_encounters(region_id: String, map_grid: Array, world_seed: int, visit_index: int) -> void:
	for child in encounters_container.get_children():
		child.queue_free()
	if RegionCatalogScript.is_safe(region_id):
		var safe_label := Label.new()
		safe_label.text = "Здесь безопасно. Противников нет."
		encounters_container.add_child(safe_label)
		return
	var record := WorldStateScript.get_region_record(world, region_id)
	var threat := int(record.get("securityThreat", 0))
	var enemies := EncounterGeneratorScript.generate(
		region_id, map_grid, world_seed, int(world.get("generatorVersion", 1)),
		visit_index, Vector2i(20, 15), threat
	)
	WorldStateScript.apply_region_persistence(world, region_id, enemies, [])
	var alive_count := 0
	for enemy in enemies:
		if enemy.get("dead", false):
			continue
		alive_count += 1
		var enemy_button := Button.new()
		enemy_button.text = "%s %s — HP %d / ATK %d" % [str(enemy.get("emoji", "👾")), str(enemy.get("name", enemy.get("enemyId", "Противник"))), int(enemy.get("hp", 0)), int(enemy.get("attack", 0))]
		enemy_button.pressed.connect(_begin_combat.bind(enemy))
		encounters_container.add_child(enemy_button)
		var tags: Array[String] = []
		if enemy.get("boss", false):
			tags.append("БОСС")
		elif enemy.get("elite", false):
			tags.append("ЭЛИТА")
		if not tags.is_empty():
			var enemy_label := Label.new()
			enemy_label.text = "[%s]" % ", ".join(tags)
			enemy_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			encounters_container.add_child(enemy_label)
	if alive_count == 0:
		var cleared := Label.new()
		cleared.text = "В этом посещении активных противников нет."
		encounters_container.add_child(cleared)
	var summary := Label.new()
	summary.text = "Активных противников: %d" % alive_count
	summary.add_theme_font_size_override("font_size", 12)
	encounters_container.add_child(summary)



func _refresh_inventory() -> void:
	for child in inventory_container.get_children():
		child.queue_free()
	var hero := CombatEngineScript.ensure_hero(world)
	var heading := Label.new()
	heading.text = "HP %d/%d · Ресурс %d/%d · Предметов: %d" % [int(hero.hp),int(hero.maxHp),int(hero.mp),int(hero.maxMp),hero.inventory.size()]
	inventory_container.add_child(heading)
	for index in range(hero.inventory.size()):
		var instance: Dictionary = hero.inventory[index]
		var item := WorldItemCatalogScript.get_item(str(instance.get("id","")))
		if item.is_empty():
			continue
		var button := Button.new()
		button.text = "%s %s ×%d" % [str(item.get("icon","")),str(item.get("name","Предмет")),int(instance.get("qty",1))]
		var item_type := str(item.get("type",""))
		if item_type in ["weapon","head","shoulders","chest","gloves","legs","boots","shield","ring","amulet","cloak","armor"]:
			button.pressed.connect(_equip_inventory_item.bind(index))
		elif item_type in ["consumable","scroll"]:
			button.pressed.connect(_use_inventory_item.bind(str(instance.id)))
		else:
			button.disabled = true
		inventory_container.add_child(button)


func _use_inventory_item(item_id: String) -> void:
	var result := CombatEngineScript.use_item(world,item_id)
	status_label.text = str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()


func _equip_inventory_item(index: int) -> void:
	var result := CombatEngineScript.equip_item(world,index)
	status_label.text = str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()


func _begin_combat(enemy: Dictionary) -> void:
	combat_state = CombatEngineScript.begin(enemy)
	_refresh_combat_ui()


func _refresh_combat_ui() -> void:
	for child in combat_container.get_children():
		child.queue_free()
	if combat_state.is_empty():
		return
	var hero := CombatEngineScript.ensure_hero(world)
	var enemy: Dictionary = combat_state.get("enemy", {})
	var status := Label.new()
	status.text = "Герой: HP %d/%d · Ур. %d · ATK %d · DEF %d\n%s: HP %d/%d" % [
		int(hero.hp), int(hero.maxHp), int(hero.level), int(hero.attack), int(hero.defense),
		str(enemy.get("name", "Противник")), int(enemy.get("hp", 0)), int(enemy.get("maxHp", 0))
	]
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	combat_container.add_child(status)
	var log_label := Label.new()
	log_label.text = str(combat_state.get("log", ""))
	log_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	combat_container.add_child(log_label)
	if not combat_state.get("over", false):
		var attack_button := Button.new()
		attack_button.text = "Атаковать"
		attack_button.pressed.connect(_combat_attack)
		combat_container.add_child(attack_button)
		var hero := CombatEngineScript.ensure_hero(world)
		var class_data: Dictionary = ClassCatalogScript.get_class(str(hero.get("class", "warrior")))
		for ability in class_data.get("abilities", []):
			var ability_button := Button.new()
			ability_button.text = "%s (%d)" % [str(ability.name), int(ability.cost)]
			ability_button.pressed.connect(_use_combat_ability.bind(str(ability.id)))
			combat_container.add_child(ability_button)
		for spell_id in hero.get("spells", []):
			var spell: Dictionary = ClassCatalogScript.get_spell(str(spell_id))
			if spell.is_empty():
				continue
			var spell_button := Button.new()
			spell_button.text = "%s (%d маны)" % [str(spell.name), int(spell.cost)]
			spell_button.pressed.connect(_cast_combat_spell.bind(str(spell_id)))
			combat_container.add_child(spell_button)
		var retreat_button := Button.new()
		retreat_button.text = "Отступить"
		retreat_button.pressed.connect(_combat_retreat)
		combat_container.add_child(retreat_button)
	else:
		var close_button := Button.new()
		close_button.text = "Закрыть бой"
		close_button.pressed.connect(_close_combat)
		combat_container.add_child(close_button)


func _combat_attack() -> void:
	var result := CombatEngineScript.player_attack(world, combat_state)
	status_label.text = str(result.get("message", ""))
	var error := WorldStateRepositoryScript.save_world(world)
	if error != OK:
		status_label.text += "\nОшибка сохранения: %s" % error_string(error)
	_refresh_combat_ui()
	_refresh_inventory()
	if combat_state.get("over", false):
		_refresh_exploration()


func _use_combat_ability(ability_id: String) -> void:
	var result := CombatEngineScript.use_ability(world, combat_state, ability_id)
	status_label.text = str(result.get("message", ""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_combat_ui()
	_refresh_inventory()


func _cast_combat_spell(spell_id: String) -> void:
	var result := CombatEngineScript.cast_spell(world, combat_state, spell_id)
	status_label.text = str(result.get("message", ""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_combat_ui()
	_refresh_inventory()


func _combat_retreat() -> void:
	CombatEngineScript.retreat(combat_state)
	_refresh_combat_ui()


func _close_combat() -> void:
	combat_state = {}
	_refresh_combat_ui()
	_refresh_exploration()


func _travel_to(region_id: String) -> void:
	var previous := str(world.get("currentRegionId", "village"))
	if not WorldStateScript.enter_region(world, region_id, previous):
		status_label.text = "Не удалось пройти по этому пути."
		return
	var error := WorldStateRepositoryScript.save_world(world)
	if error != OK:
		status_label.text = "Ошибка сохранения: %s" % error_string(error)
	_refresh_exploration()


func _region_title(region_id: String) -> String:
	var titles := {
		"village": "Тихая деревня", "forest": "Шепчущий лес",
		"briar-hollow": "Терновая лощина", "ruins": "Древние руины",
		"shadow": "Теневые земли", "swamp": "Затонувшие топи",
		"graveyard": "Старое кладбище", "library": "Забытая библиотека",
		"sunken-necropolis": "Затонувший некрополь", "wasteland": "Пустошь",
		"volcano": "Пепельный вулкан", "obsidian-fields": "Обсидиановые поля",
		"ice-peaks": "Ледяные пики", "frost-citadel": "Морозная цитадель",
		"dragon-lair": "Логово дракона", "void-crater": "Кратер Бездны"
	}
	return str(titles.get(region_id, region_id))
