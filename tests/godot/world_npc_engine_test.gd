extends SceneTree

const Npc = preload("res://godot/scripts/world_npc_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")
const NpcCatalog = preload("res://godot/scripts/world_npc_catalog.gd")
const MapGenerator = preload("res://godot/scripts/world_map_generator.gd")
const EXPECTED_NPC_IDS := ["blacksmith", "healer", "alchemist", "merchant", "elder", "well", "bard", "guard", "cat", "kids", "herald", "questBoard"]

static func _is_cell_reachable(grid: Array, start: Vector2i, target: Vector2i) -> bool:
	var pending: Array[Vector2i] = [start]
	var visited: Dictionary = {}
	visited[start] = true
	while not pending.is_empty():
		var current: Vector2i = pending.pop_front()
		if current == target:
			return true
		for direction in [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]:
			var next_cell: Vector2i = current + direction
			if visited.has(next_cell) or MapGenerator.is_blocked(grid, next_cell.x, next_cell.y):
				continue
			visited[next_cell] = true
			pending.append(next_cell)
	return false

func _initialize() -> void:
	var failures: Array[String] = []
	# Full NPC dialogue contract: every authored identity is reachable, greetings
	# cycle deterministically across the catalog, and invalid actions are side-effect free.
	var village_grid := MapGenerator.generate_map("village", 40, 30, 20261140, 1, 1)
	var npc_cells: Dictionary = NpcCatalog.map_locations()
	for npc_id in EXPECTED_NPC_IDS:
		var npc_cell: Vector2i = npc_cells.get(npc_id, Vector2i(-1, -1))
		if npc_cell.x < 0 or npc_cell.x >= 40 or npc_cell.y < 0 or npc_cell.y >= 30 or MapGenerator.is_blocked(village_grid, npc_cell.x, npc_cell.y):
			failures.append("village NPC %s must be placed on an in-bounds walkable cell" % npc_id)
		elif not _is_cell_reachable(village_grid, Vector2i(20, 15), npc_cell):
			failures.append("village NPC %s must be reachable from the central plaza without crossing blocked tiles" % npc_id)
	var dialogue_world := WorldState.create(20261140)
	var actual_npc_ids: Array = NpcCatalog.ids()
	for expected_id in EXPECTED_NPC_IDS:
		if not actual_npc_ids.has(expected_id):
			failures.append("native NPC catalog is missing browser-authored identity: %s" % expected_id)
	if actual_npc_ids.size() != EXPECTED_NPC_IDS.size():
		failures.append("native NPC catalog must not expose duplicate or extra identities")
	for npc_id in EXPECTED_NPC_IDS:
		var definition := NpcCatalog.get_npc(npc_id)
		var greetings: Array = definition.get("greetings", [])
		if definition.get("id", "") != npc_id or str(definition.get("name", "")).is_empty() or greetings.is_empty():
			failures.append("NPC %s must have a complete identity and at least one greeting" % npc_id)
			continue
		for greeting_index in range(greetings.size()):
			var dialogue := Npc.talk(dialogue_world, npc_id)
			if not bool(dialogue.get("ok", false)) or dialogue.get("npc", {}).get("id", "") != npc_id:
				failures.append("NPC %s must open a valid dialogue" % npc_id)
				break
			if not str(dialogue.get("message", "")).ends_with("«%s»" % str(greetings[greeting_index])):
				failures.append("NPC %s greeting sequence must preserve authored browser order" % npc_id)
				break
		var repeated_dialogue := Npc.talk(dialogue_world, npc_id)
		if not str(repeated_dialogue.get("message", "")).ends_with("«%s»" % str(greetings[0])):
			failures.append("NPC %s greeting sequence must wrap without skipping its first line" % npc_id)
	var unknown_dialogue_count: Dictionary = dialogue_world.get("npcDialogueCounts", {}).duplicate(true)
	var unknown_dialogue := Npc.talk(dialogue_world, "missing-npc")
	if bool(unknown_dialogue.get("ok", true)) or dialogue_world.get("npcDialogueCounts", {}) != unknown_dialogue_count:
		failures.append("unknown NPC dialogue must fail without mutating persisted greeting counts")
	var invalid_choice_world := WorldState.create(20261141)
	var invalid_choice := Npc.choose_dialogue(invalid_choice_world, "guard", "not-a-real-topic")
	if bool(invalid_choice.get("ok", true)) or invalid_choice_world.has("npcDialogueFlags"):
		failures.append("unknown dialogue choices must not create persisted dialogue flags")
	var guard_choice := Npc.choose_dialogue(invalid_choice_world, "guard", "forest")
	if not bool(guard_choice.get("ok", false)) or not str(guard_choice.get("message", "")).contains("Гоблины") or invalid_choice_world.get("npcDialogueFlags", {}).get("guard:forest", false) != true:
		failures.append("valid guard dialogue choices must return authored text and persist their selection flag")
	var isolated_npc_definition := NpcCatalog.get_npc("guard")
	isolated_npc_definition["name"] = "Mutated copy"
	if NpcCatalog.get_npc("guard").get("name", "") == "Mutated copy":
		failures.append("NPC catalog lookups must return isolated copies rather than mutable shared definitions")
	# Browser parity: well cooldown is stored in hero.stats in milliseconds
	# and becomes available only after strictly more than 24 hours.
	var well_world := WorldState.create(20261127)
	well_world["hero"] = {"level":1,"class":"mage","hp":10,"maxHp":100,"mp":5,"maxMp":50,"gold":0,"inventory":[],"stats":{"lastWellUse":1000000}}
	var exact_cooldown := Npc.use_well(well_world, 1000000 + 86400000)
	if bool(exact_cooldown.get("ok", true)) or int(well_world.hero.hp) != 10:
		failures.append("well must remain unavailable at exactly 24 hours, matching the browser's strict greater-than cooldown")
	var elapsed_cooldown := Npc.use_well(well_world, 1000000 + 86400001)
	if not bool(elapsed_cooldown.get("ok", false)) or int(well_world.hero.hp) != 100 or int(well_world.hero.mp) != 50:
		failures.append("well must restore mage health and mana after more than 24 hours")
	if int(well_world.hero.stats.get("lastWellUse", 0)) != 87400001 or well_world.hero.has("lastWellUse"):
		failures.append("well use must persist the browser-compatible stats.lastWellUse millisecond timestamp")
	var legacy_well_world := WorldState.create(20261128)
	legacy_well_world["hero"] = {"level":1,"class":"mage","hp":10,"maxHp":100,"mp":5,"maxMp":50,"gold":0,"inventory":[],"lastWellUse":1000}
	var legacy_cooldown := Npc.use_well(legacy_well_world, 1000 * 1000 + 86400000)
	if bool(legacy_cooldown.get("ok", true)):
		failures.append("legacy native seconds cooldown must be read during migration without granting an early well use")
	# Browser parity: petting the village cat grants one battle of +5% critical chance.
	var cat_world := WorldState.create(20261130)
	cat_world["hero"] = {"level":1,"gold":0,"inventory":[],"buffs":[]}
	var cat_blessing := Npc.pet_cat(cat_world)
	if not bool(cat_blessing.get("ok", false)) or cat_world.hero.buffs.size() != 1 or str(cat_world.hero.buffs[0].get("id","")) != "catLuck" or int(cat_world.hero.buffs[0].get("duration",0)) != 1:
		failures.append("petting the cat must grant the browser-compatible one-battle catLuck buff")
	var repeated_cat_blessing := Npc.pet_cat(cat_world)
	if bool(repeated_cat_blessing.get("ok", true)) or cat_world.hero.buffs.size() != 1:
		failures.append("catLuck must not be stacked by repeatedly petting the cat")
	var already_lucky_world := WorldState.create(20261131)
	already_lucky_world["hero"] = {"level":1,"gold":0,"inventory":[],"buffs":[{"id":"catLuck","duration":1}]}
	if bool(Npc.pet_cat(already_lucky_world).get("ok", true)) or already_lucky_world.hero.buffs.size() != 1:
		failures.append("an existing active catLuck buff must prevent a duplicate cat blessing")

	var warrior_well_world := WorldState.create(20261129)
	warrior_well_world["hero"] = {"level":1,"class":"warrior","hp":10,"maxHp":100,"mp":0,"maxMp":50,"gold":0,"inventory":[],"stats":{}}
	var warrior_well := Npc.use_well(warrior_well_world, 90000001)
	if not bool(warrior_well.get("ok", false)) or int(warrior_well_world.hero.hp) != 100 or int(warrior_well_world.hero.mp) != 0:
		failures.append("well must preserve warrior rage instead of restoring mana")
	var world := WorldState.create(20261108)
	world["hero"] = {"level":1,"gold":100,"inventory":[{"id":"root-court-seal","qty":1},{"id":"root-fiber","qty":2}],"campaignClaimed":{},"equipped":{}}
	var crafted := Npc.craft(world,"r-briar-court-mantle","blacksmith")
	var wrong_station := Npc.craft(world, "r-hp", "blacksmith")
	if bool(wrong_station.get("ok", true)):
		failures.append("alchemist recipes must not be craftable at the blacksmith")
	if not bool(crafted.get("ok",false)):
		failures.append("valid act-one recipe must craft successfully")
	var inventory: Array = world.hero.inventory
	var crafted_item: Dictionary = {}
	for item in inventory:
		if str(item.get("id",""))=="briar-court-mantle": crafted_item=item
	if crafted_item.is_empty() or str(crafted_item.get("rarity",""))!="uncommon":
		failures.append("crafted equipment must retain its authored rarity")
	if not inventory.is_empty() and (inventory.any(func(item): return str(item.get("id","")) in ["root-court-seal","root-fiber"])):
		failures.append("successful craft must consume all required ingredients")
	var capacity_world := WorldState.create(20261118)
	capacity_world["hero"] = {"level":1,"str":1,"gold":0,"inventory":[{"id":"iron-sword","qty":1},{"id":"root-court-seal","qty":1},{"id":"root-fiber","qty":2}],"campaignClaimed":{},"equipped":{},"inventoryInitialized":true}
	var capacity_craft := Npc.craft(capacity_world, "r-briar-court-mantle", "blacksmith")
	if not bool(capacity_craft.get("ok", false)) or capacity_world.hero.inventory.size() != 2:
		failures.append("crafting must account for the weight freed by consumed ingredients before rejecting the output")
	var poor_world := WorldState.create(20261109)
	poor_world["hero"] = {"inventoryInitialized":true,"level":1,"gold":0,"inventory":[{"id":"root-court-seal","qty":1}],"campaignClaimed":{},"equipped":{}}
	var before: Array = poor_world.hero.inventory.duplicate(true)
	var rejected := Npc.craft(poor_world,"r-briar-court-mantle","blacksmith")
	if bool(rejected.get("ok",true)) or poor_world.hero.inventory!=before:
		failures.append("failed craft must not consume partial ingredients")
	var locked := Npc.craft(poor_world,"r5-dragon-blade","blacksmith")
	if bool(locked.get("ok",true)):
		failures.append("late-act legendary recipe must remain locked before act five")

	var camp_world := WorldState.create(20261119)
	camp_world["location"] = "camp"
	camp_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"herb-life","qty":3}],"campaignClaimed":{},"equipped":{},"craftingJobs":[],"inventoryInitialized":true}
	var queued := Npc.craft(camp_world, "r-hp", "alchemist", 1000000)
	if not bool(queued.get("ok", false)) or not bool(queued.get("queued", false)) or int(queued.get("hours", 0)) < 1 or int(queued.get("hours", 0)) > 3:
		failures.append("camp crafting must queue a persistent order with a one-to-three-hour timer")
	if camp_world.hero.inventory.size() != 0 or camp_world.hero.craftingJobs.size() != 1:
		failures.append("camp order must consume ingredients and persist the pending reward instead of granting it immediately")
	var too_early := Npc.collect_crafting_jobs(camp_world, 1000000 + 3599999)
	if not too_early.is_empty() or camp_world.hero.craftingJobs.size() != 1:
		failures.append("camp order must not be claimable before its readyAt timestamp")
	var ready_at := int(camp_world.hero.craftingJobs[0].readyAt)
	var claimed_jobs := Npc.collect_crafting_jobs(camp_world, ready_at)
	if claimed_jobs.size() != 1 or camp_world.hero.craftingJobs.size() != 0 or str(camp_world.hero.inventory[0].id) != "health-potion":
		failures.append("ready camp order must grant its reward once and remove the claimed job")
	var city_world := WorldState.create(20261120)
	city_world["location"] = "village"
	city_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"herb-life","qty":3}],"campaignClaimed":{},"equipped":{},"inventoryInitialized":true}
	var city_craft := Npc.craft(city_world, "r-hp", "alchemist", 2000000)
	if not bool(city_craft.get("ok", false)) or bool(city_craft.get("queued", false)) or str(city_world.hero.inventory[0].id) != "health-potion":
		failures.append("city crafting must remain immediate and must not create a camp order")
	var blocked_world := WorldState.create(20261121)
	blocked_world["location"] = "camp"
	var blocked_inventory: Array = []
	for slot in range(30): blocked_inventory.append({"id":"iron-sword","qty":1})
	blocked_world["hero"] = {"level":1,"str":1000,"gold":0,"inventory":blocked_inventory,"campaignClaimed":{},"equipped":{},"craftingJobs":[{"id":"blocked","result":"health-potion","qty":1,"readyAt":1}],"inventoryInitialized":true}
	var blocked_claim := Npc.collect_crafting_jobs(blocked_world, 2)
	if not blocked_claim.is_empty() or blocked_world.hero.craftingJobs.size() != 1:
		failures.append("ready camp order must remain claimable when inventory capacity is full")

	var invalid_job_world := WorldState.create(20261122)
	invalid_job_world["location"] = "camp"
	invalid_job_world["hero"] = {"level":1,"gold":0,"inventory":[],"campaignClaimed":{},"equipped":{},"inventoryInitialized":true,"craftingJobs":[{"id":"quest-output","result":"old-archive-seal","qty":1,"readyAt":1}]}
	var invalid_job_claim := Npc.collect_crafting_jobs(invalid_job_world, 2)
	if not invalid_job_claim.is_empty() or invalid_job_world.hero.craftingJobs.size() != 1:
		failures.append("malformed or quest-item crafting orders must never grant restricted rewards")
	var shop_validation_world := WorldState.create(20261110)
	shop_validation_world["hero"] = {"level":1,"gold":0,"inventory":[],"campaignClaimed":{},"equipped":{}}
	if Npc.SHOP_STOCK.size() != 33 or Npc.RARE_SHOP_STOCK.size() != 8:
		failures.append("native merchant pools must match 33 common and 8 rare browser entries")
	for shop_item_id in Npc.SHOP_STOCK + Npc.RARE_SHOP_STOCK:
		if preload("res://godot/scripts/world_item_catalog.gd").get_item(str(shop_item_id)).is_empty() or Npc.get_buy_price(shop_validation_world, str(shop_item_id)) <= 0:
			failures.append("canonical merchant item must have a valid native definition and purchasable price: %s" % str(shop_item_id))
	var regular_stock := Npc.get_merchant_stock(false, 1234)
	if regular_stock.size() != 5 or regular_stock.any(func(item_id): return Npc.RARE_SHOP_STOCK.has(str(item_id))):
		failures.append("village merchant must offer five randomly selected common items only")
	var wandering_stock := Npc.get_merchant_stock(true, 1234)
	var wandering_rare_count := 0
	for stock_item_id in wandering_stock:
		if Npc.RARE_SHOP_STOCK.has(str(stock_item_id)):
			wandering_rare_count += 1
	if wandering_stock.size() != 5 or wandering_rare_count != 2:
		failures.append("wandering merchant must offer three common and two rare items")
	var trader_world := WorldState.create(20261110)
	trader_world["hero"] = {"level":1,"gold":100,"inventory":[],"campaignClaimed":{},"equipped":{}}
	trader_world["factions"] = {"schemaVersion":1,"reputation":{"free-traders":90}}
	var bought := Npc.buy_item(trader_world,"iron-sword")
	if not bool(bought.get("ok",false)) or int(bought.get("price",0)) != 38:
		failures.append("allied Free Traders must apply the 15 percent discount to act-scaled purchases")
	if int(trader_world.hero.get("gold",0)) != 62:
		failures.append("merchant purchase must debit the discounted price exactly once")
	if Npc.get_buy_price(trader_world, "iron-sword") != int(bought.get("price", 0)):
		failures.append("shop preview and purchase must share the same faction-adjusted price")
	var preview_world := WorldState.create(20261114)
	preview_world["hero"] = {"level":1,"gold":0,"inventory":[],"campaignClaimed":{},"equipped":{}}
	preview_world["factions"] = {"schemaVersion":1,"reputation":{"free-traders":90}}
	if Npc.get_buy_price(preview_world, "iron-sword") != 38:
		failures.append("shop preview must include act scaling and allied trader discount")

	var rounded_trader_world := WorldState.create(20261125)
	rounded_trader_world["hero"] = {"level":1,"gold":100,"inventory":[],"campaignClaimed":{},"equipped":{}}
	rounded_trader_world["factions"] = {"schemaVersion":1,"reputation":{"free-traders":29.6}}
	var rounded_trader_buy := Npc.buy_item(rounded_trader_world, "iron-sword")
	if not bool(rounded_trader_buy.get("ok", false)) or not is_equal_approx(float(rounded_trader_buy.get("discount", -1.0)), 0.05) or int(rounded_trader_buy.get("price", 0)) != 43:
		failures.append("purchase result must use browser-rounded reputation when crossing the +30 trader discount threshold")
	var next_trader_world := WorldState.create(20261126)
	next_trader_world["hero"] = {"level":1,"gold":100,"inventory":[],"campaignClaimed":{},"equipped":{}}
	next_trader_world["factions"] = {"schemaVersion":1,"reputation":{"free-traders":69.6}}
	var next_trader_buy := Npc.buy_item(next_trader_world, "iron-sword")
	if not bool(next_trader_buy.get("ok", false)) or not is_equal_approx(float(next_trader_buy.get("discount", -1.0)), 0.10) or int(next_trader_buy.get("price", 0)) != 41:
		failures.append("purchase result must use browser-rounded reputation when crossing the +70 trader discount threshold")
	var sell_world := WorldState.create(20261111)
	sell_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"briar-court-mantle","qty":1,"rarity":"uncommon"}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":0}}
	var sold := Npc.sell_item(sell_world,0)
	if not bool(sold.get("ok",false)) or int(sold.get("price",0)) != 8:
		failures.append("uncommon equipment sale must use rarity price and the 35 percent act-one rate")
	if int(sell_world.hero.get("gold",0)) != 8 or int(sell_world.hero.get("stats",{}).get("goldEarned",0)) != 8:
		failures.append("sale must update spendable gold and lifetime-earned gold atomically")
	var bulk_sell_world := WorldState.create(20261124)
	bulk_sell_world["hero"] = {"inventoryInitialized":true,"level":1,"gold":20,"inventory":[{"id":"health-potion","qty":1,"rarity":"common"},{"id":"iron-sword","qty":1,"rarity":"common"}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":0}}
	var bulk_expected := Npc.get_sell_price(bulk_sell_world, bulk_sell_world.hero.inventory[0]) + Npc.get_sell_price(bulk_sell_world, bulk_sell_world.hero.inventory[1])
	var bulk_sale := Npc.sell_items(bulk_sell_world, [1,0,1])
	if not bool(bulk_sale.get("ok",false)) or int(bulk_sale.get("count",0)) != 2 or int(bulk_sale.get("total",0)) != bulk_expected or not bulk_sell_world.hero.inventory.is_empty():
		failures.append("bulk sale must deduplicate selected indices, process original slots safely, and credit the combined value")
	var base_item: Dictionary = preload("res://godot/scripts/world_item_catalog.gd").get_item("iron-sword")
	var legacy_price := Npc.get_sell_price(sell_world, {"id":"iron-sword","qty":1})
	var expected_legacy_price := int(floor(float(base_item.get("price", 0)) * 0.35))
	if legacy_price != expected_legacy_price:
		failures.append("legacy equipment without a rarity must use its item base price, not common rarity price")
	var sale_preview := {"id":"briar-court-mantle","qty":1,"rarity":"uncommon"}
	if Npc.get_sell_price(sell_world, sale_preview) != 8:
		failures.append("sale preview must include rarity and act multipliers")
	if Npc.get_sell_price(sell_world, {"id":"old-archive-seal","qty":1}) != 0:
		failures.append("quest items must not receive a sell preview price")
	var confirmation_world := WorldState.create(20261115)
	confirmation_world["hero"] = {"inventoryInitialized":true,"level":1,"gold":100,"inventory":[{"id":"briar-court-mantle","qty":1,"rarity":"epic"}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":0}}
	var confirmation_before: Array = confirmation_world.hero.inventory.duplicate(true)
	var confirmation := Npc.sell_item(confirmation_world, 0)
	if not bool(confirmation.get("requiresConfirmation", false)) or confirmation_world.hero.inventory != confirmation_before:
		failures.append("epic sale must require confirmation without mutating inventory")
	var confirmed_sale := Npc.sell_item(confirmation_world, 0, true)
	if not bool(confirmed_sale.get("ok", false)) or confirmation_world.hero.buyback.size() != 1:
		failures.append("confirmed sale must create a same-day buyback record")
	var buyback_price := int(confirmation_world.hero.buyback[0].price)
	if Npc.get_buyback_items(confirmation_world, "1900-01-01").size() != 0:
		failures.append("buyback records from another calendar day must not be available")
	var buyback := Npc.buyback_item(confirmation_world, 0)
	if not bool(buyback.get("ok", false)) or confirmation_world.hero.inventory.size() != 1 or int(confirmation_world.hero.gold) != 100 + int(confirmed_sale.price) - buyback_price:
		failures.append("same-day buyback must restore the item and charge the 20 percent markup")
	var rarity_filter_world := WorldState.create(20261123)
	rarity_filter_world["hero"] = {"level":1,"gold":1000,"inventory":[],"buyback":[
		{"soldAt":"test-day","price":10,"item":{"id":"iron-sword","qty":1,"rarity":"common"}},
		{"soldAt":"test-day","price":10,"item":{"id":"iron-sword","qty":1,"rarity":"mythic"}},
		{"soldAt":"test-day","price":10,"item":{"id":"iron-sword","qty":1,"rarity":"unknown"}}
	],"campaignClaimed":{},"equipped":{}}
	var filtered_buybacks := Npc.get_buyback_items(rarity_filter_world, "test-day")
	if filtered_buybacks.size() != 1 or str(filtered_buybacks[0].item.get("rarity","")) != "common":
		failures.append("buyback must reject mythic and unknown rarity records just like the browser validator")
	var act_five_world := WorldState.create(20261117)
	var claimed_missions: Dictionary = {}
	for mission in preload("res://godot/scripts/world_campaign_catalog.gd").all_missions():
		claimed_missions[str(mission.id)] = true
	act_five_world["hero"] = {"level":50,"str":100,"gold":0,"inventory":[{"id":"echo-core","qty":1},{"id":"void-dust","qty":5},{"id":"ember-core","qty":3},{"id":"grave-salt","qty":1}],"campaignClaimed":claimed_missions,"equipped":{},"craftedHighTierByAct":{}}
	var first_high_tier := Npc.craft(act_five_world, "r-echo-prism-amulet", "blacksmith")
	if not bool(first_high_tier.get("ok", false)) or int(act_five_world.hero.craftedHighTierByAct.get("4", 0)) != 1:
		failures.append("the first T4+ craft in an act must succeed and consume that act's high-tier allowance")
	var high_tier_before: Array = act_five_world.hero.inventory.duplicate(true)
	var second_high_tier := Npc.craft(act_five_world, "r5-dragon-blade", "final-forge")
	if bool(second_high_tier.get("ok", true)) or act_five_world.hero.inventory != high_tier_before:
		failures.append("a second T4+ craft in the same act must be rejected without consuming ingredients")
	var full_bag_world := WorldState.create(20261116)
	var full_inventory: Array = []
	for slot in range(30): full_inventory.append({"id":"iron-sword","qty":1})
	full_bag_world["hero"] = {"inventoryInitialized":true,"level":1,"str":1000,"gold":1000,"inventory":full_inventory,"campaignClaimed":{},"equipped":{}}
	var full_bag_buy := Npc.buy_item(full_bag_world, "iron-sword")
	if bool(full_bag_buy.get("ok", true)) or full_bag_world.hero.inventory.size() != 30 or int(full_bag_world.hero.gold) != 1000:
		failures.append("merchant must reject purchases that exceed the 30-slot inventory limit")
	var overflow_world := WorldState.create(20261112)
	overflow_world["hero"] = {"inventoryInitialized":true,"level":1,"gold":2147483640,"inventory":[{"id":"iron-sword","qty":1}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":2147483640}}
	var overflow_inventory: Array = overflow_world.hero.inventory.duplicate(true)
	var overflow_sale := Npc.sell_item(overflow_world,0)
	if bool(overflow_sale.get("ok",true)) or overflow_world.hero.inventory != overflow_inventory:
		failures.append("sale overflow must be rejected without removing the item")
	var quest_sale_world := WorldState.create(20261113)
	quest_sale_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"old-archive-seal","qty":1}],"campaignClaimed":{},"equipped":{}}
	if bool(Npc.sell_item(quest_sale_world,0).get("ok",true)):
		failures.append("quest items must remain unsellable")
	var reforge_world := WorldState.create(20261132)
	reforge_world["hero"] = {"inventoryInitialized":true,"level":1,"gold":0,"inventory":[
		{"id":"iron-sword","qty":1,"rarity":"rare","bonus":{"attack":20},"sockets":2,"runes":["rune-ember"],"forgeLevel":2,"upgradePercent":0.1},
		{"id":"ember-core","qty":1}
	],"equipped":{}}
	var reforge_check := Npc.can_reforge_item(reforge_world, 0)
	if not bool(reforge_check.get("ok", false)) or int(reforge_check.get("tier", 0)) != 3 or str(reforge_check.get("cost", {}).get("id", "")) != "ember-core":
		failures.append("rare equipment reforge must require one Ember Core")
	var reforge_result := Npc.reforge_item(reforge_world, 0)
	var reforged_inventory: Array = reforge_world.hero.inventory
	if not bool(reforge_result.get("ok", false)) or reforged_inventory.size() != 1 or str(reforged_inventory[0].get("id", "")) != "iron-sword":
		failures.append("successful reforge must replace the original equipment without changing its inventory slot")
	else:
		var reforged: Dictionary = reforged_inventory[0]
		if str(reforged.get("rarity", "")) != "rare" or int(reforged.get("sockets", 0)) != 2 or reforged.get("runes", []) != ["rune-ember"] or int(reforged.get("forgeLevel", 0)) != 2 or not is_equal_approx(float(reforged.get("upgradePercent", 0.0)), 0.1):
			failures.append("reforge must preserve rarity, sockets, runes, forge level and upgrade percentage")
		if int(reforged.get("bonus", {}).get("attack", 0)) != 9:
			failures.append("reforge must recreate canonical item bonuses and reapply the preserved upgrade percentage")
	var material_before_equipment := WorldState.create(20261135)
	material_before_equipment["hero"] = {"inventoryInitialized":true,"level":1,"inventory":[
		{"id":"ember-core","qty":1},
		{"id":"iron-sword","qty":1,"rarity":"rare"},
		{"id":"mana-potion","qty":1}
	],"equipped":{}}
	var material_first_result := Npc.reforge_item(material_before_equipment, 1)
	if not bool(material_first_result.get("ok", false)) or material_before_equipment.hero.inventory.size() != 2 or str(material_before_equipment.hero.inventory[0].get("id", "")) != "iron-sword" or str(material_before_equipment.hero.inventory[1].get("id", "")) != "mana-potion":
		failures.append("reforge must preserve the selected equipment and its browser-compatible relative inventory position when essence precedes it")
	var insufficient_reforge := WorldState.create(20261133)
	insufficient_reforge["hero"] = {"inventoryInitialized":true,"level":1,"inventory":[{"id":"iron-sword","qty":1,"rarity":"epic"}],"equipped":{}}
	var insufficient_snapshot: Array = insufficient_reforge.hero.inventory.duplicate(true)
	if bool(Npc.reforge_item(insufficient_reforge, 0).get("ok", true)) or insufficient_reforge.hero.inventory != insufficient_snapshot:
		failures.append("reforge without the required Frost Essence must not mutate inventory")
	var mythic_reforge := WorldState.create(20261134)
	mythic_reforge["hero"] = {"level":1,"inventory":[{"id":"iron-sword","qty":1,"rarity":"mythic"}],"equipped":{}}
	if bool(Npc.can_reforge_item(mythic_reforge, 0).get("ok", true)):
		failures.append("mythic equipment must remain excluded from reforge")
	if failures.is_empty():
		print("PASS: NPC crafting, reforge, rarity and rollback")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)
