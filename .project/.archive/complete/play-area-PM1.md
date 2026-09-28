# Feature: play-area — Phase PM1: 3D Dice Physics & Rendering (Post-MVP)

**Completed:** September 24, 2026
**Feature:** `play-area`

## Deliverables

### dice/ (NEW workspace package — @vtt/dice)
- `package.json`, `tsconfig.json`, `vitest.config.ts` — raw TS exports pattern (mirrors @vtt/shared); deps: `three` ^0.165, `cannon-es` ^0.20, `@types/three` (NEW)
- `src/index.ts` — public API: `DiceScene`, `createStandardDie`, `createDiceDefinition`, `MAX_CONCURRENT_DICE`, `SUPPORTED_GEOMETRY_SIDES` (NEW)
- `src/engine/dice.ts` — `DiceDefinition` model + validation; RNG deliberately NOT ported (server authority) (NEW)
- `src/renderer/geometry.ts` — d4/d6/d8/d10/d12/d20 polyhedra with per-face label textures, `quaternionForFace` (NEW)
- `src/renderer/physics.ts` — cannon-es world, per-die convex colliders, `setBounds` arena walls, `stepFixed` (NEW)
- `src/renderer/scene.ts` — `DiceScene`: pre-simulation → material stamp → recorded playback → flatten → gold glow; camera-frustum arena bounds; on-demand RAF loop; full dispose API (NEW)
- `src/engine/dice.test.ts`, `src/renderer/geometry.test.ts`, `src/renderer/scene.test.ts` — 31 tests (NEW)

### shared/
- `src/types/play-area.ts` — Added `DiceAnimationMode` (`'instant' | '3d'`, mirrors FogMode pattern) (MODIFIED)
- `src/constants/play-area.ts` — Added `DICE_3D_SUPPORTED_SIDES`, `DICE_3D_MAX_DICE`, `DICE_3D_REVEAL_TIMEOUT_MS`, `DICE_3D_STORAGE_KEY` (MODIFIED)

### client/
- `src/features/play-area/dice3d/animator.ts` — `DiceAnimator` interface + factory (library swap seam, dynamic import) (NEW)
- `src/features/play-area/dice3d/three-dice-animator.ts` — @vtt/dice-backed implementation (NEW)
- `src/features/play-area/dice3d/roll-mapping.ts` — `mapRollToDice` with structural validation of persisted rollData (NEW)
- `src/features/play-area/dice3d/roll-mapping.test.ts`, `constants.test.ts` — 19 tests (NEW)
- `src/features/play-area/hooks/useDiceSettings.ts` — localStorage mode + reduced-motion + WebGL probe fallbacks (NEW)
- `src/features/play-area/hooks/use3dDiceReveal.ts` — holds roll messages during animation, reveals on settle, 8s safety flush (NEW)
- `src/features/play-area/hooks/use3dDiceReveal.test.ts` — 9 tests (NEW)
- `src/features/play-area/components/DiceOverlay.tsx` + `.module.css` + `.test.tsx` — transparent Three.js canvas over the PixiJS map, pointer-events none (NEW)
- `src/features/play-area/components/DiceRollerButton.tsx` + `.module.css` — settings section (3D toggle, dev camera controls); menu left-aligned to fit canvas (MODIFIED)
- `src/features/play-area/PlayArea.tsx` — overlay render, reveal-hook message routing, animator-error fallback (MODIFIED)
- `package.json` — added `@vtt/dice` workspace dep (MODIFIED)

### Root / scripts (cross-cutting, flagged)
- `package.json` — `dice` workspace, dice lint in `copilot:verify`, clean script (MODIFIED)
- `vitest.workspace.ts` — added `dice/vitest.config.ts` (MODIFIED)
- `scripts/run-compact-tests.mjs` — registered `dice` workspace (MODIFIED)

## Test Results

```
# Full workspace — npm run phase:verify -- --target full --compact
Suites: 274 passed, 0 failed (274 total)
Tests:  811 passed, 0 failed, 0 skipped (811 total)
All tests passed.

# Dice package — npx vitest run (dice/)
✓ src/renderer/geometry.test.ts (12 tests)
✓ src/engine/dice.test.ts (16 tests)
✓ src/renderer/scene.test.ts (3 tests)
Tests: 31 passed

# New client tests
✓ dice3d/constants.test.ts (2), dice3d/roll-mapping.test.ts (17),
✓ hooks/use3dDiceReveal.test.ts (9), components/DiceOverlay.test.tsx (6)
Tests: 34 passed
```

Manual verification: dice roll over the live canvas via chat `/roll`, quick-pick menu, and token quick-roll; map stays interactive mid-throw; dice bounce off canvas-edge walls; landed face shows server value with gold glow; d100 falls back to instant.

## Decisions & Insights

- **Pre-simulation architecture** (final design, after two iterations): the physics roll runs to completion synchronously before rendering, the server's result texture is stamped (material swap) onto whichever face physically landed up, then the recording plays back. First iteration reoriented the die to the server face at settle — mathematically proven correct via tests, but the tilted camera (~20° off vertical) made adjacent faces read as "up", so users saw wrong values. Lesson: **verify presentation against the camera, not world axes**.
- `RollResult` already carried `sides`/`count` from Phase 4E — no client-side formula parsing needed.
- `globalThis.crypto` is unavailable in this Node version — isomorphic packages need a guarded fallback.
- The `dice` package must be registered in three places: root workspaces, `vitest.workspace.ts`, and `scripts/run-compact-tests.mjs` (hardcoded workspace lists).
- Pre-existing infra flake: intermittent supertest `ECONNRESET` in server route tests during full runs (passes in isolation/re-run); interrupted test runs orphan seeded rows (e.g. `TestUser`) breaking later runs — clean via `prisma db execute --stdin --schema prisma/schema.prisma`.
- Deferred: manual low-end-device performance pass (pre-sim worst case ~480 sync steps × 8 convex bodies, flagged in review); linear-velocity continuity at throw→physics handoff is approximate (cosmetic).

## Dependencies Unlocked

- None new — PM1 was the last blocker-free post-MVP dice phase; PM2 (Fog mask pipeline) was already complete, PM3/PM4 depend on PM2 and remain available.
