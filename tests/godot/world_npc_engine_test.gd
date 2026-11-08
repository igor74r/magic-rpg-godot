extends SceneTree

const Npc = preload("res://godot/scripts/world_npc_engine.gd")
const WorldState = preload("res://godot/scripts/world_state.gd")

func _initialize() -> void:
	var failures: Array[String] = []
	var world := WorldState.create(20261108)
	world["hero"] = {"level":1,"gold":100,"inventory":[{"id":"root-court-seal","qty":1},{"id":"root-fiber","qty":2}],"campaignClaimed":{},"equipped":{}}
	var crafted := Npc.craft(world,"r-briar-court-mantle")
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
	var poor_world := WorldState.create(20261109)
	poor_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"root-court-seal","qty":1}],"campaignClaimed":{},"equipped":{}}
	var before: Array = poor_world.hero.inventory.duplicate(true)
	var rejected := Npc.craft(poor_world,"r-briar-court-mantle")
	if bool(rejected.get("ok",true)) or poor_world.hero.inventory!=before:
		failures.append("failed craft must not consume partial ingredients")
	var locked := Npc.craft(poor_world,"r5-dragon-blade")
	if bool(locked.get("ok",true)):
		failures.append("late-act legendary recipe must remain locked before act five")
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
	var buyback := Npc.buyback_item(confirmation_world, 0)
	if not bool(buyback.get("ok", false)) or confirmation_world.hero.inventory.size() != 1 or int(confirmation_world.hero.gold) != 100 + int(confirmed_sale.price) - buyback_price:
		failures.append("same-day buyback must restore the item and charge the 20 percent markup")
	if not Npc.get_buyback_items(confirmation_world, "1900-01-01").is_empty():
		failures.append("buyback records from another calendar day must not be available")
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
