# Archived Phase 5F: Wall & Obstacle Authoring

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-09-29

---

## Phase 5F: Wall & Obstacle Authoring

**Dependencies:** editor 5E, play-area PM2

**Notes:** `.project/notes/play-area-PM3-line-of-sight.md`

### Tasks

- [x] Add `WallSegment` model to Prisma schema (scene-scoped: endpoints, `blocksLight`, `blocksMovement`, `isDoor`, `isOpen`)
- [x] Add shared types to `shared/src/types/editor.ts`: `WallSegment`, `WallSegmentCreatePayload`, `WallSegmentUpdatePayload`
- [x] Add Zod validators for wall payloads in `shared/src/validators/editor.ts`
- [x] Create REST endpoints for wall CRUD (DM-only via `requireRole('dm')`): list by scene, create, update, delete
- [x] Build wall-drawing tool in editor mode: click-to-place vertices, grid snapping, Alt to bypass snapping
- [x] Build wall editing interactions: select, move endpoints, delete segments
- [x] Render wall segments as an editor-only overlay on the Foreground layer (hidden in play mode)
- [x] Add door toggle in the wall inspector (`isDoor` flag; open/closed state)
- [x] Add walls section to layer panel with visibility toggle and bulk delete
- [x] Socket event: `editor:walls:updated` broadcast so open play-area clients invalidate cached geometry
- [x] Write tests: wall CRUD validation, DM-only access, snap math, socket broadcast

### Decisions

- Wall geometry is authored in editor, consumed by play-area — model and types live in `shared/`, persistence and CRUD live in `server/src/features/editor/`
- Walls are polyline segments (pairs of endpoints), not closed polygons — matches raycasting input shape in the PM3 research note
- `blocksLight` and `blocksMovement` are independent flags (e.g., a window blocks movement but not light)
- Doors are wall segments with `isDoor: true`; open/closed toggles blocking at runtime — the toggle UI in play mode is deferred to play-area PM3
- No raycasting or visibility math in this phase — authoring and persistence only
- Walls are stored as flat endpoints (`x1, y1, x2, y2`); snapping targets grid intersections, not cell centres
- Wall list is DM-only; the `editor:walls:updated` payload carries only `{ campaignId, sceneId }` so layouts never leak to players — PM3 must add a role-appropriate read path
- Bulk delete is `DELETE .../walls` (clears the scene) and returns `200 { deletedCount }`; scenes are capped at `MAX_WALLS_PER_SCENE` (2000)
- Opening a non-door is rejected (400) on both create and update; clearing `isDoor` auto-closes the segment
- Pointer input uses a DOM overlay (`WallToolOverlay`) like the play-mode tools; the Pixi `WallOverlay` is render-only, and drafts bypass React state
- Wall edits are not yet part of undo/redo (`useUndoRedo` is not wired into the app)

---


