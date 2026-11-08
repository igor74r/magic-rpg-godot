extends SceneTree
const Catalog = preload("res://godot/scripts/world_chronicles_catalog.gd")
func _initialize() -> void:
	if not Catalog.validate_catalog():
		push_error("chronicles must preserve four chapters, twelve entries, three lore factions and five side stories")
		quit(1)
		return
	var entries := 0
	for chapter in Catalog.CHAPTERS: entries += chapter.entries.size()
	if entries != 12 or str(Catalog.TITLE) != "Хроники Расколотой Зари":
		push_error("chronicles catalog content is incomplete")
		quit(1)
		return
	print("PASS: chronicles narrative catalog and complete archive structure")
	quit(0)
