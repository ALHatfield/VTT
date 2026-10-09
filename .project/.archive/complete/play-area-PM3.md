# Feature: play-area — Phase PM3: Fog of War - Line of Sight Runtime (Post-MVP)

**Completed:** September 29, 2026
**Feature:** `play-area`

## Deliverables

### shared
- `shared/src/types/play-area.ts` (modified) — `ObstacleBounds`, `RaycastHit`, `VisionSource`, `VisibilityPolygon` (`source`, `partyVisible`), `DoorState`, `VisionRefreshPayload`, `VisionUpdatedPayload`, `DoorTogglePayload`, `DoorToggledPayload`
- `shared/src/constants/play-area.ts` (modified) — `VISION_EVENTS` (`play-area:vision:refresh|updated`, `play-area:door:toggle|toggled`), `DOOR_TOGGLE_COOLDOWN_MS`
- `shared/src/validators/play-area.ts` (+ `.test.ts`, modified) — `visionRefreshPayloadSchema`, `doorTogglePayloadSchema` (UUIDs, strict)

### server
- `server/src/features/play-area/line-of-sight.ts` (+ `.test.ts`) — ray/segment intersection, ±ε corner rays, circle-crossing rays, sorted CCW polygons, collinear/duplicate simplification, `SegmentGrid` spatial buckets, door visibility sampling, `inscribedRadius`
- `server/src/features/play-area/vision.scheduler.ts` (+ `.test.ts`) — serialized per-scene trailing throttle with `schedule` / `runNow`
- `server/src/features/play-area/vision.socket.ts` (+ `.test.ts`) — DM-only `vision:refresh`; role/visibility/active-scene-gated, rate-limited `door:toggle`
- `server/src/features/play-area/doors.service.ts` — find door, conditional `isOpen` flip
- `server/src/features/play-area/vision.service.ts` (+ `.test.ts`, modified) — scene obstacles + lights loading, token/light polygons, party door + party light visibility, role-gated `vision:updated`, wall-clamped exploration
- `server/src/features/play-area/fog-exploration.service.ts` (modified) — `radiusPx` override for exploration candidates
- `server/src/features/play-area/play-area.socket.ts` (modified) — uses shared scheduler, registers vision handlers
- `server/src/features/play-area/tokens.routes.ts` (modified) — REST token changes use serialized `flushVisionSync`
- `server/src/features/play-area/lights.socket.ts` (modified) — temporary light changes recompute vision

### client
- `client/src/features/play-area/canvas/doors/DoorLayer.ts` (+ `.test.ts`) — clickable door markers above fog
- `client/src/features/play-area/hooks/useLineOfSight.ts` (+ `.test.ts`) — scene-scoped polygons/doors, buffered polygon commit, party-view filter, visible-light set
- `client/src/features/play-area/canvas/fog/fog-mask-math.ts` (+ `.test.ts`, modified) — `resolveActiveVision`
- `client/src/features/play-area/canvas/fog/FogMaskService.ts` (modified) — composes visibility polygons into active + explored masks
- `client/src/features/play-area/canvas/ForegroundLayer.ts` (+ tests, modified) — `setVisibilityPolygons`; legacy + PM2 paths
- `client/src/features/play-area/canvas/CanvasManager.ts` (modified) — `doorLayer`, `setDoors`, `setVisibilityPolygons`, `onDoorToggle`, editor-mode hiding, destroy
- `client/src/features/play-area/hooks/usePlayAreaSocket.ts` (+ `.test.ts`, modified) — `onVisionUpdated`, `onDoorToggled`, `emitVisionRefresh`, `emitDoorToggle`
- `client/src/features/play-area/hooks/usePlayAreaLighting.ts` (+ `.test.ts`, modified) — glow filter via `visibleLightIds`
- `client/src/features/play-area/PlayArea.tsx` (modified) — wiring, scene-scoped reveals, DM refresh on wall/light edits

## Test Results

```
$ npm run phase:verify -- --target full --compact
> client@0.0.1 copilot:lint — tsc --noEmit --pretty false (clean)
> server@0.0.1 copilot:lint — tsc --noEmit --pretty false (clean)
Suites: 368 passed, 0 failed (368 total)
Tests:  1140 passed, 0 failed, 0 skipped (1140 total)
All tests passed.
```

- PM3 suites alone: server `line-of-sight`, `vision.*`, `lighting` → 69 passed; client `features/play-area` → 416 passed
- `vision.socket.test.ts` (live Socket.IO): DM/player door toggles, unseen-door `NOT_FOUND`, observer `FORBIDDEN`, inactive-scene rejection, non-door rejection, rate limit, payload/campaign validation, DM-only refresh, `door:toggled` not sent to other players
- Performance: 4 emitters × 225 local segments recompute averages well under the 8 ms target (`line-of-sight.test.ts > performance`)
- `npm run dev:lifecycle:verify` → `HEALTHY 5173`, `HEALTHY 3001`

## Decisions & Insights

- LOS runs on the server so players never receive wall geometry beyond door segments; the client only composes polygons into the existing fog masks (legacy + PM2)
- Unobstructed tokens send no polygon and keep circular (soft-edge-capable) reveals; lights always send a polygon
- `vision:updated` precedes `token:vision:sync`; client buffers polygons and commits with reveals in one React batch. Reveals, polygons, and doors are stored with their `sceneId` instead of being cleared on scene change, so an early join-time sync is not lost
- Vision recompute switched from resettable debounce (starves under continuous movement) to a serialized trailing throttle; every trigger (socket moves, REST, door toggles, light changes, refresh) goes through it so broadcasts cannot arrive out of order
- Review found persistent exploration uncovering rooms behind walls — fixed by recording the circle inscribed in the visibility polygon
- User-requested additions: lights reveal their wall-clipped area; lights only count when the party has line of sight to the light's origin (unlimited range), and unseen lights' glows are hidden for players and in the DM player-view preview
- Door markers live in a `DoorLayer` above Foreground (a fifth world-container child) because ForegroundLayer is `eventMode: 'none'`; `canvas.instructions.md` should be updated
- Observers keep the 4F.1 rule (no reveals/polygons/doors/light glows); "DM-selected LOS" needs a selection UI — revisit in PM6
- Gotchas: duplicate vertices from ±ε rays must be deduped before collinear simplification; FogMaskService works in mask space (×`maskResolutionScale`)
- Pre-existing infra flake (4G, PM1, 5B, 5G) root-caused during close-out: production bcrypt cost (12 rounds ≈ 250 ms per hash and per login) in nearly every server `beforeEach` starved the event loop in full runs → hook timeouts, dropped sessions (401/403), ECONNRESET. `server/src/test-setup.ts` now mocks `password.js` with 4 rounds (tests only). `vision.socket.test.ts` dropped from ~15 s to ~1.7 s. A rare load-only ECONNRESET remains and is absorbed by the runner's existing one-shot retry
- Deferred to PM6: clipping PM4 glow sprites against walls (lit *reveal areas* are already wall-clipped); per-viewer occlusion of lit areas beyond the light-origin check

## Dependencies Unlocked

- `play-area` PM6 (Advanced Vision & Atmosphere) — depends on PM3 + PM4, both now complete
