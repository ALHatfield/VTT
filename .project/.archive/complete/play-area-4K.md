# Feature: play-area — Phase 4K: Drawing Tools

**Completed:** August 31, 2026
**Feature:** `play-area`

## Deliverables

**shared/**

- `shared/src/constants/play-area.ts` — Added `DRAW_EVENTS`, `DRAW_THROTTLE_MS`, `DRAW_DEFAULT_COLOR`, `DRAW_DEFAULT_WIDTH`, `DRAW_WIDTH_MIN`, `DRAW_WIDTH_MAX`
- `shared/src/types/play-area.ts` — Added `DrawPoint`, `DrawShapeType`, `DrawStrokePayload`, `DrawStrokeRelayedPayload`, `DrawClearPayload`, `DrawClearedPayload`
- `shared/src/validators/play-area.ts` — Added `drawStrokePayloadSchema` (with coordinate bounds), `drawClearPayloadSchema`

**server/**

- `server/src/features/play-area/play-area.socket.ts` — Added `play-area:draw:stroke` relay handler (observer-gated) and `play-area:draw:clear` handler (DM scope enforcement)
- `server/src/features/play-area/play-area.socket.test.ts` — Added 6 draw tool integration tests

**client/**

- `client/src/features/play-area/canvas/CanvasManager.ts` — Extended `ToolMode` with `'draw-freehand' | 'draw-shape'`
- `client/src/features/play-area/canvas/PlaygroundLayer.ts` — Added `drawContainer`, `DrawStrokeState`, `addOrUpdateDrawStroke`, `renderDrawStroke`, `clearDrawings`
- `client/src/features/play-area/hooks/useDrawTool.ts` — New hook (freehand/shape interaction, ~30fps throttle, final emit, mid-stroke deactivation cleanup)
- `client/src/features/play-area/hooks/useDrawTool.test.ts` — 6 unit tests
- `client/src/features/play-area/hooks/usePlayAreaSocket.ts` — Added `emitDrawStroke`, `emitDrawClear`, `onDrawStroked`, `onDrawCleared`
- `client/src/features/play-area/components/CanvasToolbar.tsx` — Draw tool button (DM + Player), sub-mode selector (Freehand/Rect/Circle), color picker, width slider, clear button
- `client/src/features/play-area/components/CanvasToolbar.module.css` — Draw panel styles, `.toolbarWide` expansion class
- `client/src/features/play-area/components/CanvasToolbar.test.tsx` — Added 11 draw tool component tests
- `client/src/features/play-area/PlayArea.tsx` — Wired `useDrawTool`, draw overlay, `handleDrawClear` (optimistic local + socket), `onDrawStroked`/`onDrawCleared` callbacks
- `client/src/features/play-area/PlayArea.module.css` — Added `.drawOverlay`

## Test Results

```
npx vitest run
 Test Files  44 passed (44)
      Tests  632 passed (632)
```

New tests added: 11 (CanvasToolbar draw), 6 (useDrawTool), 6 (socket draw handlers) = 23 total

## Decisions & Insights

- **Freehand delta-point pattern**: `pointerDown` seeds the start point in `PlaygroundLayer`; each `pointerMove` sends only the new delta point. Sending the full accumulated array caused a duplicate-points bug where PixiJS looped the path back to the origin on every frame.
- **Server relays client stroke color**: Unlike the measure tool (which overrides with `playerColor`), draw strokes relay the validated client-chosen color since the user has an explicit color picker.
- **Optimistic local clear**: `handleDrawClear` clears the local canvas immediately instead of waiting for the socket round-trip. The `onDrawCleared` callback becomes a no-op for the sender but correctly clears remote clients.
- **Mid-stroke deactivation**: Tool switch while mid-stroke emits `draw:clear` with `scope: 'own'` to clean up in-progress partial strokes on remote clients.
- **Observer gate**: Server rejects `draw:stroke` from observers with `FORBIDDEN` (same pattern as dice and fog).
- **Coordinate bounds**: `drawPointSchema` validates coordinates to ±100,000 world pixels (consistent with max scene dimensions).

## Dependencies Unlocked

- `play-area` Phase 4H (Initiative & Turn Tracker) — no direct dependency on 4K, was already unblocked by 4F.3
- `play-area` Phase 4I (Token Auras) — no direct dependency on 4K, already unblocked by 4C
