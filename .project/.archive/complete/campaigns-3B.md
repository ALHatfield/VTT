# Campaigns — Phase 3B: Member Management

**Completed:** May 29, 2026
**Feature:** `campaigns`

## Deliverables

### shared/
- `shared/src/types/campaigns.ts` (MODIFIED) — Added `CampaignInvitePayload` interface
- `shared/src/validators/campaigns.ts` (MODIFIED) — Added `campaignInvitePayloadSchema` (email + player/observer role enum), exported `CampaignInviteInput` type

### server/
- `server/src/features/campaigns/campaigns.service.ts` (MODIFIED) — Added `inviteMember`, `removeMember`, `leaveCampaign` service functions
- `server/src/features/campaigns/campaigns.routes.ts` (MODIFIED) — Added `POST /:id/invite`, `DELETE /:id/members/:userId`, `POST /:id/leave` routes
- `server/src/features/campaigns/campaigns.routes.test.ts` (MODIFIED) — Added 17 tests covering all 3 new routes
- `server/vitest.config.ts` (MODIFIED) — Added `fileParallelism: false` to fix Vitest 3.x port conflicts in integration tests

### client/
- `client/src/features/campaigns/hooks/useMemberActions.ts` (NEW) — Hook exposing `inviteMember`, `removeMember`, `leaveCampaign` mutations
- `client/src/features/campaigns/hooks/useCampaignDetail.ts` (MODIFIED) — Added `refresh()` function (tick-counter pattern) to refetch campaign data after member changes
- `client/src/features/campaigns/CampaignDetail.tsx` (MODIFIED) — Added invite form (DM only), remove buttons per member row (DM only, non-DM members), leave button (non-DM members), error states for all new actions
- `client/src/features/campaigns/CampaignDetail.module.css` (MODIFIED) — Added styles for remove button, invite form, leave button

## Test Results

```
cd server && npx vitest run --reporter=verbose (with env sourced from server/.env)

 Test Files  3 passed (3)
      Tests  44 passed (44)
   Start at  21:14:53
   Duration  42.06s

Campaign Routes (33 tests)
  POST /api/campaigns/:id/invite
    ✓ DM can invite a user by email as player
    ✓ DM can invite a user as observer
    ✓ returns 422 when email does not match a user
    ✓ returns 409 when user is already a member
    ✓ returns 400 for invalid invite payload
    ✓ returns 400 when role is dm
    ✓ returns 403 when non-DM tries to invite
    ✓ returns 401 when unauthenticated
  DELETE /api/campaigns/:id/members/:userId
    ✓ DM can remove a member
    ✓ returns 403 when DM tries to remove themselves
    ✓ returns 404 when member does not exist in campaign
    ✓ returns 403 when player tries to remove a member
    ✓ returns 401 when unauthenticated
  POST /api/campaigns/:id/leave
    ✓ player can leave a campaign
    ✓ returns 403 when DM tries to leave
    ✓ returns 403 when non-member tries to leave
    ✓ returns 401 when unauthenticated
```

## Decisions & Insights

- **Invite returns 422 (not 404) for unknown email**: Prevents email enumeration (OWASP A07). Returns error code `INVITE_FAILED` with a neutral message, so DMs cannot probe arbitrary emails to check account existence.
- **DM protected at service layer**: `removeMember` and `leaveCampaign` both throw `CANNOT_REMOVE_DM`/`DM_CANNOT_LEAVE` if the target is the DM. UI also guards this, but service-level protection is the authoritative check.
- **`NOT_FOUND` in leave route is a real TOCTOU edge case**: If a DM removes a player at the exact moment that player calls `/leave`, the leave route could receive a `NOT_FOUND`. Added 404 handling in the route rather than relying on a 500 fallthrough.
- **Vitest 3.x `forks` pool breaks integration tests**: In Vitest 3.x the default pool changed from `threads` (shared module VM) to `forks` (separate processes). All test files that `import app.ts` each spawn their own server on port 3001, causing EADDRINUSE failures. Fix: `fileParallelism: false` in `server/vitest.config.ts` makes files run sequentially, each releasing the port via graceful shutdown before the next file starts. See `.project/notes/vitest-parallel-port-conflict.md`.
- **Test cleanup in try/finally**: Any test that creates a throwaway user (outsider) now wraps the cleanup in `try/finally` to prevent DB pollution if the assertion fails before the cleanup line.

## Dependencies Unlocked

Per the dependency graph in `roadmap.md`, the following phases are now unblocked:
- play-area 4A (already unblocked by 3A, no change)
- editor 5A (already unblocked by 3A, no change)
- characters 6A (already unblocked by 3A, no change)

Phase 3B itself has no downstream dependents — it completes the campaigns feature track.
