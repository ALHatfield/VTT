# Feature: play-area

> **Slug:** `play-area`
> **Feature dirs:** `client/src/features/play-area/`, `server/src/features/play-area/`
> **Instructions:** `.github/instructions/feature-play-area.instructions.md`
> **Shared types:** `shared/types/play-area.ts`

---

## Current Status

| Phase | Name | Status |
| ----- | ---- | ------ |
| 4L | Scene Switching & Spawn Point | Not Started |
| 4M | Scene Bundle & Preload | Not Started |
| PM5 | Weather & Environmental Effects | Not Started |
| PM6 | Advanced Vision & Atmosphere | Not Started |

Phases 4A–4K and PM1–PM4 complete. See `.project/.archive/features/play-area/` for archived phase details.

---

## Phase 4L: Scene Switching & Spawn Point

**Dependencies:** editor Phase 5H

### Tasks
- [ ] Prisma: add `spawnX Float?` and `spawnY Float?` to `Scene` (world coordinates; null = scene center)
- [ ] Editor: add a Spawn Point tool (DM only) that places/moves a spawn marker; autosaves via `PATCH /api/campaigns/:id/scenes/:sceneId`; marker is never rendered for players
- [ ] Include spawn point in editor 5H scene duplicate
- [ ] Shared constants: `SCENE_ACTIVATE: 'play-area:scene:activate'`, `SCENE_ACTIVATED: 'play-area:scene:activated'`
- [ ] Shared types/validators: `SceneActivatePayload` { campaignId, sceneId }, `SceneActivatedPayload` { campaignId, sceneId, relocatedTokens }
- [ ] Server handler for `play-area:scene:activate`: DM only; validates the scene belongs to the campaign; in one transaction clears `isActive` on the previous scene, sets it on the target, and moves every `type = player` token to the target scene
- [ ] Spawn formation: place player tokens in a spiral around the spawn point, snapped to grid cells, skipping occupied cells and cells outside scene bounds
- [ ] Leave monster, NPC, and misc tokens on their own scenes
- [ ] Reset session-only state on switch: end active initiative, clear drawings, measurements, and temporary lights from the previous scene
- [ ] Broadcast `play-area:scene:activated` to `campaign:{id}` (including sender); all clients unload the current scene and load the new one
- [ ] Update campaigns 3B invite flow so newly invited players get their token on the active scene at its spawn point
- [ ] Add activation controls to the editor's `SceneStrip` (5H): live badge on the active scene, "Activate" action with confirmation on each card (DM only)
- [ ] Add a GSAP fade transition overlay on all clients while the new scene loads
- [ ] Write tests: RBAC (player/observer rejected), cross-campaign scene rejection, single-active invariant under concurrent activations, spawn formation (occupied/out-of-bounds cells), non-player tokens untouched, session state reset, broadcast payload, reconnect lands on the new active scene

### Decisions
- The whole party moves together — every player token is relocated to the spawn point on activation; split parties are out of scope
- Activation is a socket intent (not REST) because it's a live-session action that must broadcast atomically
- Scene switching lives in the editor's `SceneStrip` — the DM enters editor mode to switch scenes; there is no separate play-mode switcher
- Fog regions and fog exploration are scene-scoped and persist, so returning to a scene restores what players already explored
- Initiative ends on scene switch — combat doesn't carry across maps

---

## Phase 4M: Scene Bundle & Preload

**Dependencies:** Phase 4L

### Tasks
- [ ] `GET /api/campaigns/:id/scenes/:sceneId/bundle` — returns scene, tokens, placements (with asset URLs), walls, lights, fog regions, and fog config in one response, loaded in parallel inside one read transaction
- [ ] Role-filter the bundle exactly like the existing individual endpoints (e.g. walls stay DM-only); players may only request the active scene
- [ ] Add a scene `version` (max `updatedAt` across scene children) to the bundle; support `ETag` / `If-None-Match` → 304
- [ ] Shared type: `SceneBundle`
- [ ] Replace the 7 separate play-area mount requests with one bundle request; a single owner component distributes initial data to hooks via props (no duplicate fetching hooks)
- [ ] Client scene cache: in-memory LRU of recent bundles (size as a named constant), invalidated by existing socket update events
- [ ] Texture lifecycle: preload with PixiJS `Assets.backgroundLoad`; `Assets.unload` textures of scenes evicted from the cache to bound GPU memory
- [ ] DM "Stage scene" action in the `SceneStrip` card context menu: emits `play-area:scene:stage` (DM only) → server broadcasts `play-area:scene:staged` with asset URLs only, so clients warm textures before activation
- [ ] Show a loading progress indicator in the scene transition overlay
- [ ] Write tests: bundle parity with individual endpoints per role, player blocked from inactive scenes, 304 path, cache eviction + texture unload, stage event RBAC, payload contains no scene data beyond asset URLs

### Performance Targets
- One HTTP request for scene data on load or switch
- Scene switch under 1s with staged/cached assets; under 2.5s cold for a 4096×4096 background

### Decisions
- Keep the individual endpoints for incremental updates; the bundle is for initial load and scene switch only
- Staging sends asset URLs only, never scene metadata, to keep spoiler exposure minimal

---

## Post-MVP Phases

## Phase PM5: Weather & Environmental Effects (Post-MVP)

**Dependencies:** Phase 4A, editor Phase 5J

**Notes:** `.project/notes/play-area-PM5-environmental-effects.md`

### Goals

- Add scene-scale atmosphere effects without disrupting token interaction or readability
- Establish a reusable effects pipeline for weather, haze, distortion, and future environmental presets

### Tasks

