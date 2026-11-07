# Open-world foundation — v18

## Save contract

game.world stores:

- schemaVersion: world-state schema.
- seed: persistent per-save seed.
- generatorVersion: deterministic generation contract.
- worldSeed and worldGeneratorVersion: synchronized compatibility fields for older v18 clients.
- clockMinutes: in-game world clock.
- legacyFastTravel: compatibility flag for migrated saves.
- discoveredRegions: regions the player has reached.
- unlockedRoutes: graph edges revealed by exploration.
- regionVisits: per-region visit counters.
- currentRegionId: last entered region, so loading a save does not consume another visit seed.
- events: active events, cooldowns, history, sequence and next spawn time.

game.world.factionCampaigns stores normalized multi-stage faction contract progress. The Ash Nomad warband chain unlocks at +50: defeat two elite scouts, then defeat their commander; the active stage and completion status survive save/load. game.factions stores standing and reputation change history. Free Traders grant merchant discounts at +30 (5%), +70 (10%) and +90 (15%) reputation; both the displayed shop price and purchase transaction use the same discount. Other factions do not modify merchant prices. player.activeCampaignByBranch stores the active mission per independent story branch.

## Exploration rules

1. A new character starts in Aurora (village).
2. The starting routes lead to Forest, Briar Hollow and the Ruins.
3. A player may travel only along a route unlocked from the current region.
4. Entering a region discovers it and reveals its outgoing routes.
5. Returning through an already opened edge is allowed.
6. Recommended story level is displayed as guidance, not as a hard world-travel lock.
7. Rift and Tower access continue to use their own progression requirements.

## Deterministic generation

The region seed is derived from the save seed, region ID and visit index. The map generator and enemy, chest, NPC and ambient-event spawners accept the same injected random source. Legacy saves receive a stable per-save seed and generator version 1, while legacyFastTravel keeps all regions and routes accessible.

## Persistent events

World events advance with the world clock. Visible events receive deterministic map markers. The player must accept an event before its objective progresses. Combat victories update accepted combat objectives. Hub Guardians can issue an outpost defense event: hold the marked region for three in-game minutes, with the timer pausing while the player is elsewhere; partial defense time survives save/load. Successful Guardian operations lower that region's persistent security threat by one; failed accepted operations raise it by one (0–3). Each threat level adds 5 percentage points to the region's elite spawn chance, capped at 50%; the current region's security status is shown on the world dashboard. Ash Nomad scouts unlock a commander hunt at +50 reputation; the contract requires a true boss victory and grants +12 standing. Regional boss bounties require at least +30 reputation with the Rift Cult and an actual boss victory (elite enemies do not count); their access requirement is stored on the event and shown to the player. They offer a larger gold reward with a faction-standing trade-off. Frontier survey events select a connected, not-yet-discovered region and complete only when the player enters that exact destination; unrelated discoveries do not count. Their target, objective progress and acceptance state survive save/load normalization; invalid non-adjacent targets and out-of-range progress are sanitized. Event cards disclose the faction reputation gain or loss for success and failure before the player commits; claimable cards show the reputation change already applied and the exact faction-adjusted gold amount that will be paid. Completed events apply their faction outcome and remain available for an explicit reward claim. Event acceptance and reward claims are rolled back if persistence fails. Regional boss health, phase, tactical turn count and pending special are checkpointed after each completed enemy turn, on retreat, and on player defeat/resurrection; boss victory remains permanent.

## Migration and NG+

- Every supported legacy schema v1–v17 migrates to v18.
- Migrated saves retain legacy fast travel and all regions/routes to preserve prior access.
- New characters are created directly with the canonical v18 equipment, world, faction and branch structures.
- NG+ preserves the world seed but resets regional discoveries, event state and faction standing.

## Player-facing status UI

The World and Factions dashboard tab displays the four faction standings, reputation ranks and history, active event objectives, claimable event rewards, recent event history, current region, unlocked routes and exploration progress. Faction cards show the next reputation threshold for locked and partially unlocked perks. Perks are calculated from the existing saved reputation: Free Traders grant 5/10/15% merchant discounts, Hub Guardians grant 5/10/15% incoming overworld damage reduction, Ash Nomads grant 5/10/15% ordinary enemy loot-drop chance, and Rift Cult grants 5/10/15% extra gold on its own event claims at reputation +30/+70/+90. No save schema migration is required. Event and save-provided text is escaped before insertion into the UI.

## Verification

- scripts/check-save-migrations.mjs
- scripts/check-world-foundation.mjs
- scripts/check-world-map-navigation.mjs
- scripts/check-world-events-runtime.mjs
- scripts/check-world-exploration.mjs
- scripts/check-portal-world-map.mjs
- scripts/check-story-location-gates.mjs
- scripts/browser-smoke.mjs
- scripts/browser-visual-regression.mjs

### Ash Nomad commander campaign compatibility

The former standalone `ash-nomad-warband` bounty template is no longer part of random event discovery; its boss encounter is now the second stage of the persistent two-stage campaign. Already active or completed events remain self-contained in their saved event records and continue to resolve and award rewards without looking up the removed template.
