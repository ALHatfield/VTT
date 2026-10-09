# Feature: characters — Phase 6D: Spells & Slots

**Completed:** October 8, 2026
**Feature:** `characters`

## Deliverables

### Shared (`shared/`)
- `src/types/characters.ts` — added `CharacterSpell`, `CharacterSpellSlot`, `CharacterSheetUpdatedPayload`; `spells`/`spellSlots` on `Character`, `CharacterCreatePayload`, `CharacterUpdatePayload`
- `src/constants/characters.ts` — `CHARACTER_MAX_SPELLS`, `SPELL_NAME_MAX_LENGTH`, `SPELL_LEVEL_MIN/MAX`, `SPELL_SLOT_LEVEL_MIN`, `SPELL_SLOT_MAX_PER_LEVEL`, `SPELL_LEVEL_LABELS`, `CHARACTER_EVENTS.SHEET_UPDATED` (`characters:sheet:updated`)
- `src/validators/characters.ts` — `characterSpellSchema`, `characterSpellSlotSchema` (unique ids, levels 0–9, `used ≤ max`, unique slot levels) wired into create/update payload schemas

### Server (`server/`)
- `prisma/schema.prisma` — `Character.spells` and `Character.spellSlots` Json columns (migration `20261008201928_add_character_spells_and_slots`)
- `prisma/seed.ts` — Elara Nightwhisper (wizard template) seeded with 6 spells and level 1–3 slots
- `src/features/characters/characters.service.ts` — maps and persists the new JSON fields
- `src/features/characters/characters.routes.ts` — PUT broadcasts `characters:sheet:updated` with the full updated character to the campaign room on every successful edit
- `src/features/characters/character-tokens.service.ts` — template clone now copies `skillProficiencies`, `attacks`, `spells`, `spellSlots` (fixed Phase 6C gap)
- `src/features/characters/characters.routes.test.ts` — Phase 6D suites: spells/slots validation, persistence, prepared toggles, template read-only, sheet-updated broadcast

### Client (`client/`)
- `src/features/characters/components/SpellsTab.tsx` — new: slot pips (spend/unspend), max-slot editing, Long Rest reset, prepared toggles, add/remove spells, HTML5 drag-and-drop reordering within a level group
- `src/features/characters/components/SpellsTab.module.css` — new
- `src/features/characters/components/SpellsTab.test.tsx` — new: 17 tests
- `src/features/characters/CharacterSheet.tsx` — SpellsTab wiring, serialized save queue with broadcast-echo guard, visible save errors, template read-only `canEdit`, inventory tab "coming soon" placeholder
- `src/features/characters/hooks/useCharacterSocket.ts` — `onSheetUpdated` subscription
- `src/features/characters/components/MemberLinkControls.test.tsx` — fixture gained `spells`/`spellSlots`

## Test Results

```
npm run phase:verify -- --target full --compact
Suites: 425 passed, 0 failed (425 total)
Tests:  1375 passed, 0 failed, 0 skipped (1375 total)
All tests passed.
```

Dev lifecycle verified: `npm run dev` → `HEALTHY 5173`, `HEALTHY 3001`; cleanup confirmed both ports `FREE`.

## Decisions & Insights

- **Full-character broadcast**: `characters:sheet:updated` carries the complete updated `Character` so receiving clients can apply state without refetching; emitted on every successful PUT (owner or DM).
- **Client save serialization**: sheet edits (skills, attacks, spells, slots) run through a promise-chain queue so rapid edits cannot apply out of order server-side; broadcast echoes are ignored while own saves are in flight (`pendingSavesRef`), preventing optimistic-state clobbering. Cross-client conflicts remain last-write-wins at array granularity — acceptable for MVP.
- **Template read-only in UI**: `canEdit` now requires `campaignId !== null`, matching the server's `TEMPLATE_READONLY` enforcement; previously a DM saw editable controls on templates whose saves silently failed.
- **Slot storage**: entries with `max: 0` are dropped from the stored array; `used` is clamped when `max` shrinks.
- **Drag-and-drop**: restricted to within a spell-level group; removing the dragged item before splicing at the target index makes drops land before the target when dragging up and after it when dragging down, so the end position is reachable. `e.dataTransfer?.setData` is required for Firefox (and must be optional-chained — jsdom passes `null`).
- **Gotcha**: `vi.spyOn(getIo()!, 'to')` spy variables must be typed `MockInstance` (not `ReturnType<typeof vi.spyOn>`) to satisfy strict TS.
- **Fixed 6C gap**: template cloning previously dropped `skillProficiencies`/`attacks`; clone now copies all four JSON gameplay fields.

## Dependencies Unlocked

- characters Phase 6E (Character Export & History) — depends only on 6A, now next in track
- inventory Phase 10B can slot its `InventoryPanel` into the sheet's inventory tab placeholder when built
