# Feature: play-area

> **Slug:** `play-area`
> **Feature dirs:** `client/src/features/play-area/`, `server/src/features/play-area/`
> **Instructions:** `.github/instructions/feature-play-area.instructions.md`
> **Shared types:** `shared/types/play-area.ts`

---

## Current Status

| Phase | Name                               | Status      |
| ----- | ---------------------------------- | ----------- |
| 4F.3  | Canvas Toolbar Shell & Navigation  | Not Started |
| 4F.4  | Fog of War Toolbar Integration     | Not Started |
| 4F.5  | NPC Token Placement Tool           | Not Started |
| 4H    | Initiative & Turn Tracker          | Not Started |
| 4I    | Token Auras & Status Visualization | Not Started |
| 4J    | Measure Tool & Player Color        | Not Started |
| 4K    | Drawing Tools                      | Not Started |

---

## Phase 4F.3: Canvas Toolbar Shell & Navigation

**Dependencies:** Phase 4F.2
**Notes:** `.project/notes/play-area-4F.3-toolbar-features.md`

### Overview

Establishes the tool-mode architecture, refactors existing pointer handling, and delivers the toolbar shell with Select, Pan, and Zoom — the foundation all future tools plug into. The existing top-bar `PlayAreaToolbar` is renamed to `CampaignToolbar` (navigation only); a new vertical `CanvasToolbar` docks to the left edge for all canvas interaction tools.

### Tasks

**Canvas architecture refactor**

- [ ] Refactor pointer handling in `PlayArea.tsx` to dispatch through a centralized tool-mode system instead of hardcoded pan/fog/select logic
- [ ] Create `useToolMode` hook — manages active tool state (`'select' | 'pan' | ...`), exposes `activeTool` and `setActiveTool`
- [ ] Gate all pointer handlers (pointerdown/move/up) behind `activeTool` so each tool mode owns its own interaction behavior
- [ ] Implement right-click-drag pan as a global behavior available in all tool modes (not tied to Pan tool)

**Toolbar shell**

- [ ] Build `CanvasToolbar` component — vertical strip docked left, icon-based with tooltip labels, radio-button pattern for tool modes
- [ ] Rename existing `PlayAreaToolbar` to `CampaignToolbar` — keeps navigation ("← Back") and campaign-level buttons only
- [ ] Integrate `CanvasToolbar` into `PlayArea.tsx` — visible to all roles
- [ ] Style toolbar with CSS Modules; active tool highlighted; collapsible with plain CSS transition

**Tool: Select (default)**

- [ ] Select tool mode: click token to select, drag token to move (carries forward existing behavior)
- [ ] Rubber-band rectangle selection: click-drag on empty canvas draws selection box, selects all tokens within bounds
- [ ] Players can only select their own controlled tokens; DM can select any token
- [ ] Cursor states: `default` when hovering empty canvas, `pointer` over interactive tokens, `move` while dragging

**Tool: Pan**

- [ ] Pan tool mode: left-click-drag pans the viewport (same behavior as current default, but now gated behind tool mode)
- [ ] Cursor states: `grab` when idle, `grabbing` while dragging

**Zoom controls (persistent, not a tool mode)**

- [ ] Scroll-wheel zoom remains always-on regardless of active tool
- [ ] Add floating `+`/`-` zoom buttons in top-right corner of the canvas (HTML overlay, not inside toolbar)
- [ ] Zoom buttons call existing `CanvasManager.zoom()` with fixed delta values

**Role-based tool visibility**

- [ ] DM sees all tools; Player sees Select + Pan; Observer sees Pan only (Pan is default for Observer)
- [ ] Gate via `useCampaignRole` hook in `CanvasToolbar`
- [ ] Future phases add new tools without modifying this gating pattern

**Tests**

- [ ] Tool mode switches correctly and pointer behavior changes per mode
- [ ] Right-click-drag pans in all tool modes
- [ ] Select tool: rubber-band selection selects correct tokens
- [ ] Zoom buttons call `CanvasManager.zoom()` correctly
- [ ] Role gating: correct tools visible per role (DM/Player/Observer)

### Decisions

