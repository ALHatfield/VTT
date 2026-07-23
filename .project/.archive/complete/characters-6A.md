# Feature: characters — Phase 6A: Core Character Data

**Completed:** June 5, 2026
**Feature:** `characters`

## Deliverables

### Shared Package (`shared/`)
- `src/types/characters.ts` — Character, AbilityScores, CharacterCreatePayload, CharacterUpdatePayload, CharacterHpUpdatePayload, CharacterSheetTab
- `src/constants/characters.ts` — Limits, defaults, calculateModifier(), calculateProficiencyBonus(), calculateSpellSaveDC()
- `src/validators/characters.ts` — Zod schemas: characterCreatePayloadSchema, characterUpdatePayloadSchema, characterHpUpdatePayloadSchema
- `src/constants/characters.test.ts` — 10 unit tests for calculation functions
- `src/types/index.ts`, `src/constants/index.ts`, `src/validators/index.ts` — Updated barrel exports

### Server Package (`server/`)
- `prisma/schema.prisma` — Character model with campaign/user relations
- `prisma/migrations/20260605222500_add_character_model/` — Migration
- `prisma/seed.ts` — 3 sample characters (Thorin Ironforge, Elara Nightwhisper, Rix Shadowstep)
- `src/features/characters/characters.service.ts` — CRUD service: list, get, create, update, updateHp, delete
- `src/features/characters/characters.routes.ts` — 6 endpoints: GET list, POST, GET detail, PUT, PATCH /hp, DELETE
- `src/features/characters/characters.routes.test.ts` — 16 integration tests
- `src/app.ts` — Route registration

### Client Package (`client/`)
- `src/features/characters/CharacterList.tsx` + `.module.css` — Card grid listing campaign characters
- `src/features/characters/CharacterSheet.tsx` + `.module.css` — Tabbed sheet: Stats/Biography/Inventory(placeholder)/Spells(placeholder)
- `src/features/characters/CharacterCreate.tsx` + `.module.css` — Character creation form
- `src/features/characters/hooks/useCharacters.ts` — List fetch hook
- `src/features/characters/hooks/useCharacterDetail.ts` — Detail fetch hook
- `src/features/characters/hooks/useCharacterActions.ts` — CRUD action hook
- `src/features/characters/utils.ts` — Shared abilityAbbreviation() utility
- `src/App.tsx` — Route additions for /campaigns/:id/characters, /new, /:charId

## Test Results

```
npm run phase:verify -- --target full --compact

client: No type errors
server: No type errors

Suites: 121 passed, 0 failed (121 total)
Tests:  306 passed, 0 failed, 0 skipped (306 total)

Character-specific (26 tests):
- shared/constants/characters.test.ts: 10 passed (modifier, proficiency, spell save DC)
- server/features/characters/characters.routes.test.ts: 16 passed (CRUD, ownership, role enforcement)
```

API smoke test:
```
curl GET /api/campaigns/campaign-seed-001/characters → 200, 3 characters returned
```

## Decisions & Insights

- **AC auto-calculation deferred** to Phase 6D — requires equipment/inventory system. Manual AC input for now.
- **Delete is DM-only** — not character owner. UI does not show delete button; only DM can delete via API.
- **Observer blocking** uses `requireCampaignRole('player')` middleware instead of manual role check — DMs pass through automatically.
- **HP quick-update enforces maxHp server-side** — Zod schema validates range 0–999, but route handler adds `hp <= existing.maxHp` check. Code review caught this gap.
- **portraitUrl restricted to http/https** — `.refine()` added to prevent javascript: and data: URL schemes (XSS prevention). Code review caught this.
- **Ability scores stored as JSON column** — Prisma `Json` type maps to PostgreSQL JSONB. Validated by Zod on input.
- **No cross-feature import** — removed initial `useAuth` import from CharacterSheet; HP input always editable (role-based editing deferred to when campaign context is available in character routes).

## Dependencies Unlocked

Per roadmap dependency graph:
- **characters 6B** (Character-Token Linking) — requires 6A + play-area 4B ✓
- **characters 6C** (Interactive Rolling) — requires 6A + play-area 4E ✓
- **characters 6D** (Inventory & Spells) — requires 6A ✓
- **characters 6E** (Character Export & History) — requires 6A ✓
- **play-area 4H** (Initiative) — requires 6A + play-area 4G ✓
