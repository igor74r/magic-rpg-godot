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
const PassiveEngineScript = preload("res://godot/scripts/world_passive_engine.gd")
const PassiveTreeScript = preload("res://godot/scripts/world_passive_tree.gd")
const DailyQuestScript = preload("res://godot/scripts/world_daily_quest_engine.gd")
const AchievementEngineScript = preload("res://godot/scripts/world_achievement_engine.gd")
const ChroniclesCatalogScript = preload("res://godot/scripts/world_chronicles_catalog.gd")
const FactionEngineScript = preload("res://godot/scripts/world_faction_engine.gd")
const CampaignScript = preload("res://godot/scripts/world_campaign_engine.gd")
const RiftEngineScript = preload("res://godot/scripts/world_rift_engine.gd")
const TowerEngineScript = preload("res://godot/scripts/world_tower_engine.gd")
const NpcCatalogScript = preload("res://godot/scripts/world_npc_catalog.gd")
const NpcEngineScript = preload("res://godot/scripts/world_npc_engine.gd")
const SaveRepositoryScript = preload("res://godot/scripts/save_repository.gd")

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
var passives_container: VBoxContainer
var achievements_container: VBoxContainer
var chronicles_container: VBoxContainer
var factions_container: VBoxContainer
var daily_quests_container: VBoxContainer
var campaign_container: VBoxContainer
var rift_container: VBoxContainer
var tower_container: VBoxContainer
var npc_container: VBoxContainer
var combat_state: Dictionary = {}
var browser_import_dialog: FileDialog
var browser_export_dialog: FileDialog


func _ready() -> void:
	world = WorldStateRepositoryScript.load_world()
	DailyQuestScript.get_quests(world)
	_build_exploration_ui()
	_refresh_exploration()


func _build_exploration_ui() -> void:
	_build_browser_save_controls()
	region_label = Label.new()
	region_label.add_theme_font_size_override("font_size", 24)
	_insert_before_spacer(region_label)
	detail_label = Label.new()
	detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_insert_before_spacer(detail_label)

	map_view = WorldMapViewScript.new()
	map_view.custom_minimum_size = Vector2(320, 240)
	map_view.connect("npc_clicked", Callable(self, "_on_map_npc_clicked"))
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
	var achievements_title := Label.new()
	achievements_title.text = "ДОСТИЖЕНИЯ"
	achievements_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(achievements_title)
	achievements_container = VBoxContainer.new()
	achievements_container.add_theme_constant_override("separation", 3)
	_insert_before_spacer(achievements_container)
	var chronicles_title := Label.new()
	chronicles_title.text = "ХРОНИКИ РАСКОЛОТОЙ ЗАРИ"
	chronicles_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(chronicles_title)
	chronicles_container = VBoxContainer.new()
	chronicles_container.add_theme_constant_override("separation", 8)
	_insert_before_spacer(chronicles_container)
	var factions_title := Label.new()
	factions_title.text = "РЕПУТАЦИЯ ФРАКЦИЙ"
	factions_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(factions_title)
	factions_container = VBoxContainer.new()
	factions_container.add_theme_constant_override("separation", 5)
	_insert_before_spacer(factions_container)
	var passives_title := Label.new()
	passives_title.text = "ДРЕВО ПАССИВНЫХ НАВЫКОВ"
	passives_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(passives_title)
	passives_container = VBoxContainer.new()
	passives_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(passives_container)
	var daily_title := Label.new()
	daily_title.text = "ЕЖЕДНЕВНЫЕ ПОРУЧЕНИЯ"
	daily_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(daily_title)
	daily_quests_container = VBoxContainer.new()
	daily_quests_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(daily_quests_container)
	var campaign_title := Label.new()
	campaign_title.text = "СЮЖЕТНАЯ КАМПАНИЯ"
	campaign_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(campaign_title)
	campaign_container = VBoxContainer.new()
	campaign_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(campaign_container)
	var rift_title := Label.new()
	rift_title.text = "РАЗЛОМ · ПОСЛЕСЮЖЕТНОЕ ИСПЫТАНИЕ"
	rift_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(rift_title)
	rift_container = VBoxContainer.new()
	rift_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(rift_container)
	var tower_title := Label.new()
	tower_title.text = "БАШНЯ ИСПЫТАНИЙ · 40 ЭТАЖЕЙ"
	tower_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(tower_title)
	tower_container = VBoxContainer.new()
	tower_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(tower_container)
	var npc_title := Label.new()
	npc_title.text = "ЖИТЕЛИ И СЛУЖБЫ РЕГИОНА"
	npc_title.add_theme_font_size_override("font_size", 16)
	_insert_before_spacer(npc_title)
	npc_container = VBoxContainer.new()
	npc_container.add_theme_constant_override("separation", 4)
	_insert_before_spacer(npc_container)
	combat_container = VBoxContainer.new()
	combat_container.add_theme_constant_override("separation", 6)
	_insert_before_spacer(combat_container)

	var hint := Label.new()
	hint.text = "Выбирай открытый путь, чтобы исследовать соседний регион. Прогресс сохраняется локально."
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hint.add_theme_font_size_override("font_size", 13)
	_insert_before_spacer(hint)


