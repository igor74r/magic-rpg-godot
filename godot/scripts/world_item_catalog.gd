# Native item definitions extracted from data/items.js. Dynamic JS callbacks are represented by explicit native item effects.
class_name WorldItemCatalog
extends RefCounted

const ITEMS := {
	"mana-potion": {
		"name": "Зелье маны",
		"icon": "🔵",
		"desc": "Восстанавливает 50 маны.",
		"type": "consumable",
		"price": 8
	},
	"health-potion": {
		"name": "Зелье здоровья",
		"icon": "🔴",
		"desc": "Восстанавливает 80 здоровья.",
		"type": "consumable",
		"price": 10
	},
	"strong-health-potion": {
		"name": "Большое зелье здоровья",
		"icon": "💗",
		"desc": "Восстанавливает 200 здоровья.",
		"type": "consumable",
		"price": 22
	},
	"strong-mana-potion": {
		"name": "Большое зелье маны",
		"icon": "💙",
		"desc": "Восстанавливает 120 маны.",
		"type": "consumable",
		"price": 20
	},
	"antidote": {
		"name": "Антидот",
		"icon": "🧪",
		"desc": "Снимает отравление, ожог и кровотечение. Только в бою.",
		"type": "consumable",
		"effect": "antidote",
		"price": 12,
		"combatOnly": true
	},
	"strength-elixir": {
		"name": "Эликсир силы",
		"icon": "💪",
		"desc": "+5 к атаке на 3 хода. Только в бою.",
		"type": "consumable",
		"effect": "strength",
		"price": 22,
		"combatOnly": true
	},
	"mana-elixir": {
		"name": "Эликсир маны",
		"icon": "💧",
		"desc": "Мана не тратится 2 хода. Только в бою.",
		"type": "consumable",
		"effect": "manaShield",
		"price": 24,
		"combatOnly": true
	},
	"iron-sword": {
		"name": "Железный меч",
		"icon": "🗡️",
		"desc": "+8 к атаке.",
		"type": "weapon",
		"price": 45,
		"bonus": {
			"attack": 8
		}
	},
	"steel-sword": {
		"name": "Стальной меч",
		"icon": "⚔️",
		"desc": "+14 к атаке.",
		"type": "weapon",
		"price": 95,
		"bonus": {
			"attack": 14
		}
	},
	"apprentice-staff": {
		"name": "Посох ученика",
		"icon": "🪄",
		"desc": "+5 к магии.",
		"type": "weapon",
		"price": 48,
		"bonus": {
			"magic": 5
		}
	},
	"hunter-bow": {
		"name": "Лук следопыта",
		"icon": "🏹",
		"desc": "+9 к атаке, +2 к ловкости и +3% к критическому шансу.",
		"type": "weapon",
		"price": 58,
		"bonus": {
			"attack": 9,
			"dex": 2,
			"critChance": 0.03,
			"armorPen": 1
		}
	},
	"leather-armor": {
		"name": "Кожаная броня",
		"icon": "🥋",
		"desc": "+5 к защите.",
		"type": "chest",
		"price": 40,
		"bonus": {
			"defense": 5,
			"dodgeChance": 0.02
		}
	},
	"mithril-armor": {
		"name": "Мифриловая броня",
		"icon": "🛡️",
		"desc": "+12 к защите.",
		"type": "chest",
		"price": 105,
		"bonus": {
			"defense": 12,
			"blockChance": 0.04,
			"blockPower": 0.05
		}
	},
	"tower-shield": {
		"name": "Башенный щит",
		"icon": "🛡️",
		"desc": "+8 к защите, +12% к шансу блока и +15% к силе блока.",
		"type": "shield",
		"price": 85,
		"bonus": {
			"defense": 8,
			"blockChance": 0.12,
			"blockPower": 0.15
		}
	},
	"ranger-cloak": {
		"name": "Плащ следопыта",
		"icon": "🧥",
		"desc": "+4 к защите, +4 к ловкости и +6% к уклонению.",
		"type": "cloak",
		"price": 75,
		"bonus": {
			"defense": 4,
			"dex": 4,
			"dodgeChance": 0.06
		}
	},
	"ice-staff": {
		"name": "Ледяной посох",
		"icon": "❄️",
		"desc": "+10 к магии. Дыхание зимы.",
		"type": "weapon",
		"price": 130,
		"bonus": {
			"magic": 10
		}
	},
	"frost-armor": {
		"name": "Морозная броня",
		"icon": "🧥",
		"desc": "+14 к защите. Покрыта инеем.",
		"type": "chest",
		"price": 120,
		"bonus": {
			"defense": 14,
			"blockPower": 0.04
		}
	},
	"desert-blade": {
		"name": "Клинок пустыни",
		"icon": "🌵",
		"desc": "+18 к атаке. Закалён в песках.",
		"type": "weapon",
		"price": 160,
		"bonus": {
			"attack": 18,
			"armorPen": 2
		}
	},
	"crystal-amulet": {
		"name": "Амулет кристалла",
		"icon": "🔮",
		"desc": "+8 к магии и +5 к защите. Древняя реликвия.",
		"type": "amulet",
		"price": 150,
		"bonus": {
			"magic": 8,
			"defense": 5
		}
	},
	"archmage-staff": {
		"name": "Посох архимага",
		"icon": "🌟",
		"desc": "+15 к магии. Шепчет забытые истины.",
		"type": "weapon",
		"price": 190,
		"bonus": {
			"magic": 15,
			"critChance": 0.04
		}
	},
	"dragon-scale-armor": {
		"name": "Драконья броня",
		"icon": "🐲",
		"desc": "+20 к защите. Не боится пламени.",
		"type": "chest",
		"price": 220,
		"bonus": {
			"defense": 20,
			"blockPower": 0.08
		}
	},
	"dragon-blade": {
		"name": "Драконий клинок",
		"icon": "⚡",
		"desc": "+25 к атаке. Легендарное оружие.",
		"type": "weapon",
		"price": 260,
		"bonus": {
			"attack": 25,
			"armorPen": 4
		}
	},
	"scroll-lightning": {
		"name": "Свиток: Молния",
		"icon": "📜",
		"desc": "Изучить заклинание «Молния» (45 урона).",
		"type": "scroll",
		"spellId": "lightning",
		"price": 75
	},
	"scroll-poison-cloud": {
		"name": "Свиток: Ядовитый туман",
		"icon": "📜",
		"desc": "Изучить заклинание «Ядовитый туман» (урон + яд).",
		"type": "scroll",
		"spellId": "poison-cloud",
		"price": 70
	},
	"scroll-shield": {
		"name": "Свиток: Щит",
		"icon": "📜",
		"desc": "Изучить заклинание «Щит» (+50% защиты на 2 хода).",
		"type": "scroll",
		"spellId": "shield",
		"price": 55
	},
	"herb-life": {
		"name": "Корень жизни",
		"icon": "🌿",
		"desc": "Трава для алхимии. Основа целебных зелий.",
		"type": "material",
		"price": 2
	},
	"herb-moon": {
		"name": "Лунная трава",
		"icon": "🌙",
		"desc": "Серебристая трава, светится в темноте.",
		"type": "material",
		"price": 3
	},
	"old-archive-seal": {
		"name": "Печать старого архива",
		"icon": "🔖",
		"desc": "Старая архивная метка из прежних времён. Не является осколком Кристалла Разлома.",
		"type": "quest",
		"price": 0
	},
	"greater-health-potion": {
		"name": "Эликсир возрождения",
		"icon": "🧪",
		"desc": "Восстанавливает 360 здоровья.",
		"type": "consumable",
		"price": 35
	},
	"greater-mana-potion": {
		"name": "Сгусток маны",
		"icon": "🔷",
		"desc": "Восстанавливает 220 маны.",
		"type": "consumable",
		"price": 30
	},
	"moonsteel-spear": {
		"name": "Лунно-стальное копьё",
		"icon": "🔱",
		"desc": "+21 к атаке. Лёгкое оружие дозорных ледяных перевалов.",
		"type": "weapon",
		"price": 170,
		"bonus": {
			"attack": 21
		}
	},
	"rune-sword": {
		"name": "Меч семи печатей",
		"icon": "🗡️",
		"desc": "+27 к атаке. Руны удерживают в клинке эхо древней клятвы.",
		"type": "weapon",
		"price": 230,
		"bonus": {
			"attack": 27
		}
	},
	"astral-staff": {
		"name": "Астральный посох",
		"icon": "🌌",
		"desc": "+25 к магии. Сердцевина собрана из осколков звёздного стекла.",
		"type": "weapon",
		"price": 220,
		"bonus": {
			"magic": 25
		}
	},
	"warden-plate": {
		"name": "Латы Стеклянного Щита",
		"icon": "🛡️",
		"desc": "+24 к защите. Тяжёлая броня древнего ордена.",
		"type": "chest",
		"price": 210,
		"bonus": {
			"defense": 24
		}
	},
	"void-robe": {
		"name": "Мантия тихой пустоты",
		"icon": "🥋",
		"desc": "+16 к защите и +7 к магии. Ткань не отражает свет.",
		"type": "chest",
		"price": 195,
		"bonus": {
			"defense": 16,
			"magic": 7
		}
	},
	"scroll-frost-nova": {
		"name": "Свиток: Ледяная nova",
		"icon": "📜",
		"desc": "Изучить заклинание «Ледяная nova».",
		"type": "scroll",
		"spellId": "frost-nova",
		"price": 90
	},
	"scroll-shadow-lance": {
		"name": "Свиток: Копьё тени",
		"icon": "📜",
		"desc": "Изучить заклинание «Копьё тени».",
		"type": "scroll",
		"spellId": "shadow-lance",
		"price": 110
	},
	"scroll-arcane-surge": {
		"name": "Свиток: Арканный импульс",
		"icon": "📜",
		"desc": "Изучить заклинание «Арканный импульс».",
		"type": "scroll",
		"spellId": "arcane-surge",
		"price": 100
	},
	"scroll-radiant-aegis": {
		"name": "Свиток: Эгида рассвета",
		"icon": "📜",
		"desc": "Изучить заклинание «Эгида рассвета».",
		"type": "scroll",
		"spellId": "radiant-aegis",
		"price": 85
	},
	"scroll-renewal": {
		"name": "Свиток: Возобновление",
		"icon": "📜",
		"desc": "Изучить заклинание «Возобновление».",
		"type": "scroll",
		"spellId": "renewal",
		"price": 95
	},
	"rootbound-hood": {
		"name": "Капюшон живого корня",
		"icon": "🌿",
		"desc": "+4 к защите, +1 к ловкости и +2% к уклонению. В гнезде можно закрепить руну.",
		"type": "head",
		"price": 48,
		"sockets": 1,
		"bonus": {
			"defense": 4,
			"dex": 1,
			"dodgeChance": 0.02
		}
	},
	"cinder-visor": {
		"name": "Визор пепельного дозора",
		"icon": "🔥",
		"desc": "+6 к защите и +2% к критическому шансу.",
		"type": "head",
		"price": 70,
		"sockets": 1,
		"bonus": {
			"defense": 6,
			"critChance": 0.02
		}
	},
	"duelist-grips": {
		"name": "Перчатки точного удара",
		"icon": "🥊",
		"desc": "+3 к атаке и +3% к критическому шансу.",
		"type": "gloves",
		"price": 55,
		"sockets": 1,
		"bonus": {
			"attack": 3,
			"critChance": 0.03
		}
	},
	"gravebinder-gloves": {
		"name": "Перчатки хранителя праха",
		"icon": "🧤",
		"desc": "+4 к магии и +2% к силе блока.",
		"type": "gloves",
		"price": 58,
		"sockets": 1,
		"bonus": {
			"magic": 4,
			"blockPower": 0.02
		}
	},
	"windstep-boots": {
		"name": "Сапоги быстрого следа",
		"icon": "👢",
		"desc": "+3 к защите, +3 к ловкости и +5% к уклонению.",
		"type": "boots",
		"price": 65,
		"sockets": 1,
		"bonus": {
			"defense": 3,
			"dex": 3,
			"dodgeChance": 0.05
		}
	},
	"glacier-greaves": {
		"name": "Поножи ледяной стражи",
		"icon": "🥾",
		"desc": "+7 к защите и +3% к шансу блока.",
		"type": "legs",
		"price": 72,
		"sockets": 1,
		"bonus": {
			"defense": 7,
			"blockChance": 0.03
		}
	},
	"amulet-first-light": {
		"name": "Амулет первого света",
		"icon": "☀️",
		"desc": "+4 к магии и +2% к критическому шансу.",
		"type": "amulet",
		"price": 80,
		"sockets": 1,
		"bonus": {
			"magic": 4,
			"critChance": 0.02
		}
	},
	"pendant-last-oath": {
		"name": "Подвеска последней клятвы",
		"icon": "🔶",
		"desc": "+5 к защите и +4% к шансу блока.",
		"type": "amulet",
		"price": 85,
		"sockets": 1,
		"bonus": {
			"defense": 5,
			"blockChance": 0.04
		}
	},
	"ring-wolf-eye": {
		"name": "Кольцо волчьего глаза",
		"icon": "💍",
		"desc": "+2 к атаке и +4% к критическому шансу.",
		"type": "ring",
		"price": 60,
		"sockets": 1,
		"bonus": {
			"attack": 2,
			"critChance": 0.04
		}
	},
	"ring-quiet-tide": {
		"name": "Кольцо тихого прилива",
		"icon": "🌊",
		"desc": "+3 к магии и +2% к уклонению.",
		"type": "ring",
		"price": 65,
		"sockets": 1,
		"bonus": {
			"magic": 3,
			"dodgeChance": 0.02
		}
	},
	"rune-root": {
		"name": "Руна корня",
		"icon": "ᛉ",
		"desc": "Руна для свободного гнезда: +2 к защите и +1% к уклонению.",
		"type": "rune",
		"price": 20,
		"runeBonus": {
			"defense": 2,
			"dodgeChance": 0.01
		}
	},
	"rune-ember": {
		"name": "Руна угля",
		"icon": "ᚱ",
		"desc": "Руна для свободного гнезда: +3 к атаке и +1% к критическому шансу.",
		"type": "rune",
		"price": 25,
		"runeBonus": {
			"attack": 3,
			"critChance": 0.01
		}
	},
	"rune-tide": {
		"name": "Руна прилива",
		"icon": "ᛟ",
		"desc": "Руна для свободного гнезда: +3 к магии и +2% к силе блока.",
		"type": "rune",
		"price": 25,
		"runeBonus": {
			"magic": 3,
			"blockPower": 0.02
		}
	},
	"rune-frost": {
		"name": "Руна инея",
		"icon": "ᚠ",
		"desc": "Руна для свободного гнезда: +3 к защите и +2% к шансу блока.",
		"type": "rune",
		"price": 28,
		"runeBonus": {
			"defense": 3,
			"blockChance": 0.02
		}
	},
	"rune-void": {
		"name": "Руна безмолвия",
		"icon": "ᛞ",
		"desc": "Руна для свободного гнезда: +3 к магии, +1 к пробитию брони и +1% к криту.",
		"type": "rune",
		"price": 35,
		"runeBonus": {
			"magic": 3,
			"armorPen": 1,
			"critChance": 0.01
		}
	},
	"root-fiber": {
		"name": "Волокно живого корня",
		"icon": "🌱",
		"desc": "Плотное волокно из Глухой чащи. Используется в ремесле.",
		"type": "material",
		"price": 3
	},
	"grave-salt": {
		"name": "Соль последней памяти",
		"icon": "🧂",
		"desc": "Кристаллизованная соль из затонувшего архива.",
		"type": "material",
		"price": 4
	},
	"ember-core": {
		"name": "Сердечник магмы",
		"icon": "🔸",
		"desc": "Остывшее ядро обсидианового голема.",
		"type": "material",
		"price": 5
	},
	"frost-essence": {
		"name": "Эссенция вечного инея",
		"icon": "❄️",
		"desc": "Ледяная эссенция, не тающая даже в кузнице.",
		"type": "material",
		"price": 6
	},
	"void-dust": {
		"name": "Пыль разлома",
		"icon": "🌀",
		"desc": "След Бездны, оставшийся после закрытия малой трещины.",
		"type": "material",
		"price": 8
	},
	"restorative-potion": {
		"name": "Восстанавливающее зелье",
		"icon": "🧴",
		"desc": "Восстанавливает 140 здоровья и 60 маны.",
		"type": "consumable",
		"price": 28
	},
	"briar-shoulders": {
		"name": "Наплечье живой чащи",
		"icon": "🌳",
		"desc": "+5 к защите и +2% к уклонению. Лёгкие пластины из корневого дерева.",
		"type": "shoulders",
		"price": 50,
		"sockets": 1,
		"bonus": {
			"defense": 5,
			"dodgeChance": 0.02
		}
	},
	"obsidian-mantle": {
		"name": "Мантия чёрного стекла",
		"icon": "🧥",
		"desc": "+7 к защите и +3 к магии. На ткани проступают знаки пяти орденов.",
		"type": "cloak",
		"price": 95,
		"sockets": 1,
		"bonus": {
			"defense": 7,
			"magic": 3
		}
	},
	"oath-bracers": {
		"name": "Наручи последней клятвы",
		"icon": "🔗",
		"desc": "+4 к защите, +2 к атаке и +2% к силе блока.",
		"type": "gloves",
		"price": 75,
		"sockets": 1,
		"bonus": {
			"defense": 4,
			"attack": 2,
			"blockPower": 0.02
		}
	},
	"seal-five-orders": {
		"name": "Печать пяти орденов",
		"icon": "🔰",
		"desc": "Реликвия пяти хранителей. +5 к магии, +4 к защите и +2% к критическому шансу.",
		"type": "amulet",
		"price": 140,
		"sockets": 1,
		"bonus": {
			"magic": 5,
			"defense": 4,
			"critChance": 0.02
		}
	},
	"shard-flame": {
		"name": "Осколок Пламени",
		"icon": "🔥",
		"desc": "Сюжетный осколок Пепельного Вестника. Нельзя продать или использовать в ремесле.",
		"type": "quest",
		"price": 0
	},
	"shard-ice": {
		"name": "Осколок Льда",
		"icon": "❄️",
		"desc": "Сюжетный осколок Ледяной Хватки. Нельзя продать или использовать в ремесле.",
		"type": "quest",
		"price": 0
	},
	"shard-blood": {
		"name": "Осколок Крови",
		"icon": "🩸",
		"desc": "Сюжетный осколок Кровавой Короны. Нельзя продать или использовать в ремесле.",
		"type": "quest",
		"price": 0
	},
	"root-court-seal": {
		"name": "Печать корневого суда",
		"icon": "🌿",
		"desc": "Трофей Палача корневого суда. Основа для реликвии живой чащи.",
		"type": "material",
		"price": 24
	},
	"drowned-lament": {
		"name": "Слеза утопленной плакальщицы",
		"icon": "💧",
		"desc": "Трофей плакальщицы. Внутри слышна песнь затонувшего некрополя.",
		"type": "material",
		"price": 38
	},
	"oathforge-heart": {
		"name": "Сердце расплавленной клятвы",
		"icon": "🔥",
		"desc": "Трофей стража кузницы. Ещё хранит жар древних рун.",
		"type": "material",
		"price": 52
	},
	"mirror-shard": {
		"name": "Осколок ледяного зеркала",
		"icon": "🪞",
		"desc": "Трофей хранителя. Отражает не лицо, а боевые намерения.",
		"type": "material",
		"price": 68
	},
	"echo-core": {
		"name": "Ядро пожирателя эха",
		"icon": "🔮",
		"desc": "Трофей Пожирателя эха. Удерживает силу исчезающих голосов.",
		"type": "material",
		"price": 90
	},
	"briar-court-mantle": {
		"name": "Мантия корневого суда",
		"icon": "🍃",
		"desc": "+8 к защите и +3% к уклонению. Создана из печати древнего лесного закона.",
		"type": "shoulders",
		"price": 105,
		"sockets": 1,
		"bonus": {
			"defense": 8,
			"dodgeChance": 0.03
		}
	},
	"mourner-signet": {
		"name": "Перстень плакальщицы",
		"icon": "💧",
		"desc": "+6 к магии и +3 к защите. Хранит тихую песнь глубин.",
		"type": "ring",
		"price": 145,
		"sockets": 1,
		"bonus": {
			"magic": 6,
			"defense": 3
		}
	},
	"oathfire-cleaver": {
		"name": "Секатор расплавленной клятвы",
		"icon": "🔥",
		"desc": "+17 к атаке и +2 к пробиванию брони. Закалён сердцем древней кузницы.",
		"type": "weapon",
		"price": 190,
		"sockets": 1,
		"bonus": {
			"attack": 17,
			"armorPen": 2
		}
	},
	"mirrorweave-cloak": {
		"name": "Плащ зеркального инея",
		"icon": "🪞",
		"desc": "+13 к защите и +4 к ловкости. Ткань отражает ледяные проклятия.",
		"type": "cloak",
		"price": 220,
		"sockets": 1,
		"bonus": {
			"defense": 13,
			"dex": 4
		}
	},
	"echo-prism-amulet": {
		"name": "Амулет эха",
		"icon": "🔮",
		"desc": "+11 к магии, +7 к защите и +3% к критическому шансу. Сила безмолвной Бездны.",
		"type": "amulet",
		"price": 280,
		"sockets": 1,
		"bonus": {
			"magic": 11,
			"defense": 7,
			"critChance": 0.03
		}
	}
}

const EQUIPMENT_SLOTS := ["weapon","head","shoulders","chest","gloves","legs","boots","shield","ring1","ring2","amulet","cloak"]
const SLOT_TYPES := {
	"weapon":["weapon"],"head":["head","helmet"],"shoulders":["shoulders"],
	"chest":["chest","armor"],"gloves":["gloves","bracers","wrists"],
	"legs":["legs","greaves"],"boots":["boots"],"shield":["shield","offhand"],
	"ring1":["ring"],"ring2":["ring"],"amulet":["amulet","seal"],"cloak":["cloak","back"]
}

static func get_item(item_id: String) -> Dictionary:
	return ITEMS.get(item_id, {}).duplicate(true)

static func is_equipment(item_id: String) -> bool:
	var item: Dictionary = ITEMS.get(item_id, {})
	for slot in SLOT_TYPES.values():
		if slot.has(str(item.get("type", ""))):
			return true
	return false
