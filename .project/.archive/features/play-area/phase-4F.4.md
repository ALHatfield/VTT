# Archived Phase 4F.4: Fog of War Toolbar Integration

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-08-31

---

## Phase 4F.4: Fog of War Toolbar Integration

**Dependencies:** Phase 4F.3

### Overview

Migrates existing fog-of-war controls from the campaign toolbar into the new canvas toolbar system. No new fog behavior — this is a refactor to consolidate all canvas tools in one place.

### Tasks

- [x] Add `'fog-reveal'` and `'fog-hide'` to tool mode union type in `useToolMode`
- [x] Migrate fog drawing from `CampaignToolbar` buttons into `CanvasToolbar` fog tool section
- [x] Fog tool activates with sub-mode selector: Reveal / Hide (replaces old `fogMode` state)
- [x] Existing fog pointer handlers remain intact, gated behind `activeTool === 'fog-reveal' | 'fog-hide'`
- [x] Add fog vision toggle (dm/player view) in the fog tool's expanded panel
- [x] Add `useFogViewMode` hook tracking `'dm' | 'player'` view state
- [x] `ForegroundLayer.setViewMode(mode)` changes fog alpha: semi-transparent for DM, fully opaque for player view
- [x] Remove fog mode buttons from `CampaignToolbar` (cleanup)
- [x] Tests: fog drawing works identically to pre-refactor behavior, `ForegroundLayer.setViewMode` changes fog alpha correctly

### Decisions

- This is a migration/refactor — no new fog behavior, just relocating controls into the toolbar system
- Fog tool is DM-only
- `CanvasManager.setFogRegions` routes through `ForegroundLayer.setViewMode` for consistent internal API
- `fogViewMode` resets to `'dm'` when the fog tool is deactivated to avoid DM being stuck in player view
- Deleted orphaned `PlayAreaToolbar.tsx` and `PlayAreaToolbar.module.css` (dead files discovered during migration)

---


