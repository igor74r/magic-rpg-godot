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
	var sell_world := WorldState.create(20261111)
	sell_world["hero"] = {"level":1,"gold":0,"inventory":[{"id":"briar-court-mantle","qty":1,"rarity":"uncommon"}],"campaignClaimed":{},"equipped":{},"stats":{"goldEarned":0}}
	var sold := Npc.sell_item(sell_world,0)
	if not bool(sold.get("ok",false)) or int(sold.get("price",0)) != 8:
		failures.append("uncommon equipment sale must use rarity price and the 35 percent act-one rate")
	if int(sell_world.hero.get("gold",0)) != 8 or int(sell_world.hero.get("stats",{}).get("goldEarned",0)) != 8:
		failures.append("sale must update spendable gold and lifetime-earned gold atomically")
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
