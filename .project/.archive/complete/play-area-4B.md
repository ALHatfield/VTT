# Play Area — Phase 4B: Token System

**Completed:** 2026-05-31
**Feature:** `play-area`

## Deliverables

### shared/
- `shared/src/types/play-area.ts` (MODIFIED) — added `Token`, `TokenType`, `TokenPosition`, `TokenMovePayload`, `TokenCreatePayload`, `TokenUpdatePayload`
- `shared/src/constants/play-area.ts` (MODIFIED) — added token event name constants
- `shared/src/validators/play-area.ts` (NEW) — Zod schemas for token CRUD and position update
- `shared/src/validators/index.ts` (MODIFIED) — re-exports play-area validators

### server/
- `server/prisma/schema.prisma` (MODIFIED) — added `Scene` and `Token` models
- `server/prisma/migrations/20260531023620_add_scene_and_token_models/migration.sql` (NEW)
- `server/src/features/play-area/tokens.service.ts` (NEW) — token CRUD + permission enforcement service
- `server/src/features/play-area/tokens.routes.ts` (NEW) — REST routes: POST, GET, PATCH position, PUT update, DELETE
- `server/src/features/play-area/tokens.routes.test.ts` (NEW) — 22 tests covering CRUD and role-based access
- `server/src/app.ts` (MODIFIED) — mounted `/api/campaigns/:campaignId/scenes/:sceneId/tokens` router

### client/
- `client/src/features/play-area/canvas/grid-utils.ts` (NEW) — grid coordinate helpers (`snapToGrid`, `snappedPixelToGridCoords`)
- `client/src/features/play-area/canvas/grid-utils.test.ts` (NEW) — 8 unit tests
- `client/src/features/play-area/canvas/TokenSprite.ts` (NEW) — PixiJS Container subclass with drag/drop, hover events, and name label
- `client/src/features/play-area/canvas/PlaygroundLayer.ts` (MODIFIED) — `setTokens()`, `addToken()`, `removeToken()`, `needsRebuild()` methods
- `client/src/features/play-area/canvas/CanvasManager.ts` (MODIFIED) — `setTokens()`, `onTokenHoverChange` callback, `onTokenMoveEnd` callback; 10 tests
- `client/src/features/play-area/hooks/useActiveScene.ts` (NEW) — fetches active scene for a campaign
- `client/src/features/play-area/hooks/useTokens.ts` (NEW) — fetches tokens for a scene, exposes `moveToken()`
- `client/src/features/play-area/hooks/useCampaignRole.ts` (NEW) — resolves the current user's role in a campaign
- `client/src/features/play-area/components/TokenHoverCard.tsx` (NEW) — stat card overlay (name, type, HP/AC)
- `client/src/features/play-area/components/TokenHoverCard.module.css` (NEW)
- `client/src/features/play-area/PlayArea.tsx` (MODIFIED) — wires tokens to canvas, hover card state, role-gated drag

## Test Results

```
# Phase 4B server tests (isolated run)
npx vitest run src/features/play-area/
 ✓ tokens.routes.test.ts  22 tests  ~33s
 Test Files  1 passed (1)  |  Tests  22 passed (22)

# Phase 4B client tests (isolated run)
npx vitest run src/features/play-area/
 ✓ grid-utils.test.ts          8 tests
 ✓ viewport-culling.test.ts   19 tests
 ✓ CanvasManager.test.ts      10 tests
 Test Files  3 passed (3)  |  Tests  37 passed (37)

# Total Phase 4B tests: 59 passing
```

Note: Full workspace test run shows 43 failures in `campaigns.routes.test.ts` due to a pre-existing EADDRINUSE race condition (multiple vitest workers each importing `app.ts` which starts `httpServer.listen(3001)` at module level). This is not caused by Phase 4B changes.

## Decisions & Insights

**Scene model as intermediary**: Tokens belong to a `Scene`, not directly to a `Campaign`. This enables future multi-scene support (e.g., multiple maps per campaign) without a schema migration. The seed creates one active scene per campaign automatically.

**PixiJS v8 hit testing requires explicit `hitArea`**: Plain `Container` has no `containsPoint` method and `hitTestFn` returns false for it, making it invisible to pointer events. Added `this.hitArea = new Circle(cx, cy, radius)` to `TokenSprite` constructor. This must be done for any PixiJS Container subclass that needs pointer events.

**`label` property conflict**: PixiJS `Container` has a public `label: string` property. Naming a private field `label: Text` on a subclass causes a TypeScript strict-mode error. Renamed to `nameLabel`.

**Hover card coordinate system**: `event.global` from PixiJS gives canvas-relative coordinates. The hover card is positioned `absolute` inside `.canvasWrapper` (which is `position: relative`), so no offset conversion is needed.

**Token move uses optimistic UI**: `moveToken()` in `useTokens.ts` fires the PATCH and on success updates the token state, triggering a canvas rebuild via `CanvasManager.setTokens()`.

## Dependencies Unlocked

- `play-area 4C` — Real-Time Sync (depends on Phase 4B)
- `characters 6B` — Character-token linking (depends on Phase 4B)