- The toolbar is a unified component — role gating hides tools, not components
- Zoom is a persistent control (floating buttons + scroll wheel), not a tool mode
- Right-click-drag pan is global, available in every tool mode — users never lose the ability to pan
- The existing `PlayAreaToolbar` becomes `CampaignToolbar` for navigation; canvas tools live exclusively in `CanvasToolbar`
- Future phases add new tools to the toolbar (Fog → 4F.4, NPC → 4F.5, Measure → 4J, Drawing → 4K, Turn Tracker toggle → 4H)
- Keyboard shortcuts deferred — all tools are mouse-activated only in this phase

---

## Phase 4F.4: Fog of War Toolbar Integration

**Dependencies:** Phase 4F.3

### Overview

Migrates existing fog-of-war controls from the campaign toolbar into the new canvas toolbar system. No new fog behavior — this is a refactor to consolidate all canvas tools in one place.

### Tasks

- [ ] Add `'fog-reveal'` and `'fog-hide'` to tool mode union type in `useToolMode`
- [ ] Migrate fog drawing from `CampaignToolbar` buttons into `CanvasToolbar` fog tool section
- [ ] Fog tool activates with sub-mode selector: Reveal / Hide (replaces old `fogMode` state)
- [ ] Existing fog pointer handlers remain intact, gated behind `activeTool === 'fog-reveal' | 'fog-hide'`
- [ ] Add fog vision toggle (dm/player view) in the fog tool's expanded panel
- [ ] Add `useFogViewMode` hook tracking `'dm' | 'player'` view state
- [ ] `ForegroundLayer.setViewMode(mode)` changes fog alpha: semi-transparent for DM, fully opaque for player view
- [ ] Remove fog mode buttons from `CampaignToolbar` (cleanup)
- [ ] Tests: fog drawing works identically to pre-refactor behavior, `ForegroundLayer.setViewMode` changes fog alpha correctly

### Decisions

- This is a migration/refactor — no new fog behavior, just relocating controls into the toolbar system
- Fog tool is DM-only

---

## Phase 4F.5: NPC Token Placement Tool

**Dependencies:** Phase 4F.3

### Overview

Adds a DM-only tool for placing NPC tokens directly from the canvas toolbar via drag-and-drop.

### Tasks

- [ ] Add `'npc-place'` to tool mode union type in `useToolMode`
- [ ] Add "NPC Tokens" section to `CanvasToolbar` with drag sources for "Ally" and "Enemy" generic tokens
- [ ] Add `useNpcDrop` hook: `dragstart` sets `npcSubtype` in `dataTransfer`; canvas `drop` handler converts pixel coordinates to grid cell coordinates and calls `POST /api/campaigns/:id/scenes/:sceneId/tokens` with `type: 'npc'`, `npcSubtype`, and a default name
- [ ] NPC tool is DM-only (gated by role check in `CanvasToolbar`)
- [ ] Tests: NPC drag payload sets correct `npcSubtype` and drop creates token

### Decisions

- NPC token placement is a toolbar tool, not a context menu action
- DM-only visibility

---

## Phase 4J: Measure Tool & Player Color

**Dependencies:** Phase 4F.3

### Overview

Adds line measurement with distance display and real-time broadcast. Introduces player color (campaign-scoped) as a prerequisite for measure and future drawing tools.

### Tasks

**Player color**

- [ ] Add `color` column to `CampaignPlayer` Prisma model (nullable `String`, default assigned on join)
- [ ] Migration: add column with default null; backfill existing rows with palette-based assignment
- [ ] Define color palette constant in `shared/constants/campaigns.ts` — 8-color preset cycling by join order
- [ ] Add `color` field to campaign member API responses
- [ ] Shared types: add `color` to `CampaignMember` type

**Measure tool mode**

- [ ] Add `'measure'` to tool mode union type in `useToolMode`
- [ ] Add Measure tool icon to `CanvasToolbar` — visible to DM and Player (not Observer)
- [ ] Click start point, drag to end point — render measurement line as PixiJS `Graphics` overlay on `PlaygroundLayer`
- [ ] Display distance label (in grid units) at midpoint of line, using scene `cellSize` for calculation
- [ ] Snap-to-grid-center by default: start and end points snap to nearest grid cell center
- [ ] Line color matches player's campaign color

**Broadcast**

- [ ] Add broadcast toggle in measure tool panel (show to all / private)
- [ ] Socket event: `play-area:measure:broadcast` — client sends `{ startX, startY, endX, endY, color }` while dragging
- [ ] Server handler: relay to campaign room (DM always sees all measurements regardless of toggle)
- [ ] Socket event: `play-area:measure:clear` — sent on mouseup or tool switch to remove line
- [ ] Shared types: `MeasureBroadcastPayload`, `MeasureClearPayload` in `shared/types/play-area.ts`

