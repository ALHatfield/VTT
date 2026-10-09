# play-area: One-Active-Scene Invariant (from editor 5H)

**Created:** 2026-10-09
**Affects:** play-area feature (especially Phase 4L scene switching), any server test fixtures

## The invariant

Editor Phase 5H added a partial unique index to the database:

```sql
CREATE UNIQUE INDEX "scenes_one_active_per_campaign" ON "scenes" ("campaign_id") WHERE "is_active";
```

At most **one** scene per campaign can have `isActive = true`. Violations throw Prisma `P2002`, which surfaces as an unhandled 500 unless caught.

## What Phase 4L (scene switching) must do

Scene activation must be **deactivate-then-activate in one transaction** — never a bare `update({ isActive: true })`:

```ts
await prisma.$transaction([
  prisma.scene.updateMany({ where: { campaignId, isActive: true }, data: { isActive: false } }),
  prisma.scene.update({ where: { id: sceneId }, data: { isActive: true } }),
]);
```

Also verify `scene.campaignId === campaignId` before activating (cross-campaign guard), and note that `deleteScene` in `scenes.service.ts` rejects deleting the active scene — activation order matters when swapping.

## Existing hardening to be aware of

- `getOrCreateActiveScene` (`server/src/features/play-area/tokens.service.ts`) already catches `P2002` and re-fetches the winner when two requests race to create the default scene. Follow the same pattern for any new code that can race on activation.

## Test fixture gotcha

The campaign **invite flow lazily creates an active "Default Scene"** (`createPlayerTokenForMember` → `getOrCreateActiveScene`). Any test that creates its own `isActive: true` scene must either:

1. Create its scene **before** inviting members, or
2. Deactivate first: `await prisma.scene.updateMany({ where: { campaignId }, data: { isActive: false } })`

Precedents: `server/src/features/characters/character-tokens.routes.test.ts`, `server/src/features/play-area/vision.socket.test.ts`.
