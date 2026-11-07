# Combat identity and core stats ported from data/enemies.js.
# Drops and advanced combat specials are intentionally separate follow-up ports.
class_name WorldEnemyCatalog
extends RefCounted

const ENEMIES := {
	"goblin": {"name": "Гоблин", "emoji": "👺", "hp": 40, "attack": 10, "defense": 2, "exp": 25, "gold": 15, "boss": false, "drops": []},
	"skeleton": {"name": "Скелет", "emoji": "💀", "hp": 60, "attack": 15, "defense": 5, "exp": 40, "gold": 25, "boss": false, "drops": ["mana-potion"]},
	"thorn-stalker": {"name": "Шипастый ловчий", "emoji": "🌿", "hp": 68, "attack": 16, "defense": 5, "exp": 58, "gold": 38, "drops": ["health-potion","root-fiber","rune-root"], "boss": false, "special": {"type": "double", "every": 3, "name": "Рваные шипы", "effect": "bleed"}},
	"spore-shaman": {"name": "Грибной шаман", "emoji": "🍄", "hp": 78, "attack": 20, "defense": 4, "exp": 68, "gold": 46, "drops": ["mana-potion","herb-moon","root-fiber"], "boss": false, "special": {"type": "snipe", "every": 3, "mult": 1.6, "name": "Ядовитые споры", "effect": "poison"}},
	"moss-troll": {"name": "Моховой тролль", "emoji": "🪨", "hp": 155, "attack": 25, "defense": 12, "exp": 135, "gold": 105, "drops": ["strong-health-potion"], "boss": false, "special": {"type": "double", "every": 3, "name": "Удар корнями", "effect": "stun"}},
	"rootbound-sentinel": {"name": "Страж корневой печати", "emoji": "🪵", "hp": 118, "attack": 22, "defense": 13, "exp": 105, "gold": 78, "boss": false, "drops": ["root-fiber","rune-root"]},
	"elder-treant": {"name": "Древний энт", "emoji": "🌳", "hp": 330, "attack": 39, "defense": 17, "exp": 480, "gold": 360, "boss": true, "drops": ["mithril-armor","strong-health-potion","rootbound-hood","rune-root"]},
	"root-court-executioner": {"name": "Палач корневого суда", "emoji": "🌲", "hp": 235, "attack": 31, "defense": 14, "exp": 220, "gold": 165, "boss": true, "drops": ["root-court-seal","root-fiber","rune-root","strong-health-potion"]},
	"dark-knight": {"name": "Тёмный рыцарь", "emoji": "🛡️", "hp": 120, "attack": 25, "defense": 10, "exp": 100, "gold": 80, "boss": false, "drops": ["health-potion","iron-sword"]},
	"grave-scout": {"name": "Костяной дозорный", "emoji": "💀", "hp": 82, "attack": 21, "defense": 6, "exp": 72, "gold": 52, "boss": false, "drops": ["mana-potion","grave-salt"]},
	"shadow-mage": {"name": "Теневой маг", "emoji": "🌑", "hp": 90, "attack": 30, "defense": 5, "exp": 120, "gold": 100, "drops": ["mana-potion","apprentice-staff"], "boss": true, "special": {"type": "snipe", "every": 3, "mult": 1.8, "name": "Тёмная стрела", "effect": "burn"}},
	"wolf": {"name": "Волк", "emoji": "🐺", "hp": 55, "attack": 12, "defense": 3, "exp": 35, "gold": 20, "drops": ["health-potion"], "boss": false, "special": {"type": "double", "every": 3, "name": "Двойной укус", "effect": "bleed"}},
	"skeleton-archer": {"name": "Скелет-лучник", "emoji": "🏹", "hp": 70, "attack": 18, "defense": 4, "exp": 55, "gold": 35, "boss": false, "drops": ["mana-potion","leather-armor"]},
	"ghost": {"name": "Призрак", "emoji": "👻", "hp": 65, "attack": 15, "defense": 2, "exp": 50, "gold": 40, "boss": false, "drops": ["mana-potion","apprentice-staff"]},
	"wraith": {"name": "Тень", "emoji": "🌫️", "hp": 80, "attack": 20, "defense": 3, "exp": 70, "gold": 55, "boss": false, "drops": ["mana-potion","strong-mana-potion"]},
	"crypt-hound": {"name": "Гончая склепа", "emoji": "🐺", "hp": 105, "attack": 25, "defense": 7, "exp": 92, "gold": 68, "boss": false, "drops": ["health-potion","grave-salt","rune-tide"]},
	"grave-king": {"name": "Король курганов", "emoji": "☠️", "hp": 180, "attack": 32, "defense": 12, "exp": 200, "gold": 180, "drops": ["steel-sword","strong-health-potion"], "boss": true, "special": {"type": "snipe", "every": 3, "mult": 2.0, "name": "Проклятие кургана", "effect": "bleed"}},
	"flying-tome": {"name": "Летающая книга", "emoji": "📖", "hp": 70, "attack": 18, "defense": 3, "exp": 85, "gold": 70, "boss": false, "drops": ["mana-potion","strong-mana-potion"]},
	"book-guardian": {"name": "Книжный страж", "emoji": "📕", "hp": 130, "attack": 24, "defense": 10, "exp": 130, "gold": 100, "boss": false, "drops": ["strong-mana-potion"]},
	"archmage": {"name": "Архимаг", "emoji": "🧙‍♂️", "hp": 160, "attack": 30, "defense": 8, "exp": 180, "gold": 150, "boss": true, "drops": ["archmage-staff","scroll-lightning","amulet-first-light"]},
	"drowned-scribe": {"name": "Утопленный писец", "emoji": "📜", "hp": 145, "attack": 27, "defense": 8, "exp": 138, "gold": 102, "boss": false, "drops": ["grave-salt","rune-tide"]},
	"bone-colossus": {"name": "Костяной колосс", "emoji": "☠️", "hp": 300, "attack": 37, "defense": 19, "exp": 330, "gold": 260, "boss": true, "drops": ["steel-sword","mithril-armor","gravebinder-gloves","rune-tide"]},
	"bone-tyrant": {"name": "Костяной тиран", "emoji": "👑", "hp": 390, "attack": 43, "defense": 18, "exp": 520, "gold": 420, "boss": true, "drops": ["dragon-scale-armor","archmage-staff","ring-quiet-tide","grave-salt"]},
	"drowned-queen": {"name": "Утопленная плакальщица", "emoji": "👑", "hp": 325, "attack": 40, "defense": 16, "exp": 340, "gold": 275, "boss": true, "drops": ["drowned-lament","grave-salt","rune-tide","strong-mana-potion"]},
	"sand-worm": {"name": "Песчаный червь", "emoji": "🐛", "hp": 95, "attack": 22, "defense": 8, "exp": 95, "gold": 75, "boss": false, "drops": ["strong-health-potion","windstep-boots"]},
	"dust-wraith": {"name": "Песчаный призрак", "emoji": "🌪️", "hp": 75, "attack": 24, "defense": 3, "exp": 100, "gold": 85, "boss": false, "drops": ["mana-potion","strong-mana-potion"]},
	"sand-king": {"name": "Король пустыни", "emoji": "🤴", "hp": 280, "attack": 40, "defense": 12, "exp": 350, "gold": 300, "boss": true, "drops": ["desert-blade","crystal-amulet"]},
	"fire-elemental": {"name": "Огненный элементаль", "emoji": "🔥", "hp": 75, "attack": 22, "defense": 4, "exp": 75, "gold": 60, "boss": false, "drops": ["mana-potion","ember-core","rune-ember"]},
	"magma-golem": {"name": "Магмовый голем", "emoji": "🗿", "hp": 130, "attack": 20, "defense": 15, "exp": 90, "gold": 70, "boss": false, "drops": ["strong-health-potion","ember-core"]},
	"ash-harpy": {"name": "Пепельная гарпия", "emoji": "🦅", "hp": 112, "attack": 28, "defense": 6, "exp": 112, "gold": 92, "boss": false, "drops": ["mana-potion"]},
	"obsidian-guard": {"name": "Обсидиановый страж", "emoji": "🗿", "hp": 170, "attack": 29, "defense": 18, "exp": 148, "gold": 118, "boss": false, "drops": ["mithril-armor"]},
	"flame-lord": {"name": "Пепельный Вестник", "emoji": "🐉", "hp": 220, "attack": 38, "defense": 10, "exp": 250, "gold": 220, "boss": true, "drops": ["mithril-armor","strong-mana-potion","cinder-visor","rune-ember"]},
	"ashbound-renegade": {"name": "Пепельный отступник", "emoji": "⚔️", "hp": 188, "attack": 32, "defense": 12, "exp": 165, "gold": 132, "boss": false, "drops": ["ember-core","rune-ember"]},
	"oath-forge-warden": {"name": "Страж расплавленной клятвы", "emoji": "🔥", "hp": 190, "attack": 34, "defense": 13, "exp": 210, "gold": 175, "boss": true, "drops": ["oathforge-heart","ember-core","rune-ember","strong-health-potion"]},
	"frost-wolf": {"name": "Морозный волк", "emoji": "🐕‍🦺", "hp": 85, "attack": 20, "defense": 5, "exp": 90, "gold": 70, "boss": false, "drops": ["health-potion","frost-essence","rune-frost"]},
	"ice-elemental": {"name": "Ледяной элементаль", "emoji": "🧊", "hp": 100, "attack": 24, "defense": 6, "exp": 100, "gold": 80, "boss": false, "drops": ["mana-potion"]},
	"rime-witch": {"name": "Ведьма инея", "emoji": "🧊", "hp": 118, "attack": 29, "defense": 7, "exp": 125, "gold": 105, "boss": false, "drops": ["strong-mana-potion"]},
	"frost-giant": {"name": "Ледяной великан", "emoji": "❄️", "hp": 235, "attack": 38, "defense": 19, "exp": 220, "gold": 180, "boss": false, "drops": ["frost-armor","strong-health-potion"]},
	"ice-queen": {"name": "Ледяная Хватка", "emoji": "🐉", "hp": 260, "attack": 42, "defense": 14, "exp": 320, "gold": 280, "boss": true, "drops": ["ice-staff","frost-armor","glacier-greaves","pendant-last-oath"]},
	"mirror-revenant": {"name": "Зеркальный мститель", "emoji": "🪞", "hp": 205, "attack": 34, "defense": 14, "exp": 190, "gold": 150, "boss": false, "drops": ["frost-essence","rune-frost"]},
	"mirror-icekeeper": {"name": "Хранитель ледяного зеркала", "emoji": "🪞", "hp": 220, "attack": 39, "defense": 17, "exp": 260, "gold": 215, "boss": true, "drops": ["mirror-shard","frost-essence","rune-frost","strong-mana-potion"]},
	"dragonling": {"name": "Дракончик", "emoji": "🦎", "hp": 100, "attack": 26, "defense": 6, "exp": 130, "gold": 110, "boss": false, "drops": ["health-potion","strong-health-potion","void-dust","rune-void"]},
	"fire-drake": {"name": "Огнедышащий дракон", "emoji": "🐲", "hp": 180, "attack": 34, "defense": 10, "exp": 220, "gold": 180, "boss": false, "drops": ["strong-health-potion","scroll-shield"]},
	"dragon-guardian": {"name": "Дракон-страж", "emoji": "🐉", "hp": 220, "attack": 32, "defense": 15, "exp": 250, "gold": 200, "boss": false, "drops": ["dragon-scale-armor","strong-mana-potion"]},
	"ancient-dragon": {"name": "Кровавая Корона", "emoji": "🐉", "hp": 450, "attack": 52, "defense": 16, "exp": 600, "gold": 600, "drops": ["dragon-blade","dragon-scale-armor","scroll-poison-cloud"], "boss": true, "special": {"type": "drain", "every": 2, "name": "Кровавый пир", "effect": "bleed"}},
	"riftstalker": {"name": "Охотник разлома", "emoji": "🕷️", "hp": 295, "attack": 40, "defense": 13, "exp": 320, "gold": 250, "boss": false, "drops": ["void-dust","rune-void"]},
	"void-harbinger": {"name": "Глашатай Бездны", "emoji": "🕳️", "hp": 340, "attack": 43, "defense": 15, "exp": 420, "gold": 340, "boss": true, "drops": ["crystal-amulet","strong-mana-potion","ring-wolf-eye","rune-void"]},
	"echo-devourer": {"name": "Пожиратель эха", "emoji": "🕳️", "hp": 355, "attack": 47, "defense": 16, "exp": 390, "gold": 315, "boss": true, "drops": ["echo-core","void-dust","rune-void","crystal-amulet"]}
}

static func get_enemy(enemy_id: String) -> Dictionary:
	return ENEMIES.get(enemy_id, {}).duplicate(true)

static func enemy_ids() -> Array:
	return ENEMIES.keys()