func _build_browser_save_controls() -> void:
	var save_controls := HBoxContainer.new()
	save_controls.add_theme_constant_override("separation", 10)
	var import_button := Button.new()
	import_button.text = "Импорт браузерного сохранения"
	import_button.pressed.connect(_open_browser_import_dialog)
	save_controls.add_child(import_button)
	var export_button := Button.new()
	export_button.text = "Экспорт сохранения для браузера"
	export_button.pressed.connect(_open_browser_export_dialog)
	save_controls.add_child(export_button)
	_insert_before_spacer(save_controls)

	browser_import_dialog = FileDialog.new()
	browser_import_dialog.title = "Импорт сохранения Shards of the Rift"
	browser_import_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	browser_import_dialog.access = FileDialog.ACCESS_FILESYSTEM
	browser_import_dialog.filters = PackedStringArray(["*.json ; Browser save (*.json)"])
	browser_import_dialog.file_selected.connect(_on_browser_import_selected)
	add_child(browser_import_dialog)

	browser_export_dialog = FileDialog.new()
	browser_export_dialog.title = "Экспорт сохранения Shards of the Rift"
	browser_export_dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	browser_export_dialog.access = FileDialog.ACCESS_FILESYSTEM
	browser_export_dialog.filters = PackedStringArray(["*.json ; Browser save (*.json)"])
	browser_export_dialog.current_file = "shards-of-the-rift-save.json"
	browser_export_dialog.file_selected.connect(_on_browser_export_selected)
	add_child(browser_export_dialog)


func _open_browser_import_dialog() -> void:
	browser_import_dialog.popup_centered_ratio(0.8)


func _open_browser_export_dialog() -> void:
	var payload := WorldStateRepositoryScript.to_browser_payload(world)
	if payload.is_empty() or not SaveRepositoryScript.is_browser_v18_payload(payload):
		status_label.text = "Экспорт недоступен: текущее состояние не удалось преобразовать в совместимое сохранение v18."
		return
	browser_export_dialog.popup_centered_ratio(0.8)


func _on_browser_import_selected(path: String) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		status_label.text = "Не удалось открыть файл сохранения: %s" % error_string(FileAccess.get_open_error())
		return
	var serialized := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(serialized)
	if not parsed is Dictionary or not SaveRepositoryScript.is_browser_v18_payload(parsed):
		status_label.text = "Импорт отменён: файл не соответствует формату браузерного сохранения v18."
		return
	var imported: Dictionary = WorldStateRepositoryScript.from_browser_payload(parsed)
	if imported.is_empty():
		status_label.text = "Импорт отменён: не удалось преобразовать данные сохранения."
		return
	var save_error: Error = WorldStateRepositoryScript.save_world(imported)
	if save_error != OK:
		status_label.text = "Не удалось сохранить импортированные данные: %s" % error_string(save_error)
		return
	world = imported
	DailyQuestScript.get_quests(world)
	_refresh_exploration()
	status_label.text = "Браузерное сохранение v18 успешно импортировано."


func _on_browser_export_selected(path: String) -> void:
	var write_error: Error = WorldStateRepositoryScript.export_browser_payload(path, world)
	if write_error != OK:
		status_label.text = "Не удалось безопасно экспортировать сохранение: %s" % error_string(write_error)
		return
	status_label.text = "Сохранение браузерного формата v18 экспортировано: %s" % path


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
	_refresh_map_npcs(current)
	
	_refresh_encounters(current, map_grid, world_seed, visit_index)
	_refresh_inventory()
	_refresh_chronicles()
	_refresh_factions()
	for child in routes_container.get_children():
		child.queue_free()
	var exits := WorldGraph.neighbors(current)
	var available := 0
	var hero := CombatEngineScript.ensure_hero(world)
	for region_id in exits:
		if not WorldStateScript.can_travel(world, current, region_id):
			continue
		available += 1
		var route_button := Button.new()
		var story_access: Dictionary = CampaignScript.can_enter_location(hero,region_id)
		route_button.text = _region_title(region_id)
		if not bool(story_access.get("allowed",true)):
			var requirement: Dictionary = story_access.get("requirement",{})
			if str(story_access.get("reason",""))=="level":
				route_button.text += " · уровень %d" % int(requirement.get("requiredLevel",1))
			else:
				var required_mission := CampaignScript.get_mission(str(story_access.get("requiredMissionId","")))
				route_button.text += " · после: %s" % str(required_mission.get("title",story_access.get("requiredMissionId","сюжет")))
			route_button.disabled = true
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
		visit_index, Vector2i(20, 15), threat, str(world.get("difficulty", "normal")), int(CombatEngineScript.ensure_hero(world).get("ngPlus", 0))
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
		if not str(enemy.get("modifier", "")).is_empty():
			tags.append(str(enemy.modifier).to_upper())
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
	if not bool(hero.get("classChosen", false)):
		var class_title := Label.new()
		class_title.text = "ВЫБЕРИ КЛАСС ГЕРОЯ"
		inventory_container.add_child(class_title)
		for class_id in ClassCatalogScript.class_ids():
			var class_data: Dictionary = ClassCatalogScript.get_class(str(class_id))
			var class_button := Button.new()
			class_button.text = "%s %s — HP %d / ресурс %d" % [str(class_data.emoji),str(class_data.name),int(class_data.maxHp),int(class_data.maxMp)]
			class_button.pressed.connect(_select_hero_class.bind(str(class_id)))
			inventory_container.add_child(class_button)
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
	_refresh_daily_quests()
	_refresh_campaign()
	_refresh_rift()
	_refresh_tower()
	_refresh_npcs()
	_refresh_passives()
	_refresh_achievements()



