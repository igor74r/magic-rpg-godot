# Import and migration status

- The browser game remains the canonical feature and content baseline.
- The repository contains an active native Godot project under `godot/`, with gameplay engines, data catalogs, scenes, save handling, and native regression tests under `tests/godot/`.
- The native port is in progress and is not feature-complete. See [GODOT_MIGRATION_STATUS.md](GODOT_MIGRATION_STATUS.md).
- Browser validation and native Godot validation are defined in the unified `.github/workflows/ci.yml` workflow.
- The browser save contract is schema v18. The native `SaveRepository` contains legacy migration and v18 normalization paths, plus explicit browser-v18 validation/import/export handling. Full cross-runtime fixture-based round-trip parity remains an open verification requirement.
- Migration notes name Godot 4.7.x as the intended target, while the current CI container is pinned to `barichello/godot-ci:4.4.1`. This is an unresolved documentation/toolchain provenance mismatch. **Do not change the Godot engine version, CI image, project settings, renderer, or import/export configuration as part of routine parity work.** Resolve the intended toolchain explicitly before any such change.

## Verification status

- A previous browser-baseline CI success is recorded at `6b95f2ea0992324682e99281f4f3991bd340bc1f`; it is not evidence that the current native port passes.
- The current main revision must be verified by the matching GitHub Actions run. Queued, cancelled, or missing runs are not successful validation.
- Native project import, all native regression scripts, main-scene boot, browser checks, and visual regression must be reported only from completed workflow results for the exact commit SHA.

## Remaining parity work

1. Add and run browser-to-Godot-to-browser fixtures for representative save schema versions and edge cases, comparing exported fields losslessly.
2. Compare deterministic world generation, region graph, route unlocks, encounters, and persistence against browser fixtures.
3. Compare combat formulas, class actions, status effects, rewards, drops, death/revival, and boss phases.
4. Verify inventory/equipment/runes, crafting, merchant stock and buyback, NPC services, faction bonuses, daily quests, achievements, campaign, Rift, Tower, and chronicles.
5. Complete desktop/mobile visual and interaction parity checks while preserving the browser baseline.

Do not describe the port as complete until the remaining parity requirements and the relevant CI jobs have been verified successfully.
