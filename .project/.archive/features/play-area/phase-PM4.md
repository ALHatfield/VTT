# Archived Phase PM4: Dynamic Light Rendering (Post-MVP)

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-29

---

## Phase PM4: Dynamic Light Rendering (Post-MVP)

**Dependencies:** Phase PM2 + editor 5G

**Notes:** `.project/notes/play-area-PM4-lighting-effects.md`

### Goals

- Render editor-authored light emitters live on the play-area canvas with organic animation
- Support temporary DM-placed encounter lights during play

### Tasks

- [x] Load scene lights (from editor 5G) into the play-area canvas and invalidate on `editor:lights:updated`
- [x] Implement additive-blend light sprites or textures with configurable color, intensity, radius, and falloff
- [x] Add layered sine/noise flicker animation, deterministic from persisted seed (no server ticking)
- [x] Add decorative ember particles for fireplace-class emitters, disabled under reduced-performance settings
- [x] Add temporary DM-placed lights during play (session-scoped, not persisted to the scene)
- [x] Shared types in `shared/src/types/play-area.ts`: `TemporaryLight`, `LightSourceUpdatePayload`
- [x] Socket events: `play-area:light:create`, `play-area:light:update`, `play-area:light:updated`, `play-area:light:delete`
- [x] Tests: light serialization, flicker determinism bounds, DM-only controls, render-budget guardrails

### Decisions

- Persistent lights are authored in editor (5G); play-area only renders them plus session-scoped temporary lights
- Light animation is client-side and deterministic; only placement/config changes sync over sockets
- Lighting is a tinted additive glow layer above the map — it does not replace the fog mask
- `LightLayer` is its own world-container layer between Background and Playground, so fog (Foreground) always composites over light and never leaks hidden areas
- Players read lights via member-accessible `GET /api/campaigns/:id/scenes/:sceneId/lighting` (`{ authored, temporary }`); the editor 5G list route stays DM-only
- Temporary lights live in an in-memory server store (max `MAX_TEMPORARY_LIGHTS_PER_SCENE` = 50); every change broadcasts the full scene snapshot on `play-area:light:updated`
- The editor's existing `LightSourceUpdatePayload` is reused as `TemporaryLightUpdatePayload.changes` rather than redefined (avoids a duplicate shared export)
- Animation is driven by wall-clock time (`Date.now()`) so seeded flicker stays in phase across clients
- Render budget: at most `MAX_ANIMATED_LIGHTS` (100) animate and `MAX_EMBER_EMITTERS` (16) emit embers; extras render static. `prefers-reduced-motion` freezes animation and hides embers
- Wall-aware light clipping deferred to PM6 — PM3 obstacle geometry does not exist yet

### Performance Targets

- Support 50+ simultaneous dynamic lights without visible frame drops on a typical map
- Keep per-frame light animation work under 3 ms before optional LOS clipping is applied

---


