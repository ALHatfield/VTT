# Archived Phase 5G: Light Emitter Authoring

- Feature: `editor`
- Source: `.project/features/editor.md`
- Archived: 2026-09-29

---

## Phase 5G: Light Emitter Authoring

**Dependencies:** editor 5E, play-area PM2

**Notes:** `.project/notes/play-area-PM4-lighting-effects.md`

### Tasks

- [x] Add `LightSource` model to Prisma schema (scene-scoped: position, radius, color, intensity, falloff, `emitterType`, `animationMode`)
- [x] Add shared types to `shared/src/types/editor.ts`: `LightSource`, `LightEmitterType`, `LightAnimationMode`, `LightSourceCreatePayload`, `LightSourceUpdatePayload`
- [x] Add Zod validators for light payloads in `shared/src/validators/editor.ts`
- [x] Create REST endpoints for light CRUD (DM-only): list by scene, create, update, delete
- [x] Add warm/cold preset templates (torch, fireplace, lantern, aura beacon, custom) as named defaults
- [x] Build light placement in editor mode: drag preset from a lights palette onto the canvas
- [x] Build light inspector panel: color, intensity, radius, falloff, animation mode toggle
- [x] Render placed lights as editor-only gizmos (position marker + radius ring) — no live glow rendering
- [x] Add per-scene default weather/atmosphere preset field to scene settings (consumed later by play-area PM5)
- [x] Socket event: `editor:lights:updated` broadcast for open play-area clients
- [x] Write tests: light CRUD validation, preset serialization, DM-only access

### Decisions

- Authored (persistent) lights are editor-owned; temporary encounter-time lights placed live by the DM are play-area-owned (PM4) — both share the same `LightSource` types
- Editor renders gizmos only — the additive-blend glow, flicker animation, and particles are play-area PM4 runtime work
- Animation parameters (mode, seed) are persisted so PM4 can animate deterministically client-side; the server never ticks animation
- Scene default weather preset lands here as a settings field only — no rendering until play-area PM5
- Light `radius` is stored in grid cells (like token vision/aura radius); `intensity` and `falloff` are 0–1 (falloff 0 = hard edge, 1 = fades across the full radius)
- Create payloads only require `emitterType` + `x`/`y`; the server fills omitted fields from `LIGHT_PRESETS` so presets stay authoritative in `shared/`
- `animationSeed` is server-assigned (`crypto.randomInt`) and immutable — strict schemas reject client-supplied seeds and ownership fields
- Emitter enum value for "aura beacon" is `beacon` (Prisma enums cannot contain hyphens); display label is "Aura Beacon"
- Weather preset is a `Scene.weatherPreset` enum column (`none | rain | snow | haze`) exposed via editor-owned DM-only `GET/PATCH /scenes/:sceneId/atmosphere`; not added to the play-area `Scene` type or broadcast — PM5 decides player-facing read/broadcast
- Inspector edits apply optimistically and are debounced per light (`LIGHT_UPDATE_DEBOUNCE_MS`); pending and in-flight edits are overlaid on socket-triggered refreshes and flushed on scene change/unmount
- Placement snaps to the half-cell lattice (Alt bypasses); presets can also be added by click/Enter at the view centre for keyboard access; lights are repositioned via inspector X/Y fields (no canvas drag in 5G)
- Light gizmos mount on the Foreground layer via a non-interactive `LightOverlay`, visible only in editor mode for DMs

---


