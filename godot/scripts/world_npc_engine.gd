# Native NPC service actions and dialogue state.
class_name WorldNpcEngine
extends RefCounted
const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const Catalog = preload("res://godot/scripts/world_npc_catalog.gd")
const CatalogItem = preload("res://godot/scripts/world_item_catalog.gd")
const CampaignCatalog = preload("res://godot/scripts/world_campaign_catalog.gd")
const Daily = preload("res://godot/scripts/world_daily_quest_engine.gd")
const FactionEngine = preload("res://godot/scripts/world_faction_engine.gd")
const SHOP_STOCK := ["health-potion","mana-potion","strong-health-potion","strong-mana-potion","antidote","strength-elixir","mana-elixir","scroll-lightning","scroll-shield","restorative-potion","iron-sword","apprentice-staff","leather-armor","rootbound-hood","cinder-visor","briar-shoulders","duelist-grips","gravebinder-gloves","oath-bracers","windstep-boots","glacier-greaves","tower-shield","ranger-cloak","obsidian-mantle","amulet-first-light","pendant-last-oath","ring-wolf-eye","ring-quiet-tide","rune-root","rune-ember","rune-tide","rune-frost","rune-void"]
const RARE_SHOP_STOCK := ["moonsteel-spear","rune-sword","astral-staff","warden-plate","void-robe","scroll-frost-nova","scroll-shadow-lance","scroll-arcane-surge"]
const RECIPES := {
	"r-hp":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"health-potion","ingredients":{"herb-life":3}},
	"r-mp":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"mana-potion","ingredients":{"herb-moon":3}},
	"r-shp":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"strong-health-potion","ingredients":{"herb-life":5}},
	"r-smp":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"strong-mana-potion","ingredients":{"herb-moon":5}},
	"r-rune-root":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"rune-root","ingredients":{"root-fiber":3,"herb-life":1}},
	"r-rune-ember":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"rune-ember","ingredients":{"ember-core":2,"grave-salt":1}},
	"r-rune-tide":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"rune-tide","ingredients":{"frost-essence":2,"herb-moon":1}},
	"r-rune-frost":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"rune-frost","ingredients":{"frost-essence":3}},
	"r-rune-void":{"station":"alchemist","craftTier":1,"act":1,"qty":1,"result":"rune-void","ingredients":{"void-dust":3,"ember-core":1}},
	"r-briar-court-mantle":{"station":"blacksmith","craftTier":2,"act":1,"qty":1,"result":"briar-court-mantle","rarity":"uncommon","ingredients":{"root-court-seal":1,"root-fiber":2}},
	"r-mourner-signet":{"station":"blacksmith","craftTier":3,"act":2,"qty":1,"result":"mourner-signet","rarity":"rare","ingredients":{"drowned-lament":1,"grave-salt":2}},
	"r-oathfire-cleaver":{"station":"blacksmith","craftTier":3,"act":3,"qty":1,"result":"oathfire-cleaver","rarity":"rare","ingredients":{"oathforge-heart":1,"ember-core":2}},
	"r-mirrorweave-cloak":{"station":"blacksmith","craftTier":4,"act":4,"qty":1,"result":"mirrorweave-cloak","rarity":"epic","ingredients":{"mirror-shard":1,"frost-essence":2}},
	"r-echo-prism-amulet":{"station":"blacksmith","craftTier":4,"act":5,"qty":1,"result":"echo-prism-amulet","rarity":"epic","ingredients":{"echo-core":1,"void-dust":3}},
	"r5-dragon-blade":{"station":"final-forge","craftTier":5,"act":5,"qty":1,"result":"dragon-blade","rarity":"legendary","ingredients":{"ember-core":3,"void-dust":2,"grave-salt":1}},
	"r5-dragon-plate":{"station":"final-forge","craftTier":5,"act":5,"qty":1,"result":"dragon-scale-armor","rarity":"legendary","ingredients":{"ember-core":2,"frost-essence":2,"root-fiber":2}},
	"r5-astral-staff":{"station":"final-forge","craftTier":5,"act":5,"qty":1,"result":"astral-staff","rarity":"legendary","ingredients":{"void-dust":3,"frost-essence":2,"ember-core":1}}
}

static func talk(world: Dictionary, npc_id: String) -> Dictionary:
	var npc := Catalog.get_npc(npc_id)
	if npc.is_empty(): return {"ok":false,"message":"Персонаж не найден."}
	var counts: Dictionary=world.get("npcDialogueCounts",{}) if world.get("npcDialogueCounts",{}) is Dictionary else {}
	var count:=maxi(0,int(counts.get(npc_id,0)))
	var greetings: Array=npc.get("greetings",[])
	var greeting:=str(greetings[count % greetings.size()]) if not greetings.is_empty() else "..."
	counts[npc_id]=count+1
	world["npcDialogueCounts"]=counts
	return {"ok":true,"npc":npc,"message":"%s\n«%s»" % [str(npc.name),greeting],"choices":dialogue_choices(npc_id,world)}

