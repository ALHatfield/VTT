# Feature: Portal

> **Slug:** `portal`
> **Feature dirs:** `client/src/features/portal/`
> **Instructions:** `.github/instructions/feature-portal.instructions.md`
> **Shared types:** N/A (client-only feature for MVP)

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 2B | Activity Feed | Not Started |

---

## Phase 2B: Activity Feed (Post-MVP)

**Dependencies:** Phase 2A, campaigns Phase 3A

### Tasks
- [ ] `GET /api/portal/activity` — recent activity for the authenticated user (campaigns joined, characters created, sessions played)
- [ ] Activity feed component on the Welcome page replacing static content
- [ ] Activity item types: campaign created, character created, session started, member joined
- [ ] Pagination or infinite scroll for activity history
- [ ] Real-time activity updates via Socket.IO (optional)
- [ ] Tests: activity API, feed rendering, pagination

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| auth Phase 1A | Portal routes require authenticated sessions |

| Depended On By | Why |
|---------------|-----|
| campaigns Phase 3A | Campaign list renders inside portal layout |
| characters Phase 6A | Character list renders inside portal layout |