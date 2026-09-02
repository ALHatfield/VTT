# Archived Phase 4H: Initiative & Turn Tracker

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-02

---

## Phase 4H: Initiative & Turn Tracker

**Status:** Complete

**Dependencies:** Phase 4F.3, characters Phase 6A

### Tasks

- [x] DM-initiated combat mode with initiative roll prompt
- [x] Character sheet integration: auto-populate initiative modifier
- [x] Sorted turn order sidebar component
- [x] DM advance/reorder/end turns
- [x] Active token highlight on canvas (PlaygroundLayer effect)
- [x] Socket events: `play-area:initiative:start`, `play-area:initiative:advance`, `play-area:initiative:end`
- [x] Tests: sort logic, turn advancement, DM-only controls

### Decisions & Notes

- Initiative state is server-owned and broadcast via Socket.IO, but stored in process memory for this MVP slice because Phase 4H did not include database persistence.
- Current Token records do not have a direct `characterId`, so initiative modifiers derive from the first campaign character owned by a player-token owner; unlinked and DM-controlled tokens use modifier `0`.
- Explicit initiative token lists are validated strictly: empty, duplicate, stale, or non-active-scene token lists are rejected instead of starting partial combat.
- The Turn Tracker reserves room for Chat by capping initiative panel height and scrolling combatants inside the panel.

---