- [ ] Add particle-driven weather presets for rain, snow, drifting ash, and scene haze
- [ ] Evaluate `@pixi/particle-emitter` or equivalent particle tooling against current workspace constraints
- [ ] Add displacement/filter-based effects for heat shimmer, magical distortion, or water haze where appropriate
- [ ] Read the authored `WeatherConfig` (editor 5J) as the scene default on load; apply reduced-motion fallbacks client-side
- [ ] Define layering rules so weather does not obscure token readability, hover cards, or chat usability
- [ ] Shared types: `WeatherOverridePayload`, `EnvironmentalEffect` (preset/config types are owned by editor 5J — don't duplicate)
- [ ] Socket events: `play-area:weather:update`, `play-area:weather:updated`
- [ ] Tests: emitter config validation, reduced-motion behavior, scene preset serialization, render-budget checks

### Performance Targets

- Support dense rain or snow on a standard scene while maintaining 60 FPS on the active viewport
- Keep environmental FX under 4 ms of additional render cost on mid-range hardware

### Open Questions

- Should weather be purely visual, or should later systems hook gameplay or visibility modifiers into it?
- Which effects belong in PM5 versus PM6 polish to keep the first weather pass constrained?

### Decisions

- Authoring lives in the editor's `WeatherSection` (editor 5J); PM5 owns runtime rendering and live-session controls only
- Socket weather overrides are ephemeral — they never persist to `Scene`; scene load always returns to the authored default

---

## Phase PM6: Advanced Vision & Atmosphere (Post-MVP)

**Dependencies:** Phase PM3 + Phase PM4

**Notes:** `.project/notes/pixiejs-canvas-notes.md`

### Goals

- Merge line-of-sight, fog, lighting, and atmosphere into one cohesive visual system
- Finish the final polish and performance pass for advanced PixiJS canvas features

### Tasks

- [ ] Combine PM2 fog masks, PM3 visibility polygons, and PM4 light emitters into a layered atmosphere stack
- [ ] Wall-aware light clipping: clip PM4 light glows against PM3 obstacle geometry (deferred from PM4)
- [ ] Add soft-shadow or penumbra-style edge treatments where vision and light meet obstacle boundaries
- [ ] Add final scene controls for exploration mode, light intensity, atmosphere quality, and accessibility fallbacks
- [ ] Validate effect ordering between fog, weather, tokens, overlays, and future status/aura rendering
- [ ] Run an end-to-end performance pass across heavy scenes with lights, LOS, fog, and weather active together
- [ ] Document the canonical integration pattern: CPU raycasting generates polygons; GPU mask composition renders them efficiently
- [ ] Tests: combined render-order behavior, accessibility fallbacks, stacked-effect performance, regression coverage for visual sync

### Performance Targets

- Maintain 60 FPS with fog, LOS, dynamic lights, and one active weather preset enabled together
- Keep total advanced-canvas overhead under 10 ms on mid-range hardware for a combat-scale scene

### Open Questions

- What is the minimum visual fidelity we must preserve when reduced-motion or low-performance mode is active?

### Decisions

- Atmosphere authoring (walls, lights, scene presets) lives in editor 5F/5G; live session controls live in play-area — resolved by the PM3/PM4 split

---

## Cross-Feature Dependencies

| Depends On          | Why                                         |
| ------------------- | ------------------------------------------- |
| campaigns Phase 3A  | Play area lives within a campaign context   |
| characters Phase 6A | Initiative tracker uses character modifiers |
| editor Phase 5F     | PM3 LOS runtime consumes authored wall geometry |
| editor Phase 5G     | PM4 renders authored light emitters |
| editor Phase 5H     | 4L activates scenes managed by the Scene Library |
| editor Phase 5J     | PM5 renders the authored `WeatherConfig` |

| Depended On By      | Why                                                    |
| ------------------- | ------------------------------------------------------ |
| characters Phase 6B | Character-token linking renders on play area canvas    |
| characters Phase 6C | Interactive rolls from sheets appear in play area chat |
| editor Phase 5I     | Scene templates capture the 4L spawn point             |

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**

- 60 FPS maintained with viewport culling for 1000+ tiles
- Token drag-to-move with optimistic updates + server confirmation + rollback on rejection
- 100ms debouncing for token drag events — balances responsiveness and network load
- <200ms round-trip latency for token moves (client → server → broadcast)
- Event queuing during disconnection with replay on reconnect — prevents lost actions
- Campaign-specific Socket.IO rooms for broadcasting (`campaign:{id}`)
- Refactoring MapViewer (1000+ lines) into 4 focused hooks was essential for maintainability:
  - `useMapGridConfig` (300 lines) — grid state, pan/zoom, viewport
  - `useTokenSelection` (150 lines) — hover/select state, card positioning
  - `useCharacterLinking` (120 lines) — character modal state
  - `useMapCalibration` (150 lines) — magic wand grid calibration

**Critical lesson — WebSocket State Sync:**

> Duplicate custom hook instances cause stale data. If two components both use `useWebSocket()` and maintain local state, one will have stale HP/position data after a broadcast. **Solution:** Single source of truth passed via props, not duplicate hook instances. The parent component owns the socket connection and distributes state downward.

**What we're changing:**

- Project_Pathfinder used raw HTML Canvas API → new build uses PixiJS (better performance, built-in sprite management, layer containers)
- Project_Pathfinder used Jest → new build uses Vitest (faster, Vite-native)
- Project_Pathfinder chat used message polling as fallback → new build is Socket.IO only
- Project_Pathfinder used JWT for socket auth → new build uses session cookies in handshake
