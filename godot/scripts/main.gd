extends Control

@onready var status_label: Label = $MarginContainer/Content/StatusLabel


func _ready() -> void:
	status_label.text = "Godot-проект запущен. Нативный игровой цикл пока находится в разработке."
