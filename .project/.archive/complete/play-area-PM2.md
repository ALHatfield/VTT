# Feature: play-area — Phase PM2: Fog of War - Optimized Rendering (Post-MVP)

**Completed:** September 4, 2026
**Feature:** `play-area`

## Deliverables

### shared

- `src/types/play-area.ts` — added `FogMode`, `ExplorationMode`, `FogEdgeSoftness`, `FogVisibilityState`, `FogMaskConfig`, `VisionStamp`, `FogExplorationStamp`, `FogConfigUpdatedPayload`, `FogExplorationSyncPayload`
- `src/constants/play-area.ts` — added `FOG_CONFIG_EVENTS`, `DEFAULT_FOG_MASK_CONFIG`, `FOG_MASK_RESOLUTION_MIN/MAX`, `FOG_MASK_MAX_TEXTURE_DIMENSION`, `FOG_MASK_STAMPS_PER_BATCH`, `FOG_MASK_SOFT_EDGE_STEPS`, `FOG_MASK_BLUR_STRENGTH`, `FOG_EXPLORATION_QUANTIZE_CELLS`, `FOG_EXPLORATION_MAX_STAMPS`
- `src/validators/play-area.ts` — added `fogModeSchema`, `explorationModeSchema`, `fogEdgeSoftnessSchema`, `fogMaskConfigSchema`, `fogMaskConfigPatchSchema`

### server

- `prisma/schema.prisma` — added `Scene.fogConfig` (Json?) and the `FogExploration` model (`@@unique([sceneId, cellKey])`)
- `prisma/migrations/20260904042202_add_fog_mask_config_and_exploration/migration.sql` — created
- `src/features/play-area/fog-config.service.ts` — created (`normalizeFogConfig`, `getSceneFogConfig`, `updateSceneFogConfig`)
- `src/features/play-area/fog-exploration.service.ts` — created (`buildExplorationCandidates`, `recordExploration`, `listExploration`, `clearExploration`)
- `src/features/play-area/fog.routes.ts` — added `GET`/`PATCH /fog/config` and `GET`/`DELETE /fog/exploration`
- `src/features/play-area/vision.service.ts` — added `syncSceneExploration`, invoked from `emitVisionSync`
- `src/features/play-area/fog-config.service.test.ts` — created (4 tests)
- `src/features/play-area/fog-exploration.service.test.ts` — created (5 tests)
- `src/features/play-area/fog-exploration.sync.test.ts` — created (6 tests)
- `src/features/play-area/fog-config.routes.test.ts` — created (12 tests)

### client

- `src/features/play-area/canvas/fog/fog-mask-math.ts` — created (`computeMaskDimensions`, `worldToMask`, `maskToWorld`, `visionRevealsToStamps`, `mergeVisionStamps`, `batchStamps`, `buildSoftEdgeRings`, `resolveVisibilityState`, `resolveExploredStamps`)
- `src/features/play-area/canvas/fog/FogMaskService.ts` — created (dual `RenderTexture` mask composition)
- `src/features/play-area/canvas/ForegroundLayer.ts` — added the PM2 mask branch (`attachRenderer`, `setFogMaskConfig`, `setExplorationStamps`, `getFogCompositionMs`, `destroyFogMask`)
- `src/features/play-area/canvas/CanvasManager.ts` — attaches the renderer on init; added `setFogMaskConfig`, `setFogExploration`, `getFogCompositionMs`; releases masks on destroy
- `src/features/play-area/hooks/useFogConfig.ts` — created
- `src/features/play-area/hooks/useFogExploration.ts` — created
- `src/features/play-area/hooks/usePlayAreaSocket.ts` — added `onFogConfigUpdated`, `onFogExplorationSync`
- `src/features/play-area/components/FogSettingsPanel.tsx` + `.module.css` — created (DM-only controls)
- `src/features/play-area/components/CanvasToolbar.tsx` — renders the fog settings panel
- `src/features/play-area/PlayArea.tsx` — wires config/exploration state into the canvas, scene-scoped broadcasts
- `src/features/play-area/canvas/fog/fog-mask-math.test.ts` — created (18 tests)
- `src/features/play-area/canvas/fog/FogMaskService.test.ts` — created (10 tests)
- `src/features/play-area/canvas/ForegroundLayer.pm2.test.ts` — created (10 tests)
- `src/features/play-area/hooks/useFogConfig.test.ts` — created (5 tests)
- `src/features/play-area/hooks/useFogExploration.test.ts` — created (6 tests)
- `src/features/play-area/canvas/CanvasManager.test.ts` — extended the pixi mock with `BlurFilter`, `RenderTexture`, `removeChildren`

