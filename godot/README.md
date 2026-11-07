# Native Godot foundation

This directory is the first native Godot 4 project shell. The browser game at the repository root remains the reference implementation and is not replaced.

## Current scope

- Root `project.godot` opens the native shell scene.
- `godot/scenes/main.tscn` provides a minimal responsive Control-based entry screen.
- `godot/scripts/save_repository.gd` is an initial three-slot JSON persistence adapter using `user://`.
- `tests/godot/save_repository_test.gd` checks slot bounds, schema-version rejection, and JSON round-trip behavior.
- `.github/workflows/godot-ci.yml` imports the project, runs the save adapter smoke test, and boots the main scene headlessly with Godot 4.4.1.

## Important compatibility boundary

The browser save format is version 18, but this initial adapter only accepts version 18 dictionaries. It does **not** yet reproduce the browser validator, migrations v1–v18, transactional rollback, item schemas, or world-state invariants. Do not use it to overwrite browser saves.

## Next migration slices

1. Extract and specify the browser v18 JSON contract and fixtures.
2. Port pure data validation and migration tests before enabling writes.
3. Port deterministic world generation and route graph.
4. Add Godot scenes for the village, regions, actors, combat, inventory, and campaign.
5. Compare native behavior against the browser reference.

This is a runnable project scaffold, not gameplay parity or a completed Godot port.
