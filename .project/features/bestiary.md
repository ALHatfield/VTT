# Feature: Bestiary

> **Slug:** `bestiary`
> **Feature dirs:** `client/src/features/bestiary/`, `server/src/features/bestiary/`
> **Instructions:** `.github/instructions/feature-bestiary.instructions.md`
> **Shared types:** `shared/types/bestiary.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 8A | Creature Library | Not Started |
| 8B | Creature Tokens | Not Started |
| 8C | Stat Block Rolling | Not Started |
| 8D | Import & Export | Not Started |
| 8E | Loot Tables | Not Started |

---

## Phase 8A: Creature Library

**Dependencies:** campaigns Phase 3C

### Tasks
- [ ] Prisma `Creature` model (`id`, `campaignId`, `kind` enum `monster | npc`, `name`, `size` enum, `creatureType`, `ac`, `maxHp`, `hpFormula`, `speed`, `abilityScores Json`, `systemData Json`, `portraitUrl`, `notes`, timestamps); cascade on campaign delete; index on `(campaignId, name)`
- [ ] Shared types: `Creature`, `CreatureKind`, `CreatureSize`, `CreatureAction`, `CreatureCreatePayload`, `CreatureUpdatePayload`, `Dnd5eCreatureData`, `Pf2eCreatureData` (discriminated by `system`)
- [ ] `CreatureAction` shape (shared by both systems): name, markdown description, optional attack bonus override, damage rolls (formula + damage type), optional save (ability/save + DC), optional area, usage limit (5e recharge X–6 or per day; PF2e frequency)
- [ ] `Dnd5eCreatureData`: CR, XP, saving throw and skill proficiencies, senses, languages, damage resistances/immunities/vulnerabilities, condition immunities, traits, actions, bonus actions, reactions, legendary actions (with per-round count)
- [ ] `Pf2eCreatureData`: level, traits, Perception, Fort/Ref/Will, skills, senses, languages, immunities/resistances/weaknesses, passive abilities, actions with action cost (`1 | 2 | 3 | free | reaction`) and traits, Strikes (with `agile` flag for MAP)
- [ ] Shared Zod validators: create/update schemas plus a discriminated union for `systemData`
- [ ] `bestiary.service.ts`: list (with name/type search), get, create, update, delete — all filtered by `campaignId`
- [ ] Server validates `systemData` against the campaign's `gameSystem` (422 on mismatch)
- [ ] `bestiary.routes.ts`: creature CRUD, DM only; mount `bestiaryRouter` under `/api/campaigns` in `server/src/app.ts`
- [ ] Socket broadcasts `bestiary:creature:created|updated|deleted` to DM sockets only
- [ ] Client: `useCreatures` hook (fetch + socket sync through a single source of truth)
- [ ] Client: `BestiaryPanel` (searchable list, filter by kind), `StatBlock` (shared header + `Dnd5eStatBlockSection` / `Pf2eStatBlockSection`), `CreatureForm` (adapts fields to game system; add/remove/reorder actions and abilities)
- [ ] Derived modifiers, save DCs, and attack bonuses via `getGameSystemRules()`
- [ ] Tests: validators per system, mismatch rejection, RBAC (players/observers get 403/404), search filtering, derived modifiers for both systems

### Decisions
- Monsters and NPCs share one model, split by `kind` — an NPC is just a creature with a personality
- Shared stat columns stay relational; system-specific data goes in one validated JSON column (same approach as characters 6F)
- Bestiary is campaign-scoped for MVP; cross-campaign libraries are post-MVP
- No bundled monster content — avoids licensing issues

---

## Phase 8B: Creature Tokens

**Dependencies:** Phase 8A + play-area Phase 4F.5

### Tasks
- [ ] Prisma: add nullable `Token.creatureId` (`onDelete: SetNull`); instances reuse the existing `Token.hp`, `maxHp`, and `ac` columns
- [ ] `POST /api/campaigns/:id/creatures/:creatureId/tokens` — DM only; creates a token from the creature (`monster` kind → `monster` token; `npc` kind → `npc` token with a required `npcSubtype` of `ally | enemy`), copying name, portrait, size → grid cells, AC, and max HP
- [ ] Size mapping constant: tiny/small/medium → 1, large → 2, huge → 3, gargantuan → 4 cells
- [ ] Optional auto-numbering for duplicates ("Goblin 1", "Goblin 2")
- [ ] Optional roll-for-HP using `hpFormula` on placement (otherwise use `maxHp`)
- [ ] Drag a creature from `BestiaryPanel` onto the canvas (reuse the NPC drop pipeline from 4F.5 with a new MIME type)
- [ ] DM token hover card shows AC, current/max HP, and a link to open the stat block; players see only name and health state
- [ ] Token HP edits broadcast via existing `play-area:token:updated`
- [ ] Tests: placement creates the correct token, size mapping, HP independence from template edits, player payloads never include creature stats

### Decisions
- Each placed token is an independent instance — template edits don't change tokens already in play
- Deleting a creature keeps its tokens on the map and clears `creatureId`

---

## Phase 8C: Stat Block Rolling

**Dependencies:** Phase 8B + play-area Phase 4E + play-area Phase 4H

### Tasks
- [ ] Click an ability, save, skill, or attack on `StatBlock` → roll with derived modifier through the existing dice pipeline
- [ ] Attack actions roll to-hit and damage together; formula display in chat (`d20 + 6 (Scimitar) = 19`)
- [ ] Roll-mode toggle per game system (5e advantage/disadvantage; PF2e fortune/misfortune) via `getGameSystemRules()`
- [ ] PF2e multiple attack penalty selector on Strikes (0 / −5 / −10; agile 0 / −4 / −8)
- [ ] 5e recharge roll button for recharge-limited actions (`d6`, shows available/spent)
- [ ] DM "hidden roll" option — result visible to the DM only
- [ ] Add selected creature tokens to the initiative tracker with an auto-rolled initiative (5e DEX; PF2e Perception)
- [ ] Tests: modifier derivation per system, hidden rolls never reach player sockets, initiative values per system

### Decisions
- Rolls reuse the dice service and chat message types — no bestiary-specific roll storage
- Hidden rolls are filtered server-side, not hidden in the UI

---

## Phase 8D: Import & Export

**Dependencies:** Phase 8A

### Tasks
- [ ] `GET /api/campaigns/:id/creatures/export` — DM only; JSON export of one or all creatures with a schema version field
- [ ] `POST /api/campaigns/:id/creatures/import` — DM only; validates every entry with the creature schemas and the campaign's game system; rejects unknown fields; enforces a max entry count and body size
- [ ] Import preview showing valid entries and per-entry errors before committing
- [ ] Name conflict handling: skip, rename, or overwrite
- [ ] Tests: round-trip export → import, system mismatch rejection, malformed entries, size and count limits

### Decisions
- Import uses a versioned VTT JSON format; third-party formats are post-MVP
- Imports are all-or-nothing per request to avoid half-imported libraries
- Export from one campaign and import into another of the same game system is the MVP path for reusing creatures across campaigns

---

## Phase 8E: Loot Tables

**Dependencies:** Phase 8A + Phase 8D + inventory Phase 10C + inventory Phase 10E

### Tasks
- [ ] Prisma `LootTable` model (`id`, `campaignId`, `name`, `description?`, `rolls` (dice formula for how many picks), timestamps) and `LootTableEntry` (`id`, `lootTableId`, `weight Int`, `itemId?` (catalog reference, `onDelete: SetNull`), `itemName` (fallback display name), `quantityFormula`, `currency Json?`, `subTableId?`, `sortOrder`); cascade on campaign/table delete
- [ ] Prisma: add nullable `Creature.lootTableId` (`onDelete: SetNull`)
- [ ] Shared types/validators: `LootTable`, `LootTableEntry`, `LootRollResult`, payloads; currency uses the per-system denomination constants from inventory Phase 10E
- [ ] Endpoints (DM only): loot table CRUD, `POST /api/campaigns/:id/loot-tables/:tableId/roll`
- [ ] Server-side roll using the existing dice engine (secure RNG); weighted pick; resolve sub-table entries with a max depth constant; reject cycles on save
- [ ] Roll results go to the DM only by default; "Reveal to party" posts a chat system message
- [ ] "Award" action: add rolled items to the party loot pool or a chosen character's inventory (inventory 10C entries) and currency to a character's purse (inventory 10E) in one transaction; entries without an `itemId` auto-create a catalog item on award
- [ ] Roll a creature's linked loot table from its token context menu or stat block
- [ ] Client: `LootTableEditor` (entries with weight, quantity formula, sub-table link; shows each entry's % chance) and `LootRollResult` modal
- [ ] Extend the 8D export/import format with loot tables (schema version bump; creature → table links preserved)
- [ ] Tests: weighted distribution (seeded), quantity formulas, sub-table depth and cycle rejection, award transaction, DM-only results, export/import round-trip with links

### Decisions
- Loot awards become regular inventory entries (inventory 10B/10C); entries reference catalog items where linked, and free-text names auto-create catalog items on award
- Loot results are DM-private until the DM chooses to reveal or award them

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| campaigns Phase 3C | Stat block shape and derived math depend on the campaign's game system |
| play-area Phase 4F.5 | Creature placement reuses the NPC drag-and-drop pipeline |
| play-area Phase 4E | Stat block rolls use the dice roller and chat |
| play-area Phase 4H | Creatures are added to the initiative tracker |
| inventory Phase 10C | Loot awards create entries in the party loot pool or character inventories |
| inventory Phase 10E | Currency awards use the purse and denomination constants |

| Depended On By | Why |
|---------------|-----|
| campaigns Phase 3D | DM Campaign Hub hosts the Bestiary and Loot tabs |

---

## Architectural Decisions (from Project_Pathfinder)

Project_Pathfinder had no stat block or bestiary system — tokens were plain colored circles with no linked data. This feature is new.

**What we're adopting from other features:**
- Relational shared columns + validated `systemData` JSON (characters 6F)
- Rules derived at read time from `getGameSystemRules()` so fixes apply everywhere (campaigns 3C)
- Existing token, dice, and initiative pipelines instead of parallel bestiary-specific ones

**What we're doing differently:**
- Creature templates and placed token instances are separate — editing a template never mutates tokens in play