func _refresh_tower() -> void:
	for child in tower_container.get_children():
		child.queue_free()
	var hero := CombatEngineScript.ensure_hero(world)
	var best := TowerEngineScript.best_floor(hero)
	var summary := Label.new()
	summary.text = "Лучший этаж: %d/40 · Стражи на каждом пятом этаже" % best
	tower_container.add_child(summary)
	var run := TowerEngineScript.get_run(world)
	if bool(run.get("active", false)):
		var queue: Array = run.get("enemies", [])
		var label := Label.new()
		label.text = "Активно: этаж %d · противник %d/%d" % [int(run.get("floor", 1)), int(run.get("enemyIndex", 0)) + 1, queue.size()]
		tower_container.add_child(label)
		var resume := Button.new()
		resume.text = "Продолжить Башню"
		resume.pressed.connect(_resume_tower)
		tower_container.add_child(resume)
		var abandon := Button.new()
		abandon.text = "Покинуть Башню"
		abandon.pressed.connect(_abandon_tower)
		tower_container.add_child(abandon)
	else:
		var start := Button.new()
		start.text = "Начать испытание · этаж %d" % TowerEngineScript.start_floor(hero)
		start.disabled = not bool(hero.get("classChosen", false))
		start.pressed.connect(_start_tower)
		tower_container.add_child(start)


func _start_tower() -> void:
	var result: Dictionary = TowerEngineScript.begin_floor(world)
	if not bool(result.get("ok", false)):
		status_label.text = str(result.get("message", "Не удалось начать Башню."))
		return
	status_label.text = str(result.message)
	WorldStateRepositoryScript.save_world(world)
	_begin_combat(result.enemy)
	_refresh_tower()


func _resume_tower() -> void:
	var run := TowerEngineScript.get_run(world)
	var queue: Array = run.get("enemies", [])
	var index := int(run.get("enemyIndex", -1))
	if index < 0 or index >= queue.size():
		status_label.text = "Сохранённый этаж повреждён."
		return
	_begin_combat(queue[index])


func _abandon_tower() -> void:
	if TowerEngineScript.abandon(world):
		WorldStateRepositoryScript.save_world(world)
		status_label.text = "Вы покинули Башню. Рекорд не изменён."
	_refresh_tower()


func _complete_tower_victory(enemy: Dictionary) -> void:
	var result: Dictionary = TowerEngineScript.complete_encounter(world, enemy)
	if not bool(result.get("ok", false)):
		status_label.text += "\n" + str(result.get("message", ""))
		return
	status_label.text += "\n" + str(result.message)
	if not bool(result.get("floorComplete", false)):
		_begin_combat(result.enemy)
	else:
		_refresh_tower()


func _refresh_rift() -> void:
	for child in rift_container.get_children():
		child.queue_free()
	var hero := CombatEngineScript.ensure_hero(world)
	var cleared := CampaignScript.get_rift_cleared_count(hero)
	var best := int(hero.get("riftBest", 0))
	var summary := Label.new()
	summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	summary.text = "Очищено областей: %d/30 · лучший этаж: %d" % [cleared, best]
	rift_container.add_child(summary)
	if not RiftEngineScript.is_available(world):
		var locked := Label.new()
		locked.text = "Разлом откроется после победы над Кровавой Короной."
		rift_container.add_child(locked)
		return
	var run := RiftEngineScript.get_run(world)
	if bool(run.get("active", false)):
		var active := Label.new()
		active.text = "Прохождение активно: этаж %d · %s" % [int(run.get("floor", 1)), str(CampaignScript.get_rift_location(str(run.get("locationId", ""))).get("name", ""))]
		rift_container.add_child(active)
		var resume := Button.new()
		resume.text = "Продолжить бой в Разломе"
		resume.pressed.connect(_resume_rift)
		rift_container.add_child(resume)
		var abandon := Button.new()
		abandon.text = "Покинуть Разлом"
		abandon.pressed.connect(_abandon_rift)
		rift_container.add_child(abandon)
		return
	for location in RiftEngineScript.get_locations(world):
		var button := Button.new()
		var cleared_ids: Variant = hero.get("riftClearedLocations", [])
		var is_cleared := cleared_ids is Array and cleared_ids.has(str(location.id))
		button.text = "%s %s%s" % ["✓" if is_cleared else "🌀", str(location.name), " · ур. %d" % int(location.minLevel) if not bool(location.unlocked) else ""]
		button.disabled = not bool(location.unlocked)
		button.pressed.connect(_start_rift_area.bind(str(location.id)))
		rift_container.add_child(button)


func _start_rift_area(location_id: String) -> void:
	var result: Dictionary = RiftEngineScript.begin_area(world, location_id)
	if not bool(result.get("ok", false)):
		status_label.text = str(result.get("message", "Не удалось войти в Разлом."))
		return
	status_label.text = str(result.message)
	WorldStateRepositoryScript.save_world(world)
	_begin_combat(result.enemy)
	_refresh_rift()


func _resume_rift() -> void:
	var run := RiftEngineScript.get_run(world)
	var enemy: Dictionary = run.get("enemy", {}) if run.get("enemy", {}) is Dictionary else {}
	if enemy.is_empty():
		status_label.text = "Сохранённый бой Разлома не найден. Покиньте Разлом и начните новый заход."
		return
	_begin_combat(enemy)


