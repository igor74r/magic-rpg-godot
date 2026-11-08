# Reputation and faction bonuses ported from systems/factions.js.
class_name WorldFactionEngine
extends RefCounted

const MIN_REPUTATION := -100
const MAX_REPUTATION := 100
const LOG_LIMIT := 50
const FACTIONS := {
	"hub-guardians":{"id":"hub-guardians","name":"Стражи Хаба","symbol":"🛡️","description":"Защищают поселения и путников."},
	"rift-cult":{"id":"rift-cult","name":"Культисты Разлома","symbol":"🌀","description":"Изучают силу разломов и их события."},
	"free-traders":{"id":"free-traders","name":"Вольные торговцы","symbol":"💰","description":"Вознаграждают надёжных союзников скидками."},
	"ash-nomads":{"id":"ash-nomads","name":"Пепельные кочевники","symbol":"🔥","description":"Делятся тайнами добычи и выживания."}
}

static func create_state() -> Dictionary:
	var reputation := {}
	for faction_id in FACTIONS:
		reputation[faction_id] = 0
	return {"schemaVersion":1,"reputation":reputation,"changeLog":[]}

static func ensure_state(world: Dictionary) -> Dictionary:
	var state: Variant = world.get("factions", {})
	if not state is Dictionary:
		state = create_state()
	var reputation: Variant = state.get("reputation", {})
	if not reputation is Dictionary:
		reputation = {}
	var clean := {}
	for faction_id in FACTIONS:
		clean[faction_id] = clampi(int(reputation.get(faction_id, 0)), MIN_REPUTATION, MAX_REPUTATION)
	var log: Variant = state.get("changeLog", [])
	if not log is Array:
		log = []
	var clean_log: Array = []
	for entry in log:
		if entry is Dictionary and FACTIONS.has(str(entry.get("factionId", ""))):
			clean_log.append(entry.duplicate(true))
	if clean_log.size() > LOG_LIMIT:
		clean_log = clean_log.slice(clean_log.size() - LOG_LIMIT)
	var normalized := {"schemaVersion":1,"reputation":clean,"changeLog":clean_log}
	world["factions"] = normalized
	return normalized

static func get_rank(value: int) -> String:
	var reputation := clampi(value, MIN_REPUTATION, MAX_REPUTATION)
	if reputation <= -75: return "враждебность"
	if reputation <= -30: return "настороженность"
	if reputation < 30: return "нейтралитет"
	if reputation < 70: return "дружба"
	if reputation < 90: return "почёт"
	return "союз"

static func get_reputation(world: Dictionary, faction_id: String) -> int:
	if not FACTIONS.has(faction_id): return 0
	return int(ensure_state(world).reputation.get(faction_id, 0))

static func change_reputation(world: Dictionary, faction_id: String, amount: int, reason: String = "unknown", source: String = "system") -> Dictionary:
	if not FACTIONS.has(faction_id) or amount == 0: return {}
	var state := ensure_state(world)
	var previous := int(state.reputation[faction_id])
	var value := clampi(previous + amount, MIN_REPUTATION, MAX_REPUTATION)
	var delta := value - previous
	if delta != 0:
		state.reputation[faction_id] = value
		state.changeLog.append({"factionId":faction_id,"delta":delta,"value":value,"reason":reason.left(160),"source":source.left(40)})
		if state.changeLog.size() > LOG_LIMIT:
			state.changeLog = state.changeLog.slice(state.changeLog.size() - LOG_LIMIT)
	return {"factionId":faction_id,"previous":previous,"value":value,"delta":delta,"rank":get_rank(value)}

static func _tier_bonus(reputation: int) -> float:
	if reputation >= 90: return 0.15
	if reputation >= 70: return 0.10
	if reputation >= 30: return 0.05
	return 0.0

static func get_trade_discount(world: Dictionary) -> float:
	return _tier_bonus(get_reputation(world, "free-traders"))

static func get_damage_reduction(world: Dictionary) -> float:
	return _tier_bonus(get_reputation(world, "hub-guardians"))

static func get_loot_bonus(world: Dictionary) -> float:
	return _tier_bonus(get_reputation(world, "ash-nomads"))

static func get_event_gold_bonus(world: Dictionary, faction_id: String) -> float:
	return _tier_bonus(get_reputation(world, faction_id)) if faction_id == "rift-cult" else 0.0
