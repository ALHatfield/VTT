/**
 * Reset the canvas state for the seed campaign, without touching permanent
 * fixtures (users, campaign membership, seed player tokens, characters,
 * built-in tile assets). Run with:
 *
 *   npm run db:reset-canvas
 *
 * After running, re-run `npm run db:seed` to guarantee all upsert-managed
 * seed data is present.
 */
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED_CAMPAIGN_ID = 'campaign-seed-001';
const SEED_SCENE_ID = 'scene-seed-001';

const SEED_PLAYER_TOKEN_IDS = [
  'token-seed-player-001',
  'token-seed-player-002',
  'token-seed-player-003',
  'token-seed-player-004',
  'token-seed-player-005',
  'token-seed-player-006',
];

const UPLOAD_DIRS = [path.resolve('uploads/assets'), path.resolve('uploads/thumbnails')];

async function clearDirectory(dir: string): Promise<number> {
  try {
    const files = await readdir(dir);
    await Promise.all(files.map((f) => unlink(path.join(dir, f))));
    return files.length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw err;
  }
}

async function main(): Promise<void> {
  console.log('Resetting canvas for seed campaign...');

  await prisma.$transaction([
    // Wipe placed tiles on all scenes
    prisma.tilePlacement.deleteMany({}),

    // Wipe revealed fog on all scenes
    prisma.fogRegion.deleteMany({}),

    // Wipe uploaded (non-builtin) tile assets
    prisma.tileAsset.deleteMany({ where: { source: 'uploaded' } }),

    // Wipe every token EXCEPT the seed player tokens
    prisma.token.deleteMany({
      where: { id: { notIn: SEED_PLAYER_TOKEN_IDS } },
    }),

    // Reset the seed player tokens back to their starting position
    prisma.token.updateMany({
      where: { id: { in: SEED_PLAYER_TOKEN_IDS } },
      data: { x: 0, y: 0 },
    }),

    // Wipe chat / roll history for the seed campaign
    prisma.campaignMessage.deleteMany({ where: { campaignId: SEED_CAMPAIGN_ID } }),

    // Clear the scene's uploaded background image reference
    prisma.scene.update({
      where: { id: SEED_SCENE_ID },
      data: { imageUrl: null },
    }),
  ]);

  console.log('  ✓ Database canvas state cleared');

  for (const dir of UPLOAD_DIRS) {
    const removed = await clearDirectory(dir);
    console.log(`  ✓ Removed ${removed} file(s) from ${path.relative(process.cwd(), dir)}`);
  }

  console.log('Canvas reset complete. Run `npm run db:seed` to restore seed data.');
}

main()
  .catch((err) => {
    console.error('Canvas reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
