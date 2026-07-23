# Archived Phase 4C: Real-Time Sync

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-06-01

---

Original phase section was already archived in the feature roadmap at archive time.

## Completion Record Snapshot

# Play Area — Phase 4C: Real-Time Sync

**Completed:** 2026-05-31
**Feature:** `play-area`

## Deliverables

### shared/
- `shared/src/constants/play-area.ts` (MODIFIED) — added `TOKEN_UPDATED`, `TOKEN_CREATED`, `TOKEN_DELETED` events to `PLAY_AREA_EVENTS`; added `SOCKET_TOKEN_MOVE_DEBOUNCE_MS`; added `PlayAreaEvent` type
- `shared/src/types/play-area.ts` (MODIFIED) — added `RoomJoinPayload`, `TokenMoveSocketPayload`, `TokenMovedPayload`, `TokenUpdatedPayload`, `TokenCreatedPayload`, `TokenDeletedPayload`, `PresencePayload`, `SocketErrorPayload`
- `shared/src/validators/play-area.ts` (MODIFIED) — added `roomJoinPayloadSchema`, `tokenMoveSocketPayloadSchema`; campaignId validated as `.string().min(1)` (not `.uuid()`) to support seed campaign ID

### server/
- `server/src/shared/socket/index.ts` (NEW) — `setupSocket(io, sessionMiddleware)`: wraps session middleware via `io.use()`, enforces auth, registers play-area handlers per connection
- `server/src/shared/socket/io-instance.ts` (NEW) — `setIo()` / `getIo()` singleton so REST route handlers can broadcast without circular imports on `app.ts`
- `server/src/features/play-area/play-area.socket.ts` (NEW) — `registerPlayAreaHandlers()`: handles `ROOM_JOIN` (validate membership, leave previous room, join new room, broadcast `USER_JOINED`), `TOKEN_MOVE` (validate payload, ownership check, broadcast `TOKEN_MOVED`), `disconnect` (broadcast `USER_LEFT`)
- `server/src/features/play-area/tokens.routes.ts` (MODIFIED) — broadcasts `TOKEN_CREATED`, `TOKEN_UPDATED`, `TOKEN_DELETED` via `getIo()` after each successful REST write
- `server/src/app.ts` (MODIFIED) — wired `setupSocket` + `setIo`; guarded `httpServer.listen()` with `NODE_ENV !== 'test'`; exports `{ app, httpServer, io }`
- `server/src/test-setup.ts` (NEW) — global `afterAll` that closes `httpServer` with listening guard to prevent double-close in tests
- `server/vitest.config.ts` (MODIFIED) — `fileParallelism: false`, `maxWorkers: 1`, `minWorkers: 1`, `setupFiles: ['./src/test-setup.ts']`
- `server/src/features/play-area/play-area.socket.test.ts` (NEW) — 9 integration tests: auth enforcement, room join, broadcast, room isolation, presence tracking

### client/
- `client/src/features/play-area/hooks/usePlayAreaSocket.ts` (NEW) — React hook: creates Socket.IO connection with session credentials, joins campaign room on connect/reconnect, listens for `TOKEN_MOVED/UPDATED/CREATED/DELETED`, `USER_JOINED/LEFT`; `emitTokenMove` debounced 100ms; `onReconnect` callback triggers REST re-sync
- `client/src/features/play-area/hooks/useTokens.ts` (MODIFIED) — added `applyRemoteTokenMove`, `applyRemoteTokenUpdate`, `addRemoteToken`, `removeRemoteToken`
- `client/src/features/play-area/hooks/usePlayAreaSocket.test.ts` (NEW) — 13 unit tests (socket.io-client mocked)
- `client/src/features/play-area/PlayArea.tsx` (MODIFIED) — wired all four socket callbacks; REST-first emit for token moves; `onReconnect` triggers `refresh()`
- `client/src/features/play-area/canvas/TokenSprite.ts` (MODIFIED) — HP bar rendered on canvas (4px, colour-coded: green ≥ 75%, yellow ≥ 25%, red > 0%, grey = 0); `updateToken()` method refreshes position + HP bar without sprite rebuild
- `client/src/features/play-area/canvas/PlaygroundLayer.ts` (MODIFIED) — `syncTokenData()` method calls `updateToken()`; `setTokens()` uses `updateToken()` instead of `syncTokenPosition()`

