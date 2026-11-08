extends SceneTree

const Catalog = preload("res://godot/scripts/world_chronicles_catalog.gd")


func _initialize() -> void:
	if not Catalog.validate_catalog():
		push_error("chronicles must contain complete, non-empty and uniquely identified archive records")
		quit(1)
		return

	var expected_ids := ["I", "II", "III", "IV"]
	var entries := 0
	for index in range(Catalog.CHAPTERS.size()):
		var chapter: Dictionary = Catalog.CHAPTERS[index]
		if str(chapter.id) != expected_ids[index]:
			push_error("chronicle chapter order or identifier changed")
			quit(1)
			return
		for entry in chapter.entries:
			if str(entry.title).is_empty() or str(entry.text).is_empty():
				push_error("chronicle entry must retain its title and narrative")
				quit(1)
				return
			entries += 1

	if entries != 12 or Catalog.LORE_FACTIONS.size() != 3 or Catalog.SIDE_STORIES.size() != 5:
		push_error("chronicles must preserve twelve entries, three lore factions and five side stories")
		quit(1)
		return

	if str(Catalog.TITLE) != "Хроники Расколотой Зари" or str(Catalog.SUBTITLE) != "Архив мира, который старше Кристалла":
		push_error("chronicles archive heading changed unexpectedly")
		quit(1)
		return
	if str(Catalog.NOTE) != "Эти записи дополняют основную историю. Они не меняют вступительный пролог и открывают более древнюю сторону мира.":
		push_error("chronicles archive note changed unexpectedly")
		quit(1)
		return

	print("PASS: complete chronicles catalog, chapter order, entries, factions and side stories")
	quit(0)
