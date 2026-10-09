# Feature: editor — Phase 5H: Scene Library

**Completed:** October 9, 2026
**Feature:** `editor`

## Deliverables

### Server
- `server/prisma/schema.prisma` — `Scene.sortOrder Int @default(0)`, `Scene.thumbnailUrl String?`
- `server/prisma/migrations/20261009163210_add_scene_library_fields/migration.sql` — columns, `sortOrder` backfill by `created_at` per campaign, active-scene de-dup, partial unique index `scenes_one_active_per_campaign ON scenes (campaign_id) WHERE is_active`
- `server/src/features/editor/scenes.service.ts` *(new)* — list/create/update/delete (transactional guards)/duplicate (one-transaction deep copy)/reorder (permutation-validated)/thumbnail (sharp WebP re-encode at 320px, row-locked file swap, decompression-bomb pixel limit)
- `server/src/features/editor/scenes.routes.ts` *(new)* — 7 DM-only routes under `/api/campaigns/:id/scenes`; multer memory storage (2 MB cap, PNG/WebP only, structured 400/413 errors)
- `server/src/app.ts` — `scenesRouter` registration
- `server/src/features/play-area/tokens.service.ts` — `getOrCreateActiveScene` hardened for the new unique index (P2002 → re-fetch; default scenes append to library order)
- `server/package.json` — **sharp@0.33.5 added** (0.33.x pinned for Node 18 ESM compatibility)

### Shared
- `shared/src/types/editor.ts` — `SceneSummary`, `SceneCreatePayload`, `SceneUpdatePayload`, `SceneReorderPayload`
- `shared/src/validators/editor.ts` — `sceneCreateSchema`, `sceneUpdateSchema`, `sceneReorderSchema` (duplicate-ID refinement)
- `shared/src/constants/editor.ts` — scene name/dimension/cell-size bounds, `MAX_SCENE_THUMBNAIL_FILE_SIZE`, `ALLOWED_SCENE_THUMBNAIL_MIME_TYPES`, `SCENE_THUMBNAIL_WIDTH`, `SCENE_THUMBNAIL_CAPTURE_DEBOUNCE_MS`

### Client
- `client/src/features/editor/components/SceneStrip.tsx` + `.module.css` *(new)* — horizontal scene menu between `CampaignToolbar` and the editor body: thumbnail cards, active badge, create button, inline rename, fixed-position context menu (rename/duplicate/two-step delete, Escape closes), drag-to-reorder incl. drop-at-end
- `client/src/features/editor/components/SaveStatusIndicator.tsx` + `.module.css` *(new)* — Saving… / Saved / Error + Retry
- `client/src/features/editor/utils/save-tracker.ts` *(new)* — `SaveTracker` aggregating pending/in-flight/failed writes; per-entity keyed failures so retry never regresses newer data; `savedCount` drives edit-gated thumbnail capture
- `client/src/features/editor/utils/resolve-display-scene.ts` *(new)* — pure edited-vs-active scene resolution
- `client/src/features/editor/hooks/useScenes.ts` *(new)* — scene library CRUD/reorder/thumbnail with optimistic updates and race-guarded fetches
- `client/src/features/editor/hooks/useSaveStatus.ts` *(new)* — `useSyncExternalStore` binding for the tracker
- `client/src/features/editor/hooks/useSceneThumbnail.ts` *(new)* — debounced edit-triggered capture + immediate capture on scene switch
- `client/src/features/editor/hooks/useTilePlacements.ts` — merged debounced payloads per placement (fixes pre-existing lost-edit bug), flush-on-scene-change to the originating scene, fetch race guard, save tracking
- `client/src/features/editor/hooks/useLightSources.ts`, `useWallSegments.ts`, `useSceneAtmosphere.ts` — save tracking instrumentation
- `client/src/features/play-area/PlayArea.tsx` — scene library wiring; `displayScene` separation (editor hooks, map, undo history keyed to edited scene); session-data suppression (tokens/fog/exploration/vision/light glow) while editing a non-active scene; socket guards split edited-scene refresh from active-scene LOS/lighting; tracker reset per campaign
- `client/src/features/play-area/canvas/CanvasManager.ts` — `extractSceneSnapshot(maxWidth)` (background + foreground tile layers only)
- `client/src/features/play-area/canvas/ForegroundLayer.ts` — `tilePlacementsView` getter