func _abandon_rift() -> void:
	if RiftEngineScript.abandon(world):
		WorldStateRepositoryScript.save_world(world)
		status_label.text = "Вы покинули Разлом. Рекорд не изменён."
	_refresh_rift()

func _refresh_daily_quests() -> void:
	for child in daily_quests_container.get_children():
		child.queue_free()
	var quests: Array = DailyQuestScript.get_quests(world)
	var title := Label.new()
	title.text = "ЕЖЕДНЕВНЫЕ ЗАДАНИЯ · %s" % str(world.dailyQuests.date)
	daily_quests_container.add_child(title)
	var chest_row := HBoxContainer.new()
	var chest_label := Label.new()
	chest_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var chest_remaining := DailyQuestScript.daily_chest_time_remaining(world)
	chest_label.text = "Ежедневный сундук · +8 золота и случайное зелье" if chest_remaining == 0 else "Следующий ежедневный сундук через %s" % _format_duration(chest_remaining)
	chest_row.add_child(chest_label)
	var chest_button := Button.new()
	chest_button.text = "Открыть сундук" if chest_remaining == 0 else "Ожидание"
	chest_button.disabled = not DailyQuestScript.can_open_daily(world)
	chest_button.pressed.connect(_open_daily_chest)
	chest_row.add_child(chest_button)
	daily_quests_container.add_child(chest_row)
	for quest in quests:
		var row := HBoxContainer.new()
		var label := Label.new()
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		label.text = "%s — %d/%d · +%d золота / %d опыта" % [str(quest.text),int(quest.current),int(quest.max),int(quest.gold),int(quest.exp)]
		row.add_child(label)
		var button := Button.new()
		button.text = "Получено" if bool(quest.claimed) else "Забрать" if bool(quest.completed) else "Выполняется"
		button.disabled = not bool(quest.completed) or bool(quest.claimed)
		button.pressed.connect(_claim_daily_quest.bind(str(quest.id)))
		row.add_child(button)
		daily_quests_container.add_child(row)



func _open_daily_chest() -> void:
	var snapshot := world.duplicate(true)
	var result: Dictionary = DailyQuestScript.open_daily_chest(world)
	if not bool(result.get("ok", false)):
		status_label.text = str(result.get("message", "Ежедневный сундук недоступен."))
		return
	var save_error: Error = WorldStateRepositoryScript.save_world(world)
	if save_error != OK:
		world = snapshot
		status_label.text = "Ежедневная награда отменена: не удалось сохранить мир (%s)." % error_string(save_error)
		return
	status_label.text = str(result.get("message", "Ежедневная награда получена."))
	for achievement in result.get("achievements", []):
		status_label.text += "\n🏆 %s (+%d золота)." % [str(achievement.get("name", "")), int(achievement.get("reward", 0))]
	_refresh_inventory()


func _format_duration(milliseconds: int) -> String:
	var total_minutes := int(ceil(float(maxi(0, milliseconds)) / 60000.0))
	var hours := int(total_minutes / 60)
	var minutes := total_minutes % 60
	return "%dч %dм" % [hours, minutes]


func _claim_daily_quest(quest_id: String) -> void:
	var result: Dictionary = DailyQuestScript.claim(world,quest_id)
	status_label.text = str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()



func _refresh_campaign() -> void:
	for child in campaign_container.get_children():
		child.queue_free()
	var hero := CombatEngineScript.ensure_hero(world)
	CampaignScript.ensure_state(hero)
	var totals: Dictionary = CampaignScript.campaign_progress(hero)
	var summary := Label.new()
	summary.text = "Пройдено сюжетных заданий: %d/%d (%d%%)" % [int(totals.completed),int(totals.total),int(totals.percent)]
	campaign_container.add_child(summary)
	var mission: Dictionary = CampaignScript.get_next(hero)
	if mission.is_empty():
		var finished := Label.new()
		finished.text = "Основная кампания завершена."
		campaign_container.add_child(finished)
		var finale := Label.new()
		finale.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		if CampaignScript.can_complete_main_quest(world):
			finale.text = "Все 25 заданий пройдены, три осколка собраны, Кровавая Корона повержена. Главная сюжетная развязка готова к переносу в игровой интерфейс."
		elif CampaignScript.is_rift_unlocked_by_story(world):
			finale.text = "Кровавая Корона повержена: сюжетное условие открытия Разлома выполнено."
		else:
			finale.text = "Для главной развязки нужны все 25 наград за задания, три осколка и победа над Кровавой Короной."
		campaign_container.add_child(finale)
		var rift_info := Label.new()
		rift_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		rift_info.text = "Разлом: %d областей · последние 10 требуют 50 уровень · лучший этаж: %d" % [CampaignScript.rift_locations(int(hero.get("level",1))).size(),int(hero.get("riftBest",0))]
		campaign_container.add_child(rift_info)
		return
	var progress: Dictionary = CampaignScript.progress(hero,mission)
	var description := Label.new()
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description.text = "%s\n%s\nПодсказка: %s\nЦель: %s · %d/%d" % [str(mission.title),str(mission.desc),str(mission.get("briefing","")),str(mission.objective),int(progress.current),int(progress.required)]
	campaign_container.add_child(description)
	if bool(progress.complete):
		var aftermath := Label.new()
		aftermath.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		aftermath.text = "Итог: %s\nРазгадка: %s" % [str(mission.get("aftermath","")),str(mission.get("clue",""))]
		campaign_container.add_child(aftermath)
	if str(hero.get("activeCampaignMission","")).is_empty():
		var accept_button := Button.new()
		accept_button.text = "Принять сюжетное задание"
		accept_button.pressed.connect(_accept_campaign_mission.bind(str(mission.id)))
		campaign_container.add_child(accept_button)
	else:
		var claim_button := Button.new()
		claim_button.text = "Забрать награду" if bool(progress.complete) else "Задание выполняется"
		claim_button.disabled = not bool(progress.complete)
		claim_button.pressed.connect(_claim_campaign_mission)
		campaign_container.add_child(claim_button)


