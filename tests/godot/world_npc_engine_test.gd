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
	if failures.is_empty():
		print("PASS: NPC crafting validation, rarity and rollback")
		quit(0)
	else:
		for failure in failures: push_error(failure)
		quit(1)
