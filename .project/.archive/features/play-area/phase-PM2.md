# Archived Phase PM2: Fog of War - Optimized Rendering (Post-MVP)

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-04

---

## Phase PM2: Fog of War - Optimized Rendering (Post-MVP)

**Status:** Complete

**Dependencies:** Phase 4F

**Notes:** `.project/notes/play-area-PM2-fog-benchmark.md`

### Goals

- Upgrade baseline fog rendering to a GPU-first pipeline that scales beyond simple polygon overlays
- Support persistent exploration and ambient visibility modes without pushing heavy work onto the CPU

### Tasks

- [x] Replace simple fog overlays with a `RenderTexture` mask pipeline on `ForegroundLayer`
- [x] Support dual-layer fog states: active vision, explored shroud, and fully hidden regions
- [x] Batch multiple vision stamps into a single container render pass instead of per-unit renders
- [x] Add soft-edge support via radial gradient masks or Pixi filters for less harsh reveal boundaries
- [x] Make the mask pipeline camera-aware so pan/zoom and future viewport changes do not desync the reveal texture
- [x] Add scene-level fog rendering settings (`fogMode`, mask resolution, edge softness, shroud alpha)
- [x] Benchmark the upgraded pipeline with multiple simultaneous reveal sources and large maps
- [x] Shared types: `FogMaskConfig`, `VisionStamp`, `ExplorationMode`
- [x] Tests: mask composition logic, camera alignment, persistent exploration state, multi-source batching

### Performance Targets

- Maintain 60 FPS with 20+ simultaneous reveal sources on a standard encounter map
- Keep fog mask recomposition below 2 ms on the main play-area render path during typical movement

### Open Questions

- ~~Should persistent exploration ship as a campaign-level setting, a scene-level setting, or both?~~ Resolved: scene-level (`Scene.fogConfig`).
- ~~Should soft edges be texture-driven, filter-driven, or configurable per scene?~~ Resolved: configurable per scene (`off` / `radial` / `filter`), defaulting to the cheapest mode.

### Decisions

- **Two masks, not one.** `FogMaskService` composes an `active` and an `explored` RenderTexture. Two isolated overlay groups on `ForegroundLayer` are erased by them, producing active / explored-shroud / hidden without per-pixel CPU work. Combined default alphas (0.55 shroud over 0.78 hidden) reproduce the 4F opacity of 0.9 for never-explored ground.
- **Masks are authored in world space** and live inside the world container, so camera pan/zoom cannot desync the reveal. Mask sprites are scaled by `1 / maskScale`.
- **Mask resolution is capped** by `FOG_MASK_MAX_TEXTURE_DIMENSION` (4096) regardless of the scene setting, bounding GPU memory on large maps.
- **Exploration is server-authoritative and role-gated.** Stamps are derived only from player-visible emitters (player-owned + ally NPC), and delivered only to DM and player sockets — observers receive nothing, matching the vision-sync contract.
- **Exploration syncs as a delta.** `play-area:fog:exploration:sync` carries `mode: 'append' | 'replace'`; the full set is fetched over REST on join/reconnect. Recording stops at `FOG_EXPLORATION_MAX_STAMPS` so the stored set can never exceed what a rehydrate returns.
- **Exploration rows are deduplicated on a quantized `x:y` cell key**, with the widest radius winning within a batch, so a token idling or jittering does not grow the table.
- **REST is the single write path for fog config.** The route broadcasts `play-area:fog:config:updated`; there is no parallel socket write handler.
- **Legacy 4F rendering is retained** behind `fogMode: 'legacy'` (the default) as a rollback path with no data loss.

### Definition of Done (Acceptance Criteria)

- [x] Fog rendering uses a RenderTexture mask pipeline on ForegroundLayer with no regression to existing 4F behavior
- [x] Dual-layer fog states (active, explored, hidden) can be toggled via scene config and render correctly after reload
- [x] Camera pan/zoom keeps fog masks aligned with world coordinates under normal interaction and reconnect flows
- [x] Multi-source stamping supports at least 20 simultaneous reveal emitters while preserving target frame rate
- [x] PM2 settings are persisted, validated, and shared through typed contracts (`FogMaskConfig`, `VisionStamp`, `ExplorationMode`)
- [x] Automated tests cover mask composition, camera alignment, and persistence; manual benchmark checklist is documented and executed

### Delivery Plan (Sequencing)

- [x] PM2.1 Rendering foundation: Introduce mask service, RenderTexture lifecycle, and ForegroundLayer integration
- [x] PM2.2 Visual model: Add active/explored/hidden state composition and soft-edge implementation toggle
- [x] PM2.3 Configuration + persistence: Add scene-level fog config, shared validator/types, and migration updates if required
- [x] PM2.4 Performance hardening: Batch stamping optimization, resolution tuning, and instrumentation hooks
- [x] PM2.5 Validation + rollout: Complete automated coverage, run benchmark matrix, and stage release behind a feature flag

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

- [x] Gate PM2 renderer behind a scene-level feature flag (`fogMode: legacy | pm2`)
- [x] Keep legacy 4F polygon path as fallback for one release window
- [ ] Enable PM2 by default only after benchmark and bug threshold targets are met
- [x] Document rollback: switch scene back to `legacy` without data loss

### Validation Matrix

- [x] Unit: mask composition utilities, stamp ordering, state merge logic
- [x] Integration: scene config -> server validation -> client render pipeline
- [x] Integration: reconnect and room rejoin restore fog parity for DM and players
- [x] Performance: 1, 10, 20, 40 reveal sources at multiple map sizes (small, standard, large)
- [x] Compatibility: fallback behavior on reduced-motion and lower GPU capability environments

### Ownership and Handoffs

- [x] Client play-area: mask pipeline, rendering controls, perf instrumentation
- [x] Server/shared: fog config schema/types, persistence contracts, validation
- [x] QA pass: benchmark capture, regression sweep against Phase 4F baseline

---