func _accept_campaign_mission(mission_id: String) -> void:
	var hero := CombatEngineScript.ensure_hero(world)
	var accepted := CampaignScript.accept(hero,mission_id)
	status_label.text = "Сюжетное задание принято." if accepted else "Нельзя принять это задание."
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()


func _claim_campaign_mission() -> void:
	var hero := CombatEngineScript.ensure_hero(world)
	var result: Dictionary = CampaignScript.claim(hero)
	if not bool(result.get("ok",false)):
		status_label.text = str(result.get("message",""))
		return
	var reward: Dictionary = result.reward
	hero["gold"]=mini(2147483647,int(hero.get("gold",0))+int(reward.gold))
	CombatEngineScript.grant_experience(hero,int(reward.exp))
	CombatEngineScript.add_item(hero,str(reward.itemId),1)
	status_label.text = "%s · +%d золота, +%d опыта, материал: %s" % [str(result.message),int(reward.gold),int(reward.exp),str(reward.itemId)]
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()



func _refresh_npcs() -> void:
	for child in npc_container.get_children(): child.queue_free()
	if str(world.get("currentRegionId","village"))!="village":
		var note:=Label.new()
		note.text="В этом регионе пока нет перенесённых NPC."
		npc_container.add_child(note)
		return
	for npc_id in ["elder","healer","well","bard","blacksmith","alchemist","merchant","guard","cat","kids","herald","questBoard"]:
		var npc: Dictionary=NpcCatalogScript.get_npc(npc_id)
		if npc.is_empty(): continue
		var button:=Button.new()
		button.text="%s %s" % [str(npc.get("emoji","✦")),str(npc.get("name",npc_id))]
		button.pressed.connect(_talk_to_npc.bind(npc_id))
		npc_container.add_child(button)


func _talk_to_npc(npc_id: String) -> void:
	for child in npc_container.get_children():
		if child is Button and child.name=="NpcAction": child.queue_free()
	var result: Dictionary=NpcEngineScript.talk(world,npc_id)
	status_label.text=str(result.get("message",""))
	for choice in result.get("choices",[]):
		_add_dialogue_choice(npc_id,str(choice.get("id","")),str(choice.get("label","")))
	var hero:=CombatEngineScript.ensure_hero(world)
	if npc_id=="elder":
		var mission: Dictionary=CampaignScript.get_next(hero)
		if not mission.is_empty():
			var progress: Dictionary=CampaignScript.progress(hero,mission)
			status_label.text+="\nПоручение: %s — %d/%d" % [str(mission.title),int(progress.current),int(progress.required)]
			if str(hero.get("activeCampaignMission","")).is_empty():
				_add_npc_action("Принять сюжетное поручение","accept")
			elif bool(progress.complete):
				_add_npc_action("Сдать поручение и получить награду","claim")
		if not NpcEngineScript.has_entry(hero,"elderBlessing","effects"):
			_add_npc_action("Принять благословение (+20% опыта)","blessing")
	elif npc_id=="healer":
		_add_npc_action("Полное исцеление · 8 золота","heal")
	elif npc_id=="well":
		_add_npc_action("Испить воду · полное восстановление","well")
	elif npc_id=="bard":
		_add_npc_action("Заплатить 15 золота · +10% опыта","bard")
	elif npc_id=="merchant":
		_add_npc_action("Открыть ассортимент торговца","shop")
	elif npc_id=="blacksmith":
		_add_npc_action("Открыть кузницу и улучшения","forge")
	elif npc_id=="alchemist":
		_add_npc_action("Открыть алхимические рецепты","alchemy")
	WorldStateRepositoryScript.save_world(world)



func _refresh_map_npcs(region_id: String) -> void:
	if region_id!="village":
		map_view.call("set_npcs",[])
		return
	var locations: Dictionary=NpcCatalogScript.map_locations()
	var markers: Array=[]
	for npc_id in NpcCatalogScript.ids():
		if not locations.has(npc_id): continue
		var npc: Dictionary=NpcCatalogScript.get_npc(str(npc_id))
		markers.append({"id":str(npc_id),"cell":locations[npc_id],"emoji":str(npc.get("emoji","✦")),"short":str(npc.get("name",npc_id)).split(" ")[0]})
	map_view.call("set_npcs",markers)


func _on_map_npc_clicked(npc_id: String) -> void:
	_talk_to_npc(npc_id)


func _add_dialogue_choice(npc_id: String,choice_id: String,label_text: String) -> void:
	var button:=Button.new()
	button.name="NpcAction"
	button.text="↳ "+label_text
	button.pressed.connect(_choose_npc_dialogue.bind(npc_id,choice_id))
	npc_container.add_child(button)