static func dialogue_choices(npc_id: String, world: Dictionary) -> Array:
	match npc_id:
		"guard":
			return [
				{"id":"forest","label":"Что известно о Лесе шепчущих?","text":"Гоблины держатся стаями. Следи за тропами и не недооценивай шипастых тварей."},
				{"id":"ruins","label":"Что скрывают Руины?","text":"Там бродит нежить. Скелеты уязвимы, но тёмные рыцари опаснее обычных мертвецов."},
				{"id":"shadow","label":"Расскажи о Пещере теней","text":"Маги теней бьют издали. Подготовь защиту от магии, прежде чем идти туда."}
			]
		"cat", "kids":
			return []
		"herald":
			return [
				{"id":"elite","label":"Спросить об элитных врагах","text":"Элитные противники крепче обычных, но их добыча ценнее."},
				{"id":"treasure","label":"Спросить о сокровищах","text":"Слухи ведут к тайникам. Осматривай стены и подозрительные участки."},
				{"id":"rift","label":"Спросить о Разломе","text":"Чем глубже спускаешься, тем опаснее враги. Не забывай о припасах."}
			]
		"questBoard":
			var quests: Array = Daily.get_quests(world)
			var available:=0
			for quest in quests:
				if quest is Dictionary and not bool(quest.get("claimed",false)) and bool(quest.get("completed",false)): available+=1
			return [{"id":"daily","label":"Проверить ежедневные поручения","text":"На доске %d ежедневных заданий, готовых к сдаче. Подробности и награды отмечены в журнале поручений." % available}]
	return []

static func choose_dialogue(world: Dictionary, npc_id: String, choice_id: String) -> Dictionary:
	var selected: Dictionary={}
	for choice in dialogue_choices(npc_id,world):
		if str(choice.get("id",""))==choice_id:
			selected=choice
			break
	if selected.is_empty(): return {"ok":false,"message":"Такого варианта диалога нет."}
	var flags: Dictionary=world.get("npcDialogueFlags",{}) if world.get("npcDialogueFlags",{}) is Dictionary else {}
	var flag_key: String="%s:%s" % [npc_id,choice_id]
	flags[flag_key]=true
	world["npcDialogueFlags"]=flags
	return {"ok":true,"message":str(selected.get("text",""))}

static func hero_for(world: Dictionary) -> Dictionary:
	return Combat.ensure_hero(world)
static func has_entry(hero: Dictionary,key: String,field: String="buffs") -> bool:
	var entries: Array=hero.get(field,[])
	for entry in entries:
		if entry is Dictionary and str(entry.get("id",""))==key and int(entry.get("duration",0))>0: return true
	return false
static func heal(world: Dictionary) -> Dictionary:
	var hero:=hero_for(world)
	if int(hero.hp)>=int(hero.maxHp) and int(hero.mp)>=int(hero.maxMp): return {"ok":false,"message":"Вы уже полностью здоровы."}
	if int(hero.gold)<8: return {"ok":false,"message":"Нужно 8 золота."}
	hero["gold"]=int(hero.gold)-8
	hero["hp"]=int(hero.maxHp)
	hero["mp"]=int(hero.maxMp)
	world["hero"]=hero
	return {"ok":true,"message":"Лекарь Мирра восстановила здоровье и ресурс за 8 золота."}
static func use_well(world: Dictionary, now_ms: int = -1) -> Dictionary:
	var hero := hero_for(world)
	var current_ms := int(Time.get_unix_time_from_system() * 1000.0) if now_ms < 0 else now_ms
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	# Browser saves use hero.stats.lastWellUse in Unix milliseconds. Read the
	# previous native seconds field once for backwards compatibility with saves
	# written before this parity fix, then persist only the canonical browser key.
	var last_ms := maxi(0, int(stats.get("lastWellUse", 0)))
	if last_ms == 0 and int(hero.get("lastWellUse", 0)) > 0:
		last_ms = int(hero.get("lastWellUse", 0)) * 1000
	if current_ms - last_ms <= 86400000:
		return {"ok": false, "message": "Колодец снова исцелит через 24 часа."}
	if int(hero.hp) >= int(hero.maxHp) and (str(hero.get("class", "")) == "warrior" or int(hero.mp) >= int(hero.maxMp)):
		return {"ok": false, "message": "Вы уже полностью здоровы."}
	hero["hp"] = int(hero.maxHp)
	if str(hero.get("class", "")) != "warrior":
		hero["mp"] = int(hero.maxMp)
	stats["lastWellUse"] = current_ms
	hero["stats"] = stats
	hero.erase("lastWellUse")
	world["hero"] = hero
	return {"ok": true, "message": "Древний колодец полностью восстановил ваши силы."}
static func pay_bard(world: Dictionary) -> Dictionary:
	var hero:=hero_for(world)
	if has_entry(hero,"bardBuff"): return {"ok":false,"message":"Песня барда уже действует."}
	if int(hero.gold)<15: return {"ok":false,"message":"Бард просит 15 золота."}
	hero["gold"]=int(hero.gold)-15
	var buffs: Array=hero.get("buffs",[])
	buffs.append({"id":"bardBuff","duration":3})
	hero["buffs"]=buffs
	world["hero"]=hero
	return {"ok":true,"message":"Бард вдохновил вас: +10% опыта на 3 победы."}
static func take_blessing(world: Dictionary) -> Dictionary:
	var hero:=hero_for(world)
	if has_entry(hero,"elderBlessing","effects"): return {"ok":false,"message":"Благословение уже действует."}
	var effects: Array=hero.get("effects",[])
	effects.append({"id":"elderBlessing","duration":10})
	hero["effects"]=effects
	world["hero"]=hero
	return {"ok":true,"message":"Благословение старейшины: +20% опыта на 10 побед."}

static func pet_cat(world: Dictionary) -> Dictionary:
	var hero := hero_for(world)
	if has_entry(hero, "catLuck"):
		return {"ok": false, "message": "Кошка уже принесла вам удачу."}
	var buffs: Array = hero.get("buffs", [])
	buffs.append({"id": "catLuck", "duration": 1})
	hero["buffs"] = buffs
	world["hero"] = hero
	return {"ok": true, "message": "Кошка мурчит. Удача с вами! (+5% критического шанса на 1 бой)."}
