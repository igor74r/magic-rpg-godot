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
const CampaignScript = preload("res://godot/scripts/world_campaign_engine.gd")

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
var daily_quests_container: VBoxContainer
var campaign_container: VBoxContainer
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
	_refresh_passives()


func _refresh_daily_quests() -> void:
	for child in daily_quests_container.get_children():
		child.queue_free()
	var quests: Array = DailyQuestScript.get_quests(world)
	var title := Label.new()
	title.text = "ЕЖЕДНЕВНЫЕ ЗАДАНИЯ · %s" % str(world.dailyQuests.date)
	daily_quests_container.add_child(title)
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
		return
	var progress: Dictionary = CampaignScript.progress(hero,mission)
	var description := Label.new()
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	description.text = "%s\n%s\nЦель: %s · %d/%d" % [str(mission.title),str(mission.desc),str(mission.objective),int(progress.current),int(progress.required)]
	campaign_container.add_child(description)
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