func _choose_npc_dialogue(npc_id: String,choice_id: String) -> void:
	var result: Dictionary=NpcEngineScript.choose_dialogue(world,npc_id,choice_id)
	status_label.text=str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()
	for child in npc_container.get_children():
		if child is Button and child.name=="NpcAction": child.queue_free()


func _add_npc_action(label_text: String,action: String) -> void:
	var button:=Button.new()
	button.name="NpcAction"
	button.text=label_text
	button.pressed.connect(_perform_npc_action.bind(action))
	npc_container.add_child(button)


func _perform_npc_action(action: String) -> void:
	var result: Dictionary={}
	match action:
		"accept": result=NpcEngineScript.campaign_action(world,false)
		"claim": result=NpcEngineScript.campaign_action(world,true)
		"blessing": result=NpcEngineScript.take_blessing(world)
		"heal": result=NpcEngineScript.heal(world)
		"well": result=NpcEngineScript.use_well(world)
		"bard": result=NpcEngineScript.pay_bard(world)
		"shop": _show_npc_shop()
		"forge": _show_npc_forge()
		"alchemy": _show_npc_alchemy()
	status_label.text=str(result.get("message",""))
	var save_error:=WorldStateRepositoryScript.save_world(world)
	if save_error!=OK: status_label.text+="\nОшибка сохранения: %s" % error_string(save_error)
	_refresh_inventory()
	_refresh_npcs()



func _show_npc_shop() -> void:
	var hero:=CombatEngineScript.ensure_hero(world)
	var multipliers: Array=[1.0,1.2,1.4,1.6,1.8]
	var multiplier: float=multipliers[NpcEngineScript.current_act(hero)-1]
	for item_id in NpcEngineScript.SHOP_STOCK:
		var item: Dictionary=WorldItemCatalogScript.get_item(str(item_id))
		if item.is_empty(): continue
		var price:=maxi(1,int(round(float(item.get("price",0))*multiplier)))
		var button:=Button.new()
		button.name="NpcAction"
		button.text="%s %s · %d золота" % [str(item.get("icon","📦")),str(item.get("name",item_id)),price]
		button.disabled=int(hero.get("gold",0))<price
		button.pressed.connect(_buy_from_npc.bind(str(item_id)))
		npc_container.add_child(button)
	for i in range(hero.inventory.size()):
		var instance: Dictionary=hero.inventory[i]
		var item:=WorldItemCatalogScript.get_item(str(instance.get("id","")))
		if item.is_empty() or int(item.get("price",0))<=0: continue
		var price:=maxi(1,int(floor(float(item.get("price",0))*0.35)))*int(instance.get("qty",1))
		var button:=Button.new()
		button.name="NpcAction"
		button.text="Продать: %s · %d золота" % [str(item.get("name",instance.id)),price]
		button.pressed.connect(_sell_to_npc.bind(i))
		npc_container.add_child(button)


func _buy_from_npc(item_id: String) -> void:
	var result: Dictionary=NpcEngineScript.buy_item(world,item_id)
	status_label.text=str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()
	_show_npc_shop()


func _sell_to_npc(index: int) -> void:
	var result: Dictionary=NpcEngineScript.sell_item(world,index)
	status_label.text=str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()
	_show_npc_shop()


func _show_npc_alchemy() -> void:
	for recipe_id in ["r-hp","r-mp","r-shp","r-smp","r-rune-root","r-rune-ember","r-rune-tide","r-rune-frost","r-rune-void"]:
		_add_recipe_button(recipe_id)


func _show_npc_forge() -> void:
	var hero:=CombatEngineScript.ensure_hero(world)
	var equipped: Dictionary=hero.get("equipped",{})
	var costs: Array=[30,75,140]
	for slot in equipped:
		var instance=equipped[slot]
		if not instance is Dictionary: continue
		var level:=clampi(int(instance.get("forgeLevel",0)),0,3)
		if level>=3: continue
		var button:=Button.new()
		button.name="NpcAction"
		button.text="Улучшить %s до +%d · %d золота" % [str(slot),level+1,int(costs[level])]
		button.disabled=int(hero.get("gold",0))<int(costs[level])
		button.pressed.connect(_upgrade_npc_equipment.bind(str(slot)))
		npc_container.add_child(button)
	for recipe_id in ["r-briar-court-mantle","r-mourner-signet","r-oathfire-cleaver","r-mirrorweave-cloak","r-echo-prism-amulet","r5-dragon-blade","r5-dragon-plate","r5-astral-staff"]:
		_add_recipe_button(recipe_id)


func _add_recipe_button(recipe_id: String) -> void:
	var recipe: Dictionary=NpcEngineScript.RECIPES.get(recipe_id,{})
	if recipe.is_empty(): return
	var item:=WorldItemCatalogScript.get_item(str(recipe.result))
	var button:=Button.new()
	button.name="NpcAction"
	button.text="Создать: %s" % str(item.get("name",recipe.result))
	button.pressed.connect(_craft_npc_recipe.bind(recipe_id))
	npc_container.add_child(button)