static func campaign_action(world: Dictionary,claim_reward: bool=false) -> Dictionary:
	var hero:=hero_for(world)
	if not claim_reward:
		var next:=Campaign.get_next(hero)
		if next.is_empty(): return {"ok":false,"message":"Все сюжетные поручения завершены."}
		if not Campaign.accept(hero,str(next.id)): return {"ok":false,"message":"Не удалось принять поручение."}
		world["hero"]=hero
		return {"ok":true,"message":"Принято поручение: %s" % str(next.title)}
	var result:=Campaign.claim(hero)
	if not bool(result.get("ok",false)): return result
	var reward: Dictionary=result.reward
	hero["gold"]=mini(2147483647,int(hero.get("gold",0))+int(reward.gold))
	Combat.grant_experience(hero,int(reward.exp))
	Combat.add_item(hero,str(reward.itemId),1)
	world["hero"]=hero
	return {"ok":true,"message":"%s · +%d золота, +%d опыта, материал %s" % [str(result.message),int(reward.gold),int(reward.exp),str(reward.itemId)]}



static func _shuffle_stock(pool: Array, rng: RandomNumberGenerator) -> void:
	for index in range(pool.size() - 1, 0, -1):
		var swap_index := rng.randi_range(0, index)
		var temporary: Variant = pool[index]
		pool[index] = pool[swap_index]
		pool[swap_index] = temporary

static func get_merchant_stock(is_wandering: bool = false, seed_value: int = -1) -> Array:
	var rng := RandomNumberGenerator.new()
	if seed_value >= 0:
		rng.seed = seed_value
	else:
		rng.randomize()
	var common_pool: Array = SHOP_STOCK.duplicate()
	_shuffle_stock(common_pool, rng)
	var result: Array = common_pool.slice(0, 3 if is_wandering else 5)
	if is_wandering:
		var rare_pool: Array = RARE_SHOP_STOCK.duplicate()
		_shuffle_stock(rare_pool, rng)
		result.append_array(rare_pool.slice(0, 2))
	return result
static func current_act(hero: Dictionary) -> int:
	var claimed: Dictionary=hero.get("campaignClaimed",{}) if hero.get("campaignClaimed",{}) is Dictionary else {}
	for mission in CampaignCatalog.all_missions():
		if not bool(claimed.get(str(mission.id),false)):
			var mission_id:=str(mission.get("id","a1-m1"))
			return clampi(int(mission_id.substr(1,1)),1,5)
	return 5
static func _is_stackable(item_type: String) -> bool:
	return item_type in ["consumable", "material", "rune", "scroll", "quest"]

static func _item_unit_weight(item: Dictionary) -> float:
	var item_type := str(item.get("type", ""))
	if item.get("weight", null) is float or item.get("weight", null) is int:
		return maxf(0.0, float(item.weight))
	if item_type == "quest": return 0.0
	if item_type in ["weapon", "head", "shoulders", "chest", "gloves", "legs", "boots", "shield", "ring", "amulet", "cloak", "armor"]: return 5.0
	if item_type in ["material", "consumable"]: return 0.5
	if item_type in ["rune", "scroll"]: return 0.2
	return 1.0

static func _can_add_item(hero: Dictionary, item_id: String, quantity: int = 1, rarity: String = "") -> Dictionary:
	var item := CatalogItem.get_item(item_id)
	if item.is_empty() or quantity < 1: return {"ok":false,"reason":"invalid"}
	var inventory: Array = hero.get("inventory", []) if hero.get("inventory", []) is Array else []
	var item_type := str(item.get("type", ""))
	var stackable := _is_stackable(item_type)
	var existing_stack := false
	if stackable:
		for entry in inventory:
			if entry is Dictionary and str(entry.get("id", "")) == item_id and str(entry.get("rarity", "")) == rarity:
				existing_stack = true
				break
	var slots := 0
	var weight := 0.0
	for entry in inventory:
		if not entry is Dictionary: continue
		var definition := CatalogItem.get_item(str(entry.get("id", "")))
		if definition.is_empty(): continue
		var entry_type := str(definition.get("type", ""))
		if entry_type not in ["quest", "material"]: slots += 1
		var raw_qty: Variant = entry.get("qty", 1)
		var entry_qty := int(raw_qty) if raw_qty is int and int(raw_qty) > 0 else 1
		weight += _item_unit_weight(definition) * float(entry_qty)
	var added_slots := 0
	if item_type not in ["quest", "material"] and not existing_stack:
		added_slots = 1 if stackable else quantity
	var next_slots := slots + added_slots
	if next_slots > 30: return {"ok":false,"reason":"slots","slots":next_slots,"maxSlots":30}
	var capacity := maxf(10.0, maxf(0.0, float(hero.get("str", 10))) * 5.0)
	var next_weight := weight + _item_unit_weight(item) * float(quantity)
	if next_weight > capacity + 0.000001: return {"ok":false,"reason":"weight","weight":next_weight,"capacity":capacity}
	return {"ok":true,"slots":next_slots,"weight":next_weight,"capacity":capacity}

static func _today_key() -> String:
	return Time.get_date_string_from_system()

