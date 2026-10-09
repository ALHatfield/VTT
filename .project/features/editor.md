# Feature: editor

> **Slug:** `editor`
> **Feature dirs:** `client/src/features/editor/`, `server/src/features/editor/`
> **Instructions:** `.github/instructions/feature-editor.instructions.md`
> **Shared types:** `shared/types/editor.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 5I | Scene Templates | Not Started |
| 5J | Weather Authoring Panel | Not Started |

Phases 5A–5G and 5A.1 complete. See `.project/.archive/features/editor/` for archived phase details and `.project/.archive/complete/` for completion records.

---

## Phase 5I: Scene Templates

**Dependencies:** Phase 5H, play-area Phase 4L

### Tasks
- [ ] Prisma: add `SceneTemplate` model (`id`, `ownerId` → User, `name`, `description?`, `width`, `height`, `cellSize`, `fogConfig?`, `weatherPreset`, `spawnX?`, `spawnY?`, `thumbnailUrl?`, `content Json`, `schemaVersion Int`, timestamps)
- [ ] Define the `content` snapshot shape in shared types: `SceneTemplateContent` { placements, walls, lights, assets } — placements reference template-local asset keys, not campaign `TileAsset` IDs
- [ ] Shared Zod validator for `SceneTemplateContent` keyed by `schemaVersion`; reject unknown versions on instantiate
- [ ] `POST /api/campaigns/:id/scenes/:sceneId/template` — DM only; snapshots the scene into a template owned by the requesting user
- [ ] When saving a template, copy referenced **uploaded** asset files into `uploads/templates/{templateId}/` so templates survive campaign deletion; built-in assets are referenced by ID
- [ ] `GET /api/scene-templates` — returns only templates owned by the requesting user
- [ ] `PATCH /api/scene-templates/:templateId` (rename/description) and `DELETE /api/scene-templates/:templateId` (removes stored files) — owner only
- [ ] `POST /api/campaigns/:id/scenes/from-template` — DM of the target campaign and owner of the template; in one transaction creates the scene, `TileAsset` rows for copied uploads (category preserved), placements, walls, lights, and spawn point
- [ ] Add "Save as template" to the `SceneStrip` card context menu
- [ ] Build `SceneTemplatePicker` modal (thumbnails, name, size) shown from "New scene → From template"
- [ ] Write tests: snapshot completeness, ownership enforcement on every route, instantiate into a different campaign, asset file copy and cleanup, schemaVersion rejection, transaction rollback on failure

### Decisions
- Templates belong to a user (the DM), not a campaign — that's what makes them reusable across campaigns
- Snapshots are stored as one versioned JSON document: one row read per instantiate, immutable, easy to export later
- Uploaded asset files are copied into template storage rather than shared, so deleting a campaign never breaks a template
- Templates are private to their owner for now; sharing/public templates are post-MVP
- Depends on 4L so the spawn point is part of the snapshot from day one

---

## Phase 5J: Weather Authoring Panel (Post-MVP)

**Dependencies:** Phase 5G

### Tasks
- [ ] Prisma: add `weatherIntensity` enum (`low`/`medium`/`high`, default `medium`) to `Scene` alongside the existing `weatherPreset`
- [ ] Shared types (`shared/src/types/editor.ts`): `WeatherConfig` { preset, intensity }, `EffectIntensity`
- [ ] Shared validators: extend `sceneAtmosphereUpdateSchema` to accept the full `WeatherConfig`
- [ ] Extend the DM-only `/atmosphere` endpoints to read/write `WeatherConfig`
- [ ] Build `WeatherSection` in the editor layer panel, as a sibling of Walls and Lights: preset picker (none, rain, snow, ash, haze), intensity control
- [ ] Move the default-weather select out of `LightsSection` into `WeatherSection` (remove it from the lights UI)
- [ ] Extend `useSceneAtmosphere` to cover intensity (keep the existing race-safe write pattern)
- [ ] Include `weatherIntensity` in the 5H scene duplicate deep-copy and the 5I template snapshot
- [ ] Write tests: validator bounds, RBAC on atmosphere endpoints, WeatherSection render/update, duplicate/template carry-through

### Decisions
- Weather is a first-class authoring section in the layer panel, not a lights sub-setting — mirrors the walls (5F) and lights (5G) pattern
- The editor authors the persisted per-scene default; live session overrides are play-area PM5's job and never write back to the scene
- `WeatherConfig` stays enum-driven (preset + intensity) — no free-form particle parameters in authored data

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| campaigns Phase 3A | Editor operates within a campaign |
| play-area Phase 4A | Editor reuses the PixiJS canvas and layers |
| play-area Phase 4L | Scene templates capture the spawn point |

| Depended On By | Why |
|---------------|-----|
| play-area Phase 4L | Scene switching activates scenes created in the Scene Library |
| play-area PM3/PM4 | Runtime LOS and lighting consume authored walls and lights |
| play-area PM5 | Weather runtime renders the `WeatherConfig` authored in 5J |
