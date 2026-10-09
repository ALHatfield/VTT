# Feature: editor — Phase 5F: Wall & Obstacle Authoring

**Completed:** September 29, 2026
**Feature:** `editor`

## Deliverables

### shared/
- Modified `src/types/editor.ts` — `WallSegment`, `WallSegmentCreatePayload`, `WallSegmentUpdatePayload`, `WallsUpdatedPayload`
- Modified `src/constants/editor.ts` — `EDITOR_EVENTS.WALLS_UPDATED` (`editor:walls:updated`), `WALL_COORDINATE_LIMIT`, `MAX_WALLS_PER_SCENE`
- Modified `src/validators/editor.ts` — `wallSegmentCreateSchema` (defaults, zero-length and open-non-door refinements, strict), `wallSegmentUpdateSchema` (partial, non-empty, strict)
- Modified `src/validators/editor.test.ts` — wall validator coverage

### server/
- Modified `prisma/schema.prisma` — `WallSegment` model (`wall_segments`, cascade on scene/campaign, `@@index([campaignId, sceneId])`)
- Created `prisma/migrations/20260929145923_add_wall_segment_model/`
- Modified `prisma/seed.ts` — demo room on the seed scene (4 walls, 1 door, 1 window)
- Created `src/features/editor/walls.service.ts` — scoped CRUD, `WallServiceError` codes, degenerate/door-state checks, per-scene cap
- Created `src/features/editor/walls.routes.ts` — DM-only `GET/POST/DELETE .../walls`, `PATCH/DELETE .../walls/:wallId`, `editor:walls:updated` broadcast
- Created `src/features/editor/walls.routes.test.ts`
- Modified `src/app.ts` — mounts `wallsRouter`

### client/
- Created `src/features/editor/utils/wall-geometry.ts` (+ test) — grid-intersection snapping, Alt bypass, segment/endpoint hit-testing
- Created `src/features/editor/canvas/WallOverlay.ts` (+ test) — render-only Pixi overlay on the Foreground layer; static walls and live draft on separate `Graphics`
- Created `src/features/editor/hooks/useWallSegments.ts` (+ test) — DM-only CRUD with optimistic state and stale-refetch guard
- Created `src/features/editor/hooks/useWallEditor.ts` — overlay lifecycle, tool/visibility/selection state, prop wiring
- Created `src/features/editor/components/WallToolOverlay.tsx` (+ CSS, test) — pointer/keyboard capture: chain drawing, select, endpoint drag, delete, pan
- Created `src/features/editor/components/WallsSection.tsx` (+ CSS, test) — Walls tab: tool toggle, visibility, list, bulk delete with confirm
- Created `src/features/editor/components/WallInspector.tsx` (+ CSS) — blocking flags, door toggle, open/closed state
- Modified `src/features/editor/components/LayersPanel.tsx` (+ test) — Walls tab; leaving it deactivates the tool
- Modified `src/features/play-area/PlayArea.tsx` — `useWallEditor` wiring, tool overlay, walls refresh on socket/reconnect
- Modified `src/features/play-area/hooks/usePlayAreaSocket.ts` (+ test) — `onWallsUpdated` listener

## Test Results

`npm run phase:verify -- --slug editor --target full --compact`:

```
Suites: 63 passed, 0 failed (63 total)
Tests:  229 passed, 0 failed, 0 skipped (229 total)
```

Full workspace regression, `npx vitest run --reporter=dot`:

```
 Test Files  66 passed (66)
      Tests  881 passed (881)
```

ESLint on all touched paths: exit 0.

Live smoke test against the dev server (seeded accounts):

```
dm login 200
player login 200
dm list 6 doors 1 windows 1
player list 403
patch door 200
delete 204
```

## Decisions & Insights

- Walls are flat endpoints (`x1, y1, x2, y2`); snapping targets grid intersections rather than cell centres.
- All wall routes are DM-only, including list. The broadcast payload is `{ campaignId, sceneId }` only, so players never receive layouts; PM3 must add a role-appropriate read path for LOS.
- Bulk delete is `DELETE .../walls` returning `200 { deletedCount }` (a documented exception to the 204 convention). Scenes are capped at 2000 walls.
- Opening a non-door is rejected with 400 on both create and update; clearing `isDoor` auto-closes the segment.
- Pointer input follows the play-mode tool pattern (DOM overlay + `screenToWorld`) because `ForegroundLayer` is `eventMode: 'none'`. The Pixi overlay is render-only, and draft updates call `WallOverlay.setDraft` directly to avoid re-rendering `PlayArea` on every pointermove.
- Gotcha: `server/src/test-setup.ts` loads `app.js` before test-file mocks register, so `vi.mock` of `io-instance.js` has no effect — spy on the live `getIo()` instance instead.
- Gotcha: a recovery refetch must not clear the error set by the failed mutation that triggered it; only user-initiated mutations clear `error`.
- In-flight refetches are discarded whenever a local mutation starts, preventing socket-triggered reloads from overwriting newer optimistic edits.
- Deferred: wall edits are not in undo/redo (`useUndoRedo` is not wired into the app); the DM refetches after its own broadcasts; the database does not enforce `wall.campaignId === scene.campaignId` (service-level only). "Blocks light" is persisted but has no runtime effect until PM3.

## Dependencies Unlocked

- **play-area PM3 (Line of Sight)** — wall geometry, `blocksLight`/`blocksMovement`/door flags, and the `editor:walls:updated` invalidation event are now available (PM3 also depends on PM2, already complete).