### docs

- `.project/notes/play-area-PM2-fog-benchmark.md` — created (manual benchmark checklist + rollback)

## Test Results

```
$ npm run phase:verify -- --target full --compact

> client@0.0.1 copilot:lint
> tsc --noEmit --pretty false

> server@0.0.1 copilot:lint
> tsc --noEmit --pretty false

> vtt@0.0.1 copilot:test
> node scripts/run-compact-tests.mjs

Suites: 253 passed, 0 failed (253 total)
Tests:  746 passed, 0 failed, 0 skipped (746 total)
All tests passed.
```

```
$ npm run db:migrate -- --name add_fog_mask_config_and_exploration
Applying migration `20260904042202_add_fog_mask_config_and_exploration`
Your database is now in sync with your schema.
```

```
$ npm run dev:lifecycle:verify
HEALTHY 5173
HEALTHY 3001
```

Baseline before PM2 was 740 tests. Manual acceptance (DM + player, standard
2048×2048 scene): renderer toggle, persistent exploration across reload,
edge-softness modes, mask/shroud/hidden sliders, exploration reset, and rollback
to `legacy` all confirmed by the user.

Lint (`npx eslint client/src/features/play-area server/src/features/play-area shared/src`)
reports only pre-existing errors in files untouched by this phase; no new PM2 file
raises a finding.

## Decisions & Insights

- **Two masks, not one.** `FogMaskService` composes an `active` and an `explored`
  RenderTexture. `ForegroundLayer` stacks two filter-isolated overlay groups —
  hidden (erased by the explored mask) over shroud (erased by the active mask).
  Never-explored pixels receive both layers, explored-but-unseen receive only the
  shroud, actively visible receive neither. Default alphas (0.78 hidden + 0.55
  shroud) compose to the 4F opacity of 0.9.
- **Masks are authored in world space** and live inside the world container, so
  camera pan/zoom cannot desync the reveal. Sprites are scaled by `1 / maskScale`.
- **`AlphaFilter` isolation is still the mechanism** that makes `blendMode: 'erase'`
  safe — the same trick 4F uses, now applied to two groups instead of one.
- **Mask resolution is capped** at `FOG_MASK_MAX_TEXTURE_DIMENSION` (4096) regardless
  of the scene setting, so a large map cannot blow up GPU memory.
- **Exploration is server-authoritative and role-gated.** Stamps derive only from
  player-visible emitters (player-owned + ally NPC) and are delivered only to DM and
  player sockets. An early implementation broadcast to the whole room, which would
  have let observers see everything the party had explored — caught in code review.
- **Exploration syncs as a delta** (`mode: 'append' | 'replace'`) with REST rehydrate
  on join/reconnect. The first implementation re-read and broadcast the full set on
  every discovery and truncated with `take` on the oldest rows, which caused newly
  explored ground to disappear once a scene passed the cap. Recording now stops at
  `FOG_EXPLORATION_MAX_STAMPS` so the stored set can never exceed a rehydrate.
- **Exploration rows key on a quantized `x:y` cell** with the widest radius winning
  within a batch. Including radius in the key (the first attempt) meant changing a
  token's vision radius re-inserted every visited cell.
- **REST is the single write path for fog config.** A parallel socket write handler
  was implemented and then deleted — two authorization surfaces for one mutation.
- **Slider commits are deferred to release.** `FogSettingsPanel` holds draft values
  locally and commits on `pointerup`/`keyup`/`blur`; `useFogConfig` also carries a
  request-sequence guard so out-of-order responses cannot install a stale config.
- **Gotcha — shared pixi mocks.** Adding `Sprite`/`BlurFilter`/`RenderTexture` imports
  to `ForegroundLayer` broke 20+ unrelated `CanvasManager` tests, because each test
  file supplies its own `vi.mock('pixi.js')`. Grep for existing pixi mocks before
  introducing a new pixi import into a shared canvas class.

## Dependencies Unlocked

- **play-area PM3** (Fog of War — Line of Sight & Obstacles) — depends on PM2 plus an
  obstacle/wall geometry model. LOS visibility polygons will render into this mask
  pipeline rather than as a separate overlay system.
- **play-area PM4** (Dynamic Light Sources) — depends on PM2. Light emitters can reuse
  the world-space stamp and RenderTexture composition primitives.
- **play-area PM6** (Advanced Vision & Atmosphere) — indirectly, once PM3 and PM4 land.
