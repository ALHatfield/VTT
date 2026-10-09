# Feature: editor — Phase 5G: Light Emitter Authoring

**Completed:** September 29, 2026
**Feature:** `editor`

## Deliverables

### Shared (`shared/`)

- Modified `src/constants/editor.ts`: `EDITOR_EVENTS.LIGHTS_UPDATED` (`editor:lights:updated`), `LIGHT_EMITTER_TYPES`, `LIGHT_ANIMATION_MODES`, `WEATHER_PRESETS`, `LIGHT_COORDINATE_LIMIT`, `LIGHT_RADIUS_MIN/MAX`, `MAX_LIGHTS_PER_SCENE`, `LIGHT_ANIMATION_SEED_MAX`, `LightTone`, `LightPreset`, `LIGHT_PRESETS` (torch, fireplace, lantern, beacon, custom)
- Modified `src/types/editor.ts`: `LightEmitterType`, `LightAnimationMode`, `WeatherPreset`, `LightSource`, `LightSourceCreatePayload`, `LightSourceUpdatePayload`, `LightsUpdatedPayload`, `SceneAtmosphere`
- Modified `src/validators/editor.ts`: `lightEmitterTypeSchema`, `lightAnimationModeSchema`, `weatherPresetSchema`, `lightSourceCreateSchema`, `lightSourceUpdateSchema`, `sceneAtmosphereUpdateSchema`
- Modified `src/validators/editor.test.ts`: preset serialization, light and atmosphere validator tests

### Server (`server/`)

- Modified `prisma/schema.prisma`: `LightSource` model, `LightEmitterType` / `LightAnimationMode` / `WeatherPreset` enums, `Scene.weatherPreset`, relations on `Scene` and `Campaign`
- Created `prisma/migrations/20260929172522_add_light_source_model/migration.sql`
- Modified `prisma/seed.ts`: seeds a torch and an aura beacon inside the 5F walled room
- Created `src/features/editor/lights.service.ts`: list/create/update/delete lights (preset defaults + server-assigned seed), get/update scene atmosphere
- Created `src/features/editor/lights.routes.ts`: DM-only `GET/POST /scenes/:sceneId/lights`, `PATCH/DELETE /scenes/:sceneId/lights/:lightId`, `GET/PATCH /scenes/:sceneId/atmosphere`; broadcasts `editor:lights:updated`
- Created `src/features/editor/lights.routes.test.ts`
- Modified `src/app.ts`: mounts `lightsRouter`

### Client (`client/`)

- Created `src/features/editor/canvas/LightOverlay.ts` (+ test): editor-only marker, radius ring, falloff ring, selection highlight
- Created `src/features/editor/components/LightsSection.tsx` (+ CSS module, test): preset palette (drag or click/Enter), light list, visibility toggle, default-weather select
- Created `src/features/editor/components/LightInspector.tsx` (+ CSS module): X/Y, color, intensity, radius, falloff, animation mode, delete
- Created `src/features/editor/hooks/useLightSources.ts` (+ test): REST CRUD with optimistic, per-light debounced updates
- Created `src/features/editor/hooks/useSceneAtmosphere.ts` (+ test): race-safe weather preset read/write
- Created `src/features/editor/hooks/useLightEditor.ts` (+ test): overlay lifecycle, drop/add placement, section props
- Created `src/features/editor/utils/light-placement.ts` (+ test): `LIGHT_DRAG_MIME`, drag parsing, half-cell snapping, hex → number
- Modified `src/features/editor/components/LayersPanel.tsx` (+ test): Lights tab
- Modified `src/features/play-area/PlayArea.tsx`: wires `useLightEditor`, combined drop handler, socket refresh + reconnect
- Modified `src/features/play-area/hooks/usePlayAreaSocket.ts` (+ test): `onLightsUpdated`

## Test Results

Slug-scoped verification:

```
$ npm run phase:verify -- --slug editor --compact
Suites: 89 passed, 0 failed (89 total)
Tests:  313 passed, 0 failed, 0 skipped (313 total)
All tests passed.
```

Full verification (typecheck + all packages):

```
$ npm run phase:verify -- --target full --compact
Suites: 326 passed, 0 failed (326 total)
Tests:  997 passed, 0 failed, 0 skipped (997 total)
All tests passed.
```

Two earlier full runs each hit a single intermittent server hook failure (`lights.routes.test.ts`, then pre-existing `editor.routes.test.ts`); both passed in isolation and under `npx vitest run --project server` (19 files, 323 tests), and the full re-run passed.

End-to-end smoke test against the running dev servers (seed campaign):

```
dm login 200
list 2 torch@288,288 beacon@544,416
create fireplace 6 #ff6a1f flicker seed=1495674022
 patch 200
{"data":{"weatherPreset":"rain"}} atmosphere 200
delete 204
player login 200
player list 403
```

## Decisions & Insights

- Light `radius` is in grid cells (matches token vision/aura radius); `intensity` and `falloff` are 0–1.
- Create payloads need only `emitterType` + `x`/`y`; the server fills the rest from `LIGHT_PRESETS`, keeping presets authoritative in `shared/`.
- `animationSeed` is server-assigned and immutable; `.strict()` schemas reject client-supplied seeds, `sceneId`, and `campaignId`.
- "Aura beacon" is stored as `beacon` because Prisma enum values cannot contain hyphens.
- Weather preset lives on `Scene.weatherPreset` behind editor-owned DM-only `/atmosphere` endpoints. It is not added to the play-area `Scene` type or broadcast — PM5 must decide player-facing read and broadcast.
- Inspector edits update the gizmo immediately and send a debounced PATCH per light. Pending and in-flight edits are overlaid on socket-triggered refreshes so a DM's own broadcast doesn't snap sliders back; pending edits flush to the original scene on scene change/unmount.
- Presets are buttons that are both draggable and clickable (adds at view centre) for keyboard accessibility; lights are repositioned through inspector X/Y fields. Canvas drag-to-move and undo/redo are not in scope (consistent with 5F).
- Gotcha: `useTileDragDrop` accepts every editor-mode drag-over, so the light drop handler guards on its own MIME type; the combined-handler comment in `PlayArea.tsx` was corrected.
- Gotcha: full-repo test runs are intermittently flaky on server hooks under load; single-project runs are stable.

## Dependencies Unlocked

- **play-area PM4 (Light Rendering)** — both dependencies (PM2, editor 5G) are complete; consumes `LightSource`, `LIGHT_PRESETS`, `animationMode` + `animationSeed`
- **play-area PM5 (Weather)** — can read the authored `Scene.weatherPreset` default
- The `editor` feature is now complete (5A–5G, 5A.1)
