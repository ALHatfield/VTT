# Archived Phase PM1: 3D Dice Physics & Rendering (Post-MVP)

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-25

---

## Phase PM1: 3D Dice Physics & Rendering (Post-MVP)

**Status:** Complete
**Dependencies:** Phase 4E

**Notes:** `.project/handoffs/play-area-PM1-3d-dice-roller.md`
**Project_Pathfinder:** `~/Desktop/dice`

### Goals

- Replace instant roll feedback with an optional immersive 3D dice throw overlay
- Preserve authoritative server roll results while improving visual experience

### Tasks

- [x] Extract reusable dice engine from `~/Desktop/dice` into npm workspace package (`dice/`)
- [x] Package core primitives (`DiceDefinition`, physics config, roll lifecycle types)
- [x] Package 3D renderer and scene orchestration (`DiceScene`) with clean mount/unmount API
- [x] Integrate 3D dice overlay canvas in Play Area UI without disrupting PixiJS map interactions
- [x] Wire chat + token quick-roll triggers to start a 3D throw animation
- [x] Keep server roll authority: animation reveals server-produced result, never client-generated result
- [x] Add accessibility and fallback mode (instant 2D result when WebGL/physics is unavailable)
- [x] Add settings toggle per user for 3D dice enable/disable and reduced motion behavior
- [x] Add automated tests for package API contracts and client integration boundaries
- [ ] Add manual performance pass for low-end devices (deferred — pre-sim worst case flagged in review, needs low-end hardware)

### Decisions

- **Pre-simulation architecture**: the full cannon-es roll runs invisibly (fixed 60 Hz, 8 s cap) before any frame renders; the physically-landed face gets the server's result texture stamped onto it (material swap), then the recorded throw plays back. The shown value is correct by construction — dice are never reoriented to a predetermined face.
- **Renderer swap seam**: client integrates via the `DiceAnimator` interface + `DiceAnimationMode` (`'instant' | '3d'`), mirroring the FogMode pattern, so a different dice library can replace `@vtt/dice` behind one factory function.
- **RNG deliberately not ported** from the dice project — the server (`crypto.randomInt`) remains the only source of roll results.
- **Gold glow** (`0xd4af37` emissive) marks the result face the moment the die lands, before the flatten rotation squares it upright.
- **Arena walls**: camera frustum corners are intersected with the ground plane to install invisible physics walls at the visible canvas edges (recomputed on resize) — dice bounce instead of sliding off-screen.
- **Instant fallbacks**: WebGL unavailable, `prefers-reduced-motion`, animator init failure, d100, or >8 dice all reveal directly in chat; a held roll message always flushes via an 8 s safety timeout.
- **Dev-only camera controls** toggle (orbit/zoom) lives in the DiceRollerButton settings, gated by `import.meta.env.DEV`.
- **Three.js is dynamically imported** — users who never enable 3D dice don't download the renderer.

### Open Questions

---