static func _valid_buyback_records(hero: Dictionary, today: String = "") -> Array:
	var records: Variant = hero.get("buyback", [])
	if not records is Array: return []
	var date_key := today if not today.is_empty() else _today_key()
	var valid: Array = []
	for index in range(records.size()):
		var record: Variant = records[index]
		if not record is Dictionary or str(record.get("soldAt", "")) != date_key: continue
		var instance: Variant = record.get("item", {})
		if not instance is Dictionary: continue
		var item := CatalogItem.get_item(str(instance.get("id", "")))
		var rarity := str(instance.get("rarity", "common"))
		var qty_value: Variant = instance.get("qty", 1)
		var qty := int(qty_value) if qty_value is int else 0
		var price_value: Variant = record.get("price", 0)
		if item.is_empty() or not price_value is int or int(price_value) <= 0 or qty < 1: continue
		if str(item.get("type", "")) == "quest" or bool(item.get("storyShard", false)) or bool(item.get("bossOnly", false)): continue
		# Match the browser buyback validator: unknown rarities and boss-only tiers
		# are never eligible, even when a legacy record otherwise looks valid.
		if rarity not in ["common", "uncommon", "rare", "epic", "legendary"]: continue
		if not _is_stackable(str(item.get("type", ""))) and qty != 1: continue
		valid.append({"recordIndex":index,"item":instance.duplicate(true),"price":int(price_value),"soldAt":date_key})
	return valid

static func get_buy_price(world: Dictionary, item_id: String) -> int:
	if not SHOP_STOCK.has(item_id) and not RARE_SHOP_STOCK.has(item_id): return 0
	var item := CatalogItem.get_item(item_id)
	if item.is_empty() or str(item.get("type","")) == "quest" or bool(item.get("storyShard",false)) or bool(item.get("bossOnly",false)): return 0
	var hero := hero_for(world)
	var multipliers: Array = [1.0, 1.2, 1.4, 1.6, 1.8]
	var discount := FactionEngine.get_trade_discount(world)
	var base_price := int(item.get("price", 0))
	if base_price <= 0: return 0
	return maxi(1, int(round(float(base_price) * multipliers[current_act(hero) - 1] * (1.0 - discount))))

static func get_sell_price(world: Dictionary, instance: Dictionary) -> int:
	var item := CatalogItem.get_item(str(instance.get("id", "")))
	if item.is_empty() or str(item.get("type", "")) == "quest" or bool(item.get("storyShard", false)) or bool(item.get("bossOnly", false)): return 0
	var raw_qty: Variant = instance.get("qty", 1)
	var stackable := str(item.get("type", "")) in ["consumable", "material", "rune", "scroll"]
	var qty := int(raw_qty) if raw_qty is int and int(raw_qty) > 0 else 1
	if stackable and (not raw_qty is int or qty < 1): return 0
	if not stackable: qty = 1
	var rarity := str(instance.get("rarity", ""))
	var rarity_prices: Dictionary = {"common":10, "uncommon":25, "rare":60, "epic":150, "legendary":400}
	var rarity_multipliers: Dictionary = {"common":1.0, "uncommon":1.25, "rare":1.5, "epic":2.2, "legendary":3.5}
	if rarity == "mythic": return 0
	# Legacy equipment without a rarity uses its authored item price, matching the browser economy.
	var base_price := int(rarity_prices.get(rarity, float(item.get("price", 0)) * float(rarity_multipliers.get(rarity, 1.0))))
	if base_price <= 0: return 0
	var multipliers: Array = [1.0, 1.2, 1.4, 1.6, 1.8]
	var unit_price := maxi(1, int(floor(float(base_price) * multipliers[current_act(hero_for(world)) - 1] * 0.35)))
	var price := unit_price * qty
	return price if price > 0 and price <= 2147483647 else 0

static func buy_item(world: Dictionary, item_id: String) -> Dictionary:
	var hero := hero_for(world)
	var item := CatalogItem.get_item(item_id)
	var price := get_buy_price(world, item_id)
	if price <= 0: return {"ok":false,"message":"Этот предмет нельзя купить у торговца."}
	# Use the canonical browser-compatible reputation normalization and thresholds.
	var discount := FactionEngine.get_trade_discount(world)
	var balance := int(hero.get("gold", 0))
	if balance < 0 or balance < price: return {"ok":false,"message":"Недостаточно золота: нужно %d." % price}
	var capacity := _can_add_item(hero, item_id, 1)
	if not bool(capacity.get("ok", false)):
		var reason := "Сумка заполнена." if str(capacity.get("reason", "")) == "slots" else "Превышен лимит переносимого веса."
		return {"ok":false,"message":reason}
	if not Combat.add_item(hero, item_id, 1): return {"ok":false,"message":"Не удалось добавить предмет."}
	hero["gold"] = balance - price
	world["hero"] = hero
	return {"ok":true,"message":"Куплено: %s за %d золота." % [str(item.name), price], "price":price, "discount":discount}
