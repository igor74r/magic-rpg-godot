extends SceneTree

const Campaign = preload("res://godot/scripts/world_campaign_engine.gd")
const Catalog = preload("res://godot/scripts/world_campaign_catalog.gd")


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var failures: Array[String] = []
	var hero: Dictionary = {"level": 1}

	var first_region := Campaign.can_enter_location(hero, "briar-hollow")
	if not bool(first_region.get("allowed", false)):
		failures.append("the first story region must be available to a new level-1 hero")

	var forest_locked := Campaign.can_enter_location(hero, "forest")
	if bool(forest_locked.get("allowed", true)) or str(forest_locked.get("reason", "")) != "level":
		failures.append("forest must require its authored level before the first mission is claimed")

	hero["level"] = 3
	forest_locked = Campaign.can_enter_location(hero, "forest")
	if bool(forest_locked.get("allowed", true)) or str(forest_locked.get("reason", "")) != "campaign":
		failures.append("forest must remain locked until the preceding campaign mission is claimed")
	if str(forest_locked.get("requiredMissionId", "")) != "a1-m1":
		failures.append("forest must identify a1-m1 as its preceding mission")

	# Only a literal true may unlock the next story location.
	var claimed: Dictionary = {"a1-m1": "yes"}
	hero["campaignClaimed"] = claimed
	forest_locked = Campaign.can_enter_location(hero, "forest")
	if bool(forest_locked.get("allowed", true)):
		failures.append("malformed truthy campaign state must not unlock a story region")

	hero["campaignClaimed"] = {"a1-m1": true}
	var forest_open := Campaign.can_enter_location(hero, "forest")
	if not bool(forest_open.get("allowed", false)):
		failures.append("forest must unlock after level and preceding mission requirements are met")

	var unknown_region := Campaign.can_enter_location(hero, "village")
	if not bool(unknown_region.get("allowed", false)):
		failures.append("non-story locations must remain unrestricted by story progression")

	var progression: Array = Campaign.story_location_progression()
	if progression.is_empty() or str(progression[0].get("id", "")) != "briar-hollow":
		failures.append("story progression must begin with the first authored campaign location")
	if progression.size() < 2 or str(progression[1].get("unlockAfterMissionId", "")) != "a1-m1":
		failures.append("the second distinct story region must depend on the first mission")

	if Catalog.all_missions().size() != 25:
		failures.append("the native campaign catalog must contain all 25 browser story missions")

	if failures.is_empty():
		print("PASS: campaign mission ordering, strict claims, level gates and story-region unlocks")
		quit(0)
	else:
		for failure in failures:
			push_error(failure)
		quit(1)
