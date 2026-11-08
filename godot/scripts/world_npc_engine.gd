# Native NPC service actions and dialogue state.
class_name WorldNpcEngine
extends RefCounted
const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const Catalog = preload("res://godot/scripts/world_npc_catalog.gd")
const CatalogItem = preload("res://godot/scripts/world_item_catalog.gd")
const CampaignCatalog = preload("res://godot/scripts/world_campaign_catalog.gd")
const Daily = preload("res://godot/scripts/world_daily_quest_engine.gd")
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
		"cat":
			return [{"id":"pet","label":"Погладить кошку","text":"Кошка довольно мурлычет и трётся о вашу руку."}]
		"kids":
			return [
				{"id":"heroes","label":"Рассказать о приключениях","text":"Дети слушают, затаив дыхание. Теперь они мечтают стать искателями приключений."},
				{"id":"coin","label":"Подарить детям 1 золото","text":"Дети радостно благодарят вас за монетку."}
			]
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
	if npc_id=="kids" and choice_id=="coin":
		if bool(flags.get(flag_key,false)): return {"ok":false,"message":"Вы уже подарили детям монетку."}
		var hero:=hero_for(world)
		if int(hero.get("gold",0))<1: return {"ok":false,"message":"У вас нет даже одной золотой монеты."}
		hero["gold"]=int(hero.gold)-1
		world["hero"]=hero
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
static func use_well(world: Dictionary,now: int=-1) -> Dictionary:
	var hero:=hero_for(world)
	var current:=int(Time.get_unix_time_from_system()) if now<0 else now
	var last:=maxi(0,int(hero.get("lastWellUse",0)))
	if current-last<86400: return {"ok":false,"message":"Колодец снова исцелит через 24 часа."}
	if int(hero.hp)>=int(hero.maxHp) and (str(hero.get("class",""))=="warrior" or int(hero.mp)>=int(hero.maxMp)): return {"ok":false,"message":"Вы уже полностью здоровы."}
	hero["hp"]=int(hero.maxHp)
	if str(hero.get("class",""))!="warrior": hero["mp"]=int(hero.maxMp)
	hero["lastWellUse"]=current
	world["hero"]=hero
	return {"ok":true,"message":"Древний колодец полностью восстановил ваши силы."}
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


const SHOP_STOCK := ["health-potion","mana-potion","strong-health-potion","strong-mana-potion","antidote","strength-elixir","mana-elixir","scroll-lightning","scroll-shield","restorative-potion","iron-sword","apprentice-staff","leather-armor","rootbound-hood","cinder-visor","briar-shoulders","duelist-grips","gravebinder-gloves","oath-bracers","windstep-boots","glacier-greaves","tower-shield","ranger-cloak","obsidian-mantle","amulet-first-light","pendant-last-oath","ring-wolf-eye","ring-quiet-tide","rune-root","rune-ember","rune-tide","rune-frost","rune-void"]
const RECIPES := {
 "r-hp":{"result":"health-potion","ingredients":{"herb-life":3}},
 "r-mp":{"result":"mana-potion","ingredients":{"herb-moon":3}},
 "r-shp":{"result":"strong-health-potion","ingredients":{"herb-life":5}},
 "r-smp":{"result":"strong-mana-potion","ingredients":{"herb-moon":5}},
 "r-rune-root":{"result":"rune-root","ingredients":{"root-fiber":3,"herb-life":1}},
 "r-rune-ember":{"result":"rune-ember","ingredients":{"ember-core":2,"grave-salt":1}},
 "r-rune-tide":{"result":"rune-tide","ingredients":{"frost-essence":2,"herb-moon":1}},
 "r-rune-frost":{"result":"rune-frost","ingredients":{"frost-essence":3}},
 "r-rune-void":{"result":"rune-void","ingredients":{"void-dust":3,"ember-core":1}},
 "r-briar-court-mantle":{"result":"briar-court-mantle","rarity":"uncommon","act":1,"ingredients":{"root-court-seal":1,"root-fiber":2}},
 "r-mourner-signet":{"result":"mourner-signet","rarity":"rare","act":2,"ingredients":{"drowned-lament":1,"grave-salt":2}},
 "r-oathfire-cleaver":{"result":"oathfire-cleaver","rarity":"rare","act":3,"ingredients":{"oathforge-heart":1,"ember-core":2}},
 "r-mirrorweave-cloak":{"result":"mirrorweave-cloak","rarity":"epic","act":4,"ingredients":{"mirror-shard":1,"frost-essence":2}},
 "r-echo-prism-amulet":{"result":"echo-prism-amulet","rarity":"epic","act":5,"ingredients":{"echo-core":1,"void-dust":3}},
 "r5-dragon-blade":{"result":"dragon-blade","rarity":"legendary","act":5,"ingredients":{"ember-core":3,"void-dust":2,"grave-salt":1}},
 "r5-dragon-plate":{"result":"dragon-scale-armor","rarity":"legendary","act":5,"ingredients":{"ember-core":2,"frost-essence":2,"root-fiber":2}},
 "r5-astral-staff":{"result":"astral-staff","rarity":"legendary","act":5,"ingredients":{"void-dust":3,"frost-essence":2,"ember-core":1}}
}
static func current_act(hero: Dictionary) -> int:
 var claimed: Dictionary=hero.get("campaignClaimed",{}) if hero.get("campaignClaimed",{}) is Dictionary else {}
 for mission in CampaignCatalog.all_missions():
  if not bool(claimed.get(str(mission.id),false)):
   var mission_id:=str(mission.get("id","a1-m1"))
   return clampi(int(mission_id.substr(1,1)),1,5)
 return 5
