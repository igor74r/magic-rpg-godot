# Import and migration status

- Browser baseline imported from the public upstream repository.
- Current browser baseline passed GitHub Actions CI, including syntax/import checks, 80+ game checks, desktop/mobile browser smoke tests, and gameplay visual regression.
- Latest verified CI commit: `6b95f2ea0992324682e99281f4f3991bd340bc1f`.
- The repository now also contains the first native Godot project scaffold: root `project.godot`, a main scene, a startup script, and an initial isolated JSON save adapter.
- The Godot scaffold is not yet gameplay-complete and does not provide save compatibility parity. Its save adapter accepts only version 18 dictionaries and must not overwrite browser saves.
- Local-only changes from `C:\\Users\\Igor\\Desktop\\magic-rpg-main` have not all been reconciled or overlaid.

## Next steps

1. Validate the Godot project with the target Godot 4.7.x editor/headless runtime.
2. Add fixtures and parity tests for the browser v18 save contract before implementing migrations or writes.
3. Port deterministic world generation, region graph, and state transitions.
4. Add gameplay scenes and UI incrementally while keeping the browser baseline intact.
5. Reconcile remaining local-only source changes separately.
