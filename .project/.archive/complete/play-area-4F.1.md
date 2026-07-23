# Feature: play-area — Phase 4F.1: Token Vision Reveals

**Completed:** June 6, 2026
**Feature:** `play-area`

## Deliverables

### server/
- `prisma/schema.prisma` — added `visionRadius Int @default(6) @map("vision_radius")` to Token model
- `prisma/migrations/20260606170326_add_token_vision_radius/` — migration applied
- `prisma/seed.ts` — existing tokens seeded with visionRadius=6
- `src/features/play-area/vision.service.ts` (**new**) — `computeTokenVisionRegions`, `emitVisionSync`, `emitVisionSyncToSocket` with role-gating
- `src/features/play-area/play-area.socket.ts` — vision sync on room join (socket-only) + debounced sync on TOKEN_MOVE (200ms, keyed per campaign:scene)
- `src/features/play-area/tokens.service.ts` — `visionRadius` in toToken mapper, createToken, updateToken; DM-only enforcement for visionRadius changes
- `src/features/play-area/tokens.routes.ts` — `emitVisionSync` after create/update/delete/move; single `getIo()` call per handler
- `src/features/play-area/vision.service.test.ts` (**new**) — role-gated payload tests
- `src/features/play-area/play-area.routes.test.ts` — visionRadius REST integration tests

### shared/
- `src/types/play-area.ts` — `TokenVisionReveal`, `TokenVisionSyncPayload`, `visionRadius` on Token/TokenCreatePayload/TokenUpdatePayload
- `src/constants/play-area.ts` — `TOKEN_VISION_EVENTS`, `DEFAULT_VISION_RADIUS=6`, `VISION_RADIUS_MAX=30`, `VISION_SYNC_DEBOUNCE_MS=200`
- `src/validators/play-area.ts` — `visionRadius` in tokenCreatePayloadSchema and tokenUpdatePayloadSchema

### client/
- `src/features/play-area/canvas/ForegroundLayer.ts` — fog-of-war compositing via `AlphaFilter` isolation + `blendMode='erase'`; `setTokenVisionReveals()` draws vision circles into `fogCutouts`
- `src/features/play-area/canvas/ForegroundLayer.test.ts` (**new**) — vision reveal unit tests
- `src/features/play-area/canvas/CanvasManager.ts` — `setTokenVisionReveals()` delegating to ForegroundLayer
- `src/features/play-area/hooks/usePlayAreaSocket.ts` — `onVisionSync` callback + `TOKEN_VISION_SYNC` listener
- `src/features/play-area/components/TokenHoverCard.tsx` — DM-only visionRadius inline editor
- `src/features/play-area/PlayArea.tsx` — `visionReveals` state, `onVisionSync` handler, `handleVisionRadiusChange`

### notes/
- `.project/notes/play-area-fog-compositing.md` (**new**) — full record of the PixiJS v8 erase compositing problem and solution

## Test Results

```
npm run phase:verify -- --target full --compact

No type errors (client)
No type errors (server)

Suites: 128 passed, 0 failed (128 total)
Tests:  321 passed, 0 failed, 0 skipped (321 total)
All tests passed.
```

## Decisions & Insights

**PixiJS v8 erase compositing — critical finding:**
`blendMode='erase'` erases from the accumulated WebGL scene buffer, not from siblings. The fix: `fogContainer.filters = [new AlphaFilter({ alpha: 1 })]` forces the container into an isolated render texture. `fogCutouts` erase then only removes `fogOverlay` pixels within that texture, producing transparent holes that reveal the map when composited. `isRenderGroup=true` does NOT achieve isolation — it is a batching optimisation only. Full details in `.project/notes/play-area-fog-compositing.md`.

**Security: DM-only visionRadius enforcement added server-side.**
The route uses `requireCampaignRole('member')` so players can reach the PUT handler. `assertCanWriteToken` allows players to modify their own tokens, but does not restrict which fields. Without the explicit check added to `updateToken()`, a player could PUT `{ visionRadius: 30 }` and punch a max-radius hole through fog for all clients.

**PATCH /position now emits vision sync.**
The position route was missing an `emitVisionSync` call. While clients always follow REST moves with a socket TOKEN_MOVE event (which triggers `scheduleVisionSync`), direct API callers would have left fog stale.

**Step-by-step debug protocol for compositing issues:**
1. Disable all effects → verify base scene
2. Enable each effect individually → verify it works alone
3. Combine → if it fails, the bug is compositing-specific

## Dependencies Unlocked

- **play-area Phase 4H** (Initiative & Turn Tracker) — now unblocked
- **play-area Phase 4I** (Token Auras & Status Visualization) — already unblocked by 4C