static func buy_item(world: Dictionary,item_id: String) -> Dictionary:
 var hero:=hero_for(world)
 if not SHOP_STOCK.has(item_id): return {"ok":false,"message":"Этот предмет не продаётся у торговца."}
 var item:=CatalogItem.get_item(item_id)
 if item.is_empty() or str(item.get("type",""))=="quest" or bool(item.get("storyShard",false)) or bool(item.get("bossOnly",false)): return {"ok":false,"message":"Предмет нельзя купить."}
 var act:=current_act(hero)
 var multipliers: Array=[1.0,1.2,1.4,1.6,1.8]
 var faction_state: Dictionary=world.get("factions",{}) if world.get("factions",{}) is Dictionary else {}
 var reputation: Dictionary=faction_state.get("reputation",{}) if faction_state.get("reputation",{}) is Dictionary else {}
 var trader_reputation:=clampi(int(reputation.get("free-traders",0)),-100,100)
 var discount:=0.15 if trader_reputation>=90 else 0.10 if trader_reputation>=70 else 0.05 if trader_reputation>=30 else 0.0
 var base_price:=int(item.get("price",0))
 if base_price<=0: return {"ok":false,"message":"У предмета нет цены покупки."}
 var price:=maxi(1,int(round(float(base_price)*multipliers[act-1]*(1.0-discount))))
 var balance:=int(hero.get("gold",0))
 if balance<0 or balance<price: return {"ok":false,"message":"Недостаточно золота: нужно %d." % price}
 if not Combat.add_item(hero,item_id,1): return {"ok":false,"message":"Не удалось добавить предмет."}
 hero["gold"]=balance-price
 world["hero"]=hero
 return {"ok":true,"message":"Куплено: %s за %d золота." % [str(item.name),price],"price":price,"discount":discount}