**Tests**

- [ ] Distance calculation correct for horizontal, vertical, and diagonal lines
- [ ] Snap-to-center places endpoints at grid cell centers
- [ ] Measurement line renders and clears correctly
- [ ] Broadcast relays to room; private mode hides from non-DM players
- [ ] Player color assigned on campaign join and returned in API responses

### Decisions

- Player color is campaign-scoped (stored on `CampaignPlayer`, not `User`) — a player can be red in one campaign and blue in another
- Measurement uses simple Euclidean distance for MVP; configurable diagonal styles (D&D 5E, Pathfinder) deferred
- Area-of-effect shapes (circle, cone, square templates) deferred to a post-4J phase
- Waypoints (multi-segment measurement paths) deferred

---

## Phase 4K: Drawing Tools

**Dependencies:** Phase 4F.3

### Overview

Adds ephemeral freehand and shape drawing tools with real-time broadcast. Full front-to-back feature: new tool modes, PixiJS rendering, socket relay handlers, and shared payload types.

### Tasks

**Drawing tool modes**

- [ ] Add `'draw-freehand'` and `'draw-shape'` to tool mode union type in `useToolMode`
- [ ] Add Draw tool icon to `CanvasToolbar` with sub-mode selector (Freehand / Rectangle / Circle) — visible to DM and Player
- [ ] Stroke color picker (defaults to a preset color; integrates with player campaign color after Phase 4J) and line width selector in draw tool panel

**Freehand drawing**

- [ ] Click-and-drag to draw freehand strokes on the canvas
- [ ] Render strokes as PixiJS `Graphics` paths on `PlaygroundLayer` (above grid, below tokens)
- [ ] Stream stroke data in chunks during drag (~30fps throttle) so other players see strokes in progress
- [ ] On mouseup, finalize stroke and add to local drawing list

**Shape drawing**

- [ ] Rectangle: click-drag defines opposite corners, renders outline
- [ ] Circle: click-drag defines center and radius, renders outline
- [ ] Shapes use configured stroke color and line width

**Socket broadcast**

- [ ] Server socket handler: `play-area:draw:stroke` — relay stroke chunk data to campaign room
- [ ] Server socket handler: `play-area:draw:clear` — relay clear action to campaign room
- [ ] Shared types in `shared/types/play-area.ts`: `DrawStrokePayload` (points array, color, width, shapeType), `DrawClearPayload` (scope: 'all' | 'own', userId)

**Clear drawings**

- [ ] "Clear drawings" button in draw tool panel
- [ ] DM clears all drawings; Player clears only their own
- [ ] Clear action broadcast via socket so all clients remove the appropriate drawings

**Tests**

- [ ] Freehand stroke renders correctly on canvas and clears on tool switch
- [ ] Shape tool draws rectangle and circle with correct dimensions
- [ ] Stroke data relayed via socket to other clients in real-time
- [ ] Clear action respects role: DM clears all, Player clears own
- [ ] Drawing throttle does not exceed ~30 events/second

### Decisions

- Drawings are ephemeral (not persisted to DB) for MVP — used for quick annotations during play
- Persisted drawings (saved per scene) deferred to a later phase
- Polygon/line tool (vertex-based), text tool, fill color, and drawing grouping all deferred
- Drawings render on PlaygroundLayer, not on a separate drawing layer

---

## Phase 4H: Initiative & Turn Tracker

**Dependencies:** Phase 4F.3, characters Phase 6A

### Tasks

- [ ] DM-initiated combat mode with initiative roll prompt
- [ ] Character sheet integration: auto-populate initiative modifier
- [ ] Sorted turn order sidebar component
- [ ] DM advance/reorder turns
- [ ] Active token highlight on canvas (PlaygroundLayer effect)
- [ ] Socket events: `play-area:initiative:start`, `play-area:initiative:advance`
- [ ] Tests: sort logic, turn advancement, DM-only controls

---

## Phase 4I: Token Auras & Status Visualization

**Dependencies:** Phase 4C (real-time sync for aura broadcasts)

### Tasks

