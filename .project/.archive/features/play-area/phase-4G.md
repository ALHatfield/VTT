# Archived Phase 4G: Player & NPC Tokens

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-06-05

---

## Phase 4G: Player & NPC Tokens

**Dependencies:** Phase 4B (token model), Phase 4C (real-time sync)

### Goals
- Auto-create a default player token when a player is invited to a campaign
- Enforce strict per-token ownership: only the owning player (or DM) can move or edit their token
- NPC tokens are DM-only (no owner)
- Token hover card displays the token image, type badge, and owner name for player tokens
- Observers see read-only hover cards (no HP editing, no quick-roll buttons)

### Tasks
- [x] Extend `Token` shared type with `ownerName: string | null`
- [x] Update `toToken()` mapper to join and include `owner.username`
- [x] Update all token Prisma queries to `include: { owner: { select: { username: true } } }`
- [x] Add `createPlayerTokenForMember()` service function in `tokens.service.ts`
- [x] Update `inviteMember()` in `campaigns.service.ts` to auto-create a player token on invite
- [x] Return `InviteResult { member, token }` from `inviteMember()` and emit `TOKEN_CREATED` socket event from invite route
- [x] Seed default player tokens for all 6 TestPlayers in Dragon's Lair (`scene-seed-001`)
- [x] `TokenHoverCard` — display `iconUrl` image (with colored-circle fallback), type badge, owner name for player tokens
- [x] `TokenHoverCard` — add `canRoll?: boolean` prop; hide quick-roll buttons for observers
- [x] Update `CARD_W`/`CARD_H` constants to fit new hover card layout
- [x] Permission tests: player cannot move/update another player's token or any NPC token
- [x] Permission tests: DM can move/update any token type
- [x] `ownerName` included in list and create responses
- [x] Invite tests: player invite → token auto-created; observer invite → no token created

### Token Ownership Rules
| Token type | Who can move/edit | Who can delete |
|------------|------------------|----------------|
| `player`   | DM + owning player | DM only |
| `npc`      | DM only | DM only |
| `monster`  | DM only | DM only |
| `misc`     | DM only | DM only |

### Socket Events
- `play-area:token:created` — emitted from the invite route when a player token is auto-created on invite

### Default Player Token Properties
- `name`: invited user's username
- `type`: `'player'`
- `color`: random pick from a 10-color palette (distinct per player)
- `x`, `y`: `0, 0` (top-left of the scene grid)
- `size`: 1 (1×1 grid cell)
- `ownerId`: invited user's ID

---


