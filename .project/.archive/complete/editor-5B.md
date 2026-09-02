# Feature: editor — Phase 5B: Scene Editor Canvas & Persistence

**Completed:** July 27, 2026
**Feature:** `editor`

## Deliverables

**shared/**

- `shared/src/types/editor.ts` — `TilePlacement`, `CreateTilePlacementPayload`, `UpdateTilePlacementPayload` shared types (defined in an earlier commit but part of this phase's contract)

**server/**

- `server/prisma/schema.prisma` — `TilePlacement` model with position, rotation, scale, z-index, and layer category; relations to `Scene` and `TileAsset`
- `server/prisma/migrations/20260612221214_add_tile_placement_model/` — migration
- `server/src/features/editor/editor.routes.ts` + `editor.service.ts` — create/list/update/delete placement endpoints
- `server/src/features/editor/editor.routes.test.ts` — 39 tests covering placement CRUD + auth/RBAC

**client/**

- `client/src/features/editor/EditorModeContext.tsx` — set-based tile selection (`selectedTilePlacementIds: ReadonlySet<string>`); clears selection on mode toggle
- `client/src/features/editor/EditorModeContext.test.tsx` — 10 tests including set-based selection
- `client/src/features/editor/components/TileContextMenu.tsx` (+ `.module.css`) — right-click menu with rotate 90°/180°/270°, delete, duplicate
- `client/src/features/editor/components/SmartSizingPrompt.tsx` (+ `.module.css`) — background asset resize prompt on empty BG layer with dismiss
- `client/src/features/editor/hooks/useTileDragDrop.ts` + tests — drag/drop with grid-snap and Alt-bypass
- `client/src/features/editor/hooks/useTilePlacements.ts` + tests — API client, auto-save (debounced), local state
- `client/src/features/editor/hooks/useUndoRedo.ts` + tests — command-pattern undo/redo with Ctrl+Z / Ctrl+Shift+Z
- `client/src/features/play-area/canvas/TilePlacementSprite.ts` — click select / drag move / SE-handle resize / right-click context menu / Alt-bypass grid snap; new `getWorldBounds()` for marquee; `onSelect(id, additive)` signature exposes Shift-state
- `client/src/features/play-area/canvas/CanvasManager.ts` — set-based `selectedTilePlacementIds`; `onSelectionChange(ids)`; `setTileSelection` / `clearTileSelection` / `getSelectedTilePlacementIds` public API; marquee (rubber-band) drag with activation threshold; auto-clear selection when leaving editor mode; background click clears selection in editor mode (unless Shift held)
- `client/src/features/play-area/canvas/selection-utils.ts` (new) — pure `rectsIntersect` + `rectFromPoints` helpers
- `client/src/features/play-area/canvas/selection-utils.test.ts` (new) — 10 tests
- `client/src/features/play-area/canvas/CanvasManager.test.ts` — 29 tests including 5 selection tests, 4 editor-mode lifecycle tests, 6 marquee tests; also fixed 2 pre-existing background-click tests that were missing `target` on mock events
- `client/src/features/play-area/PlayArea.tsx` — wired to `onSelectionChange`; delete/context-menu flows use `canvasManager.clearTileSelection()`

## Test Results

Client (all Phase 5B tests + related suites):

```
npx vitest run
Test Files  20 passed (20)
     Tests  209 passed (209)
  Duration  ~38s
```

Server editor routes (Phase 5A + 5B in isolation):

```
npx vitest run src/features/editor
Test Files  1 passed (1)
     Tests  39 passed (39)
  Duration  ~113s
```

Shared:

```
npx vitest run
Test Files  3 passed (3)
     Tests  30 passed (30)
```

**Note on full-suite server run:** running the full server suite in parallel hits pre-existing `Unique constraint failed on the fields: (username)` seed-collision failures in fog / tokens / characters / socket tests. Those tests pass individually; the flake is unrelated to Phase 5B. Filed against the shared test-seed infra (out of scope here).

## Decisions & Insights

- **Set-based selection over singular ID.** Multi-select required a shift from `selectedTilePlacementId: string | null` to `selectedTilePlacementIds: ReadonlySet<string>`. CanvasManager now owns selection state; sprites just report clicks with `(id, additive)` and CanvasManager decides add/toggle/replace. React state observes changes via `onSelectionChange(ids)`.
- **Sprite no longer self-toggles.** Previously the sprite flipped its own `_selected` and fired `onSelect(id | null)`. That coupled UI intent (Shift semantics) to the sprite. Now CanvasManager applies the toggle after inspecting the additive flag, and calls `sprite.setSelected(bool)` back to sync visuals. Cleaner separation.
- **Marquee drawn on `worldContainer`, not on the DOM.** Rendering the rubber-band as a PixiJS `Graphics` inside `worldContainer` makes pan/zoom "just work" — no screen↔world math for the overlay. Only the pointer coordinates need conversion.
- **Marquee activation threshold reuses the 4px click threshold.** A drag under 4px is treated as a background click (which clears selection in editor mode). This keeps the click-vs-drag boundary consistent with token/tile interactions.
- **Shift-drag = union, plain drag = replace.** Follows Photoshop/Figma convention: Shift adds marquee hits to existing selection; without Shift the selection is replaced. Non-shift background clicks (no drag) clear the selection; shift+bg-click leaves it alone so the user can chain shift-drags.
- **Axis-aligned bounds for intersection.** `TilePlacementSprite.getWorldBounds()` returns un-rotated bounds. Rotated tiles use their un-rotated footprint for marquee hit-testing — acceptable for MVP; full rotated OBB testing can come later if needed.
- **Background click behavior split by mode.** In play mode `onBackgroundClick` still deselects the hovered token; in editor mode CanvasManager additionally clears its own tile selection before firing the callback. This keeps token vs. tile selection independent.
- **`setEditorMode(false)` proactively clears selection + any active marquee.** Prevents stale selection state from bleeding across mode toggles (and avoids ghost selection borders on tiles that become non-interactive).
- **Pre-existing test hole surfaced.** The two `onBackgroundClick` tests were relying on mock events without a `target` field. The handlers correctly returned early because `e.target !== stage`, so those tests had been silently failing. Fixed as part of this work by adding `target: stage` to the mocks and refactoring into a shared `stageOf(mgr)` helper.

## Dependencies Unlocked

- **editor Phase 5C** (Layer Management & Inspector) — layer panel enhancements and per-tile inspector; the multi-select foundation here enables 5C's "Batch editing" task.
- **editor Phase 5E** (Grid Alignment Tool) — grid-alignment lives on the same selected-tile flow that 5B established.