- [ ] Aura radius configuration (DM-controlled), concentric rings around tokens
- [ ] Aura color customization (RGB picker), visibility toggle
- [ ] Aura types: presence, turn indicator, condition status
- [ ] Condition auras with semantic colors (stunned=red, poisoned=purple, blessed=gold)
- [ ] GSAP pulse/glow animations (200ms transitions) for aura effects
- [ ] WebSocket broadcast for aura changes (`play-area:aura:update` → `play-area:aura:updated`)
- [ ] Token inspector integration for aura radius/color fields
- [ ] Preset aura templates (Aura of Protection, Healing Aura, Danger Zone)
- [ ] Database: `auraRadius`, `auraColor` columns on Token model
- [ ] Shared types: `AuraConfig`, `AuraType`, `AuraUpdatePayload`
- [ ] Tests: aura rendering, DM-only controls, WebSocket broadcast, performance

### Performance Targets

- <5ms render per token aura
- 50+ simultaneous auras without frame drops

---

## Post-MVP Phases

## Phase PM1: 3D Dice Physics & Rendering (Post-MVP)

**Dependencies:** Phase 4E

**Notes:** `.project/notes/HANDOFF-3d-dice-roller.md`
**Project_Pathfinder:** `~/Desktop/dice`

### Goals

- Replace instant roll feedback with an optional immersive 3D dice throw overlay
- Preserve authoritative server roll results while improving visual experience

### Tasks

- [ ] Extract reusable dice engine from `~/Desktop/dice` into npm workspace package (`dice/`)
- [ ] Package core primitives (`DiceDefinition`, physics config, roll lifecycle types)
- [ ] Package 3D renderer and scene orchestration (`SceneManager`) with clean mount/unmount API
- [ ] Integrate 3D dice overlay canvas in Play Area UI without disrupting PixiJS map interactions
- [ ] Wire chat + token quick-roll triggers to start a 3D throw animation
- [ ] Keep server roll authority: animation reveals server-produced result, never client-generated result
- [ ] Add accessibility and fallback mode (instant 2D result when WebGL/physics is unavailable)
- [ ] Add settings toggle per user for 3D dice enable/disable and reduced motion behavior
- [ ] Add automated tests for package API contracts and client integration boundaries
- [ ] Add manual performance pass for low-end devices (target stable canvas interaction during throws)

### Open Questions

---

## Phase PM2: Fog of War - Optimized Rendering (Post-MVP)

**Dependencies:** Phase 4F

**Notes:** `.project/notes/play-area-fog-rendering.md`

### Goals

- Upgrade baseline fog rendering to a GPU-first pipeline that scales beyond simple polygon overlays
- Support persistent exploration and ambient visibility modes without pushing heavy work onto the CPU

### Tasks

- [ ] Replace simple fog overlays with a `RenderTexture` mask pipeline on `ForegroundLayer`
- [ ] Support dual-layer fog states: active vision, explored shroud, and fully hidden regions
- [ ] Batch multiple vision stamps into a single container render pass instead of per-unit renders
- [ ] Add soft-edge support via radial gradient masks or Pixi filters for less harsh reveal boundaries
- [ ] Make the mask pipeline camera-aware so pan/zoom and future viewport changes do not desync the reveal texture
- [ ] Add scene-level fog rendering settings (`fogMode`, mask resolution, edge softness, shroud alpha)
- [ ] Benchmark the upgraded pipeline with multiple simultaneous reveal sources and large maps
- [ ] Shared types: `FogMaskConfig`, `VisionStamp`, `ExplorationMode`
- [ ] Tests: mask composition logic, camera alignment, persistent exploration state, multi-source batching

### Performance Targets

- Maintain 60 FPS with 20+ simultaneous reveal sources on a standard encounter map
- Keep fog mask recomposition below 2 ms on the main play-area render path during typical movement

### Open Questions

- Should persistent exploration ship as a campaign-level setting, a scene-level setting, or both?
- Should soft edges be texture-driven, filter-driven, or configurable per scene?

### Definition of Done (Acceptance Criteria)

- [ ] Fog rendering uses a RenderTexture mask pipeline on ForegroundLayer with no regression to existing 4F behavior
- [ ] Dual-layer fog states (active, explored, hidden) can be toggled via scene config and render correctly after reload
- [ ] Camera pan/zoom keeps fog masks aligned with world coordinates under normal interaction and reconnect flows
- [ ] Multi-source stamping supports at least 20 simultaneous reveal emitters while preserving target frame rate
- [ ] PM2 settings are persisted, validated, and shared through typed contracts (`FogMaskConfig`, `VisionStamp`, `ExplorationMode`)
- [ ] Automated tests cover mask composition, camera alignment, and persistence; manual benchmark checklist is documented and executed

