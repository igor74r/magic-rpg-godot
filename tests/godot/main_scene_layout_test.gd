extends SceneTree


func _initialize() -> void:
	var failures: Array[String] = []
	var packed := load("res://godot/scenes/main.tscn") as PackedScene
	if packed == null:
		failures.append("main scene must load as a PackedScene")
	else:
		var scene := packed.instantiate()
		var scroll := scene.get_node_or_null("MarginContainer/ScrollContainer") as ScrollContainer
		if scroll == null:
			failures.append("main scene must place its content inside a ScrollContainer")
		else:
			var content := scroll.get_node_or_null("Content") as VBoxContainer
			if content == null:
				failures.append("scroll container must own the main VBoxContainer")
			if scroll.horizontal_scroll_mode != ScrollContainer.SCROLL_MODE_SHOW_NEVER:
				failures.append("main UI must not require horizontal scrolling")
			if scroll.vertical_scroll_mode == ScrollContainer.SCROLL_MODE_SHOW_NEVER:
				failures.append("main UI must allow vertical scrolling")
		var main_script := scene.get_script() as GDScript
		if main_script == null or not main_script.source_code.contains("$MarginContainer/ScrollContainer/Content"):
			failures.append("main controller onready paths must target the scrollable content node")
		var controller_source := FileAccess.get_file_as_string("res://godot/scripts/main.gd")
		for required_fragment in [
			"func _refresh_chronicles() -> void:",
			"func _add_chronicle_section(",
			"func _set_chronicle_section(",
			"func _make_chronicle_panel_style(",
			"var panel := PanelContainer.new()",
			"panel.visible = false",
			"panel.visible = expanded",
			"toggle.toggled.connect(_set_chronicle_section",
			"note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART",
			"func _handle_combat_victory(defeated_enemy: Dictionary) -> void:",
			"RiftEngineScript.complete_area(world, defeated_enemy)",
			"_complete_tower_victory(defeated_enemy)",
			"_handle_combat_victory(combat_state.get(\"enemy\", {}))"
		]:
			if not controller_source.contains(required_fragment):
				failures.append("native chronicles view must preserve expandable, styled and readable content: %s" % required_fragment)
		var victory_handler_calls := controller_source.split("_handle_combat_victory(combat_state.get(\"enemy\", {}))").size() - 1
		if victory_handler_calls != 4:
			failures.append("block, basic attack, ability and spell victories must all use the shared Rift/Tower completion path")
		for required_fragment in [
			"func _save_world_or_restore(snapshot: Dictionary, failure_prefix: String) -> bool:",
			"func _claim_daily_quest(quest_id: String) -> void:",
			"if not _save_world_or_restore(snapshot, \\\"Получение ежедневной награды отменено\\\"):",
			"func _claim_campaign_mission() -> void:",
			"if not CombatEngineScript.add_item(hero, str(reward.itemId), 1):",
			"func _allocate_passive(node_id: String) -> void:",
			"func _reset_passives() -> void:",
			"func _take_class_talent(talent_id: String) -> void:",
			"func _reset_class_talents() -> void:",
			"func _select_hero_class(class_id: String) -> void:"
		]:
			if not controller_source.contains(required_fragment):
				failures.append("progression reward actions must use validated persistence and rollback: %s" % required_fragment)
		var campaign_claim_start := controller_source.find("func _claim_campaign_mission() -> void:")
		var campaign_claim_end := controller_source.find("\n\nfunc ", campaign_claim_start)
		var campaign_claim_source := controller_source.substr(campaign_claim_start, campaign_claim_end - campaign_claim_start)
		if campaign_claim_source.find("add_item(hero, str(reward.itemId), 1)") > campaign_claim_source.find('hero["gold"]') or campaign_claim_source.find("add_item(hero, str(reward.itemId), 1)") > campaign_claim_source.find("_save_world_or_restore(snapshot"):
			failures.append("campaign reward inventory capacity must be validated before crediting rewards or committing the save")
		if not campaign_claim_source.contains("world = snapshot"):
			failures.append("campaign reward failures must restore the full pre-claim world snapshot")
		var commerce_actions := [
			{"name":"_buy_from_npc", "engine":"NpcEngineScript.buy_item(world, item_id)"},
			{"name":"_sell_to_npc", "engine":"NpcEngineScript.sell_item(world, index, confirmed)"},
			{"name":"_buyback_from_npc", "engine":"NpcEngineScript.buyback_item(world, index)"},
			{"name":"_refresh_crafting_jobs", "engine":"NpcEngineScript.collect_crafting_jobs(world)"},
			{"name":"_craft_npc_recipe", "engine":"NpcEngineScript.craft(world, recipe_id, station)"},
			{"name":"_reforge_npc_item", "engine":"NpcEngineScript.reforge_item(world, index)"},
			{"name":"_upgrade_npc_equipment", "engine":"NpcEngineScript.upgrade_equipment(world, slot)"}
		]
		for action in commerce_actions:
			var action_start := controller_source.find("func %s(" % str(action.name))
			var action_end := controller_source.find("\n\nfunc ", action_start)
			if action_start < 0 or action_end < 0:
				failures.append("NPC commerce action must remain implemented: %s" % str(action.name))
				continue
			var action_source := controller_source.substr(action_start, action_end - action_start)
			if not action_source.contains(str(action.engine)) or not action_source.contains("world.duplicate(true)") or not action_source.contains("WorldStateRepositoryScript.save_world(world)") or not action_source.contains("world = previous_world"):
				failures.append("NPC commerce action must atomically save or restore its complete world snapshot: %s" % str(action.name))
		var event_claim_start := controller_source.find("func _claim_world_event(event_id: String) -> void:")
		var event_claim_end := controller_source.find("\n\nfunc ", event_claim_start)
		var event_claim_source := controller_source.substr(event_claim_start, event_claim_end - event_claim_start)
		for required_event_guard in ["floor(float(raw_gold)) != float(raw_gold)", "int(current_gold) > 2147483647 - int(raw_gold)", "world = snapshot", "WorldStateRepositoryScript.save_world(world)"]:
			if not event_claim_source.contains(required_event_guard):
				failures.append("regional event rewards must reject malformed/overflow currency and roll back failed claims: %s" % required_event_guard)
		scene.free()

	if failures.is_empty():
		print("PASS: main scene keeps the native game UI vertically scrollable")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
