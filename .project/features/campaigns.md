# Feature: campaigns

> **Slug:** `campaigns`
> **Feature dirs:** `client/src/features/campaigns/`, `server/src/features/campaigns/`
> **Instructions:** `.github/instructions/feature-campaigns.instructions.md`
> **Shared types:** `shared/types/campaigns.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 3D | DM Campaign Hub | Not Started |

Phases 3A–3B complete. See `.project/.archive/features/campaigns/` for archived phase details and `.project/.archive/complete/` for completion records.

---

## Phase 3D: DM Campaign Hub

**Dependencies:** Phase 3C + editor Phase 5H + story Phase 7A + bestiary Phase 8A

### Tasks
- [ ] Build `CampaignHubLayout` (DM only): campaign header with game system badge, tab navigation, and an `<Outlet>` for the active tab
- [ ] Register hub routes in `App.tsx` as nested routes under `/campaigns/:id/hub` — `story`, `scenes`, `characters`, `bestiary` — each rendering that feature's own page component
- [ ] Scenes tab: mount the editor 5H `SceneLibraryPanel` as a standalone page with "Open in editor" and "Go live" actions
- [ ] Story tab: mount the story 7A `ChapterList` + `JournalPanel`
- [ ] Characters tab: party overview (name, level, HP, AC) linking to each character sheet
- [ ] Bestiary tab: mount the bestiary 8A `BestiaryPanel`
- [ ] Hide tabs whose feature phase hasn't shipped yet behind a constant-driven tab registry (Loot tab added when bestiary 8E lands; Progression panel when characters 6G lands)
- [ ] "Launch session" button that opens the play area on the active scene
- [ ] Add a "DM Hub" entry to `CampaignDetail` and portal navigation for DMs only; non-DMs requesting hub routes are redirected to the campaign detail page
- [ ] Persist the last-opened hub tab per campaign in local storage
- [ ] Add GSAP tab transition consistent with existing page transitions
- [ ] Write tests: DM-only access and redirect, tab registry visibility, nested route rendering, last-tab persistence

### Decisions
- The hub is a layout, not a data owner — each tab is the owning feature's own page, so features stay decoupled
- Composition happens in `App.tsx` routing; `campaigns` never imports from `story`, `bestiary`, `editor`, or `characters`
- Server-side RBAC is already enforced by each feature's API; the hub redirect is a UX guard only

---

## Cross-Feature Dependencies

| Depends On | Why |
|-----------|-----|
| editor Phase 5H | Hub Scenes tab hosts the Scene Library |
| story Phase 7A | Hub Story tab hosts chapters and journal |
| bestiary Phase 8A | Hub Bestiary tab hosts the creature library |

| Depended On By | Why |
|---------------|-----|
| characters Phase 6F | Character sheets render and validate per game system |
| bestiary Phase 8A | Stat block shape depends on the campaign's game system |
