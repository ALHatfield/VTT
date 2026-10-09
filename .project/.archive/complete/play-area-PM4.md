# Feature: play-area — Phase PM4: Dynamic Light Rendering (Post-MVP)

**Completed:** September 29, 2026
**Feature:** `play-area`

## Deliverables

### shared
- `shared/src/types/play-area.ts` (modified) — `TemporaryLight`, `TemporaryLightCreatePayload`, `TemporaryLightUpdatePayload` (reuses editor `LightSourceUpdatePayload` as `changes`), `TemporaryLightDeletePayload`, `TemporaryLightsUpdatedPayload`, `SceneLighting`
- `shared/src/constants/play-area.ts` (modified) — `LIGHT_EVENTS` (`play-area:light:create|update|delete|updated`), `MAX_TEMPORARY_LIGHTS_PER_SCENE`
- `shared/src/validators/play-area.ts` (modified) — `temporaryLightCreatePayloadSchema`, `temporaryLightUpdatePayloadSchema`, `temporaryLightDeletePayloadSchema` (UUID ids, strict)
- `shared/src/validators/play-area.test.ts` (modified)

### server
- `server/src/features/play-area/temporary-lights.store.ts` (+ `.test.ts`) — in-memory session-scoped store with preset fill, seed assignment, per-scene cap
- `server/src/features/play-area/lighting.service.ts` — scene ownership check + authored/temporary lighting read
- `server/src/features/play-area/lighting.routes.ts` — `GET /api/campaigns/:id/scenes/:sceneId/lighting` (member)
- `server/src/features/play-area/lights.socket.ts` — DM-only create/update/delete handlers, snapshot broadcast
- `server/src/features/play-area/lighting.test.ts` — route + socket integration tests
- `server/src/features/play-area/play-area.socket.ts` (modified) — registers `registerLightHandlers`
- `server/src/app.ts` (modified) — mounts `lightingRouter`

### client
- `client/src/features/play-area/canvas/lights/light-animation.ts` (+ `.test.ts`) — seeded layered-sine + value-noise flicker, pulse, bounds
- `client/src/features/play-area/canvas/lights/LightLayer.ts` (+ `.test.ts`) — additive tinted glow sprites, quantized shared gradient textures, embers, reduced motion, budget caps
- `client/src/features/play-area/hooks/usePlayAreaLighting.ts` (+ `.test.ts`) — fetch, socket snapshot merge, canvas push, reduced-motion wiring
- `client/src/features/play-area/hooks/useTemporaryLightDrop.ts` — drag-drop placement
- `client/src/features/play-area/components/TemporaryLightsPanel.tsx` (+ `.module.css`, `.test.tsx`) — DM preset drag items, intensity slider, delete
- `client/src/features/play-area/canvas/CanvasManager.ts` (+ `.test.ts`, modified) — `lightLayer`, ticker drive, `setLights`, `setLightingReducedMotion`, `'light-place'` tool mode
- `client/src/features/play-area/hooks/usePlayAreaSocket.ts` (+ `.test.ts`, modified) — `onTemporaryLightsUpdated`, `emitLightCreate/Update/Delete`
- `client/src/features/play-area/components/CanvasToolbar.tsx` (modified) — DM Lights tool
- `client/src/features/play-area/PlayArea.tsx` (modified) — wiring

## Test Results

```
$ npm run phase:verify -- --slug play-area --target full --compact
> client@0.0.1 copilot:lint — tsc --noEmit --pretty false (clean)
> server@0.0.1 copilot:lint — tsc --noEmit --pretty false (clean)
Suites: 200 passed, 0 failed (200 total)
Tests:  597 passed, 0 failed, 0 skipped (597 total)
All tests passed.
```

- `npm run dev:lifecycle:verify` → `HEALTHY 5173`, `HEALTHY 3001`
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/campaigns/x/scenes/y/lighting` → `401` (auth enforced)
- Render budget: 50 animated lights (10 ember emitters) average under 3 ms per `LightLayer.update()` in unit tests; flicker math for 50 lights well under 3 ms/frame

## Decisions & Insights

- `LightLayer` is its own world-container child between Background and Playground; Foreground fog composites over it so light never reveals hidden areas. `canvas.instructions.md` still describes lighting under Foreground and should be updated
- Players needed a read path — editor 5G `GET .../lights` is DM-only — so play-area exposes `GET .../lighting` returning `{ authored, temporary }`
- Temporary lights are in-memory only (lost on restart). They are not yet purged on scene/campaign delete; bounded at 50/scene
- Every temporary-light change broadcasts the full scene snapshot; the client ignores an in-flight REST `temporary` list if a socket snapshot arrived meanwhile
- Animation uses `Date.now()` so seeded flicker is in phase across clients; `performance.now()` would desync per page load
- Gradient textures are quantized into 8 falloff steps and shared across sprites; flicker also wobbles scale by 4%
- Intensity slider commits on pointer-up/key-up/blur and skips no-op commits to avoid socket floods
- Gotcha: typing a `getContext` mock as `CanvasRenderingContext2D` fails tsc (overload resolves to `GPUCanvasContext`); cast to `ReturnType<HTMLCanvasElement['getContext']>`
- Wall-aware light clipping deferred to PM6 (PM3 geometry not yet available)

## Dependencies Unlocked

- `play-area PM6` (Advanced Vision & Atmosphere) — PM4 dependency satisfied; still blocked on PM3
