# Archived Phase 3A: Campaign CRUD

- Feature: `campaigns`
- Source: `.project/features/campaigns.md`
- Archived: 2026-06-01

---

Original phase section was already archived in the feature roadmap at archive time.

## Completion Record Snapshot

# Campaigns — Phase 3A: Campaign CRUD

**Completed:** 2026-05-29
**Feature:** `campaigns`

## Deliverables

### shared/
- `shared/src/types/campaigns.ts` (NEW) — `Campaign`, `CampaignPlayer`, `CampaignRole`, `CampaignCreatePayload`, `CampaignUpdatePayload`, `CampaignListResponse`, `CampaignDetailResponse`
- `shared/src/validators/campaigns.ts` (NEW) — `campaignCreatePayloadSchema`, `campaignUpdatePayloadSchema` (with at-least-one-field refinement on update)
- `shared/src/constants/campaigns.ts` (NEW) — `CAMPAIGN_NAME_MAX_LENGTH`, `CAMPAIGN_DESCRIPTION_MAX_LENGTH`, `CAMPAIGN_ROLES`
- `shared/src/types/index.ts` (MODIFIED) — re-exports campaigns types
- `shared/src/validators/index.ts` (MODIFIED) — re-exports campaigns validators
- `shared/src/constants/index.ts` (MODIFIED) — re-exports campaigns constants

### server/
- `server/prisma/schema.prisma` (MODIFIED) — Added `CampaignRole` enum, `Campaign` model, `CampaignPlayer` join table (cascade delete on campaign removal, unique constraint on campaignId+userId)
- `server/prisma/seed.ts` (MODIFIED) — Seeds "Dragon's Lair" campaign with all 3 seed users assigned dm/player/observer roles
- `server/src/features/campaigns/campaigns.middleware.ts` (NEW) — `requireCampaignRole(role)` with DM elevation (DMs pass all role checks)
- `server/src/features/campaigns/campaigns.service.ts` (NEW) — `listCampaignsForUser`, `getCampaignWithMembers`, `createCampaign`, `updateCampaign`, `deleteCampaign`
- `server/src/features/campaigns/campaigns.routes.ts` (NEW) — 5 REST endpoints registered at `/api/campaigns`
- `server/src/features/campaigns/campaigns.routes.test.ts` (NEW) — 16 integration tests
- `server/src/shared/types/express.d.ts` (NEW) — Express Request augmentation: `campaignRole`, `campaignId`
- `server/src/app.ts` (MODIFIED) — Registered `campaignRouter` at `/api/campaigns`

### client/
- `client/src/features/campaigns/hooks/useCampaigns.ts` (NEW) — List + CRUD hook (abort-on-unmount, 204 no-content safe)
- `client/src/features/campaigns/hooks/useCampaignDetail.ts` (NEW) — Single campaign detail hook (abort-on-unmount)
- `client/src/features/campaigns/hooks/useCampaignActions.ts` (NEW) — Lightweight update/delete hook (no list fetch side effect)
- `client/src/features/campaigns/CampaignList.tsx` (NEW) — List page with create button, role badges, DM delete
- `client/src/features/campaigns/CampaignList.module.css` (NEW)
- `client/src/features/campaigns/CampaignDetail.tsx` (NEW) — Detail page with member list, DM edit/delete controls
- `client/src/features/campaigns/CampaignDetail.module.css` (NEW)
- `client/src/features/campaigns/CampaignForm.tsx` (NEW) — Create/edit form (null-clears description in edit mode)
- `client/src/features/campaigns/CampaignForm.module.css` (NEW)
- `client/src/App.tsx` (MODIFIED) — Added `/campaigns` and `/campaigns/:id` routes, replaced `CampaignsPlaceholder`

## Test Results

```
npx vitest run --reporter=verbose  (from server/)

 Test Files  3 passed (3)
      Tests  27 passed (27)
   Start at  15:27:37
   Duration  17.73s

Campaign Routes (16 tests)
  POST /api/campaigns
    ✓ creates a campaign and assigns DM role to creator
    ✓ returns 400 for missing name
    ✓ returns 401 when unauthenticated
    ✓ creates campaign without description
  GET /api/campaigns
    ✓ lists campaigns the user belongs to
    ✓ returns empty array when user has no campaigns
    ✓ returns 401 when unauthenticated
  GET /api/campaigns/:id
    ✓ returns campaign detail with members for DM
    ✓ returns 403 when user is not a member
    ✓ returns 401 when unauthenticated
  PUT /api/campaigns/:id
    ✓ allows DM to update campaign name
    ✓ returns 403 when player tries to update
    ✓ returns 400 for invalid update payload
  DELETE /api/campaigns/:id
    ✓ allows DM to delete campaign
    ✓ cascades and removes campaign players on delete
    ✓ returns 403 when player tries to delete
```

API smoke test (against live dev server):
```
GET  /api/campaigns → 200 { data: [ { id, name, role: "dm", ... } ] }
POST /api/campaigns → 201 { data: { id, name, description, role: "dm", ... } }
```

## Decisions & Insights

**DM role hierarchy implemented in middleware:** `requireCampaignRole` grants DMs elevated access — a DM passes any role check (`'member'`, `'player'`, `'dm'`). This prevents DMs from being accidentally blocked by future player-scoped routes (e.g. token placement, character sheet access).

**Email omitted from member list (OWASP A02):** `CampaignPlayer` type and the member list response do not include `email`. Exposing all member emails to every observer or player is a data leakage risk. Email management (for invite flows) is reserved for Phase 3B.

**`useCampaignActions` hook:** The detail page needs update/delete mutations but not the full campaign list. Extracting to a separate hook prevents `useCampaigns`'s `useEffect` from firing a spurious `GET /api/campaigns` request on every detail page load.

**204 safe `apiFetch`:** The shared fetch helper checks `response.status === 204` before calling `response.json()` to avoid `SyntaxError: Unexpected end of JSON input` on delete responses.

**Validator imports constants:** `campaignUpdatePayloadSchema` and `campaignCreatePayloadSchema` import `CAMPAIGN_NAME_MAX_LENGTH` / `CAMPAIGN_DESCRIPTION_MAX_LENGTH` from the constants file to keep limits in sync.

**Pre-existing test port race:** Running all 3 server test files concurrently causes 2 "EADDRINUSE :3001" unhandled exceptions (test files race to bind the same port). All 27 tests still pass — this is a pre-existing issue with the test setup, not introduced by this phase.

## Dependencies Unlocked

Per the dependency graph in `roadmap.md`, Phase 3A completion unblocks:
- **play-area 4A** — Play area loads within a campaign context
- **editor 5A** — Editor accessed from campaign detail (DM only)
- **characters 6A** — Characters scoped to a campaign
- **campaigns 3B** — Member management (invite, remove, leave)
