# Native Godot 4 project

The browser game at the repository root remains the canonical feature, balance, and content reference. The native Godot project is an active port, not a replacement for the browser implementation and not yet feature-complete.

## Current native implementation

- Root `project.godot` opens the native shell and responsive exploration UI.
- `godot/scripts/world_graph.gd` contains the canonical 16-region bidirectional graph.
- `godot/scripts/world_map_generator.gd` creates deterministic region maps with collision and free-cell rules; the village hub remains a simplified hand-authored layout.
- `godot/scripts/world_state.gd` and `world_state_repository.gd` manage persistent exploration state, discovery, routes, visits, and world events.
- `godot/scripts/world_event_engine.gd` implements deterministic regional event spawning, cooldowns, expiry, accepted kill/elite/boss/discovery/defense objectives, faction reputation and campaign progress, and one-time reward claims.
- `godot/scripts/world_combat_engine.gd` provides native turn-based combat, enemy rewards, item drops, and the Ash Nomad loot modifier; Guardian reputation reduces incoming combat damage.
- `godot/scripts/world_faction_engine.gd` stores bounded faction reputation and exposes trade, damage, loot, and event-gold bonus tiers. The NPC shop applies the Free Traders discount.
- `godot/scripts/world_chronicles_catalog.gd` and the native UI expose the four-chapter chronicle archive, lore factions, and side stories.
- Native progression also includes campaign, daily-quest, passive/talent, Rift, Tower, merchant, and crafting systems in varying degrees of parity.
- `godot/scripts/save_repository.gd` validates native character saves, migrates supported legacy versions through v18, and writes slots atomically with backup recovery. `world_state_repository.gd` persists native exploration state separately.

## Validation

All browser and native validation jobs are defined in the single `.github/workflows/ci.yml` workflow:

- `Verify (syntax + imports + smoke load)` runs the browser checks.
- `Validate native Godot project` imports the project, runs every `tests/godot/*_test.gd` regression script, and smoke-boots the main scene using Godot 4.4.1.

A queued or in-progress run is not a pass. Treat the workflow result for the exact commit SHA as the verification source of truth. Godot runtime tests must not be described as passing until the native CI job completes successfully.

## Remaining parity work

The port is still incomplete. The remaining work requires continued browser/native comparison across legacy-save fixtures and lossless round-tripping, all gameplay paths and edge cases, UI/visual behavior, map and encounter parity, NPC behavior, and campaign/content progression. Existing native catalogs or bonus helpers do not by themselves prove complete behavioral parity.

Do not use the native save adapter as a replacement for browser saves. Preserve the browser implementation and its save format as the compatibility baseline.
