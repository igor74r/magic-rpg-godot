extends SceneTree

const WorldRng = preload("res://godot/scripts/world_random.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var rng := WorldRng.new(123456)
	var expected := [
		0.38233304349705577,
		0.7972629074938595,
		0.9965302373748273,
		0.16001168475486338,
		0.20857197884470224
	]
	for index in range(expected.size()):
		var actual := rng.next_float()
		if absf(actual - expected[index]) > 0.000000001:
			failures.append("Mulberry32 vector %d differs: %.12f" % [index, actual])

	var unicode_seed := WorldRng.derive_seed(["Hero 😀"])
	if unicode_seed != 2299317654:
		failures.append("FNV-1a seed must hash supplementary Unicode using browser-compatible UTF-16 code units: %d" % unicode_seed)

	var region_seed := WorldRng.derive_region_seed(123456, 1, "forest", 0)
	if region_seed != 3155385942:
		failures.append("forest visit 0 seed differs: %d" % region_seed)
	if WorldRng.derive_region_seed(123456, 1, "forest", 1) == region_seed:
		failures.append("different visit indices must produce different region seeds")

	var first := WorldRng.for_region(123456, 1, "forest", 0)
	var second := WorldRng.for_region(123456, 1, "forest", 0)
	for index in range(8):
		if first.next_float() != second.next_float():
			failures.append("same region seed must reproduce the same sequence")
			break

	var bounded := WorldRng.new(7)
	for index in range(32):
		var value := bounded.next_int(4)
		if value < 0 or value >= 4:
			failures.append("next_int must stay inside its exclusive upper bound")
			break
	if bounded.next_int(0) != 0:
		failures.append("next_int(0) must safely return zero")

	if failures.is_empty():
		print("PASS: browser-compatible FNV-1a region seeds and Mulberry32 sequences")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
