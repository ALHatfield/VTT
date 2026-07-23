# Phase Complete: play-area 4G — Player & NPC Tokens

**Completed:** 2026-06-05
**Feature:** `play-area`
**Phase:** 4G

---

## Deliverables

**Modified — Shared**
- `shared/src/types/play-area.ts` — `ownerName: string | null` added to `Token` interface

**Modified — Server**
- `server/src/features/play-area/tokens.service.ts` — `toToken()` mapper joins `owner.username`; all token Prisma queries include `owner { select { username } }`; `createPlayerTokenForMember()` added; `assertCanWriteToken()` enforces player-owns-token / DM-any / observer-none
- `server/src/features/play-area/tokens.routes.ts` — `PATCH /position` now emits `TOKEN_MOVED` socket event (was missing); imports `createPlayerTokenForMember` for invite flow
- `server/src/features/campaigns/campaigns.service.ts` — `inviteMember()` refactored to return `InviteResult { member, invitedUserId, invitedUsername }` (cross-feature service boundary removed)
- `server/src/features/campaigns/campaigns.routes.ts` — invite route calls `createPlayerTokenForMember` directly and emits `TOKEN_CREATED` socket event
- `server/prisma/seed.ts` — seeds `scene-seed-001` (deleting any auto-created scenes first) and 6 player tokens for TestPlayer1–6 with distinct colors

**Modified — Client**
- `client/src/features/play-area/components/TokenHoverCard.tsx` — icon/fallback avatar, type badge, `ownerName` display for player tokens, `canRoll?: boolean` prop guards quick-roll buttons
- `client/src/features/play-area/components/TokenHoverCard.test.tsx` — added `canRoll` param to `renderCard`; added observer `canRoll=false` test
- `client/src/features/play-area/canvas/TokenSprite.test.ts` — fixed pre-existing TS errors (PixiJS `Point`/`FederatedPointerEvent` types) via `emitEvent` helper
- `client/src/features/auth/ProtectedRoute.test.tsx` — fixed pre-existing `fetch` mock type error
- `client/src/features/portal/PortalLayout.test.tsx` — fixed `User` → `AuthUser` import; fixed `fetch` mock type error

**Modified — Server Tests**
- `server/src/features/play-area/tokens.routes.test.ts` — `beforeAll` cleanup expanded to include `Tok_OtherPlayer`/`Tok_OtherPlayer2`; full permission matrix tests for player/NPC token ownership

## Token Ownership Rules

| Token type | Who can move/edit | Who can delete |
|------------|------------------|----------------|
| `player`   | DM + owning player | DM only |
| `npc`      | DM only | DM only |
| `monster`  | DM only | DM only |
| `misc`     | DM only | DM only |

## Socket Events

- `play-area:token:created` — emitted from invite route when a player token is auto-created
- `play-area:token:moved` — was missing from `PATCH /position`; now emitted correctly

## Decisions

- **Cross-feature service boundary**: `createPlayerTokenForMember` is called from `campaigns.routes.ts` (route layer), not from `campaigns.service.ts`. This keeps the service layer free of cross-feature imports.
- **Seed idempotency**: Seed deletes any auto-created scenes (non-seed UUIDs) before upserting `scene-seed-001`, ensuring the seeded tokens are always on the active scene regardless of prior dev server visits.
- **Token position on invite**: New player tokens are placed at `x:0, y:0`. Multiple players will stack at the same position; the DM is expected to spread them out.

## Test Results

```
Server (vitest run — isolated):
  Test Files  8 passed (8)
  Tests       138 passed (138)
  Duration    137s

Client (vitest run):
  Test Files  13 passed (13)
  Tests       133 passed (133)
  Duration    2.01s
```

Note: One ECONNRESET flake observed in full parallel suite (`campaigns.routes.test.ts > returns 400 when role is dm`); passes consistently in isolation (37/37).

## Next Phase

**4H — Initiative & Turn Tracker** (depends on characters Phase 6A)