### Delivery Plan (Sequencing)

- [ ] PM2.1 Rendering foundation: Introduce mask service, RenderTexture lifecycle, and ForegroundLayer integration
- [ ] PM2.2 Visual model: Add active/explored/hidden state composition and soft-edge implementation toggle
- [ ] PM2.3 Configuration + persistence: Add scene-level fog config, shared validator/types, and migration updates if required
- [ ] PM2.4 Performance hardening: Batch stamping optimization, resolution tuning, and instrumentation hooks
- [ ] PM2.5 Validation + rollout: Complete automated coverage, run benchmark matrix, and stage release behind a feature flag

### Risks and Mitigations

- Risk: GPU memory pressure on large maps with high-resolution mask textures
  Mitigation: Cap mask resolution by scene setting, add default downscale factor, and monitor texture allocation during benchmarks
- Risk: Camera transform drift causes reveal artifacts while panning/zooming
  Mitigation: Centralize world-to-mask transform math and add camera alignment regression tests
- Risk: Soft-edge filters cause frame-time spikes on low-end devices
  Mitigation: Provide per-scene softness modes (off, radial texture, filter) and default to the cheapest mode
- Risk: Stateful exploration introduces desync between reconnecting clients
  Mitigation: Keep server authoritative, rehydrate from persisted fog state on join, and add reconnect parity tests

### Rollout Strategy

- [ ] Gate PM2 renderer behind a scene-level feature flag (`fogMode: legacy | pm2`)
- [ ] Keep legacy 4F polygon path as fallback for one release window
- [ ] Enable PM2 by default only after benchmark and bug threshold targets are met
- [ ] Document rollback: switch scene back to `legacy` without data loss

### Validation Matrix

- [ ] Unit: mask composition utilities, stamp ordering, state merge logic
- [ ] Integration: scene config -> server validation -> client render pipeline
- [ ] Integration: reconnect and room rejoin restore fog parity for DM and players
- [ ] Performance: 1, 10, 20, 40 reveal sources at multiple map sizes (small, standard, large)
- [ ] Compatibility: fallback behavior on reduced-motion and lower GPU capability environments

### Ownership and Handoffs

- [ ] Client play-area: mask pipeline, rendering controls, perf instrumentation
- [ ] Server/shared: fog config schema/types, persistence contracts, validation
- [ ] QA pass: benchmark capture, regression sweep against Phase 4F baseline

---

## Phase PM3: Fog of War - Line of Sight & Obstacles (Post-MVP)

**Dependencies:** Phase PM2 + obstacle/wall geometry model

**Notes:** `.project/notes/play-area-line-of-sight.md`

### Goals

- Move from open-circle reveals to obstacle-aware visibility polygons
- Establish the wall and obstacle geometry needed for accurate vision blocking and future lighting systems

### Tasks

- [ ] Add a wall or obstacle geometry model for scenes (`WallSegment` or equivalent obstacle primitives)
- [ ] Persist obstacle geometry per scene and expose REST/socket contracts for play-area visibility consumers
- [ ] Implement raycasting from units or reveal emitters to generate wall-aware visibility polygons
- [ ] Add angular-offset corner casting to prevent clipping at obstacle vertices
- [ ] Limit raycast work with spatial partitioning or local obstacle bucketing instead of full-scene scans
- [ ] Throttle or schedule LOS recomputation so visibility updates remain smooth under movement
- [ ] Render LOS polygons into the PM2 mask pipeline rather than treating raycasting as a separate overlay system
- [ ] Shared types: `WallSegment`, `ObstacleBounds`, `VisibilityPolygon`, `RaycastHit`
- [ ] Socket events: `play-area:vision:refresh`, `play-area:vision:updated`
- [ ] Tests: ray-segment intersection math, polygon sorting, obstacle culling, LOS throttling, role-safe delivery

### Performance Targets

- Maintain 60 FPS with at least 4 moving LOS emitters and 200+ relevant obstacle segments in the active area
- Keep LOS recomputation under 8 ms for a standard combat scene after spatial filtering

### Open Questions

- Does obstacle geometry live primarily in play-area data, editor data, or a shared scene package between both?
- Should observers follow player LOS, DM-selected LOS, or a separate read-only camera mode?