static func sell_item(world: Dictionary, index: int, confirmed: bool = false) -> Dictionary:
	var hero := hero_for(world)
	var inventory: Array = hero.get("inventory", []) if hero.get("inventory", []) is Array else []
	if index < 0 or index >= inventory.size(): return {"ok":false,"message":"Предмет не найден."}
	var instance_value: Variant = inventory[index]
	if not instance_value is Dictionary: return {"ok":false,"message":"Формат предмета повреждён."}
	var instance: Dictionary = instance_value
	var item := CatalogItem.get_item(str(instance.get("id", "")))
	if item.is_empty() or str(item.get("type", "")) == "quest" or bool(item.get("storyShard", false)) or bool(instance.get("storyShard", false)) or bool(item.get("bossOnly", false)):
		return {"ok":false,"message":"Этот предмет нельзя продать."}
	var price := get_sell_price(world, instance)
	if price <= 0: return {"ok":false,"message":"Этот предмет нельзя продать или его цена некорректна."}
	var rarity := str(instance.get("rarity", "common"))
	if (rarity in ["epic", "legendary", "mythic"] or price > 500) and not confirmed:
		return {"ok":false,"requiresConfirmation":true,"message":"Подтвердите продажу ценного предмета за %d золота." % price,"price":price}
	var balance_value: Variant = hero.get("gold", 0)
	var stats: Dictionary = hero.get("stats", {}) if hero.get("stats", {}) is Dictionary else {}
	var earned_value: Variant = stats.get("goldEarned", 0)
	if not balance_value is int or not earned_value is int: return {"ok":false,"message":"Некорректный баланс золота."}
	var balance := int(balance_value)
	var earned := int(earned_value)
	if balance < 0 or earned < 0 or balance > 2147483647 - price or earned > 2147483647 - price:
		return {"ok":false,"message":"Операция продажи превысит допустимый баланс золота."}
	var today := _today_key()
	var previous_buyback: Array = hero.get("buyback", []).duplicate(true) if hero.get("buyback", []) is Array else []
	var buyback_price := int(ceil(float(price) * 1.2))
	var buyback: Array = previous_buyback.filter(func(record): return record is Dictionary and str(record.get("soldAt", "")) == today)
	if buyback_price > 0:
		buyback.append({"id":"buyback-%d-%d" % [int(Time.get_unix_time_from_system() * 1000000.0), index], "item":instance.duplicate(true), "soldAt":today, "price":buyback_price})
	inventory.remove_at(index)
	hero["inventory"] = inventory
	hero["gold"] = balance + price
	stats["goldEarned"] = earned + price
	hero["stats"] = stats
	hero["buyback"] = buyback
	world["hero"] = hero
	return {"ok":true,"message":"Продано: %s · +%d золота." % [str(item.get("name", "Предмет")), price],"price":price,"buybackPrice":buyback_price}

# Sell several selected inventory entries as one atomic transaction.
# Indices refer to the original inventory and are processed from highest to lowest.
static func sell_items(world: Dictionary, indices: Array, confirmed: bool = false) -> Dictionary:
	var hero := hero_for(world)
	var inventory: Array = hero.get("inventory", []) if hero.get("inventory", []) is Array else []
	var selected: Array[int] = []
	for value in indices:
		if not value is int or int(value) < 0 or int(value) >= inventory.size() or selected.has(int(value)):
			continue
		selected.append(int(value))
	selected.sort()
	selected.reverse()
	var candidates: Array[Dictionary] = []
	var total := 0
	var high_tier := false
	for index in selected:
		var value: Variant = inventory[index]
		if not value is Dictionary:
			continue
		var instance: Dictionary = value
		var item := CatalogItem.get_item(str(instance.get("id", "")))
		if item.is_empty() or str(item.get("type", "")) == "quest" or bool(item.get("storyShard", false)) or bool(instance.get("storyShard", false)) or bool(item.get("bossOnly", false)):
			continue
		var price := get_sell_price(world, instance)
		if price <= 0 or total > 2147483647 - price:
			continue
		total += price
		var rarity := str(instance.get("rarity", "common"))
		if rarity in ["epic", "legendary"]:
			high_tier = true
		candidates.append({"index":index,"price":price})
	if candidates.is_empty() or total <= 0:
		return {"ok":false,"count":0,"total":0,"message":"Нет предметов, доступных для продажи."}
	if (high_tier or total > 500) and not confirmed:
		return {"ok":false,"requiresConfirmation":true,"count":candidates.size(),"total":total,"hasHighTier":high_tier}
	var previous_inventory: Array = inventory.duplicate(true)
	var previous_gold: Variant = hero.get("gold", 0)
	var previous_stats: Dictionary = hero.get("stats", {}).duplicate(true) if hero.get("stats", {}) is Dictionary else {}
	var previous_buyback: Array = hero.get("buyback", []).duplicate(true) if hero.get("buyback", []) is Array else []
	var sold_count := 0
	var actual_total := 0
	for candidate in candidates:
		var result := sell_item(world, int(candidate.index), true)
		if not bool(result.get("ok", false)):
			hero["inventory"] = previous_inventory
			hero["gold"] = previous_gold
			hero["stats"] = previous_stats
			hero["buyback"] = previous_buyback
			world["hero"] = hero
			return {"ok":false,"count":0,"total":0,"message":"Продажа отменена: %s" % str(result.get("message", "ошибка операции"))}
		sold_count += 1
		actual_total += int(result.get("price", 0))
	hero = hero_for(world)
	return {"ok":true,"count":sold_count,"total":actual_total,"message":"Продано предметов: %d · +%d золота." % [sold_count,actual_total]}


static func get_buyback_items(world: Dictionary, today: String = "") -> Array:
	return _valid_buyback_records(hero_for(world), today)

static func buyback_item(world: Dictionary, index: int, today: String = "") -> Dictionary:
	var hero := hero_for(world)
	var records := _valid_buyback_records(hero, today)
	if index < 0 or index >= records.size(): return {"ok":false,"message":"Предмет больше нельзя выкупить."}
	var entry: Dictionary = records[index]
	var record_index := int(entry.recordIndex)
	var instance: Dictionary = entry.item
	var item := CatalogItem.get_item(str(instance.get("id", "")))
	var price := int(entry.price)
	var balance_value: Variant = hero.get("gold", 0)
	if not balance_value is int or int(balance_value) < 0 or int(balance_value) < price:
		return {"ok":false,"message":"Не хватает золота для обратного выкупа: нужно %d." % price}
	var qty := int(instance.get("qty", 1))
	var rarity := str(instance.get("rarity", ""))
	var capacity := _can_add_item(hero, str(instance.get("id", "")), qty, rarity)
	if not bool(capacity.get("ok", false)):
		var reason := "Сумка заполнена." if str(capacity.get("reason", "")) == "slots" else "Превышен лимит переносимого веса."
		return {"ok":false,"message":reason}
	var previous_inventory: Array = hero.get("inventory", []).duplicate(true)
	var previous_gold := int(hero.gold)
	var previous_buyback: Array = hero.get("buyback", []).duplicate(true) if hero.get("buyback", []) is Array else []
	if _is_stackable(str(item.get("type", ""))):
		if not Combat.add_item(hero, str(instance.get("id", "")), qty, rarity):
			return {"ok":false,"message":"Не удалось вернуть предмет в сумку."}
	else:
		hero.inventory.append(instance.duplicate(true))
	hero["gold"] = previous_gold - price
	hero["buyback"] = previous_buyback
	hero.buyback.remove_at(record_index)
	if int(hero.gold) < 0:
		hero["inventory"] = previous_inventory
		hero["gold"] = previous_gold
		hero["buyback"] = previous_buyback
		return {"ok":false,"message":"Обратный выкуп отменён: некорректный баланс."}
	world["hero"] = hero
	return {"ok":true,"message":"Предмет выкуплен обратно за %d золота." % price,"price":price}

