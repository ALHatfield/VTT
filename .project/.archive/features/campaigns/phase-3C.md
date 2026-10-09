# Archived Phase 3C: Game System Support

- Feature: `campaigns`
- Source: `.project/features/campaigns.md`
- Archived: 2026-10-05

---

## Phase 3C: Game System Support

**Dependencies:** Phase 3A

### Tasks
- [x] Prisma: add `GameSystem` enum (`dnd5e`, `pf2e`) and `Campaign.gameSystem` (default `dnd5e`); migration backfills existing campaigns
- [x] Shared types/validators: add `gameSystem` to `Campaign`, `CampaignCreatePayload`; reject `gameSystem` on update payloads
- [x] Create `shared/src/constants/game-systems.ts` with a `GameSystemRules` interface and implementations for `dnd5e` and `pf2e`:
  - ability modifier
  - proficiency (5e: level-based bonus; PF2e: Untrained/Trained/Expert/Master/Legendary rank + level)
  - max level and XP-to-level rule (5e XP thresholds; PF2e 1000 XP per level)
  - encumbrance model (5e weight; PF2e Bulk)
  - roll modes (5e advantage/disadvantage; PF2e fortune/misfortune)
  - degrees of success (PF2e ±10 critical rule; 5e pass/fail with nat 20/1 attack crits)
- [x] Export `getGameSystemRules(system)` from `@vtt/shared`
- [x] Campaign create form: game system selector (required, defaults to D&D 5e)
- [x] Show a game system badge on campaign list cards and the campaign detail page
- [x] Expose `gameSystem` through the campaign context so features can read rules without refetching
- [x] Write tests: each rules function for both systems (including PF2e degree-of-success edges), create with each system, update rejects system change, badge rendering

### Decisions
- "Pathfinder" means **Pathfinder 2e** (Remaster terms: ancestry, heritage, Bulk)
- The game system is chosen at creation and immutable — switching would require migrating every sheet and stat block
- Rules live in `shared/` so client and server always compute the same numbers
- Only system mechanics are encoded; content (monsters, spells, items) is user-entered or from ORC/OGL-licensed SRD material
- `degreeOfSuccess` takes an optional `rollType` (`'check' | 'attack'`, default `'check'`) — 5e nat 20/1 overrides apply only to attack rolls; PF2e nat 20/1 step-shifts apply to every check
- Campaign context lives in `client/src/shared/context/CampaignContext.tsx` (not the campaigns feature) so other features can consume it without cross-feature imports; `CampaignScope` layout routes wrap `/campaigns/:id/*` and `/play/:campaignId`
- `useCampaignDetail` was deleted — `CampaignDetail` now reads from the campaign context, avoiding a double fetch
- Update validator rejects `gameSystem` via `z.undefined()` with a targeted field error rather than `.strict()`, keeping unknown-key behavior unchanged

---


