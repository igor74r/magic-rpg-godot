extends SceneTree

const Npc = preload("res://godot/scripts/world_npc_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")

func _initialize() -> void:
	var failures: Array[String] = []
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
	poor_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"root-court-seal","qty":1}],"campaignClaimed":{},"equipped":{}}
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
	var sell_world := WorldState.create(20261111)
	sell_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"briar-court-mantle","qty":1,"rarity":"uncommon"}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":0}}
	var sold := Npc.sell_item(sell_world,0)
	if not bool(sold.get("ok",false)) or int(sold.get("price",0)) != 8:
		failures.append("uncommon equipment sale must use rarity price and the 35 percent act-one rate")
	if int(sell_world.hero.get("gold",0)) != 8 or int(sell_world.hero.get("stats",{}).get("goldEarned",0)) != 8:
		failures.append("sale must update spendable gold and lifetime-earned gold atomically")
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
	confirmation_world["hero"] = {"level":1,"gold":100,"inventory":[{"id":"briar-court-mantle","qty":1,"rarity":"epic"}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":0}}
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
	full_bag_world["hero"] = {"level":1,"str":1000,"gold":1000,"inventory":full_inventory,"campaignClaimed":{},"equipped":{}}
	var full_bag_buy := Npc.buy_item(full_bag_world, "iron-sword")
	if bool(full_bag_buy.get("ok", true)) or full_bag_world.hero.inventory.size() != 30 or int(full_bag_world.hero.gold) != 1000:
		failures.append("merchant must reject purchases that exceed the 30-slot inventory limit")
	var overflow_world := WorldState.create(20261112)
	overflow_world["hero"] = {"level":1,"gold":2147483640,"inventory":[{"id":"iron-sword","qty":1}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":2147483640}}
	var overflow_inventory: Array = overflow_world.hero.inventory.duplicate(true)
	var overflow_sale := Npc.sell_item(overflow_world,0)
	if bool(overflow_sale.get("ok",true)) or overflow_world.hero.inventory != overflow_inventory:
		failures.append("sale overflow must be rejected without removing the item")
	var quest_sale_world := WorldState.create(20261113)
	quest_sale_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"old-archive-seal","qty":1}],"campaignClaimed":{},"equipped":{}}
	if bool(Npc.sell_item(quest_sale_world,0).get("ok",true)):
		failures.append("quest items must remain unsellable")
	if failures.is_empty():
		print("PASS: NPC crafting validation, rarity and rollback")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)
