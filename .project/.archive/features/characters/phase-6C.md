# Archived Phase 6C: Interactive Rolling

- Feature: `characters`
- Source: `.project/features/characters.md`
- Archived: 2026-10-07

---

## Phase 6C: Interactive Rolling

**Dependencies:** Phase 6A + play-area Phase 4E

### Tasks
- [x] Click ability score → roll `d20 + modifier`
- [x] Click skill → roll with proficiency bonus
- [x] Click weapon/attack → roll attack + damage dice
- [x] Roll results sent to campaign chat via Socket.IO
- [x] Formula display in chat: `d20 + 5 (DEX) = 18`
- [x] Advantage/disadvantage toggle (roll 2d20, take higher/lower)
- [x] Initiative roll integration (character initiative modifier)
- [x] Tests: modifier calculation, roll-to-chat flow, advantage logic

### Decisions
- Added `Character.skillProficiencies` and `Character.attacks` JSON columns (defaults `[]`) — skills are the fixed 5e 18-skill list defined in `SKILL_DEFINITIONS` (shared constants); attacks are client-id'd entries validated by a strict damage-dice pattern
- Roll source labels (`d20+5 (DEX)`) ride an optional `label` field on the existing dice roll payload/`RollResult` — the dice socket passes it through untouched and ChatPanel renders it; no new events
- The character sheet rolls through its own `useCharacterSocket` connection (dice handlers register on every socket); `isConnected` flips only after the room-join broadcast confirms, and server rejections surface via a `lastError` alert on the sheet
- Rolls use the stored, editable `Character.proficiencyBonus` (not the level-derived value) as the source of truth
- Skill/attack edits are optimistic (local state shadows the server copy) so rapid toggles never compute from stale data; edit controls are owner-or-DM only and observers cannot roll

---


