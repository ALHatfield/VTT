# Archived Phase 6A: Core Character Data

- Feature: `characters`
- Source: `.project/features/characters.md`
- Archived: 2026-06-05

---

## Phase 6A: Core Character Data

**Dependencies:** campaigns Phase 3A

### Tasks
- [x] Prisma `Character` model (name, race, class, level, ability scores, HP, AC, campaignId, userId)
- [x] `POST /api/campaigns/:id/characters` — create (player or DM)
- [x] `GET /api/campaigns/:id/characters` — list campaign characters (filtered by role)
- [x] `GET /api/campaigns/:id/characters/:charId` — detail
- [x] `PUT /api/campaigns/:id/characters/:charId` — update (owner or DM)
- [x] `PATCH /api/campaigns/:id/characters/:charId/hp` — quick HP update
- [x] Character sheet page with stat blocks
- [x] Ability score modifier auto-calculation: `Math.floor((score - 10) / 2)`
- [x] Tabbed layout: Stats, Biography, Inventory, Spells
- [ ] AC auto-calculation from equipped armor + DEX modifier (deferred to Phase 6D — requires inventory/equipment system)
- [x] Spell Save DC auto-calculation: `casting stat modifier + proficiency bonus + 8`
- [x] Shared types: `Character`, `AbilityScores`, `CharacterCreatePayload`
- [x] Tests: CRUD, modifier calculation, ownership enforcement

### Decisions
- Characters belong to a user AND a campaign
- Extended data (inventory, spells, features) stored as JSON columns
- Character portrait URL for token display
- AC auto-calculation deferred to Phase 6D when equipment system exists; manual AC input for now
- Delete is DM-only (not owner); character creation uses `requireCampaignRole('player')` which blocks observers but allows DM passthrough
- HP quick-update enforces server-side `hp <= maxHp` validation beyond Zod schema range check
- `portraitUrl` restricted to `http://` or `https://` schemes to prevent XSS vectors

---