func _craft_npc_recipe(recipe_id: String) -> void:
	var result: Dictionary=NpcEngineScript.craft(world,recipe_id)
	status_label.text=str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()
	for child in npc_container.get_children():
		if child is Button and child.name=="NpcAction":
			child.queue_free()
	if recipe_id in ["r-hp","r-mp","r-shp","r-smp","r-rune-root","r-rune-ember","r-rune-tide","r-rune-frost","r-rune-void"]:
		_show_npc_alchemy()
	else:
		_show_npc_forge()


func _upgrade_npc_equipment(slot: String) -> void:
	var result: Dictionary=NpcEngineScript.upgrade_equipment(world,slot)
	status_label.text=str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()
	_show_npc_forge()


func _refresh_achievements() -> void:
	for child in achievements_container.get_children():
		child.queue_free()
	var hero := CombatEngineScript.ensure_hero(world)
	var unlocked: Array = hero.get("achievements", []) if hero.get("achievements", []) is Array else []
	var count := AchievementEngineScript.unlocked_count(hero)
	var heading := Label.new()
	heading.text = "Открыто: %d / %d" % [count, AchievementEngineScript.DEFINITIONS.size()]
	achievements_container.add_child(heading)
	for definition in AchievementEngineScript.DEFINITIONS:
		var id := str(definition.get("id", ""))
		var progress: Dictionary = AchievementEngineScript.get_progress(world, definition)
		var is_unlocked := unlocked.has(id)
		var icon := str(AchievementEngineScript.ICONS.get(id, "🏅"))
		var reward := int(definition.get("reward", 0))
		var row := Label.new()
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var state_text := "✓ получено" if is_unlocked else "%d/%d" % [int(progress.current), int(progress.target)]
		row.text = "%s %s — %s · %s · награда %d золота" % [icon, str(definition.get("name", id)), str(definition.get("desc", "")), state_text, reward]
		if is_unlocked:
			row.modulate = Color(0.65, 0.9, 0.7)
		achievements_container.add_child(row)



func _refresh_chronicles() -> void:
	for child in chronicles_container.get_children():
		child.queue_free()
	var intro := Label.new()
	intro.text = "%s — %s" % [ChroniclesCatalogScript.TITLE, ChroniclesCatalogScript.SUBTITLE]
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	chronicles_container.add_child(intro)
	for chapter in ChroniclesCatalogScript.CHAPTERS:
		var heading := Label.new()
		heading.text = "ГЛАВА %s · %s · %s" % [str(chapter.id), str(chapter.title), str(chapter.period)]
		heading.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		heading.add_theme_font_size_override("font_size", 15)
		chronicles_container.add_child(heading)
		var summary := Label.new()
		summary.text = str(chapter.summary)
		summary.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		chronicles_container.add_child(summary)
		for entry in chapter.entries:
			var note := Label.new()
			note.text = "• %s: %s" % [str(entry.title), str(entry.text)]
			note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			chronicles_container.add_child(note)
	var factions_heading := Label.new()
	factions_heading.text = "Знамёна старого мира"
	chronicles_container.add_child(factions_heading)
	for faction in ChroniclesCatalogScript.LORE_FACTIONS:
		var note := Label.new()
		note.text = "%s %s — %s. %s" % [str(faction.symbol), str(faction.name), str(faction.tone), str(faction.text)]
		note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		chronicles_container.add_child(note)
	var stories_heading := Label.new()
	stories_heading.text = "Нити побочных историй"
	chronicles_container.add_child(stories_heading)
	for story in ChroniclesCatalogScript.SIDE_STORIES:
		var note := Label.new()
		note.text = "%s · %s — %s" % [str(story.place), str(story.title), str(story.hook)]
		note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		chronicles_container.add_child(note)


func _refresh_factions() -> void:
	for child in factions_container.get_children():
		child.queue_free()
	var state := FactionEngineScript.ensure_state(world)
	for faction_id in FactionEngineScript.FACTIONS:
		var faction: Dictionary = FactionEngineScript.FACTIONS[faction_id]
		var reputation := int(state.reputation.get(faction_id, 0))
		var row := Label.new()
		row.text = "%s %s · %s · репутация %+d (%s)" % [str(faction.symbol), str(faction.name), str(faction.description), reputation, FactionEngineScript.get_rank(reputation)]
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		factions_container.add_child(row)
	var benefit := Label.new()
	benefit.text = "Бонусы: торговцы %d%% · стража %d%% снижения урона · кочевники %d%% добычи · культисты %d%% золота событий" % [roundi(FactionEngineScript.get_trade_discount(world) * 100.0), roundi(FactionEngineScript.get_damage_reduction(world) * 100.0), roundi(FactionEngineScript.get_loot_bonus(world) * 100.0), roundi(FactionEngineScript.get_event_gold_bonus(world, "rift-cult") * 100.0)]
	benefit.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	factions_container.add_child(benefit)


