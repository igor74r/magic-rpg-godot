extends Control

const WorldStateScript = preload("res://godot/scripts/world_state.gd")
const WorldStateRepositoryScript = preload("res://godot/scripts/world_state_repository.gd")
const WorldMapGeneratorScript = preload("res://godot/scripts/world_map_generator.gd")
const WorldMapViewScript = preload("res://godot/scripts/world_map_view.gd")

@onready var content: VBoxContainer = $MarginContainer/Content
@onready var status_label: Label = $MarginContainer/Content/StatusLabel

var world: Dictionary = {}
var routes_container: GridContainer
var region_label: Label
var detail_label: Label
var map_view: Control


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
	map_view.call("set_map", WorldMapGeneratorScript.generate_map(current, 40, 30, world_seed, int(world.get("generatorVersion", 1)), visit_index))
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
