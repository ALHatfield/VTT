# Feature: play-area — Phase 4F.5: NPC Token Placement Tool

**Completed:** August 31, 2026
**Feature:** `play-area`

## Deliverables

**New — client**

- `client/src/features/play-area/hooks/useNpcDrop.ts` — Canvas-side drag-over + drop handlers; converts drop coordinates to grid cells via `screenToWorld`, calls `createToken` with `type: 'npc'` and resolved subtype
- `client/src/features/play-area/hooks/useNpcDrop.test.ts` — 10 tests (drag-over guards, drop coordinate conversion, null canvasManager, invalid subtype, rejection logging)

**Modified — client**

- `client/src/features/play-area/canvas/CanvasManager.ts` — `ToolMode` union extended: `'select' | 'pan' | 'measure' | 'fog-reveal' | 'fog-hide' | 'npc-place'`
- `client/src/features/play-area/components/CanvasToolbar.tsx` — NPC tool button (DM-only) with toggle behaviour; Ally/Enemy drag source items rendered when `npc-place` is active; inline `dragstart` handlers set `application/vtt-npc-subtype` MIME type
- `client/src/features/play-area/components/CanvasToolbar.module.css` — `.npcPanel`, `.npcDragItem`, `.npcDragItemAlly` (green), `.npcDragItemEnemy` (red) styles
- `client/src/features/play-area/components/CanvasToolbar.test.tsx` — 10 new NPC toolbar tests (34 total); covers DM-only visibility, toggle, panel render, drag start payload for ally and enemy
- `client/src/features/play-area/PlayArea.tsx` — Integrated `useNpcDrop`; `handleCombinedDragOver` / `handleCombinedDrop` merge tile and NPC handlers on the canvas div

## Test Results

```
npx vitest run --project client --project server --project "@vtt/shared"

 Test Files  43 passed (43)
      Tests  609 passed (609)
```

New tests added this phase: 20 (useNpcDrop × 10, CanvasToolbar NPC section × 10)

## Decisions & Insights

- **`useNpcDrop` owns canvas-side only:** Drag-start is defined inline in `CanvasToolbar` (simple `setData` call, no external state). Canvas-side drag-over/drop live in `useNpcDrop` for testability via `renderHook`.
- **Combined canvas drag handler:** `handleCombinedDragOver` / `handleCombinedDrop` call the tile handler and the NPC handler in sequence. Each guards on its own MIME type (`application/vtt-asset` vs `application/vtt-npc-subtype`) and active mode, so they cannot interfere.
- **`Math.round` for grid snapping:** Uses `Math.round(world.x / cellSize)` (snap to nearest cell), matching the `onTilePlaced` playground-asset token path in `PlayArea.tsx`. `Math.floor` was flagged in code review and corrected.
- **`DEFAULT_NPC_SIZE = 1` constant:** Magic number `1` extracted to a named local constant per coding standards.
- **Accessibility:** Drag source `<div>` elements have `role="button"` and `aria-label` in addition to `title` so screen readers can identify them as interactive.
- **`visibleTools()` comment added:** Documents that DM-only panel tools (`npc-place`, fog modes) are gated inline and are intentionally absent from the enumeration.

## Dependencies Unlocked

- No new phases directly depend on 4F.5 per the dependency graph. The remaining play-area phases (4H, 4I, 4K) each have their own dependency chains.
