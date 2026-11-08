# Godot port parity audit — 2026-11-09

## Scope and baseline

- Repository: `igor74r/magic-rpg-godot`
- Audited branch: `main`
- Audited commit: `acc6dfef010b5c6f411902dce8e1962fd391a607`
- Method: read-only inspection of the GitHub tree, migration notes, project configuration, browser save contract, native GDScript implementation, native tests, and CI workflow.
- Engine/configuration constraint: **no Godot version, container image, project setting, renderer, import setting, or export setting was changed.**
- Runtime limitation: GitHub Actions jobs for this SHA are queued; no current runtime test result can be inferred from this static audit.

## Verified repository inventory

| Area | Count / fact |
|---|---:|
| Browser runtime systems | 41 JavaScript files |
| Browser data modules | 13 JavaScript files |
| Browser UI modules | 24 JavaScript files |
| Browser validation scripts | 75 `scripts/check-*.mjs` |
| Additional smoke/browser scripts | 5 |
| Native Godot scripts | 28 GDScript files |
| Native Godot regression tests | 21 `tests/godot/*_test.gd` |
| Native scene files | 1 main scene |
| Project configuration files | root `project.godot` |

The browser implementation remains the canonical feature/content baseline. The Godot runtime is substantial and contains world, map, encounter, combat, save, faction, event, campaign, NPC, passive, daily-quest, achievement, Rift, Tower, and chronicles modules. It is nevertheless not feature-complete.

## Confirmed findings

### P0 — CI has not verified the current source

The workflow `.github/workflows/ci.yml` has two validation jobs:
- Browser verification: JavaScript syntax, imports, 75 check scripts, smoke checks, Playwright desktop/mobile, and visual regression.
- Native Godot verification: project import, every native `*_test.gd`, and main-scene boot.

The native job uses container image `barichello/godot-ci:4.4.1`. The current main run for the audited SHA is queued, not successful. Therefore neither browser nor Godot CI can currently be reported as passing for this SHA.

### P0 — Version documentation is inconsistent

- `IMPORT_STATUS.md` names Godot 4.7.x as the target.
- `ARCHITECTURE_AUDIT.md` and parts of `PROJECT_CONTEXT.md` also describe a 4.7.x target.
- The active CI workflow explicitly runs Godot 4.4.1.
- `project.godot` has `config_version=5`; this is the project-file format marker and does not, by itself, establish the Godot engine version.

This is a documentation/configuration provenance conflict, not proof that either engine version is correct. It must be resolved from the project's actual approved target before changing anything. Per the task constraint, this audit makes no engine-version changes.

### Implemented during this audit — integral-float schema version parity

A concrete browser/Godot contract mismatch was found and fixed on this audit branch:
- JavaScript `Number.isSafeInteger(18.0)` accepts the value because JavaScript has one numeric type.
- Godot's JSON parser may represent JSON `18.0` as a float, while the native browser-v18 validator previously required the concrete `int` Variant type.
- The validator now uses the existing safe-integer predicate and still requires the exact schema value 18.
- A regression case was added to `tests/godot/save_repository_test.gd`.

This is a narrow compatibility fix, not proof of complete save round-trip parity. Runtime execution remains pending CI.

### P0 — Save compatibility needs end-to-end parity proof

Verified implementation:
- Browser save schema is v18; `systems/save.js` contains sequential migrations through v18 and validates current saves.
- Native `SaveRepository` supports migration logic for browser legacy versions and normalizes v18 payloads.
- Browser payload import/export has an explicit v18 validator.
- Native world state is stored separately at `user://shards_world_state.json`; native character slots use `user://shards_slot_%d.json`.
- Imported browser payloads are retained in `_browserSourcePayload` so browser-only fields can be carried through native export.

Remaining proof required:
- Fixture-based browser → Godot → browser round-trip for real v1–v18 shapes, including unknown fields and optional/null values.
- Field-by-field diff of the exported JSON against the expected browser contract.
- Crash/recovery tests covering primary, temporary, and backup files, and failed import/export writes.
- Verification that every gameplay mutation updates the authoritative native fields and that the preserved source snapshot cannot overwrite newer native state on export.

The existing save tests are broad, but they do not replace a complete cross-runtime fixture matrix.

### P1 — Native presentation is still a compact runtime shell

The only native scene file is `godot/scenes/main.tscn`. It is a Control-based shell with a scrollable content area; `godot/scripts/main.gd` constructs most gameplay UI dynamically. This is a real interactive native foundation, not evidence of visual parity with the browser game.

Visual parity remains explicitly listed as incomplete in `GODOT_MIGRATION_STATUS.md` and `godot/README.md`. Desktop, tablet, narrow mobile, touch, keyboard navigation, focus, and accessibility behavior need comparative checks against the browser version.

### P1 — Gameplay parity is broader than module presence

Native modules and tests exist for many systems, but a matching filename/catalog is not proof of equivalent gameplay. The repository's own migration status and this source review identify remaining work in:
- complete legacy-save compatibility and lossless round-trip;
- chronicles interaction parity: the native runtime renders the complete catalog as text, while browser chronicles use structured article/card markup; interaction and responsive presentation have not been compared end to end;
- visual/UI parity;
- paired scenario coverage for NPC dialogue/services, map navigation, encounter lifecycle, and campaign/content progression.

**Correction to the earlier broad audit wording:** faction bonus functions are not merely present as unused helpers. Source inspection confirms their integration into the native runtime: Free Trader discounts are applied in NPC merchant purchase/sale pricing, Guardian damage reduction is applied to incoming combat damage, Ash Nomad loot bonus is included in encounter drop probability, and Rift Cult bonus is applied to eligible world-event gold rewards. Dedicated faction and encounter tests cover these paths. This source-level wiring is verified; final runtime confirmation still depends on the queued Godot CI job.

These remaining areas need paired browser/Godot fixtures and scenario-level comparisons, not just isolated native unit tests.

### P1 — Browser baseline must remain intact

The root browser implementation contains the canonical data and behavior and must remain runnable during the port. No browser files, save schema, or project configuration were changed by this audit.

## Prioritized continuation

1. Restore a runnable CI signal for the exact source SHA; then inspect actual job logs rather than treating queued/cancelled runs as test failures.
2. Build a cross-runtime save fixture matrix and round-trip comparator before making save-format changes.
3. Compare the 16-region graph, deterministic generation, route unlocks, encounters, and region persistence against browser fixtures.
4. Compare combat formulas and all class actions, including statuses, mitigation, rewards, drops, death/revival, and boss phases.
5. Compare inventory/equipment/runes, crafting queues, merchant stock, buyback, NPC services, faction bonuses, daily quests, achievements, campaign, Rift, Tower, and chronicles.
6. Run visual and interaction parity checks at desktop and mobile sizes.
7. Fix only demonstrated mismatches, add regression tests, and rerun both CI jobs on the resulting exact SHA.

## Explicitly untouched

- Godot engine version and CI container version.
- `project.godot` settings and renderer.
- Import/export settings.
- Existing game logic and save data.
- Existing PRs and merge state.

## Verification statement

This is a static GitHub source audit. No Godot or browser runtime tests were executed by this audit because the current GitHub Actions run for `acc6dfef010b5c6f411902dce8e1962fd391a607` is queued. Do not interpret this document as a passing CI result or a claim of feature completion.