---

## Phase PM4: Dynamic Light Sources (Post-MVP)

**Dependencies:** Phase PM2

**Notes:** `.project/notes/play-area-lighting-effects.md`

### Goals

- Add real-time ambient and authored light emitters that make scenes feel alive
- Provide reusable lighting primitives that can later share geometry with PM3 obstacle-aware visibility

### Tasks

- [ ] Add scene light emitters (torch, fireplace, lantern, aura beacon, custom) with DM-authored placement/configuration
- [ ] Implement additive-blend light sprites or textures with configurable color, intensity, radius, and falloff
- [ ] Add organic flicker animation patterns for fire and candle sources without repetitive visual loops
- [ ] Support optional wall-aware clipping once PM3 obstacle geometry is available
- [ ] Add warm/cold light preset templates and per-emitter animation toggles
- [ ] Add decorative secondary effects such as ember particles for fireplace-class emitters
- [ ] Shared types: `LightSource`, `LightEmitterType`, `LightAnimationMode`, `LightSourceUpdatePayload`
- [ ] Socket events: `play-area:light:create`, `play-area:light:update`, `play-area:light:updated`, `play-area:light:delete`
- [ ] Tests: light emitter serialization, flicker determinism bounds, DM-only controls, render-budget guardrails

### Performance Targets

- Support 50+ simultaneous dynamic lights without visible frame drops on a typical map
- Keep per-frame light animation work under 3 ms before optional LOS clipping is applied

### Open Questions

- Should dynamic lights be authored in the editor only, or can DMs place temporary lights live in the play area?
- Which light properties must stay synchronized in real time versus being recalculated client-side?

---

## Phase PM5: Weather & Environmental Effects (Post-MVP)

**Dependencies:** Phase 4A

**Notes:** `.project/notes/play-area-environmental-effects.md`

### Goals

- Add scene-scale atmosphere effects without disrupting token interaction or readability
- Establish a reusable effects pipeline for weather, haze, distortion, and future environmental presets

### Tasks

- [ ] Add particle-driven weather presets for rain, snow, drifting ash, and scene haze
- [ ] Evaluate `@pixi/particle-emitter` or equivalent particle tooling against current workspace constraints
- [ ] Add displacement/filter-based effects for heat shimmer, magical distortion, or water haze where appropriate
- [ ] Support per-scene weather presets, intensity controls, and reduced-motion fallbacks
- [ ] Define layering rules so weather does not obscure token readability, hover cards, or chat usability
- [ ] Shared types: `WeatherPreset`, `WeatherConfig`, `EnvironmentalEffect`, `EffectIntensity`
- [ ] Socket events: `play-area:weather:update`, `play-area:weather:updated`
- [ ] Tests: emitter config validation, reduced-motion behavior, scene preset serialization, render-budget checks

### Performance Targets

- Support dense rain or snow on a standard scene while maintaining 60 FPS on the active viewport
- Keep environmental FX under 4 ms of additional render cost on mid-range hardware

### Open Questions

- Should weather be purely visual, or should later systems hook gameplay or visibility modifiers into it?
- Which effects belong in PM5 versus PM6 polish to keep the first weather pass constrained?

---

## Phase PM6: Advanced Vision & Atmosphere (Post-MVP)

**Dependencies:** Phase PM3 + Phase PM4

**Notes:** `.project/notes/pixiejs-canvas-notes.md`

### Goals

- Merge line-of-sight, fog, lighting, and atmosphere into one cohesive visual system
- Finish the final polish and performance pass for advanced PixiJS canvas features

### Tasks

- [ ] Combine PM2 fog masks, PM3 visibility polygons, and PM4 light emitters into a layered atmosphere stack
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

- Do advanced atmosphere controls belong in the editor, live DM controls, or both?
- What is the minimum visual fidelity we must preserve when reduced-motion or low-performance mode is active?

---

## Cross-Feature Dependencies

| Depends On          | Why                                         |
| ------------------- | ------------------------------------------- |
| campaigns Phase 3A  | Play area lives within a campaign context   |
| characters Phase 6A | Initiative tracker uses character modifiers |

| Depended On By      | Why                                                    |
| ------------------- | ------------------------------------------------------ |
| characters Phase 6B | Character-token linking renders on play area canvas    |
| characters Phase 6C | Interactive rolls from sheets appear in play area chat |

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
