# Native Godot foundation

This directory is the first native Godot 4 project shell. The browser game at the repository root remains the reference implementation and is not replaced.

## Current scope

- Root `project.godot` opens the native shell scene.
- `godot/scenes/main.tscn` provides a minimal responsive Control-based entry screen.
- `godot/scripts/save_repository.gd` is an initial three-slot JSON persistence adapter using `user://`.
- `godot/scripts/world_graph.gd` ports the canonical 16-region, bidirectional world graph from the browser reference.
- `tests/godot/save_repository_test.gd` checks slot bounds, schema-version rejection, and JSON round-trip behavior.
- `tests/godot/world_graph_test.gd` checks region count, route symmetry, starting exits, and graph connectivity.
- `.github/workflows/godot-ci.yml` imports the project, runs both headless data tests, and boots the main scene with Godot 4.4.1.

## Important compatibility boundary

The browser save format is version 18, but the initial adapter only accepts version 18 dictionaries. It does **not** yet reproduce the browser validator, migrations v1–v18, transactional rollback, item schemas, or world-state invariants. The world graph is static reference data only; per-save discovery, unlocked routes, region visits, events, and procedural generation have not yet been ported. Do not use this adapter to overwrite browser saves.

## Next migration slices

1. Extract and specify the browser v18 JSON contract and fixtures.
2. Port save validation and migration tests before enabling writes.
3. Port deterministic world seeds and region generation.
4. Port per-save discovery, route unlocking, and persistent region state.
5. Add Godot scenes for the village, regions, actors, combat, inventory, and campaign.
6. Compare native behavior against the browser reference.

This is a growing native foundation, not gameplay parity or a completed Godot port.
