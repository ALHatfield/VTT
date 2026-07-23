# Note: Seed Scene Idempotency

**Phase:** 4G  
**Date:** 2026-06-05

## Problem

When a dev server is started before `npm run db:seed` is run (or after the DB is reset), `getOrCreateActiveScene()` auto-creates a scene for `campaign-seed-001` with a random UUID. The seed then tries to upsert `scene-seed-001`, which creates a *second* scene — but the auto-created one remains `isActive: true`. Player tokens are seeded onto `scene-seed-001`, which is not the active scene, so they are invisible.

## Fix Applied

`server/prisma/seed.ts` now deletes all non-seed scenes for `campaign-seed-001` before upserting `scene-seed-001`:

```ts
await prisma.scene.deleteMany({
  where: { campaignId: SEED_CAMPAIGN_ID, id: { not: SEED_SCENE_ID } },
});
```

## Implication for Future Phases

Any future seed data that references `scene-seed-001` is safe — the seed is now idempotent regardless of dev server visit order. If additional seed campaigns are added, apply the same pattern: delete auto-created scenes before upserting the canonical seed scene.
