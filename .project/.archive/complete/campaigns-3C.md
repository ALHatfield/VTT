# Feature: campaigns — Phase 3C: Game System Support

**Completed:** October 5, 2026
**Feature:** `campaigns`

## Deliverables

### Shared
- `shared/src/constants/game-systems.ts` (NEW) — `GameSystemRules` interface, `dnd5e` and `pf2e` implementations, `getGameSystemRules()`, `GAME_SYSTEM_IDS`, `DEFAULT_GAME_SYSTEM`, `GAME_SYSTEM_LABELS`; covers ability modifiers, proficiency (5e level table / PF2e rank + level), XP↔level (5e thresholds / PF2e 1000 XP per level), encumbrance (5e pounds / PF2e Bulk), roll modes, and degrees of success (PF2e ±10 with nat 20/1 step shifts; 5e pass/fail with attack-only nat crits)
- `shared/src/constants/game-systems.test.ts` (NEW) — 24 tests across both systems incl. PF2e degree-of-success edges
- `shared/src/constants/index.ts` (MODIFIED) — export game-systems
- `shared/src/types/campaigns.ts` (MODIFIED) — `GameSystem` type; `gameSystem` on `Campaign` and `CampaignCreatePayload` (absent from `CampaignUpdatePayload`)
- `shared/src/validators/campaigns.ts` (MODIFIED) — create schema: `gameSystem` enum defaulting to `dnd5e`; update schema rejects `gameSystem` via `z.undefined()` with field error
- `shared/src/validators/campaigns.test.ts` (NEW) — create default/explicit/invalid + update rejection tests

### Server
- `server/prisma/schema.prisma` (MODIFIED) — `GameSystem` enum (`@@map("game_system")`), `Campaign.gameSystem` with `@default(dnd5e)`
- `server/prisma/migrations/20261005225759_add_game_system_to_campaign/` (NEW) — default backfills existing campaigns
- `server/prisma/seed.ts` (MODIFIED) — seed campaign sets `gameSystem: 'dnd5e'` explicitly
- `server/src/features/campaigns/campaigns.service.ts` (MODIFIED) — `toCampaign` maps `gameSystem`; `createCampaign` accepts it
- `server/src/features/campaigns/campaigns.routes.ts` (MODIFIED) — create route passes validated `gameSystem`
- `server/src/features/campaigns/campaigns.routes.test.ts` (MODIFIED) — 5 new tests: default, explicit 5e, pf2e, invalid system (400), update rejects system change (400 + DB unchanged)

### Client
- `client/src/shared/context/CampaignContext.tsx` (NEW) — `CampaignProvider` (fetches campaign detail, memoizes `gameSystem` + `rules`), `useCampaign()` hook, `CampaignScope` layout-route wrapper
- `client/src/App.tsx` (MODIFIED) — `CampaignScope` layout routes wrap `/campaigns/:id/*` (nested detail + character routes) and `/play/:campaignId`
- `client/src/features/campaigns/GameSystemBadge.tsx` + `.module.css` (NEW) — color-coded system badge
- `client/src/features/campaigns/GameSystemBadge.test.tsx` (NEW) — label rendering for both systems
- `client/src/features/campaigns/CampaignForm.tsx` + `.module.css` (MODIFIED) — required game system `<select>` on create (defaults D&D 5e); locked badge + immutability note on edit
- `client/src/features/campaigns/CampaignList.tsx` + `.module.css` (MODIFIED) — badge on campaign cards
- `client/src/features/campaigns/CampaignDetail.tsx` (MODIFIED) — badge in title row; reads from campaign context; refreshes after edit
- `client/src/features/campaigns/hooks/useCampaignDetail.ts` (DELETED) — replaced by `CampaignContext`
- `client/src/features/campaigns/hooks/useCampaignActions.ts` (MODIFIED) — comment updated to reference context

## Test Results

```
npm run phase:verify -- --target full --compact
Suites: 400 passed, 0 failed (400 total)
Tests:  1268 passed, 0 failed, 0 skipped (1268 total)
All tests passed.
```

API smoke test against the running dev server (session-cookie auth):
- `POST /api/campaigns` `{"name":"3C PF2e Smoke","gameSystem":"pf2e"}` → 201, `gameSystem: "pf2e"`
- `POST /api/campaigns` `{"name":"3C Default Smoke"}` → 201, `gameSystem: "dnd5e"`
- `PUT /api/campaigns/:id` `{"gameSystem":"dnd5e"}` → 400 with gameSystem validation error
- `GET /api/campaigns` → both campaigns listed with correct systems; cleanup `DELETE` → 204

## Decisions & Insights

- `degreeOfSuccess(total, dc, naturalRoll?, rollType?)` — code review caught that 5e nat 20/1 crits apply only to attack rolls, not checks/saves. Added `rollType: 'check' | 'attack'` (default `'check'`); PF2e step-shifting applies to all check types per Remaster rules.
- Campaign context placed in `client/src/shared/context/` (not the campaigns feature) so characters/bestiary/play-area can consume `gameSystem`/`rules` without cross-feature imports; routes compose via `CampaignScope` in `App.tsx`.
- `useCampaignDetail` deleted rather than kept alongside the provider — `CampaignDetail` reads the context, avoiding a duplicate fetch of `GET /api/campaigns/:id`.
- Update validator uses `z.undefined({ invalid_type_error })` on `gameSystem` instead of `.strict()` — gives a targeted field error without changing unknown-key behavior for other fields.
- Prisma `@default(dnd5e)` on the new column backfilled all existing campaigns in the migration; no data script needed.
- Flake note: `characters.routes.test.ts` failed once in the batch run (opaque beforeEach error) but passed in isolation and in the re-run — not related to this phase.

## Dependencies Unlocked

- **characters Phase 6F** — character sheets can render/validate per game system via `useCampaign().rules`
- **bestiary Phase 8A** — stat block shape can key off the campaign's game system
- **campaigns Phase 3D** (partially) — still blocked on editor 5H, story 7A, bestiary 8A
