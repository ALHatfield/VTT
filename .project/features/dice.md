# Feature: Dice

> **Slug:** `dice`
> **Feature dirs:** `client/src/features/dice/`, `server/src/features/dice/`
> **Instructions:** `.github/instructions/feature-dice.instructions.md`
> **Shared types:** `shared/types/dice.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 9A | Advanced Dice Expressions | Not Started |
| 9B | Roll Visibility | Not Started |
| 9C | Roll Macros | Not Started |
| 9D | Roll History & Stats | Not Started |
| 9E | Dice Skins | Deferred |

Dice history: the base roller shipped as play-area 4E and the 3D renderer as play-area PM1 (archived under `.project/.archive/complete/play-area-4E.md` and `play-area-PM1.md`). Those records keep their play-area IDs; ongoing ownership of that code is dice.

---

## Phase 9A: Advanced Dice Expressions

**Dependencies:** None

### Tasks
- [ ] Shared types: `RollTerm` (dice term or numeric term with sign), `DieModifier` (`kh | kl | dh | dl | explode | reroll | rerollOnce`), extend `RollResult` with `terms` while keeping legacy fields populated
- [ ] Tokenizer + recursive-descent parser in `server/src/features/dice/dice-expression.ts`: multi-term sums (`1d8+2d6+3`), parentheses, `*` and `/` (floor) on totals, keep/drop (`4d6kh3`, `2d20kl1`), exploding (`d6!`), reroll (`r1`, `ro<2`), `adv`/`dis` aliases mapped to `2d20kh1`/`2d20kl1`
- [ ] Bounds: `DICE_FORMULA_MAX_LENGTH`, total dice across terms ≤ `DICE_MAX_COUNT`, `DICE_EXPLODE_MAX_ITERATIONS`, `DICE_MAX_TERMS`, parenthesis depth cap — reject on overflow
- [ ] Structured parse errors (`code`, `message`, `position`) surfaced as chat error toasts instead of a generic "invalid formula"
- [ ] Keep `parseDiceFormula` / `rollDiceFormula` call sites working via the new parser (no behavior change for existing formulas)
- [ ] Chat roll card: per-term breakdown with dropped dice struck through and exploded dice marked
- [ ] `mapRollToDice` maps multi-term results to 3D dice (only supported sides animate; others fall back to instant)
- [ ] Tests: grammar coverage, bounds and pathological inputs (`999d999!`, deep parens), legacy formula parity, seeded keep/drop/explode/reroll distributions, legacy `rollData` still renders

### Decisions
- Hand-written parser over a library — small grammar, full control over bounds, no `eval`
- Results stay server-only; the parser is shared-safe but RNG lives in the server service

---

## Phase 9B: Roll Visibility

**Dependencies:** None

### Tasks
- [ ] Prisma: `RollVisibility` enum (`public | gm | blind | self`) and `CampaignMessage.visibility` (default `public`); index on `(campaignId, type, createdAt)`
- [ ] Chat commands `/gmroll`, `/broll`, `/sroll` plus a visibility selector on the roller button; default visibility per user in localStorage
- [ ] Server: per-socket fan-out for non-public rolls; `blind` sends the roller a placeholder (no total, no dice values)
- [ ] Messages history REST endpoint applies the same visibility filter
- [ ] DM "reveal" action converts a hidden roll to `public` and broadcasts the full result
- [ ] 3D: non-recipients get no animation; the roller of a `blind` roll gets a hidden-result animation (no face stamp)
- [ ] Tests: no hidden `rollData` reaches unauthorized sockets (DM, player, other player, observer matrix), history filtering, reveal flow

### Decisions
- Visibility is enforced server-side only — UI hiding is never the security boundary
- Visibility lives on the message row so history, stats, and reveal share one source of truth

---

## Phase 9C: Roll Macros

**Dependencies:** Phase 9A

### Tasks
- [ ] Prisma `DiceMacro` model (`id`, `userId`, `campaignId?`, `characterId?`, `name`, `formula`, `visibility`, `sortOrder`, timestamps); cascade on user/campaign/character delete; unique `(userId, campaignId, name)`
- [ ] Shared types/validators: `DiceMacro`, `DiceMacroCreatePayload`, `DiceMacroUpdatePayload`; formula validated by the 9A parser on save
- [ ] `dice.routes.ts`: macro CRUD under `/api/dice/macros`, owner only; mount `diceRouter` in `server/src/app.ts`
- [ ] Emit `dice:macro:created|updated|deleted` to the owner's sockets
- [ ] Client: `useDiceMacros` hook, `MacroHotbar` (drag to reorder, click to roll), `MacroEditor` modal
- [ ] Chat shortcut: `/m name` rolls a macro by name
- [ ] Per-user macro cap (`DICE_MACRO_MAX_PER_USER`)
- [ ] Tests: CRUD RBAC (other users get 404), invalid formula rejection, cap enforcement, macro rolls respect cooldown and visibility

### Decisions
- Macros store formulas, not results — every macro roll goes through the normal server roll path
- Character attribute references (`@dex`) are post-MVP; macros hold literal formulas for now

---

## Phase 9D: Roll History & Stats

**Dependencies:** Phase 9B

### Tasks
- [ ] `GET /api/campaigns/:id/rolls` — visibility-filtered, cursor-paginated, filter by `userId` and formula text
- [ ] `GET /api/campaigns/:id/rolls/stats` — per-player roll count, d20 average, natural 20/1 counts, highest/lowest total; DM sees all players, players see their own plus public aggregates
- [ ] Client: `RollHistoryPanel` (search, filter by player, click to re-roll formula) and `RollStatsPanel`
- [ ] Tests: visibility filtering in history and stats, pagination stability, stats math on seeded data

### Decisions
- History and stats read `roll` chat messages — no separate roll log table
- Stats are computed on request with an aggregate query; cache only if profiling shows a need

---

## Phase 9E: Dice Skins

**Dependencies:** None

### Tasks
- [ ] Prisma `DiceSkin` model (`userId` unique, `bodyColor`, `labelColor`, `material` enum, timestamps); cascade on user delete
- [ ] Shared types/validators: `DiceSkin`, `DiceSkinUpdatePayload`; hex color validation; `DICE_SKIN_MATERIALS`
- [ ] `GET|PUT /api/dice/skin` — own skin only; emit `dice:skin:updated` to the user's campaign rooms
- [ ] Server attaches the roller's skin to each roll broadcast so other clients render it without a lookup
- [ ] Renderer: material presets (plastic, metal, glass, stone) and per-die color/label textures; geometry and physics unchanged
- [ ] Client: `DiceSkinPicker` with live 3D preview in roller settings
- [ ] Tests: validator bounds, skin applied per roller, default skin when none saved, no physics/result change across skins

### Decisions
- One skin per user (not per campaign) for MVP
- Skins are presentation only — they never affect simulation or results

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| — | No blocking dependencies; builds on already-complete play-area 4E (roller + chat) and PM1 (3D renderer) |

| Depended On By | Why |
|---------------|-----|
| — | No blocking dependents; characters 6C and bestiary 8C consume the dice pipeline and pick up 9A–9C capabilities when available |

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**
- Chat-driven `/roll` commands with persisted results
- Three.js + cannon-es physics dice from the standalone `~/Desktop/dice` project

**What we're changing:**
- Server-authoritative RNG — the original dice project rolled client-side; here the renderer only plays back server results
- Dice gets its own feature slug instead of living inside play-area, and the separate `@vtt/dice` workspace folds into `features/dice/`
- Roll visibility enforced server-side rather than by hiding UI
