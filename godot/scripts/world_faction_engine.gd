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

static func _normalize_reputation(value: Variant) -> int:
	# Match Number(value) + Math.round() in the browser save normalizer.
	var numeric := 0.0
	if value is bool:
		numeric = 1.0 if value else 0.0
	elif value is int or value is float:
		numeric = float(value)
	elif value is String and str(value).is_valid_float():
		numeric = str(value).to_float()
	elif value == null:
		numeric = 0.0
	if not is_finite(numeric):
		return 0
	var bounded := clampf(numeric, float(MIN_REPUTATION), float(MAX_REPUTATION))
	# JavaScript Math.round(-1.5) is -1 (ties move toward +infinity).
	return int(floor(bounded + 0.5))


static func ensure_state(world: Dictionary) -> Dictionary:
	var state: Variant = world.get("factions", {})
	if not state is Dictionary:
		state = create_state()
	var reputation: Variant = state.get("reputation", {})
	if not reputation is Dictionary:
		reputation = {}
	var clean := {}
	for faction_id in FACTIONS:
		clean[faction_id] = _normalize_reputation(reputation.get(faction_id, 0))
	var log: Variant = state.get("changeLog", [])
	if not log is Array:
		log = []
	# Browser ensureFactionState preserves arbitrary legacy log entries and
	# only trims the history length; keep that lossless behavior here too.
	var clean_log: Array = log.duplicate(true)
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

static func change_reputation(world: Dictionary, faction_id: String, amount: float, reason: String = "unknown", source: String = "system") -> Dictionary:
	# Browser changeFactionReputation accepts any finite numeric delta and
	# rounds the combined reputation with JavaScript Math.round semantics.
	if not FACTIONS.has(faction_id) or not is_finite(amount) or amount == 0.0: return {}
	var state := ensure_state(world)
	var previous := int(state.reputation[faction_id])
	var value := _normalize_reputation(float(previous) + amount)
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