### Tests
- `server/src/features/editor/scenes.routes.test.ts` *(new, 24 tests)* — RBAC on all routes, cross-campaign rejection, duplicate deep-copy completeness/exclusions, delete guards, reorder permutation edge cases, thumbnail re-encode/replace/MIME/decode validation
- `client`: `save-tracker.test.ts` (11), `resolve-display-scene.test.ts` (6), `useScenes.test.ts` (10), `useSceneThumbnail.test.ts` (6), `SceneStrip.test.tsx` (13), `useTilePlacements.test.ts` (+2: payload merge, flush-on-scene-change)
- Fixture updates for the new unique index: `character-tokens.routes.test.ts`, `vision.socket.test.ts` (deactivate the invite-created default scene first)

## Test Results

```
npm run phase:verify -- --target full --compact
Suites: 445 passed, 0 failed (445 total)
Tests:  1447 passed, 0 failed, 0 skipped (1447 total)
All tests passed.
```

End-to-end smoke test against live dev servers (seeded DM, campaign-seed-001):

```
created=c6814545-e738-4e1c-b95c-de6ed432d79e                      # POST /scenes → sortOrder appended
copy=79ea57eb-... "Default Scene (copy)" sortOrder=2              # POST /:sceneId/duplicate
[('Default Scene', 0), ('Default Scene (copy)', 1), ('Smoke Scene', 2)]   # PUT /scenes/order
/uploads/thumbnails/scene-thumb_c6814545-..._1791565318548.webp   # PUT /:sceneId/thumbnail (PNG → WebP)
{"error":{"code":"SCENE_ACTIVE","message":"The active scene cannot be deleted"}}  # delete guard → 409
del new=204, del copy=204                                          # DELETE
```

## Decisions & Insights

- **sharp 0.33.5, not 0.35** — sharp 0.35's ESM entry uses `import … with { type: "json" }` (Node ≥ 20.10); the workspace runs Node 18.18. 0.33.x has full WebP support and loads cleanly.
- **Jimp cannot handle WebP** — the existing Jimp-based asset pipeline silently can't decode/encode WebP (latent issue for WebP asset uploads); sharp is now available if the asset thumbnailer ever needs migrating.
- **The campaign invite flow lazily creates the active scene** — any test that creates its own `isActive: true` scene must do so *before* inviting members, or deactivate existing scenes first. The new partial unique index turned this latent pattern into hard failures in two existing fixtures.
- **Edit-gated thumbnail capture** — capturing on `[placements, walls, lights]` identity would fire on scene *load* and could overwrite a good thumbnail with a partially loaded render. Capture is keyed to the save tracker's `savedCount` (successful writes only) plus a dirty check on switch.
- **Pre-existing lost-edit bug fixed in `useTilePlacements`** — consecutive updates within the 500 ms debounce window previously dropped the earlier payload (e.g. move + rotate lost the move); payloads are now merged per placement, matching the lights hook.
- **Scroll containers clip dropdowns** — `overflow-x: auto` forces vertical clipping too; the SceneStrip context menu uses fixed positioning (same pattern as `TileContextMenu`).
- **Deferred (recorded, not blocking)**: `/uploads` is served unauthenticated (pre-existing pattern; thumbnails rely on unguessable filenames — revisit with an auth'd asset route); concurrent scene creates can produce duplicate `sortOrder` (cosmetic; deterministic `createdAt`/`id` tie-break).

## Dependencies Unlocked

- **editor 5I (Scene Templates)** — depends on 5H + play-area 4L; the 5H half is now satisfied
- **play-area 4L (Scene Switching)** — scene activation now has a library of scenes to activate, and the one-active-scene invariant is enforced at the database level