### vitest configs
- `vitest.config.ts` (root, MODIFIED) — removed `fileParallelism` (caused IPC errors at workspace level)
- `server/src/features/campaigns/campaigns.routes.test.ts` (MODIFIED) — file-scoped usernames (`Camp_*`), `beforeAll` cleanup
- `server/src/features/play-area/tokens.routes.test.ts` (MODIFIED) — file-scoped usernames (`Tok_*`), `beforeAll` cleanup

## Test Results

```
npx vitest run

 ✓  client  src/shared/components/ErrorBoundary.test.tsx              (3 tests)
 ✓  client  src/features/portal/PortalLayout.test.tsx                (10 tests)
 ✓  client  src/features/auth/ProtectedRoute.test.tsx                 (3 tests)
 ✓  client  src/features/auth/Login.test.tsx                          (4 tests)
 ✓  client  src/features/play-area/hooks/usePlayAreaSocket.test.ts   (13 tests)
 ✓  client  src/features/portal/Welcome.test.tsx                      (5 tests)
 ✓  client  src/features/play-area/canvas/TokenSprite.test.ts        (14 tests)
 ✓  client  src/features/play-area/canvas/viewport-culling.test.ts   (19 tests)
 ✓  client  src/features/play-area/canvas/CanvasManager.test.ts      (13 tests)
 ✓  client  src/features/play-area/canvas/grid-utils.test.ts          (8 tests)
 ✓  client  src/features/play-area/components/TokenHoverCard.test.tsx (18 tests)
 ✓  server  src/features/auth/dev.routes.test.ts                      (4 tests)
 ✓  server  src/features/auth/auth.routes.test.ts                     (7 tests)  [includes 2 untracked]
 ✓  server  src/features/play-area/play-area.socket.test.ts           (9 tests)
 ✓  server  src/features/play-area/tokens.routes.test.ts             (22 tests)
 ✓  server  src/features/campaigns/campaigns.routes.test.ts          (33 tests)

 Test Files  16 passed (16)
      Tests  185 passed (185)
   Duration  34.70s
```

## Decisions & Insights

- **REST-first, socket-second for token moves.** `moveToken()` (REST) is awaited before `emitTokenMove()` fires. This prevents split-brain state: the server is confirmed as source of truth before other clients receive the position update.

- **Broadcast after every REST write.** `tokens.routes.ts` calls `getIo()?.to(room).emit(...)` after each successful `createToken`, `updateToken`, and `deleteToken`. This covers HP edits, token creation, and deletion — any client in the room receives the updated full token object immediately.

- **`io-instance.ts` singleton.** Avoids circular imports between `app.ts` (which owns the `io` instance) and route handlers. `setIo(io)` is called once at startup; `getIo()` is called from route handlers. The `?` guard means no broadcast is attempted during tests where `io` is not set.

- **Reconnect re-sync.** Socket.IO's `reconnect` event fires after the client re-establishes the connection (not on the first connect). The hook emits `ROOM_JOIN` again and calls `onReconnect()` → `refresh()` to fetch the latest token list from REST. This covers any state mutations (moves, HP edits) that occurred during the disconnection window.

- **Test parallelism fix.** Root `vitest.config.ts` must NOT have `fileParallelism: false` — that causes `ERR_IPC_CHANNEL_CLOSED` at the workspace runner level. The server project config uses `fileParallelism: false` + `maxWorkers: 1` / `minWorkers: 1` to serialize DB-hitting tests within the server project. File-scoped username prefixes (`Camp_*`, `Tok_*`, `Socket*`) prevent unique constraint collisions when projects run concurrently.

- **campaignId as non-UUID.** The seed campaign uses `'campaign-seed-001'` as its ID (a plain string, not a UUID). Zod validators were relaxed from `.uuid()` to `.string().min(1)`. The DB schema (`String @id`) has no UUID constraint so this is intentional.

- **HP bar on TokenSprite.** Rendered as a `Graphics` child overlaid inside the token's bounding box (4px, positioned 6px from the bottom of the circle). `drawHpBar()` is called from `updateToken()` so it redraws whenever HP/maxHp changes without a full sprite rebuild. Colours match the hover card: `#4caf6e` healthy, `#f0a030` wounded, `#e05050` critical, `#555555` dead.

## Dependencies Unlocked

- `play-area 4D` (Chat System) — now unblocked; depends on Phase 4C
- `play-area 4F` (Fog of War) — now unblocked; depends on Phase 4A (already done), socket infrastructure now in place
