# Playable class and spell definitions ported from data/classes.js and data/spells.js.
class_name WorldClassCatalog
extends RefCounted

const CLASSES := {
	"warrior": {
		"name": "Воин", "emoji": "⚔️", "maxHp": 170, "maxMp": 100,
		"attack": 22, "defense": 16, "str":18, "int":4, "wis":7, "con":16, "dex":6, "resourceName": "Ярость",
		"combat": {"dodgeChance":0.04,"blockChance":0.16,"blockPower":0.66,"critChance":0.08,"armorPen":2},
		"spells": [], "startingItems": ["iron-sword","tower-shield","health-potion"],
		"abilities": [
			{"id":"charge","name":"Сокрушительный рывок","cost":20,"cooldown":2,"kind":"next_double"},
			{"id":"war-cry","name":"Боевой клич","cost":20,"cooldown":4,"kind":"attack_buff"},
			{"id":"bloodthirst","name":"Кровожадность","cost":30,"cooldown":5,"kind":"lifesteal"},
			{"id":"shield-bash","name":"Щитовой удар","cost":25,"cooldown":3,"kind":"stun"}
		]
	},
	"mage": {
		"name": "Маг", "emoji": "🧙", "maxHp": 105, "maxMp": 180,
		"attack": 12, "defense": 7, "str":4, "int":20, "wis":14, "con":7, "dex":8, "resourceName": "Мана",
		"combat": {"dodgeChance":0.10,"blockChance":0.03,"blockPower":0.40,"critChance":0.12,"armorPen":1},
		"spells": ["fireball","ice-bolt"], "startingItems": ["apprentice-staff","mana-potion","health-potion"],
		"abilities": [
			{"id":"mana-shield","name":"Барьер маны","cost":20,"cooldown":3,"kind":"defense_buff"},
			{"id":"teleport","name":"Скачок сквозь эфир","cost":25,"cooldown":4,"kind":"dodge"},
			{"id":"meteor","name":"Метеор","cost":45,"cooldown":5,"kind":"meteor"},
			{"id":"frost-nova","name":"Ледяная нова","cost":32,"cooldown":4,"kind":"stun"}
		]
	},
	"archer": {
		"name": "Лучник", "emoji": "🏹", "maxHp": 125, "maxMp": 100,
		"attack": 20, "defense": 10, "str":12, "int":7, "wis":9, "con":10, "dex":18, "resourceName": "Концентрация",
		"combat": {"dodgeChance":0.20,"blockChance":0.06,"blockPower":0.42,"critChance":0.18,"armorPen":3},
		"spells": ["poison-arrow"], "startingItems": ["hunter-bow","leather-armor","health-potion"],
		"abilities": [
			{"id":"aimed-shot","name":"Меткий выстрел","cost":20,"cooldown":2,"kind":"critical"},
			{"id":"evasion","name":"Уклонение","cost":15,"cooldown":3,"kind":"dodge"},
			{"id":"toxic-blade","name":"Ядовитый наконечник","cost":20,"cooldown":3,"kind":"poison_strike"},
			{"id":"piercing-shot","name":"Пробивающий выстрел","cost":28,"cooldown":3,"kind":"pierce"}
		]
	},
	"priest": {
		"name": "Жрец", "emoji": "✨", "maxHp": 115, "maxMp": 160,
		"attack": 6, "defense": 5, "str":6, "int":15, "wis":18, "con":10, "dex":7, "resourceName": "Мана",
		"combat": {"dodgeChance":0.08,"blockChance":0.05,"blockPower":0.45,"critChance":0.08,"armorPen":0},
		"spells": ["heal","holy-light"], "startingItems": [],
		"abilities": [
			{"id":"prayer","name":"Молитва","cost":25,"cooldown":3,"kind":"prayer"},
			{"id":"sanctify","name":"Освящение","cost":20,"cooldown":3,"kind":"sanctify"},
			{"id":"resurrection","name":"Воскрешение","cost":0,"cooldown":0,"kind":"passive","passive":true}
		]
	}
}

const SPELLS := {
	"fireball":{"name":"Огненный шар","cost":15,"damage":25,"element":"fire","effect":"burn"},
	"ice-bolt":{"name":"Ледяная стрела","cost":12,"damage":25,"element":"ice","effect":"slow"},
	"lightning":{"name":"Молния","cost":25,"damage":45,"element":"lightning"},
	"poison-cloud":{"name":"Ядовитый туман","cost":20,"damage":15,"effect":"poison"},
	"poison-arrow":{"name":"Ядовитая стрела","cost":10,"damage":15,"effect":"poison"},
	"holy-light":{"name":"Святой свет","cost":18,"damage":25},
	"heal":{"name":"Исцеление","cost":20,"heal":60},
	"shield":{"name":"Щит","cost":15,"selfEffect":"defBuff"},
	"sacrifice":{"name":"Жертва","cost":0,"selfDamagePct":0.2,"restoreMp":50},
	"arcane-surge":{"name":"Арканный импульс","cost":30,"damage":55},
	"frost-nova":{"name":"Ледяная нова","cost":26,"damage":34,"element":"ice","effect":"stun"},
	"radiant-aegis":{"name":"Эгида рассвета","cost":24,"selfEffect":"defBuff"},
	"shadow-lance":{"name":"Копьё тени","cost":36,"damage":68,"effect":"bleed"},
	"renewal":{"name":"Возобновление","cost":32,"heal":95}
}

static func class_ids() -> Array:
	var ids: Array = CLASSES.keys()
	ids.erase("priest")
	return ids

static func get_class_definition(class_id: String) -> Dictionary:
	return CLASSES.get(class_id, CLASSES.warrior).duplicate(true)

static func get_spell(spell_id: String) -> Dictionary:
	return SPELLS.get(spell_id, {}).duplicate(true)
