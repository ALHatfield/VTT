# Feature: characters

> **Slug:** `characters`
> **Feature dirs:** `client/src/features/characters/`, `server/src/features/characters/`
> **Instructions:** `.github/instructions/feature-characters.instructions.md`
> **Shared types:** `shared/types/characters.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 6E | Character Export & History | Deferred |
| 6F | System-Aware Character Sheets | Not Started |
| 6G | Character Progression | Not Started |

---

## Phase 6F: System-Aware Character Sheets

**Dependencies:** Phase 6A + campaigns Phase 3C

### Tasks
- [ ] Prisma: add `Character.systemData Json` for system-specific fields; migration backfills existing characters with an empty 5e shape
- [ ] Shared types: `Dnd5eCharacterData`, `Pf2eCharacterData` (ancestry, heritage, background, class DC, proficiency ranks for skills/saves/perception, hero points), discriminated by `system`
- [ ] Shared Zod validator: discriminated union for `systemData`
- [ ] Server: validate `systemData` against the campaign's `gameSystem` on create/update (422 on mismatch)
- [ ] Derive proficiency, skill, and save modifiers via `getGameSystemRules()` instead of the stored `proficiencyBonus` for PF2e
- [ ] Character sheet: shared header (name, level, HP, AC, ability scores, speed) plus system-specific section components (`Dnd5eSheetSection`, `Pf2eSheetSection`)
- [ ] Relabel "Race" as "Ancestry" for PF2e campaigns
- [ ] Character create form adapts fields to the campaign's game system
- [ ] Write tests: validator per system, mismatch rejection, derived modifiers for both systems, sheet renders the correct section per system

### Decisions
- Keep shared columns (name, level, HP, AC, ability scores, speed) relational; system-specific data goes in one validated JSON column
- Modifiers are derived from rules at read time, not stored, so rules fixes apply to every sheet

---

## Phase 6G: Character Progression

**Dependencies:** Phase 6F

### Tasks
- [ ] Prisma: add `Character.xp Int @default(0)` and `Campaign.progressionMode` enum (`xp`, `milestone`, default `xp`)
- [ ] Prisma: add `CharacterAdvancement` model (`characterId`, `campaignId`, `fromLevel`, `toLevel`, `choices Json`, `createdAt`) as an append-only log
- [ ] DM setting to choose the campaign progression mode
- [ ] `POST /api/campaigns/:id/characters/xp` — DM only; awards XP to one or many characters (XP mode)
- [ ] `POST /api/campaigns/:id/characters/milestone` — DM only; grants a level to one or many characters (milestone mode)
- [ ] Socket broadcast `characters:progression:updated` to the campaign room after awards
- [ ] "Level up available" badge on the sheet when XP crosses the system threshold or a milestone is granted
- [ ] Level-up wizard (owner only), system-aware: 5e HP (roll or average) and ASI levels; PF2e fixed HP (class + Con) and boost levels (5/10/15/20); records choices in `CharacterAdvancement` and updates level/maxHp
- [ ] DM can undo the most recent advancement for a character
- [ ] DM progression panel: party XP/level overview with bulk award
- [ ] Write tests: XP thresholds for both systems, milestone grant, wizard HP math per system, ownership/RBAC, undo restores previous level and HP, broadcast

### Decisions
- Players run their own level-up; the DM awards XP/milestones and can undo
- Feat, spell, and class-feature catalogs are out of scope — choices are recorded as free-form entries in `choices`
- The advancement log is append-only; undo writes a reversal instead of deleting history

---

## Phase 6E: Character Export & History (Post-MVP)

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
| campaigns Phase 3C | Sheets and progression use game system rules |

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
- Project_Pathfinder stored character data in a flat structure → new build uses JSON columns for extensible data (spells, features); inventory is normalized in the `inventory` feature instead of living in character JSON
- Project_Pathfinder used raw SQL → new build uses Prisma with typed queries
