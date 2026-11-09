# Deterministic random primitives ported from systems/world-state.js.
# Keep these algorithms stable: changing them changes generated regions for existing saves.
class_name WorldRandom
extends RefCounted

const UINT32_MASK := 0xffffffff
const UINT32_RANGE := 4294967296.0
const MULBERRY_INCREMENT := 0x6D2B79F5


static func _uint32(value: int) -> int:
	return value & UINT32_MASK


static func _imul(a: int, b: int) -> int:
	# JavaScript Math.imul semantics, without overflowing Godot's signed 64-bit int.
	var a_low := a & 0xffff
	var b_low := b & 0xffff
	var cross := ((a >> 16) & 0xffff) * b_low + a_low * ((b >> 16) & 0xffff)
	return _uint32(a_low * b_low + ((cross & 0xffff) << 16))


static func derive_seed(parts: Array) -> int:
	# Mirrors deriveWorldSeed(): FNV-1a over String(parts).join("|").
	var values := PackedStringArray()
	for part in parts:
		values.append("" if part == null else str(part))
	var input := "|".join(values)
	var hash_value := 2166136261
	# JavaScript charCodeAt() hashes UTF-16 code units, not Unicode scalar
	# values. Iterate the same 16-bit units so supplementary characters (for
	# example emoji in an extension identifier) produce identical seeds.
	var utf16 := input.to_utf16_buffer()
	for byte_offset in range(0, utf16.size(), 2):
		hash_value = _uint32(hash_value ^ utf16.decode_u16(byte_offset))
		hash_value = _imul(hash_value, 16777619)
	return hash_value if hash_value != 0 else 1


static func derive_region_seed(world_seed: int, generator_version: int, region_id: String, visit_index: int = 0) -> int:
	var normalized_world_seed := _uint32(world_seed)
	if normalized_world_seed == 0:
		normalized_world_seed = 1
	return derive_seed([
		normalized_world_seed,
		generator_version,
		region_id,
		maxi(0, visit_index)
	])


static func for_region(world_seed: int, generator_version: int, region_id: String, visit_index: int = 0) -> WorldRandom:
	return WorldRandom.new(derive_region_seed(world_seed, generator_version, region_id, visit_index))


var _state: int


func _init(seed: int = 1) -> void:
	_state = _uint32(seed)
	if _state == 0:
		_state = 1


func next_float() -> float:
	# Mulberry32, kept bit-for-bit compatible with the browser implementation.
	_state = _uint32(_state + MULBERRY_INCREMENT)
	var value := _state
	value = _imul(value ^ (value >> 15), value | 1)
	value = _uint32(value ^ _uint32(value + _imul(value ^ (value >> 7), value | 61)))
	value = _uint32(value ^ (value >> 14))
	return float(value) / UINT32_RANGE


func next_int(max_exclusive: int) -> int:
	if max_exclusive <= 0:
		return 0
	return mini(int(floor(next_float() * float(max_exclusive))), max_exclusive - 1)
