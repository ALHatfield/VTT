# Archived Phase 5H: Scene Library

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-10-09

---

## Phase 5H: Scene Library

**Dependencies:** Phase 5G

### Tasks
- [x] Prisma: add `sortOrder Int` and `thumbnailUrl String?` to `Scene`; migration backfills `sortOrder` by `createdAt` per campaign
- [x] Prisma: enforce a single active scene per campaign with a partial unique index (`CREATE UNIQUE INDEX ... ON scenes (campaign_id) WHERE is_active`) via raw SQL in the migration
- [x] Shared types (`shared/src/types/editor.ts`): `SceneSummary`, `SceneCreatePayload`, `SceneUpdatePayload`, `SceneReorderPayload`
- [x] Shared validators (`shared/src/validators/editor.ts`): Zod schemas for create/update/reorder (name 1–100 chars, width/height/cellSize bounded by named constants)
- [x] `GET /api/campaigns/:id/scenes` — DM only, returns `SceneSummary[]` ordered by `sortOrder`
- [x] `POST /api/campaigns/:id/scenes` — DM only, creates a scene appended to the end of the order
- [x] `PATCH /api/campaigns/:id/scenes/:sceneId` — DM only, rename and update width/height/cellSize
- [x] `DELETE /api/campaigns/:id/scenes/:sceneId` — DM only; rejects deleting the active scene or the last remaining scene (409)
- [x] `POST /api/campaigns/:id/scenes/:sceneId/duplicate` — DM only; one transaction deep-copies `TilePlacement`, `WallSegment`, `LightSource`, `fogConfig`, `weatherPreset` with new IDs; excludes tokens, fog regions, and fog exploration
- [x] `PUT /api/campaigns/:id/scenes/order` — DM only, reorders scenes in one transaction; rejects IDs from other campaigns
- [x] `PUT /api/campaigns/:id/scenes/:sceneId/thumbnail` — DM only; accepts a PNG/WebP upload capped by a named size constant, re-encodes server-side to WebP at a fixed max width, replaces the previous file
- [x] Every `:sceneId` route verifies `scene.campaignId === :id` before acting (no cross-campaign access)
- [x] Build `SceneStrip` — a 100%-width horizontal scene menu rendered between `CampaignToolbar` and the editor body (editor mode, DM only): horizontally scrolling thumbnail cards, active-scene badge, create button, inline rename, card context menu (duplicate, delete with confirmation), horizontal drag-to-reorder
- [x] Separate the **edited scene** from the **active scene**: the editor loads whichever scene is selected in the library; all editor hooks (placements, walls, lights, atmosphere) are keyed by the edited `sceneId`
- [x] Flush pending debounced edits before switching the edited scene (reuse existing flush-on-change behavior; verify for every hook)
- [x] Generate thumbnails client-side by extracting the background + foreground layers from PixiJS at a fixed width, debounced after edits and on leaving a scene
- [x] Build `SaveStatusIndicator` (Saving… / Saved / Error with retry) that aggregates in-flight and pending writes across all editor hooks
- [x] Ensure editor socket broadcasts (`editor:walls:updated`, `editor:lights:updated`, placement updates) for a non-active scene do not alter players' canvas
- [x] Write tests: CRUD + RBAC (player/observer get 403), cross-campaign ID rejection, duplicate deep-copy completeness and exclusions, delete guards, reorder, thumbnail validation, edited-vs-active scene isolation, save status aggregation

### Decisions
- The DM can prep scene B in the editor while players play scene A — the edited scene and the active scene are independent
- Scene management is a horizontal strip above the canvas body (below `CampaignToolbar`), not a sidebar panel — both sidebars stay dedicated to assets (left) and layers (right)
- The scene list is DM-only; players never see names or thumbnails of scenes they haven't been shown (spoiler protection)
- Duplicate copies authored content only — tokens and fog state are session data, not design data
- Thumbnails are generated on the client (PixiJS already has the rendered scene); the server only validates and re-encodes them
- Keep the existing per-entity autosave (walls immediate, lights 300ms, placements 500ms) — add visibility through the save indicator instead of rewriting persistence
- **(5H impl)** `sharp@0.33.5` added to the server for WebP re-encoding — pinned to 0.33.x because sharp 0.35's ESM build requires Node 20.10+ (`import … with` attributes) and the workspace runs Node 18
- **(5H impl)** Duplicated scenes get a null thumbnail (regenerated on first edit) rather than copying the source's file
- **(5H impl)** Thumbnail capture is gated on successful writes via the save tracker's `savedCount` — merely opening a scene never overwrites its thumbnail; switching away captures only if the scene was edited
- **(5H impl)** `useTilePlacements` now merges consecutive debounced payloads per placement and flushes pending edits to the originating scene on scene switch (also fixed a pre-existing lost-edit bug where a second update within the debounce window dropped the first payload)
- **(5H impl)** `SaveTracker` keys retryable failures per entity so a newer successful write supersedes a stale failure — retry can never regress fresher data; tracker state resets per campaign
- **(5H impl)** `getOrCreateActiveScene` (play-area) hardened for the new unique index: a concurrent-create P2002 re-fetches the winner instead of returning 500; auto-created default scenes append to the library order
- **(5H impl)** The strip's context menu uses fixed positioning (like `TileContextMenu`) because the scroll container's `overflow-x: auto` clips absolutely-positioned descendants
- **(5H impl)** Known deferred items: `/uploads` static files are served unauthenticated (pre-existing pattern — thumbnails rely on unguessable filenames); concurrent scene creates can produce duplicate `sortOrder` values (deterministic `createdAt`/`id` tie-break makes this cosmetic)

---


