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
	tile_map = value
	queue_redraw()

func set_npcs(value: Array) -> void:
	npc_markers = value.duplicate(true)
	queue_redraw()

func _draw() -> void:
	if tile_map.is_empty() or tile_map[0].is_empty():
		return
	var cell_w := size.x / float(tile_map[0].size())
	var cell_h := size.y / float(tile_map.size())
	for y in range(tile_map.size()):
		for x in range(tile_map[y].size()):
			var rect := Rect2(x * cell_w, y * cell_h, cell_w + 0.5, cell_h + 0.5)
			draw_rect(rect, TILE_COLORS.get(int(tile_map[y][x]), Color("#66845a")), true)
			draw_rect(rect, Color(0, 0, 0, 0.10), false, 0.5)
	var font := ThemeDB.fallback_font
	for npc in npc_markers:
		var cell: Vector2i = npc.get("cell", Vector2i.ZERO)
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
	if tile_map.is_empty() or tile_map[0].is_empty():
		return
	var cell_w := size.x / float(tile_map[0].size())
	var cell_h := size.y / float(tile_map.size())
	for npc in npc_markers:
		var cell: Vector2i = npc.get("cell", Vector2i.ZERO)
		var center := Vector2((float(cell.x) + 0.5) * cell_w, (float(cell.y) + 0.5) * cell_h)
		if position.distance_to(center) <= 15.0:
			npc_clicked.emit(str(npc.get("id", "")))
			accept_event()
			return
