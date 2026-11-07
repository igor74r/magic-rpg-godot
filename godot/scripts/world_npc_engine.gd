# Native NPC service actions and dialogue state.
class_name WorldNpcEngine
extends RefCounted
const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Combat = preload("res://godot/scripts/world_combat_engine.gd")
const Catalog = preload("res://godot/scripts/world_npc_catalog.gd")
const CatalogItem = preload("res://godot/scripts/world_item_catalog.gd")
static func talk(npc_id: String) -> Dictionary:
	var npc := Catalog.get_npc(npc_id)
	if npc.is_empty(): return {"ok":false,"message":"Персонаж не найден."}
	var greetings: Array=npc.get("greetings",[])
	var greeting:=str(greetings[0]) if not greetings.is_empty() else "..."
	return {"ok":true,"npc":npc,"message":"%s\n«%s»" % [str(npc.name),greeting]}
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
 for mission in Campaign.MISSIONS:
  if not bool(claimed.get(str(mission.id),false)): return clampi(int(mission.get("act",1)),1,5)
 return 5
static func buy_item(world: Dictionary,item_id: String) -> Dictionary:
 var hero:=hero_for(world)
 if not SHOP_STOCK.has(item_id): return {"ok":false,"message":"Этот предмет не продаётся у торговца."}
 var item:=CatalogItem.get_item(item_id)
 if item.is_empty() or str(item.get("type",""))=="quest" or bool(item.get("storyShard",false)) or bool(item.get("bossOnly",false)): return {"ok":false,"message":"Предмет нельзя купить."}
 var act:=current_act(hero)
 var multipliers: Array=[1.0,1.2,1.4,1.6,1.8]
 var price:=maxi(1,int(round(float(item.get("price",0))*multipliers[act-1])))
 if int(item.get("price",0))<=0 or int(hero.get("gold",0))<price: return {"ok":false,"message":"Недостаточно золота: нужно %d." % price}
 if not Combat.add_item(hero,item_id,1): return {"ok":false,"message":"Не удалось добавить предмет."}
 hero["gold"]=int(hero.gold)-price
 world["hero"]=hero
 return {"ok":true,"message":"Куплено: %s за %d золота." % [str(item.name),price],"price":price}
static func sell_item(world: Dictionary,index: int) -> Dictionary:
 var hero:=hero_for(world)
 var inventory: Array=hero.get("inventory",[])
 if index<0 or index>=inventory.size(): return {"ok":false,"message":"Предмет не найден."}
 var instance: Dictionary=inventory[index]
 var item:=CatalogItem.get_item(str(instance.get("id","")))
 if item.is_empty() or str(item.get("type",""))=="quest" or bool(item.get("storyShard",false)) or bool(item.get("bossOnly",false)): return {"ok":false,"message":"Этот предмет нельзя продать."}
 var qty:=int(instance.get("qty",1))
 var price:=maxi(1,int(floor(float(item.get("price",0))*0.35)))*qty
 if int(item.get("price",0))<=0: return {"ok":false,"message":"У предмета нет цены продажи."}
 var item_name:=str(item.name)
 inventory.remove_at(index)
 hero["inventory"]=inventory
 hero["gold"]=mini(2147483647,int(hero.get("gold",0))+price)
 world["hero"]=hero
 return {"ok":true,"message":"Продано: %s · +%d золота." % [item_name,price],"price":price}
static func craft(world: Dictionary,recipe_id: String) -> Dictionary:
 var hero:=hero_for(world)
 var recipe: Dictionary=RECIPES.get(recipe_id,{})
 if recipe.is_empty(): return {"ok":false,"message":"Рецепт не найден."}
 if int(recipe.get("act",1))>current_act(hero): return {"ok":false,"message":"Рецепт откроется в акте %d." % int(recipe.act)}
 for item_id in recipe.ingredients:
  var needed:=int(recipe.ingredients[item_id])
  var have:=0
  for instance in hero.inventory:
   if str(instance.get("id",""))==str(item_id): have+=int(instance.get("qty",1))
  if have<needed: return {"ok":false,"message":"Не хватает %s: %d/%d." % [str(CatalogItem.get_item(str(item_id)).get("name",item_id)),have,needed]}
 var snapshot: Array=hero.inventory.duplicate(true)
 for item_id in recipe.ingredients:
  if not Combat.remove_item(hero,str(item_id),int(recipe.ingredients[item_id])):
   hero["inventory"]=snapshot
   return {"ok":false,"message":"Не удалось списать ингредиенты; отменено."}
 if not Combat.add_item(hero,str(recipe.result),1):
  hero["inventory"]=snapshot
  return {"ok":false,"message":"Не удалось создать предмет; ингредиенты возвращены."}
 world["hero"]=hero
 return {"ok":true,"message":"Создано: %s." % str(CatalogItem.get_item(str(recipe.result)).get("name",recipe.result))}
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