static func _is_camp_crafting(world: Dictionary) -> bool:
	var overworld: Dictionary = world.get("overworld", {}) if world.get("overworld", {}) is Dictionary else {}
	return str(world.get("location", "")) == "camp" or str(overworld.get("locationId", "")) == "camp" or str(overworld.get("sourceLocationId", "")) == "camp"

static func get_crafting_jobs(world: Dictionary) -> Array:
	var hero := hero_for(world)
	var jobs: Variant = hero.get("craftingJobs", [])
	return jobs.duplicate(true) if jobs is Array else []

# readyAt is Unix time in milliseconds, matching the browser save contract.
static func collect_crafting_jobs(world: Dictionary, now_ms: int = -1) -> Array:
	var hero := hero_for(world)
	var jobs: Variant = hero.get("craftingJobs", [])
	if not jobs is Array or jobs.is_empty():
		return []
	var current_ms := int(Time.get_unix_time_from_system() * 1000.0) if now_ms < 0 else now_ms
	var inventory_before: Array = hero.get("inventory", []).duplicate(true)
	var claimed: Array = []
	var claimed_ids: Array[String] = []
	for job_value in jobs:
		if not job_value is Dictionary:
			continue
		var job: Dictionary = job_value
		var ready_value: Variant = job.get("readyAt", null)
		var quantity_value: Variant = job.get("qty", null)
		var result_id := str(job.get("result", ""))
		var job_id := str(job.get("id", ""))
		var quantity := int(quantity_value) if quantity_value is int else 0
		if not (ready_value is int or ready_value is float) or float(ready_value) > float(current_ms):
			continue
		var result_definition := CatalogItem.get_item(result_id)
		if job_id.is_empty() or claimed_ids.has(job_id) or result_id.is_empty() or quantity < 1 or quantity > 99 or result_definition.is_empty() or str(result_definition.get("type", "")) == "quest" or bool(result_definition.get("storyShard", false)) or bool(result_definition.get("bossOnly", false)):
			continue
		var rarity := str(job.get("rarity", ""))
		if not rarity.is_empty() and rarity not in ["common", "uncommon", "rare", "epic", "legendary"]:
			continue
		var capacity := _can_add_item(hero, result_id, quantity, rarity)
		if not bool(capacity.get("ok", false)):
			continue
		if not Combat.add_item(hero, result_id, quantity, rarity):
			hero["inventory"] = inventory_before
			return []
		claimed.append(job.duplicate(true))
		claimed_ids.append(str(job.get("id", "")))
	if claimed.is_empty():
		return []
	var remaining: Array = []
	for job_value in jobs:
		var remove_job := false
		if job_value is Dictionary:
			var job_id := str(job_value.get("id", ""))
			if not job_id.is_empty() and claimed_ids.has(job_id):
				remove_job = true
				claimed_ids.erase(job_id)
		if not remove_job:
			remaining.append(job_value)
	hero["craftingJobs"] = remaining
	world["hero"] = hero
	return claimed

