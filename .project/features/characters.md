# Feature: characters

> **Slug:** `characters`
> **Feature dirs:** `client/src/features/characters/`, `server/src/features/characters/`
> **Instructions:** `.github/instructions/feature-characters.instructions.md`
> **Shared types:** `shared/types/characters.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 6B | Character-Token Linking | Not Started |
| 6C | Interactive Rolling | Not Started |
| 6D | Inventory & Spells | Not Started |
| 6E | Character Export & History | Not Started |

---

## Phase 6B: Character-Token Linking

**Dependencies:** Phase 6A + play-area Phase 4B

### Tasks
- [ ] Prisma `CharacterToken` join table (characterId, tokenId, campaignId)
- [ ] Link/unlink character to token API
- [ ] Token displays character portrait, name, current HP on canvas
- [ ] HP changes on character sheet → token updates (and vice versa)
- [ ] Character link modal for DM (bulk assignment)
- [ ] Player can only link their own character to their own token (ownership via `Character.userId`)
- [ ] User-character assignment per campaign (prevent duplicate — no two users same character)
- [ ] Dropdown to select/change character per player
- [ ] WebSocket broadcast on assignment change (`characters:assignment:changed`)
- [ ] Shared types: `CharacterToken`, `CharacterLinkPayload`, `CharacterAssignmentPayload`
- [ ] Tests: link/unlink, HP sync, permission enforcement
- **Token ownership chain:** `Character.userId` → `CharacterToken` → `Token` (see `.project/notes/rbac-architecture.md`)

---

## Phase 6C: Interactive Rolling

**Dependencies:** Phase 6A + play-area Phase 4E

### Tasks
- [ ] Click ability score → roll `d20 + modifier`
- [ ] Click skill → roll with proficiency bonus
- [ ] Click weapon/attack → roll attack + damage dice
- [ ] Roll results sent to campaign chat via Socket.IO
- [ ] Formula display in chat: `d20 + 5 (DEX) = 18`
- [ ] Advantage/disadvantage toggle (roll 2d20, take higher/lower)
- [ ] Initiative roll integration (character initiative modifier)
- [ ] Tests: modifier calculation, roll-to-chat flow, advantage logic

---

## Phase 6D: Inventory & Spells

**Dependencies:** Phase 6A

### Tasks
- [ ] Inventory management UI (items with name, weight, quantity, properties)
- [ ] Auto-calculated encumbrance
- [ ] Encumbrance visual states: normal, encumbered, overburdened, immobilized
- [ ] Spell list with slot tracking per spell level
- [ ] Prepared spells management (toggle prepared status)
- [ ] Drag-and-drop item/spell reordering
- [ ] Real-time character editing via WebSocket (`characters:sheet:updated`) — DM and owner edits broadcast to connected clients
- [ ] Tests: encumbrance calculation, spell slot tracking, visual state thresholds, real-time sync

---

## Phase 6E: Character Export & History

**Dependencies:** Phase 6A

### Tasks
- [ ] PDF export (printable character sheet layout)
- [ ] JSON export (backup/restore character data)
- [ ] Version history / audit log for character changes
- [ ] Tests: export format validation, history recording

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| campaigns Phase 3A | Characters scoped to campaigns |
| play-area Phase 4B | Token linking requires token system |
| play-area Phase 4E | Interactive rolling sends to play area chat/dice |

| Depended On By | Why |
|---------------|-----|
| play-area Phase 4G | Initiative tracker uses character modifiers |

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**
- `character_tokens` join table linking characters to tokens — clean separation of concerns
- `CharacterLinkModal` for DM bulk character-token assignment — essential for session setup
- `TokenCard` component with hover display (name, HP, AC, portrait) — great UX feedback
- Color-coded health states: Green (>50%), Orange (25-50%), Red (<25%), Gray (0 HP) — instant visual feedback
- Character portrait rendering directly on canvas tokens — improves immersion
- HP changes syncing bidirectionally between character sheet and token

**Critical lesson — Stale State in Hooks:**
> Same WebSocket state sync issue as play-area. Character HP updates via socket must flow through a single source of truth, not through multiple hook instances that can hold stale values. See play-area architectural decisions for the full pattern.

**What we're changing:**
- Project_Pathfinder characters page was a placeholder → new build designs character sheets as a full feature from the start
- Project_Pathfinder stored character data in a flat structure → new build uses JSON columns for extensible data (inventory, spells, features)
- Project_Pathfinder used raw SQL → new build uses Prisma with typed queries
