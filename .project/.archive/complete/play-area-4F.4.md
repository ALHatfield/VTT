# Feature: play-area — Phase 4F.4: Fog of War Toolbar Integration

**Completed:** August 31, 2026
**Feature:** `play-area`

## Deliverables

**client/src/features/play-area/canvas/**

- `CanvasManager.ts` — `ToolMode` union extended: `'select' | 'pan' | 'measure' | 'fog-reveal' | 'fog-hide'`; `setFogRegions` now routes through `ForegroundLayer.setViewMode`
- `ForegroundLayer.ts` — Added `setViewMode(mode: 'dm' | 'player'): void`

**client/src/features/play-area/hooks/**

- `useFogViewMode.ts` — New hook tracking `FogViewMode = 'dm' | 'player'`
- `useFogViewMode.test.ts` — New tests (3)

**client/src/features/play-area/components/**

- `CanvasToolbar.tsx` — Fog tool section added (DM-only): Fog button, Reveal/Hide sub-modes, Player View toggle
- `CanvasToolbar.module.css` — Fog panel styles (divider, sub-mode buttons, view toggle)
- `CanvasToolbar.test.tsx` — New fog tool tests (16 new cases, 24 total)
- `CampaignToolbar.tsx` — Removed fog mode buttons and all fog-related props (`FogToolMode`, `canUseFogTools`, `fogMode`, `onFogModeChange`)
- `PlayAreaToolbar.tsx` + `PlayAreaToolbar.module.css` — **Deleted** (orphaned dead files)

**client/src/features/play-area/**

- `PlayArea.tsx` — Removed `fogMode` state; fog drawing now gated on `activeTool === 'fog-reveal' | 'fog-hide'`; integrated `useFogViewMode`; fog view mode resets to `'dm'` on tool deactivation

## Test Results

```
npx vitest run --project client --project server --project "@vtt/shared"

 Test Files  42 passed (42)
      Tests  589 passed (589)
```

All TypeScript checks clean (`tsc --noEmit` zero errors on all packages).

## Decisions & Insights

- `CanvasManager.setFogRegions` routes through `ForegroundLayer.setViewMode` rather than calling `setObfuscationEnabled` directly, keeping a single public API surface on `ForegroundLayer` for view mode control.
- `fogViewMode` resets to `'dm'` whenever the fog tool is deactivated — avoids DM being stuck in player-perspective fog with no visible indicator.
- Fog tool button toggles: inactive → activates `'fog-reveal'`; active → returns to `'select'`.
- Orphaned `PlayAreaToolbar.tsx` (original top-bar component predating the `CampaignToolbar`/`CanvasToolbar` split) discovered and deleted.

## Dependencies Unlocked

- Phase 4F.5 (NPC Token Placement Tool) — was already unblocked by 4F.3; 4F.4 completes the fog migration prerequisite noted in the toolbar notes
