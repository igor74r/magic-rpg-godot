# Dialogue identities and authentic greetings extracted from data/npcs.js.
class_name WorldNpcCatalog
extends RefCounted
const NPCS := {"blacksmith":{"id":"blacksmith","name":"Кузнец Борин","emoji":"⚒️","greetings":["Клинок тупой? Принеси, наточу.","Быстро и недёшево.","Эх, раньше сталь была лучше..."]},"healer":{"id":"healer","name":"Лекарь Мирра","emoji":"💚","greetings":["Раны глубоки, но свет сильнее.","Полное исцеление — 8 золота.","Не умирай, странник."]},"alchemist":{"id":"alchemist","name":"Алхимик Сайрус","emoji":"⚗️","greetings":["Травы собираешь? Неси, сварю.","Осторожно, не взболтай!","Лунная трава светится в темноте..."]},"merchant":{"id":"merchant","name":"Странствующий торговец","emoji":"🛒","greetings":["Товар редкий, цена честная!","Смотри, не проходи мимо!","Золотишко водится?"]},"elder":{"id":"elder","name":"Старейшина Эдвин","emoji":"👴","greetings":["Осколки ждут тебя, странник.","Прими моё благословение.","Тьма отступит перед светом."]},"well":{"id":"well","name":"Древний колодец","emoji":"⛲","greetings":["Вода чиста и прохладна.","Она восстановит твои силы."]},"bard":{"id":"bard","name":"Бард Лютик","emoji":"🎵","greetings":["Спою тебе о героях!","Скидка для смельчаков!","Монетку — и песня твоя!"]},"guard":{"id":"guard","name":"Стражник","emoji":"🛡️","greetings":["В лесу гоблины, будь осторожен.","В руинах нежить.","Пещера теней — гиблое место."]},"cat":{"id":"cat","name":"Кошка","emoji":"🐈","greetings":["Мяу.","Муррр.","..."]},"kids":{"id":"kids","name":"Дети","emoji":"👦","greetings":["Смотрите, герой!","А ты правда убил дракона?","Дай монетку!"]},"herald":{"id":"herald","name":"Глашатай","emoji":"📢","greetings":["Внемлите новостям!","Элитный гоблин в лесу!","Слухи о сокровищах в Разломе..."]},"questBoard":{"id":"questBoard","name":"Доска объявлений","emoji":"📋","greetings":["Здесь висят задания."]}}
static func ids() -> Array:
	return NPCS.keys()
static func get_npc(npc_id: String) -> Dictionary:
	return NPCS.get(npc_id, {}).duplicate(true)

const MAP_LOCATIONS := {
	"elder": Vector2i(20, 13), "healer": Vector2i(12, 14),
	"well": Vector2i(7, 9), "bard": Vector2i(28, 15),
	"blacksmith": Vector2i(33, 10), "alchemist": Vector2i(10, 22),
	"merchant": Vector2i(30, 22), "guard": Vector2i(20, 4),
	"cat": Vector2i(15, 15), "kids": Vector2i(25, 15),
	"herald": Vector2i(20, 24), "questBoard": Vector2i(17, 15)
}
static func map_locations() -> Dictionary:
	return MAP_LOCATIONS.duplicate(true)
