# Archived Phase 4A: Canvas & Map Rendering

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-06-01

---

Original phase section was already archived in the feature roadmap at archive time.

## Completion Record Snapshot

# Play Area — Phase 4A: Canvas & Map Rendering

**Completed:** 2026-05-29
**Feature:** `play-area`

## Deliverables

### shared/
- `src/types/play-area.ts` (NEW) — `MapData`, `GridConfig`, `ViewportBounds` interfaces
- `src/constants/play-area.ts` (NEW) — `DEFAULT_GRID_CELL_SIZE`, `DEFAULT_GRID_COLOR`, `DEFAULT_GRID_ALPHA`, `MIN_ZOOM`, `MAX_ZOOM`, `ZOOM_FACTOR`
- `src/types/index.ts` (MODIFIED) — added `play-area` export
- `src/constants/index.ts` (MODIFIED) — added `play-area` export

### client/src/features/play-area/
- `canvas/CanvasManager.ts` (NEW) — owns PixiJS `Application`, manages `worldContainer` + all three layers, pan/zoom with clamping and zoom-toward-cursor math
- `canvas/BackgroundLayer.ts` (NEW) — `PIXI.Container` subclass, loads map image via `PIXI.Assets`, safe `destroy()` override
- `canvas/PlaygroundLayer.ts` (NEW) — grid overlay (batched `stroke()`) + `tokenContainer` for Phase 4B
- `canvas/ForegroundLayer.ts` (NEW) — reserved for fog/weather (Phase 4F)
- `canvas/viewport-culling.ts` (NEW) — pure math: `isInViewport`, `getViewportBounds`, `screenToWorld`
- `canvas/CanvasManager.test.ts` (NEW) — 10 tests with mocked pixi.js
- `canvas/viewport-culling.test.ts` (NEW) — 19 tests covering all edge cases
- `hooks/useCanvas.ts` (NEW) — React hook managing PixiJS lifecycle with cancellation guard and deferred destroy
- `components/PlayAreaToolbar.tsx` (NEW) — top bar: Back, Campaign Notes, Inventory, icon slots
- `components/PlayAreaToolbar.module.css` (NEW)
- `components/ChatPanel.tsx` (NEW) — placeholder chat sidebar
- `components/ChatPanel.module.css` (NEW)
- `components/DiceRollerButton.tsx` (NEW) — placeholder dice roller trigger (bottom-left canvas overlay)
- `components/DiceRollerButton.module.css` (NEW)
- `PlayArea.tsx` (NEW) — full wireframe layout: toolbar + canvas wrapper + chat sidebar
- `PlayArea.module.css` (NEW)

### client/src/
- `App.tsx` (MODIFIED) — added `/play/:campaignId` route (protected, outside PortalLayout)

### client/
- `package.json` (MODIFIED) — added `pixi.js@^8.18.1`

### client/src/features/campaigns/
- `CampaignList.tsx` (MODIFIED) — Open button now navigates to `/play/:campaignId`

## Test Results

```
npx vitest run --reporter=verbose (client package)

Test Files  7 passed (7)
     Tests  54 passed (54)
  Duration  1.97s
```

New tests added: 29 (19 viewport-culling + 10 CanvasManager)
All pre-existing tests continue to pass.

## Decisions & Insights

**PixiJS v8 canvas ownership:** PixiJS v8 must own its canvas element. Passing a React-managed `<canvas>` ref causes WebGL shader compilation failures (`Cannot read properties of null (reading 'split')`). The correct pattern: let PixiJS create the canvas via `app.init()` with no `canvas` option, then call `container.appendChild(app.canvas)`. The ref is a `<div>` container.

**React Strict Mode destroy race:** In dev, Strict Mode double-invokes effects (mount → cleanup → remount). Calling `app.destroy()` before `app.init()` resolves crashes with `_cancelResize is not a function`. Fix: hold the init Promise in `useCanvas` and chain destroy off it — `initPromise.then(() => manager.destroy())`.

**WebGL preference:** Added `preference: 'webgl'` to `app.init()`. PixiJS v8 defaults to WebGPU first; in many desktop browser/dev environments the WebGPU shader pipeline fails silently.

**Deferred destroy pattern:** The `useCanvas` hook's cleanup function stores the init promise and waits for it before calling destroy. This is required any time PixiJS (or similar async APIs) are used inside React effects.

## Dependencies Unlocked

- `play-area 4B` (Token System) — can now begin
- `play-area 4F` (Fog of War) — can now begin (depends only on 4A)