static func sell_item(world: Dictionary,index: int) -> Dictionary:
 var hero:=hero_for(world)
 var inventory: Array=hero.get("inventory",[])
 if index<0 or index>=inventory.size(): return {"ok":false,"message":"Предмет не найден."}
 var instance: Dictionary=inventory[index]
 var item:=CatalogItem.get_item(str(instance.get("id","")))
 if item.is_empty() or str(item.get("type",""))=="quest" or bool(item.get("storyShard",false)) or bool(item.get("bossOnly",false)): return {"ok":false,"message":"Этот предмет нельзя продать."}
 var raw_qty: Variant=instance.get("qty",1)
 var stackable:=str(item.get("type","")) in ["consumable","material","rune","scroll"]
 var qty:=int(raw_qty) if raw_qty is int and int(raw_qty)>0 else 1
 if stackable and (not raw_qty is int or qty<1): return {"ok":false,"message":"Некорректное количество предмета."}
 if not stackable: qty=1
 var rarity:=str(instance.get("rarity","common"))
 var rarity_prices: Dictionary={"common":10,"uncommon":25,"rare":60,"epic":150,"legendary":400}
 var rarity_multipliers: Dictionary={"common":1.0,"uncommon":1.25,"rare":1.5,"epic":2.2,"legendary":3.5}
 if rarity=="mythic": return {"ok":false,"message":"Мифические предметы нельзя продать торговцу."}
 var base_price:=int(rarity_prices.get(rarity,float(item.get("price",0))*float(rarity_multipliers.get(rarity,1.0))))
 if base_price<=0: return {"ok":false,"message":"У предмета нет цены продажи."}
 var act:=current_act(hero)
 var act_multipliers: Array=[1.0,1.2,1.4,1.6,1.8]
 var unit_price:=maxi(1,int(floor(float(base_price)*act_multipliers[act-1]*0.35)))
 var price:=unit_price*qty
 var balance:=int(hero.get("gold",0))
 var stats: Dictionary=hero.get("stats",{}) if hero.get("stats",{}) is Dictionary else {}
 var earned:=int(stats.get("goldEarned",0))
 if balance<0 or earned<0 or balance>2147483647-price or earned>2147483647-price:
  return {"ok":false,"message":"Операция продажи превысит допустимый баланс золота."}
 var item_name:=str(item.name)
 inventory.remove_at(index)
 hero["inventory"]=inventory
 hero["gold"]=balance+price
 stats["goldEarned"]=earned+price
 hero["stats"]=stats
 world["hero"]=hero
 return {"ok":true,"message":"Продано: %s · +%d золота." % [item_name,price],"price":price}
static func craft(world: Dictionary,recipe_id: String) -> Dictionary:
 var hero:=hero_for(world)
 var recipe: Dictionary=RECIPES.get(recipe_id,{})
 if recipe.is_empty(): return {"ok":false,"message":"Рецепт не найден."}
 if int(recipe.get("act",1))>current_act(hero): return {"ok":false,"message":"Рецепт откроется в акте %d." % int(recipe.act)}
 var result_id := str(recipe.get("result", ""))
 var result_definition := CatalogItem.get_item(result_id)
 if result_definition.is_empty() or str(result_definition.get("type", "")) == "quest" or bool(result_definition.get("storyShard", false)) or bool(result_definition.get("bossOnly", false)):
  return {"ok":false,"message":"Этот предмет нельзя создавать по рецепту."}
 var ingredients: Variant = recipe.get("ingredients", {})
 if not ingredients is Dictionary or ingredients.is_empty(): return {"ok":false,"message":"Рецепт повреждён: нет ингредиентов."}
 for item_id in ingredients:
  var ingredient_id := str(item_id)
  var ingredient_definition := CatalogItem.get_item(ingredient_id)
  var needed := int(ingredients[item_id])
  if ingredient_definition.is_empty() or str(ingredient_definition.get("type", "")) == "quest" or bool(ingredient_definition.get("storyShard", false)) or needed < 1:
   return {"ok":false,"message":"Рецепт содержит недопустимый ингредиент."}
  var have:=0
  for instance in hero.inventory:
   if str(instance.get("id",""))==ingredient_id: have+=int(instance.get("qty",1))
  if have<needed: return {"ok":false,"message":"Не хватает %s: %d/%d." % [str(ingredient_definition.get("name",ingredient_id)),have,needed]}
 var snapshot: Array=hero.inventory.duplicate(true)
 for item_id in ingredients:
  if not Combat.remove_item(hero,str(item_id),int(ingredients[item_id])):
   hero["inventory"]=snapshot
   return {"ok":false,"message":"Не удалось списать ингредиенты; отменено."}
 var rarity := str(recipe.get("rarity", ""))
 if not Combat.add_item(hero,result_id,1,rarity):
  hero["inventory"]=snapshot
  return {"ok":false,"message":"Не удалось создать предмет; ингредиенты возвращены."}
 world["hero"]=hero
 return {"ok":true,"message":"Создано: %s." % str(result_definition.get("name",result_id))}

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
