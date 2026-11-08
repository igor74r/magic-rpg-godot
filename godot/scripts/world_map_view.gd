class_name WorldMapView
extends Control

signal npc_clicked(npc_id: String)

var tile_map: Array = []
var npc_markers: Array = []

const TILE_COLORS := {
	0: Color("#66845a"),
	1: Color("#b79a70"),
	2: Color("#55545a"),
	3: Color("#777d82"),
	4: Color("#315b3c")
}

func set_map(value: Array) -> void:
	tile_map = value.duplicate(true)
	queue_redraw()

func set_npcs(value: Array) -> void:
	npc_markers.clear()
	for entry in value:
		if not entry is Dictionary:
			continue
		var npc_id := str(entry.get("id", "")).strip_edges()
		var cell: Variant = entry.get("cell", null)
		if npc_id.is_empty() or not cell is Vector2i:
			continue
		npc_markers.append(entry.duplicate(true))
	queue_redraw()

func _map_width() -> int:
	if tile_map.is_empty() or not tile_map[0] is Array:
		return 0
	return tile_map[0].size()

func _draw() -> void:
	var columns := _map_width()
	if columns == 0 or size.x <= 0.0 or size.y <= 0.0:
		return
	var cell_w := size.x / float(columns)
	var cell_h := size.y / float(tile_map.size())
	for y in range(tile_map.size()):
		if not tile_map[y] is Array:
			continue
		for x in range(mini(columns, tile_map[y].size())):
			var rect := Rect2(x * cell_w, y * cell_h, cell_w + 0.5, cell_h + 0.5)
			draw_rect(rect, TILE_COLORS.get(int(tile_map[y][x]), Color("#66845a")), true)
			draw_rect(rect, Color(0, 0, 0, 0.10), false, 0.5)
	var font := ThemeDB.fallback_font
	for npc in npc_markers:
		var cell: Vector2i = npc["cell"]
		if not _cell_is_inside_map(cell, columns):
			continue
		var center := Vector2((float(cell.x) + 0.5) * cell_w, (float(cell.y) + 0.5) * cell_h)
		draw_circle(center, 9.0, Color("#29251e"))
		draw_circle(center, 7.0, Color("#f1d28a"))
		draw_string(font, center + Vector2(-3.5, 3.5), str(npc.get("emoji", "✦")), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#211b12"))
		draw_string(font, center + Vector2(-22, 19), str(npc.get("short", npc.get("id", ""))), HORIZONTAL_ALIGNMENT_LEFT, 60, 9, Color("#fff4d6"))

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index != MOUSE_BUTTON_LEFT or not event.pressed:
			return
		_activate_npc_at(event.position)
	elif event is InputEventScreenTouch:
		if not event.pressed:
			return
		_activate_npc_at(event.position)


func _activate_npc_at(position: Vector2) -> void:
	var columns := _map_width()
	if columns == 0 or size.x <= 0.0 or size.y <= 0.0:
		return
	var cell_w := size.x / float(columns)
	var cell_h := size.y / float(tile_map.size())
	for npc in npc_markers:
		var cell: Vector2i = npc["cell"]
		if not _cell_is_inside_map(cell, columns):
			continue
		var center := Vector2((float(cell.x) + 0.5) * cell_w, (float(cell.y) + 0.5) * cell_h)
		if position.distance_to(center) <= 15.0:
			npc_clicked.emit(str(npc["id"]))
			accept_event()
			return


func _cell_is_inside_map(cell: Vector2i, columns: int) -> bool:
	return cell.x >= 0 and cell.x < columns and cell.y >= 0 and cell.y < tile_map.size()
