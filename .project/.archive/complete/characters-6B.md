# Feature: characters — Phase 6B: Character-Token Linking

**Completed:** October 6, 2026
**Feature:** `characters`

## Deliverables

### Shared (`shared/`)
- `src/types/characters.ts` — `CharacterToken`, `CharacterLinkPayload`, `CharacterAssignmentPayload`, `CharacterLinkUpdatedPayload`, `CharacterAssignmentChangedPayload`, `CharacterHpUpdatedPayload`; `Character.campaignId` now `string | null` (null = global template)
- `src/validators/characters.ts` — `characterLinkPayloadSchema`, `characterAssignmentPayloadSchema`; portrait URLs accept http(s) or site-relative paths (protocol-relative rejected)
- `src/constants/characters.ts` — `CHARACTER_EVENTS` (`characters:link:updated`, `characters:assignment:changed`, `characters:hp:updated`), `TOKEN_IMAGE_OPTIONS`

### Server (`server/`)
- `prisma/schema.prisma` — `CharacterToken` model (1:1 unique on `characterId` and `tokenId`, campaign-scoped, cascade deletes); `Character.campaignId` nullable for templates. Migrations: `20261006193044_add_character_token_model`, `character_templates_nullable_campaign`
- `prisma/seed.ts` — Thorin/Elara/Rix seeded as global templates owned by the seed DM
- `src/features/characters/character-tokens.service.ts` (new) — transactional link/unlink/assign with replace semantics, template clone-on-link/assign, auto-link to the assignee's player token, P2002 → 409, ownership guards
- `src/features/characters/character-tokens.routes.ts` (new) — `GET/POST /character-tokens`, `DELETE /character-tokens/:linkId`, `POST /characters/:charId/assign` with Socket.IO broadcasts
- `src/features/characters/characters.routes.ts` — HP/display sync + broadcasts on PUT and PATCH hp; `TEMPLATE_READONLY` guards; PUT hp ≤ maxHp validation
- `src/features/characters/characters.service.ts` — lists/details include global templates
- `src/shared/sync/character-token-sync.ts` (new) — bidirectional HP/display sync helpers shared by characters and play-area (avoids cross-feature imports); token→character sync clamps to max HP and writes the clamp back
- `src/app.ts` — mounts `characterTokensRouter`
- `src/features/play-area/tokens.routes.ts` — token PUT hp changes sync to the linked character and broadcast `characters:hp:updated`

### Client (`client/`)
- `src/features/characters/components/MemberLinkControls.tsx` + `.module.css` (new) — inline per-member controls on campaign settings: character dropdown (assign + auto-link), token image picker, linked badge
- `src/features/characters/components/CharacterCards.tsx` + `.module.css` (new) — character cards grid embedded in campaign settings
- `src/features/characters/hooks/useCharacterLinking.ts` (new) — link state + unlink/assign actions
- `src/features/characters/hooks/useCharacterSocket.ts` (new) — campaign-room subscription for character events
- `src/features/characters/CharacterSheet.tsx` — live HP sync via socket; back-buttons target campaign settings
- `src/features/campaigns/CampaignDetail.tsx` — embeds member controls + characters section (recorded feature-boundary exception); "Enter Play Area" nav button
- Removed: `CharacterList.tsx`, `CharacterLinkModal.tsx` (+css/tests), `/campaigns/:id/characters` route

### Tests
- `server/src/features/characters/character-tokens.routes.test.ts` (new) — 23 tests: link/unlink role matrix, replace semantics, template clone-on-link/assign, auto-link, HP sync both directions with clamp write-back, theft prevention
- `client/src/features/characters/components/MemberLinkControls.test.tsx` (new) — 8 tests: assignment flows, template labeling, image picker, unlink
- Updated: `characters.routes.test.ts` (template-tolerant list assertions)

## Test Results

```
npm run phase:verify -- --target full --compact
Suites: 410 passed, 0 failed (410 total)
Tests:  1307 passed, 0 failed, 0 skipped (1307 total)
All tests passed.
```

Live API smoke (dev servers):
```
POST /api/auth/login (testdm@email.com) → 200
GET  /api/campaigns/campaign-seed-001/characters → 3 templates (campaignId: null)
POST /api/campaigns/campaign-seed-001/character-tokens {char-seed-001, token-seed-player-001}
     → 201, link.characterId = new campaign clone (template preserved)
PATCH character hp 22 → token hp 22; PUT token hp 30 → character hp 30 (bidirectional sync verified)
```

## Decisions & Insights

- **1:1 link with replace semantics** — `@@unique` on both `characterId` and `tokenId`; a new link transactionally displaces existing links on either side; unique-constraint races surface as 409
- **Token adopts character display** — on link/assign the token takes the character's name, portrait (iconUrl), HP, max HP, AC, and `ownerId` follows `Character.userId`, preserving the RBAC ownership chain
- **Sync module in `server/src/shared/sync/`** — both characters and play-area need HP sync, and features must not import each other; DB sync runs even when Socket.IO is unavailable (broadcast is best-effort)
- **Global template characters** — `Character.campaignId: null` marks a shared pregen; templates are read-only and cloned into a campaign on link/assign so HP/edits never leak across campaigns
- **Auto-link on assignment** — the player's token is implied; assigning a character links it to the member's earliest `player` token in one step. UI needs no token picker
- **Security (from code review)** — players may self-assign only their own characters or templates (service-level guard prevents claiming another player's character); portrait URLs reject protocol-relative `//` hosts; assignment is a single transaction so no partial state on conflict
- **UI consolidation** — linking lives inline in the campaign settings Members rows (`MemberLinkControls`); the separate characters page and modal were removed at user request. `CampaignDetail` → characters-feature imports recorded as a deliberate boundary exception
- **Gotcha** — campaign invites auto-create player tokens, so test assertions must check linked-token *ownership*, not hardcoded token ids

## Dependencies Unlocked

- characters 6C (Interactive Rolling) — needs 6A + play-area 4E (both complete)
- play-area 4G initiative tracker gains character modifiers once 6C lands (unchanged)
