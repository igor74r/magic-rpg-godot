# Godot migration status

The browser game remains the canonical feature and content baseline. The repository also contains an active native Godot 4 project under `godot/`, with its own scenes, gameplay engines, data catalogs, save repository, and automated native tests under `tests/godot/`.

The native port is **in progress, not feature-complete**. Camp crafting now mirrors the browser order lifecycle: queued jobs persist with millisecond `readyAt` timestamps, ready rewards are claimed at the alchemist/blacksmith, and inventory-capacity failures leave orders pending. Recent work has hardened save validation and progression for the Rift and Tower, and expanded native encounter/combat parity. The browser implementation must remain intact while remaining feature, save-schema, combat, map, UI, and rendering parity is audited.

Use the GitHub Actions workflows as the verification source of truth. Do not describe native tests or deployment as passing until the corresponding workflow run has completed successfully.
