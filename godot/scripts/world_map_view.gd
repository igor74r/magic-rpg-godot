class_name WorldMapView
extends Control

var tile_map: Array = []
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
