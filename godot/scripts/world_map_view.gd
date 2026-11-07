class_name WorldMapView
extends Control

signal npc_clicked(npc_id: String)\n\nvar tile_map: Array = []\nvar npc_markers: Array = []\nconst NPC_TILE_SIZE := Vector2(40.0, 30.0)
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