static func craft(world: Dictionary, recipe_id: String, station: String = "", now_ms: int = -1) -> Dictionary:
	var hero := hero_for(world)
	var recipe: Dictionary = RECIPES.get(recipe_id, {})
	if recipe.is_empty(): return {"ok":false,"message":"Рецепт не найден."}
	var expected_station := str(recipe.get("station", ""))
	if station != expected_station:
		return {"ok":false,"message":"Для этого рецепта нужна другая мастерская."}
	var required_act := int(recipe.get("act", 1))
	if required_act < 1 or required_act > 5 or required_act > current_act(hero):
		return {"ok":false,"message":"Рецепт откроется в акте %d." % clampi(required_act, 1, 5)}
	var result_id := str(recipe.get("result", ""))
	var result_definition := CatalogItem.get_item(result_id)
	var craft_tier := int(recipe.get("craftTier", 1))
	var quantity_value: Variant = recipe.get("qty", 1)
	var quantity := int(quantity_value) if quantity_value is int else 0
	if craft_tier < 1 or craft_tier > 5 or quantity < 1 or quantity > 99:
		return {"ok":false,"message":"Рецепт содержит недопустимый уровень или количество."}
	if result_definition.is_empty() or str(result_definition.get("type", "")) == "quest" or bool(result_definition.get("storyShard", false)) or bool(result_definition.get("bossOnly", false)):
		return {"ok":false,"message":"Этот предмет нельзя создавать по рецепту."}
	if craft_tier == 5 and (current_act(hero) != 5 or station != "final-forge"):
		return {"ok":false,"message":"Предметы T5 доступны только в кузнице пятого акта."}
	var act_index := current_act(hero) - 1
	var crafted_by_act: Dictionary = hero.get("craftedHighTierByAct", {}) if hero.get("craftedHighTierByAct", {}) is Dictionary else {}
	if craft_tier >= 4 and int(crafted_by_act.get(str(act_index), 0)) >= 1:
		return {"ok":false,"message":"В этом акте уже создан один предмет T4 или выше."}
	var ingredients: Variant = recipe.get("ingredients", {})
	if not ingredients is Dictionary or ingredients.is_empty(): return {"ok":false,"message":"Рецепт повреждён: нет ингредиентов."}
	var inventory: Array = hero.get("inventory", []) if hero.get("inventory", []) is Array else []
	for item_id in ingredients:
		var ingredient_id := str(item_id)
		var ingredient_definition := CatalogItem.get_item(ingredient_id)
		var needed_value: Variant = ingredients[item_id]
		var needed := int(needed_value) if needed_value is int else 0
		if ingredient_definition.is_empty() or str(ingredient_definition.get("type", "")) == "quest" or bool(ingredient_definition.get("storyShard", false)) or needed < 1:
			return {"ok":false,"message":"Рецепт содержит недопустимый ингредиент."}
		var have := 0
		for instance in inventory:
			if instance is Dictionary and str(instance.get("id", "")) == ingredient_id:
				var raw_qty: Variant = instance.get("qty", 1)
				var stack_qty := int(raw_qty) if raw_qty is int and int(raw_qty) > 0 else 1
				have += stack_qty
		if have < needed:
			return {"ok":false,"message":"Не хватает %s: %d/%d." % [str(ingredient_definition.get("name", ingredient_id)), have, needed]}
	var output_rarity := str(recipe.get("rarity", ""))
	var snapshot: Array = inventory.duplicate(true)
	for item_id in ingredients:
		if not Combat.remove_item(hero, str(item_id), int(ingredients[item_id])):
			hero["inventory"] = snapshot
			return {"ok":false,"message":"Не удалось списать ингредиенты; отменено."}
	if _is_camp_crafting(world):
		var hours := int(recipe.get("craftHours", 0))
		if hours < 1 or hours > 3:
			var rng := RandomNumberGenerator.new()
			rng.randomize()
			hours = rng.randi_range(1, 3)
		var current_ms := int(Time.get_unix_time_from_system() * 1000.0) if now_ms < 0 else now_ms
		var jobs: Array = hero.get("craftingJobs", []) if hero.get("craftingJobs", []) is Array else []
		var job_id := "%s-%d-%d" % [recipe_id, current_ms, jobs.size()]
		jobs.append({"id":job_id,"result":result_id,"qty":quantity,"rarity":output_rarity,"readyAt":current_ms + hours * 60 * 60 * 1000})
		hero["craftingJobs"] = jobs
		if craft_tier >= 4:
			crafted_by_act[str(act_index)] = int(crafted_by_act.get(str(act_index), 0)) + 1
			hero["craftedHighTierByAct"] = crafted_by_act
		world["hero"] = hero
		return {"ok":true,"queued":true,"hours":hours,"message":"Заказ принят. Готово через %d ч." % hours}
	var output_capacity := _can_add_item(hero, result_id, quantity, output_rarity)
	if not bool(output_capacity.get("ok", false)):
		hero["inventory"] = snapshot
		var capacity_message := "Сумка заполнена." if str(output_capacity.get("reason", "")) == "slots" else "Превышен лимит переносимого веса."
		return {"ok":false,"message":capacity_message}
	if not Combat.add_item(hero, result_id, quantity, output_rarity):
		hero["inventory"] = snapshot
		return {"ok":false,"message":"Не удалось создать предмет; ингредиенты возвращены."}
	if craft_tier >= 4:
		crafted_by_act[str(act_index)] = int(crafted_by_act.get(str(act_index), 0)) + 1
		hero["craftedHighTierByAct"] = crafted_by_act
	world["hero"] = hero
	return {"ok":true,"message":"Создано: %s ×%d." % [str(result_definition.get("name", result_id)), quantity]}

static func can_reforge_item(world: Dictionary, index: int) -> Dictionary:
	var hero := hero_for(world)
	var inventory: Array = hero.get("inventory", []) if hero.get("inventory", []) is Array else []
	if index < 0 or index >= inventory.size() or not inventory[index] is Dictionary:
		return {"ok":false,"message":"Перековать можно только экипировку из сумки."}
	var instance: Dictionary = inventory[index]
	var item_id := str(instance.get("id", ""))
	var item := CatalogItem.get_item(item_id)
	if item.is_empty() or not CatalogItem.is_equipment(item_id):
		return {"ok":false,"message":"Перековать можно только экипировку из сумки."}
	var rarity := str(instance.get("rarity", "common"))
	if bool(item.get("storyShard", false)) or str(item.get("type", "")) == "quest" or rarity == "mythic":
		return {"ok":false,"message":"Этот предмет нельзя перековать."}
	var rarity_tiers := {"common":1,"uncommon":2,"rare":3,"epic":4,"legendary":5}
	var tier := int(rarity_tiers.get(rarity, 1))
	var costs := {
		1: {"id":"root-fiber","qty":1},
		2: {"id":"grave-salt","qty":1},
		3: {"id":"ember-core","qty":1},
		4: {"id":"frost-essence","qty":2},
		5: {"id":"void-dust","qty":2}
	}
	var cost: Dictionary = costs[tier]
	var have := 0
	for entry in inventory:
		if entry is Dictionary and str(entry.get("id", "")) == str(cost.id):
			var raw_qty: Variant = entry.get("qty", 1)
			have += int(raw_qty) if raw_qty is int and int(raw_qty) > 0 else 1
	if have < int(cost.qty):
		var material := CatalogItem.get_item(str(cost.id))
		return {"ok":false,"message":"Для перековки нужно: %s ×%d (есть %d)." % [str(material.get("name", cost.id)), int(cost.qty), have]}
	return {"ok":true,"cost":cost.duplicate(true),"tier":tier,"itemId":item_id}