func _refresh_passives() -> void:
	for child in passives_container.get_children():
		child.queue_free()
	var hero := CombatEngineScript.ensure_hero(world)
	PassiveEngineScript.ensure_passives(hero)
	var tree: Dictionary = PassiveTreeScript.get_tree(str(hero.get("class", "warrior")))
	var learned := maxi(0, hero.passives.size() - 1)
	var heading := Label.new()
	heading.text = "Очки: %d · Изучено узлов: %d · Уровень: %d" % [int(hero.passivePoints), learned, int(hero.level)]
	passives_container.add_child(heading)
	for node_id in tree.nodes:
		if not PassiveEngineScript.can_allocate(hero, str(node_id)):
			continue
		var node: Dictionary = tree.nodes[node_id]
		var button := Button.new()
		button.text = "%s %s — %s (ур. %d)" % [str(node.get("icon", "✦")), str(node.get("name", node_id)), str(node.get("desc", "")), int(node.get("levelReq", 1))]
		button.pressed.connect(_allocate_passive.bind(str(node_id)))
		passives_container.add_child(button)
	var reset_button := Button.new()
	reset_button.text = "Сбросить пассивки · 500 золота"
	reset_button.disabled = learned == 0 or int(hero.gold) < 500
	reset_button.pressed.connect(_reset_passives)
	passives_container.add_child(reset_button)
	var talent_title := Label.new()
	talent_title.text = "КЛАССОВЫЕ ТАЛАНТЫ"
	passives_container.add_child(talent_title)
	var chosen_talents: Array = hero.get("talents", [])
	var talent_summary := Label.new()
	talent_summary.text = "Выбрано: %d · Тиры: уровни 5, 10, 15 и 20" % chosen_talents.size()
	passives_container.add_child(talent_summary)
	for talent in PassiveEngineScript.available_talents(hero):
		var talent_button := Button.new()
		talent_button.text = "%s %s — %s (ур. %d)" % [str(talent.icon),str(talent.name),str(talent.desc),int(talent.tier)]
		talent_button.pressed.connect(_take_class_talent.bind(str(talent.id)))
		passives_container.add_child(talent_button)
	var reset_talents_button := Button.new()
	reset_talents_button.text = "Сбросить таланты · 500 золота"
	reset_talents_button.disabled = chosen_talents.is_empty() or int(hero.gold)<500
	reset_talents_button.pressed.connect(_reset_class_talents)
	passives_container.add_child(reset_talents_button)


func _allocate_passive(node_id: String) -> void:
	var result: Dictionary = PassiveEngineScript.allocate(CombatEngineScript.ensure_hero(world), node_id)
	status_label.text = str(result.get("message", ""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()


func _reset_passives() -> void:
	var result: Dictionary = PassiveEngineScript.reset(CombatEngineScript.ensure_hero(world))
	status_label.text = str(result.get("message", "Пассивки сброшены."))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()



func _take_class_talent(talent_id: String) -> void:
	var result: Dictionary = PassiveEngineScript.take_talent(CombatEngineScript.ensure_hero(world),talent_id)
	status_label.text = str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()

func _reset_class_talents() -> void:
	var result: Dictionary = PassiveEngineScript.reset_talents(CombatEngineScript.ensure_hero(world))
	status_label.text = str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()

func _select_hero_class(class_id: String) -> void:
	var result := CombatEngineScript.select_class(world,class_id)
	status_label.text = str(result.get("message",""))
	WorldStateRepositoryScript.save_world(world)
	_refresh_inventory()


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
	if not bool(combat_state.get("over", false)):
		RiftEngineScript.sync_encounter(world, combat_state.get("enemy", {}))
		TowerEngineScript.sync_encounter(world, combat_state.get("enemy", {}))
	if str(result.get("result", "")) == "victory":
		var defeated_enemy: Dictionary = combat_state.get("enemy", {})
		if bool(defeated_enemy.get("riftMode", false)):
			var rift_result: Dictionary = RiftEngineScript.complete_area(world, defeated_enemy)
			if bool(rift_result.get("ok", false)):
				status_label.text += "\\n" + str(rift_result.message)
		elif bool(defeated_enemy.get("towerMode", false)):
			_complete_tower_victory(defeated_enemy)
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
	if not bool(combat_state.get("over", false)):
		RiftEngineScript.sync_encounter(world, combat_state.get("enemy", {}))
		TowerEngineScript.sync_encounter(world, combat_state.get("enemy", {}))
	elif str(result.get("result", "")) == "victory" and bool(combat_state.get("enemy", {}).get("towerMode", false)):
		_complete_tower_victory(combat_state.enemy)
	WorldStateRepositoryScript.save_world(world)
	_refresh_combat_ui()
	_refresh_inventory()


func _cast_combat_spell(spell_id: String) -> void:
	var result := CombatEngineScript.cast_spell(world, combat_state, spell_id)
	status_label.text = str(result.get("message", ""))
	if not bool(combat_state.get("over", false)):
		RiftEngineScript.sync_encounter(world, combat_state.get("enemy", {}))
		TowerEngineScript.sync_encounter(world, combat_state.get("enemy", {}))
	elif str(result.get("result", "")) == "victory" and bool(combat_state.get("enemy", {}).get("towerMode", false)):
		_complete_tower_victory(combat_state.enemy)
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
	var hero := CombatEngineScript.ensure_hero(world)
	var story_access: Dictionary = CampaignScript.can_enter_location(hero,region_id)
	if not bool(story_access.get("allowed",true)):
		var requirement: Dictionary = story_access.get("requirement",{})
		if str(story_access.get("reason",""))=="level":
			status_label.text = "Для этого региона нужен уровень %d." % int(requirement.get("requiredLevel",1))
		else:
			var required_mission := CampaignScript.get_mission(str(story_access.get("requiredMissionId","")))
			status_label.text = "Сначала завершите сюжетное задание: %s." % str(required_mission.get("title","предыдущее задание"))
		return
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
