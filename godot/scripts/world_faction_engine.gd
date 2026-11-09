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
	elif value is String:
		numeric = _number_from_string(str(value))
	elif value == null:
		numeric = 0.0
	if not is_finite(numeric):
		return 0
	var bounded := clampf(numeric, float(MIN_REPUTATION), float(MAX_REPUTATION))
	# JavaScript Math.round(-1.5) is -1 (ties move toward +infinity).
	return int(floor(bounded + 0.5))

# Match JavaScript Number(string), including whitespace and radix-prefixed
# integer forms used by legacy browser saves.
static func _number_from_string(value: String) -> float:
	var text := value.strip_edges()
	if text.is_empty():
		return 0.0
	var radix := 0
	if text.begins_with("0x") or text.begins_with("0X"):
		radix = 16
	elif text.begins_with("0b") or text.begins_with("0B"):
		radix = 2
	elif text.begins_with("0o") or text.begins_with("0O"):
		radix = 8
	if radix > 0:
		if text.length() <= 2:
			return NAN
		var result := 0.0
		for index in range(2, text.length()):
			var codepoint := text.unicode_at(index)
			var digit := -1
			if codepoint >= 48 and codepoint <= 57:
				digit = codepoint - 48
			elif codepoint >= 65 and codepoint <= 70:
				digit = codepoint - 55
			elif codepoint >= 97 and codepoint <= 102:
				digit = codepoint - 87
			if digit < 0 or digit >= radix:
				return NAN
			result = result * float(radix) + float(digit)
		return result
	return text.to_float() if text.is_valid_float() else NAN



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
	# Browser normalization spreads the existing faction object before
	# replacing canonical fields. Keep extension fields for lossless import/export.
	var normalized: Dictionary = state.duplicate(true)
	normalized["schemaVersion"] = 1
	normalized["reputation"] = clean
	normalized["changeLog"] = clean_log
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
