# Static region connectivity shared with the browser reference data/world.js.
# Mutable discovery and unlocked-route state belongs in each save, not here.
extends RefCounted
class_name WorldGraph


const CONNECTIONS := {
	"village": ["forest", "briar-hollow", "ruins"],
	"forest": ["village", "shadow", "swamp", "briar-hollow"],
	"briar-hollow": ["village", "forest", "swamp"],
	"ruins": ["village", "shadow", "graveyard", "library"],
	"shadow": ["forest", "ruins", "library"],
	"swamp": ["forest", "briar-hollow", "graveyard", "sunken-necropolis"],
	"graveyard": ["ruins", "swamp", "sunken-necropolis", "wasteland"],
	"library": ["ruins", "shadow", "sunken-necropolis", "ice-peaks"],
	"sunken-necropolis": ["swamp", "graveyard", "library", "void-crater"],
	"wasteland": ["graveyard", "volcano", "obsidian-fields"],
	"volcano": ["wasteland", "obsidian-fields"],
	"obsidian-fields": ["wasteland", "volcano", "dragon-lair", "void-crater"],
	"ice-peaks": ["library", "frost-citadel"],
	"frost-citadel": ["ice-peaks", "dragon-lair", "void-crater"],
	"dragon-lair": ["obsidian-fields", "frost-citadel", "void-crater"],
	"void-crater": ["sunken-necropolis", "obsidian-fields", "frost-citadel", "dragon-lair"]
}

const STARTING_REGIONS := ["village"]
const STARTING_ROUTES := [
	["village", "forest"],
	["village", "briar-hollow"],
	["village", "ruins"]
]


static func region_ids() -> Array:
	return CONNECTIONS.keys()


static func neighbors(region_id: String) -> Array:
	return CONNECTIONS.get(region_id, []).duplicate()


static func route_key(from_id: String, to_id: String) -> String:
	var endpoints := [from_id, to_id]
	endpoints.sort()
	return "%s::%s" % [endpoints[0], endpoints[1]]


static func is_route(from_id: String, to_id: String) -> bool:
	return CONNECTIONS.get(from_id, []).has(to_id) \
		and CONNECTIONS.get(to_id, []).has(from_id)


static func reachable_from(start_id: String) -> Array:
	if not CONNECTIONS.has(start_id):
		return []
	var visited := {start_id: true}
	var queue: Array = [start_id]
	while not queue.is_empty():
		var current: String = queue.pop_front()
		for next_id in CONNECTIONS[current]:
			if not visited.has(next_id):
				visited[next_id] = true
				queue.append(next_id)
	return visited.keys()