static func reforge_item(world: Dictionary, index: int) -> Dictionary:
	var check := can_reforge_item(world, index)
	if not bool(check.get("ok", false)):
		return check
	var hero := hero_for(world)
	var inventory: Array = hero.get("inventory", [])
	var snapshot: Array = inventory.duplicate(true)
	var old: Dictionary = inventory[index]
	var item_id := str(old.get("id", ""))
	var rarity := str(old.get("rarity", "common"))
	var preserved_sockets: Variant = old.get("sockets", CatalogItem.get_item(item_id).get("sockets", 0))
	var preserved_runes: Array = old.get("runes", []).duplicate(true) if old.get("runes", []) is Array else []
	var preserved_forge_level := maxi(0, int(old.get("forgeLevel", 0)))
	var preserved_upgrade_percent := maxf(0.0, float(old.get("upgradePercent", 0.0)))
	var cost: Dictionary = check.cost
	# Mark the selected instance while the essence is consumed. The browser
	# removes the material first, then restores the reforged item at its shifted
	# original index; tracking the instance preserves that exact ordering.
	var marker := "__native_reforge_selected_7f3a__"
	old[marker] = true
	hero["inventory"] = inventory
	if not Combat.remove_item(hero, str(cost.id), int(cost.qty)):
		hero["inventory"] = snapshot
		world["hero"] = hero
		return {"ok":false,"message":"Не удалось списать эссенцию; предметы не изменены."}
	inventory = hero.get("inventory", [])
	var selected_index := -1
	for candidate_index in range(inventory.size()):
		if inventory[candidate_index] is Dictionary and bool(inventory[candidate_index].get(marker, false)):
			selected_index = candidate_index
			inventory[candidate_index].erase(marker)
			break
	if selected_index < 0:
		hero["inventory"] = snapshot
		world["hero"] = hero
		return {"ok":false,"message":"Предмет не найден; материалы возвращены."}
	inventory.remove_at(selected_index)
	hero["inventory"] = inventory
	if not Combat.add_item(hero, item_id, 1, rarity):
		hero["inventory"] = snapshot
		world["hero"] = hero
		return {"ok":false,"message":"Перековка не удалась; материалы возвращены."}
	inventory = hero.get("inventory", [])
	var reforged_index := inventory.size() - 1
	if reforged_index < 0 or not inventory[reforged_index] is Dictionary:
		hero["inventory"] = snapshot
		world["hero"] = hero
		return {"ok":false,"message":"Не удалось создать предмет; материалы возвращены."}
	var reforged: Dictionary = inventory[reforged_index]
	reforged["sockets"] = preserved_sockets
	reforged["runes"] = preserved_runes
	reforged["forgeLevel"] = preserved_forge_level
	reforged["upgradePercent"] = preserved_upgrade_percent
	if preserved_upgrade_percent > 0.0:
		var bonus: Dictionary = reforged.get("bonus", {}).duplicate(true) if reforged.get("bonus", {}) is Dictionary else {}
		for key in bonus:
			var value: Variant = bonus[key]
			if value is int or value is float:
				var scaled := float(value) * (1.0 + preserved_upgrade_percent)
				bonus[key] = snappedf(scaled, 0.0001) if str(key) in ["dodgeChance","blockChance","blockPower","critChance"] else int(floor(scaled + 0.5))
		reforged["bonus"] = bonus
		inventory[reforged_index] = reforged
	inventory.remove_at(reforged_index)
	inventory.insert(mini(selected_index, inventory.size()), reforged)
	hero["inventory"] = inventory
	world["hero"] = hero
	return {"ok":true,"message":"Перековано: %s." % str(CatalogItem.get_item(item_id).get("name", item_id))}


static func upgrade_equipment(world: Dictionary,slot: String) -> Dictionary:
	var hero:=hero_for(world)
	var equipped: Dictionary=hero.get("equipped",{})
	if not equipped.has(slot) or not equipped[slot] is Dictionary: return {"ok":false,"message":"В этом слоте нет экипировки."}
	var instance: Dictionary=equipped[slot]
	var level:=clampi(int(instance.get("forgeLevel",0)),0,3)
	var costs: Array=[30,75,140]
	if level>=3: return {"ok":false,"message":"Достигнут максимальный уровень ковки."}
	var cost:=int(costs[level])
	if int(hero.get("gold",0))<cost: return {"ok":false,"message":"Для улучшения нужно %d золота." % cost}
	var bonus: Dictionary=instance.get("bonus",{}).duplicate(true)
	if bonus.is_empty(): bonus=CatalogItem.get_item(str(instance.get("id",""))).get("bonus",{}).duplicate(true)
	for key in bonus:
		if bonus[key] is float or bonus[key] is int:
			if str(key) in ["dodgeChance","blockChance","blockPower","critChance"]: bonus[key]=snappedf(float(bonus[key])*1.05,0.0001)
			else: bonus[key]=int(round(float(bonus[key])*1.05))
	instance["bonus"]=bonus
	instance["forgeLevel"]=level+1
	instance["upgradePercent"]=minf(1.0,float(instance.get("upgradePercent",0.0))+0.05)
	equipped[slot]=instance
	hero["equipped"]=equipped
	hero["gold"]=int(hero.gold)-cost
	world["hero"]=hero
	return {"ok":true,"message":"Ковка +%d завершена за %d золота." % [level+1,cost]}
