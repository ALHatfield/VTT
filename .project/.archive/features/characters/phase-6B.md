# Archived Phase 6B: Character-Token Linking

- Feature: `characters`
- Source: `.project/features/characters.md`
- Archived: 2026-10-06

---

## Phase 6B: Character-Token Linking

**Dependencies:** Phase 6A + play-area Phase 4B
**Status:** Complete

### Tasks
- [x] Prisma `CharacterToken` join table (characterId, tokenId, campaignId)
- [x] Link/unlink character to token API
- [x] Token displays character portrait, name, current HP on canvas
- [x] HP changes on character sheet → token updates (and vice versa)
- [x] Character link modal for DM (bulk assignment) — superseded by inline `MemberLinkControls` on the campaign settings page
- [x] Player can only link their own character to their own token (ownership via `Character.userId`)
- [x] User-character assignment per campaign (prevent duplicate — no two users same character)
- [x] Dropdown to select/change character per player
- [x] WebSocket broadcast on assignment change (`characters:assignment:changed`)
- [x] Shared types: `CharacterToken`, `CharacterLinkPayload`, `CharacterAssignmentPayload`
- [x] Tests: link/unlink, HP sync, permission enforcement
- **Token ownership chain:** `Character.userId` → `CharacterToken` → `Token` (see `.project/notes/phase0-rbac-architecture.md`)

### Decisions
- `CharacterToken` is 1:1 on both sides (`@@unique` on `characterId` and `tokenId`); linking uses replace semantics — a new link displaces existing links on either side, transactionally, with P2002 races mapped to 409
- On link/assign the token adopts the character's display fields (name, portrait → iconUrl, HP, max HP, AC) and `Token.ownerId` follows `Character.userId`
- Bidirectional HP sync helpers live in `server/src/shared/sync/character-token-sync.ts` so characters and play-area features never import each other; token→character sync clamps to the character's max HP and writes the clamped value back to the token
- **Global template characters:** `Character.campaignId` is nullable — null = template (pregen) visible in every campaign. Templates are read-only (`TEMPLATE_READONLY` 403) and are **cloned into the campaign** on link/assign so HP never leaks across campaigns. Seed trio (Thorin/Elara/Rix) ships as templates
- **Auto-link on assignment:** assigning a character to a member automatically links it to their earliest `player`-type token — no separate token picker. Players may self-assign (own characters or templates only; claiming another player's character is rejected at the service level)
- Linking/assignment UI lives inline on the campaign settings page (`MemberLinkControls` per member row + `CharacterCards` section); the standalone `/characters` list page and `CharacterLinkModal` were removed. `CampaignDetail` imports characters-feature components/hooks — a deliberate, recorded exception to the feature-boundary rule
- Portrait URLs accept http(s) or site-relative paths (protocol-relative `//` rejected); built-in token art exposed as `TOKEN_IMAGE_OPTIONS` (`/tokens/token1-6.png`)

---


