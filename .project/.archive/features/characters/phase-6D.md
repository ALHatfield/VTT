# Archived Phase 6D: Spells & Slots

- Feature: `characters`
- Source: `.project/features/characters.md`
- Archived: 2026-10-08

---

## Phase 6D: Spells & Slots

**Dependencies:** Phase 6A (inventory Phase 10B soft-required for the inventory tab embed — ship the tab as "coming soon" if 10B isn't done)

### Tasks
- [x] Spell list with slot tracking per spell level
- [x] Prepared spells management (toggle prepared status)
- [x] Drag-and-drop spell reordering
- [x] Character sheet inventory tab renders `InventoryPanel` from inventory Phase 10B (embed only — no inventory logic in this feature) — shipped as "coming soon" placeholder since 10B is not started
- [x] Real-time character editing via WebSocket (`characters:sheet:updated`) — DM and owner edits broadcast to connected clients
- [x] Tests: spell slot tracking, prepared toggle, real-time sync

### Decisions
- Item management, encumbrance, and transfers moved to the `inventory` feature (10B/10C) — the sheet only embeds the inventory panel
- Spells stay in the character's JSON data; items are normalized inventory entries
- `characters:sheet:updated` broadcasts the full updated `Character` so clients can apply it without refetching; emitted on every successful PUT
- Client serializes sheet PUTs through a promise queue and ignores broadcast echoes while its own saves are in flight — prevents out-of-order writes and optimistic-state clobbering; cross-client conflicts remain last-write-wins at array granularity (acceptable for MVP)
- Global template sheets (campaignId null) are read-only in the UI (`canEdit` requires a campaign-scoped character), matching the server's `TEMPLATE_READONLY` enforcement
- Spell slot entries with `max: 0` are dropped from the stored array; drag-and-drop reordering is restricted to within a spell-level group
- Template cloning now copies `skillProficiencies`, `attacks`, `spells`, and `spellSlots` (fixed a Phase 6C gap where clones silently dropped skills/attacks)

---


