# Data-driven region encounter catalog ported from data/locations.js.
# Enemy IDs and ordering are kept intact; combat stats remain in browser data/enemies.js.
class_name WorldRegionCatalog
extends RefCounted

const REGIONS := {
	"village": {
		"name": "Деревня Аврора",
		"safe": true,
		"chestsCount": 0,
		"enemies": []
	},
	"forest": {
		"name": "Тёмный лес",
		"safe": false,
		"chestsCount": -1,
		"enemies": ["goblin", "goblin", "skeleton", "thorn-stalker"]
	},
	"briar-hollow": {
		"name": "Глухая чаща",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["thorn-stalker", "spore-shaman", "moss-troll", "rootbound-sentinel", "goblin", "elder-treant", "root-court-executioner"]
	},
	"ruins": {
		"name": "Руины павшего храма",
		"safe": false,
		"chestsCount": -1,
		"enemies": ["skeleton", "skeleton", "dark-knight", "grave-scout"]
	},
	"shadow": {
		"name": "Пещера теней",
		"safe": false,
		"chestsCount": -1,
		"enemies": ["dark-knight", "shadow-mage"]
	},
	"swamp": {
		"name": "Кровавая топь",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["wolf", "skeleton-archer", "ghost", "spore-shaman"]
	},
	"graveyard": {
		"name": "Проклятое кладбище",
		"safe": false,
		"chestsCount": 4,
		"enemies": ["skeleton", "skeleton-archer", "ghost", "wraith", "grave-scout", "crypt-hound", "grave-king"]
	},
	"library": {
		"name": "Забытая библиотека",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["flying-tome", "book-guardian", "archmage"]
	},
	"sunken-necropolis": {
		"name": "Затонувший некрополь",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["grave-scout", "crypt-hound", "drowned-scribe", "bone-colossus", "grave-king", "bone-tyrant", "drowned-queen"]
	},
	"wasteland": {
		"name": "Пустошь",
		"safe": false,
		"chestsCount": 4,
		"enemies": ["sand-worm", "dust-wraith", "sand-worm", "sand-king"]
	},
	"volcano": {
		"name": "Огненный разлом",
		"safe": false,
		"chestsCount": 4,
		"enemies": ["fire-elemental", "magma-golem", "ash-harpy", "obsidian-guard", "flame-lord"]
	},
	"obsidian-fields": {
		"name": "Обсидиановые поля",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["fire-elemental", "ash-harpy", "ashbound-renegade", "obsidian-guard", "magma-golem", "flame-lord", "oath-forge-warden"]
	},
	"ice-peaks": {
		"name": "Ледяные пики",
		"safe": false,
		"chestsCount": 4,
		"enemies": ["frost-wolf", "ice-elemental", "rime-witch", "frost-giant", "ice-queen"]
	},
	"frost-citadel": {
		"name": "Крепость вечного льда",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["frost-wolf", "rime-witch", "mirror-revenant", "ice-elemental", "frost-giant", "ice-queen", "mirror-icekeeper"]
	},
	"dragon-lair": {
		"name": "Логово дракона",
		"safe": false,
		"chestsCount": 5,
		"enemies": ["dragonling", "fire-drake", "dragon-guardian", "ancient-dragon"]
	},
	"void-crater": {
		"name": "Кратер Бездны",
		"safe": false,
		"chestsCount": 6,
		"enemies": ["dragonling", "fire-drake", "dragon-guardian", "riftstalker", "void-harbinger", "ancient-dragon", "echo-devourer"]
	}
}


static func region_ids() -> Array:
	return REGIONS.keys()


static func get_region(region_id: String) -> Dictionary:
	if not REGIONS.has(region_id):
		return {}
	return REGIONS[region_id].duplicate(true)


static func enemy_roster(region_id: String) -> Array:
	return get_region(region_id).get("enemies", [])


static func is_safe(region_id: String) -> bool:
	return bool(get_region(region_id).get("safe", false))
