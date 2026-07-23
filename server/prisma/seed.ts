import { PrismaClient } from '@prisma/client';
import { BCRYPT_ROUNDS } from '@vtt/shared';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Pre-seeded user accounts for MVP
 * All accounts use password: "password123"
 */
const SEED_USERS = [
  {
    id: 'dm-seed-user-001',
    username: 'TestDM',
    email: 'testdm@email.com',
    password: 'password123',
  },
  {
    id: 'player-seed-user-001',
    username: 'TestPlayer1',
    email: 'testplayer1@email.com',
    password: 'password123',
  },
  {
    id: 'player-seed-user-002',
    username: 'TestPlayer2',
    email: 'testplayer2@email.com',
    password: 'password123',
  },
  {
    id: 'player-seed-user-003',
    username: 'TestPlayer3',
    email: 'testplayer3@email.com',
    password: 'password123',
  },
  {
    id: 'player-seed-user-004',
    username: 'TestPlayer4',
    email: 'testplayer4@email.com',
    password: 'password123',
  },
  {
    id: 'player-seed-user-005',
    username: 'TestPlayer5',
    email: 'testplayer5@email.com',
    password: 'password123',
  },
  {
    id: 'player-seed-user-006',
    username: 'TestPlayer6',
    email: 'testplayer6@email.com',
    password: 'password123',
  },
  {
    id: 'observer-seed-user-001',
    username: 'TestObserver',
    email: 'testobserver@email.com',
    password: 'password123',
  },
];

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Seed data added per feature phase:
  // - auth Phase 1A: pre-seeded user accounts
  // - campaigns Phase 3A: pre-seeded test campaign

  console.log('Seeding user accounts...');
  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_ROUNDS);

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        email: user.email,
        passwordHash,
      },
      create: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash,
      },
    });

    console.log(`  ✓ Created/updated user: ${user.email}`);
  }

  console.log('Seeding test campaign...');
  const SEED_CAMPAIGN_ID = 'campaign-seed-001';
  await prisma.campaign.upsert({
    where: { id: SEED_CAMPAIGN_ID },
    update: {
      name: "Dragon's Lair",
      description: 'A perilous dungeon crawl — seed campaign for testing.',
    },
    create: {
      id: SEED_CAMPAIGN_ID,
      name: "Dragon's Lair",
      description: 'A perilous dungeon crawl — seed campaign for testing.',
    },
  });

  // Ensure each seed user has a role in the seed campaign
  const SEED_CAMPAIGN_MEMBERS = [
    { userId: 'dm-seed-user-001', role: 'dm' as const },
    { userId: 'player-seed-user-001', role: 'player' as const },
    { userId: 'player-seed-user-002', role: 'player' as const },
    { userId: 'player-seed-user-003', role: 'player' as const },
    { userId: 'player-seed-user-004', role: 'player' as const },
    { userId: 'player-seed-user-005', role: 'player' as const },
    { userId: 'player-seed-user-006', role: 'player' as const },
    { userId: 'observer-seed-user-001', role: 'observer' as const },
  ];

  for (const member of SEED_CAMPAIGN_MEMBERS) {
    await prisma.campaignPlayer.upsert({
      where: {
        campaignId_userId: {
          campaignId: SEED_CAMPAIGN_ID,
          userId: member.userId,
        },
      },
      update: { role: member.role },
      create: {
        campaignId: SEED_CAMPAIGN_ID,
        userId: member.userId,
        role: member.role,
      },
    });
    console.log(`  ✓ Added ${member.role} to seed campaign`);
  }

  console.log('Seeding default player tokens...');

  // Ensure the default scene exists with the deterministic seed ID.
  // Delete any auto-created scenes (those with non-seed UUIDs) so the seed
  // scene becomes the only active scene for the campaign.
  const SEED_SCENE_ID = 'scene-seed-001';
  await prisma.scene.deleteMany({
    where: {
      campaignId: SEED_CAMPAIGN_ID,
      id: { not: SEED_SCENE_ID },
    },
  });

  await prisma.scene.upsert({
    where: { id: SEED_SCENE_ID },
    update: {},
    create: {
      id: SEED_SCENE_ID,
      campaignId: SEED_CAMPAIGN_ID,
      name: 'Default Scene',
      isActive: true,
      width: 2048,
      height: 2048,
      cellSize: 70,
    },
  });

  // Default player tokens — one per player, each with a distinct color
  const PLAYER_TOKEN_DEFAULTS: Array<{
    id: string;
    userId: string;
    username: string;
    color: string;
  }> = [
    {
      id: 'token-seed-player-001',
      userId: 'player-seed-user-001',
      username: 'TestPlayer1',
      color: '#4a9eff',
    },
    {
      id: 'token-seed-player-002',
      userId: 'player-seed-user-002',
      username: 'TestPlayer2',
      color: '#ff6b6b',
    },
    {
      id: 'token-seed-player-003',
      userId: 'player-seed-user-003',
      username: 'TestPlayer3',
      color: '#51cf66',
    },
    {
      id: 'token-seed-player-004',
      userId: 'player-seed-user-004',
      username: 'TestPlayer4',
      color: '#ffd43b',
    },
    {
      id: 'token-seed-player-005',
      userId: 'player-seed-user-005',
      username: 'TestPlayer5',
      color: '#cc5de8',
    },
    {
      id: 'token-seed-player-006',
      userId: 'player-seed-user-006',
      username: 'TestPlayer6',
      color: '#ff922b',
    },
  ];

  for (const t of PLAYER_TOKEN_DEFAULTS) {
    await prisma.token.upsert({
      where: { id: t.id },
      update: { name: t.username, color: t.color },
      create: {
        id: t.id,
        sceneId: SEED_SCENE_ID,
        campaignId: SEED_CAMPAIGN_ID,
        ownerId: t.userId,
        name: t.username,
        type: 'player',
        color: t.color,
        x: 0,
        y: 0,
        size: 1,
      },
    });
    console.log(`  ✓ Upserted player token for ${t.username}`);
  }

  console.log('Seeding NPC tokens (Phase 4F.2)...');

  const NPC_TOKENS = [
    {
      id: 'token-seed-npc-ally-001',
      name: 'Town Guard',
      type: 'npc' as const,
      npcSubtype: 'ally' as const,
      color: '#51cf66',
      x: 8,
      y: 4,
    },
    {
      id: 'token-seed-npc-enemy-001',
      name: 'Goblin',
      type: 'npc' as const,
      npcSubtype: 'enemy' as const,
      color: '#ff6b6b',
      x: 12,
      y: 8,
    },
  ];

  for (const t of NPC_TOKENS) {
    await prisma.token.upsert({
      where: { id: t.id },
      update: { name: t.name, color: t.color, npcSubtype: t.npcSubtype },
      create: {
        id: t.id,
        sceneId: SEED_SCENE_ID,
        campaignId: SEED_CAMPAIGN_ID,
        ownerId: null,
        name: t.name,
        type: t.type,
        npcSubtype: t.npcSubtype,
        color: t.color,
        x: t.x,
        y: t.y,
        size: 1,
      },
    });
    console.log(`  ✓ Upserted ${t.npcSubtype} NPC token: ${t.name}`);
  }

  console.log('Seeding sample characters...');

  const SEED_CHARACTERS = [
    {
      id: 'char-seed-001',
      campaignId: SEED_CAMPAIGN_ID,
      userId: 'player-seed-user-001',
      name: 'Thorin Ironforge',
      race: 'Dwarf',
      class: 'Fighter',
      level: 5,
      abilityScores: {
        strength: 16,
        dexterity: 12,
        constitution: 14,
        intelligence: 10,
        wisdom: 13,
        charisma: 8,
      },
      hp: 44,
      maxHp: 44,
      ac: 18,
      proficiencyBonus: 3,
      speed: 25,
    },
    {
      id: 'char-seed-002',
      campaignId: SEED_CAMPAIGN_ID,
      userId: 'player-seed-user-002',
      name: 'Elara Nightwhisper',
      race: 'Elf',
      class: 'Wizard',
      level: 5,
      abilityScores: {
        strength: 8,
        dexterity: 14,
        constitution: 12,
        intelligence: 18,
        wisdom: 13,
        charisma: 10,
      },
      hp: 32,
      maxHp: 32,
      ac: 12,
      proficiencyBonus: 3,
      speed: 30,
    },
    {
      id: 'char-seed-003',
      campaignId: SEED_CAMPAIGN_ID,
      userId: 'player-seed-user-003',
      name: 'Rix Shadowstep',
      race: 'Halfling',
      class: 'Rogue',
      level: 5,
      abilityScores: {
        strength: 10,
        dexterity: 18,
        constitution: 12,
        intelligence: 13,
        wisdom: 10,
        charisma: 14,
      },
      hp: 38,
      maxHp: 38,
      ac: 15,
      proficiencyBonus: 3,
      speed: 25,
    },
  ];

  for (const c of SEED_CHARACTERS) {
    await prisma.character.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        race: c.race,
        class: c.class,
        level: c.level,
        abilityScores: c.abilityScores,
        hp: c.hp,
        maxHp: c.maxHp,
        ac: c.ac,
        proficiencyBonus: c.proficiencyBonus,
        speed: c.speed,
      },
      create: c,
    });
    console.log(`  ✓ Upserted character: ${c.name}`);
  }

  // ---------------------------------------------------------------------------
  // Built-in tile assets (Phase 5A.1)
  // ---------------------------------------------------------------------------
  console.log('Seeding built-in tile assets (Phase 5A.1)...');
  const BUILTIN_ASSETS = [
    {
      id: 'asset-seed-tile-001',
      filename: 'tile1.png',
      url: '/tiles/tile1.png',
      thumbnailUrl: '/tiles/tile1.png',
      width: 753,
      height: 571,
      category: 'background' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-tile-002',
      filename: 'tile2.png',
      url: '/tiles/tile2.png',
      thumbnailUrl: '/tiles/tile2.png',
      width: 898,
      height: 722,
      category: 'background' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-token-001',
      filename: 'token1.png',
      url: '/tokens/token1.png',
      thumbnailUrl: '/tokens/token1.png',
      width: 200,
      height: 200,
      category: 'playground' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-token-002',
      filename: 'token2.png',
      url: '/tokens/token2.png',
      thumbnailUrl: '/tokens/token2.png',
      width: 200,
      height: 200,
      category: 'playground' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-token-003',
      filename: 'token3.png',
      url: '/tokens/token3.png',
      thumbnailUrl: '/tokens/token3.png',
      width: 198,
      height: 205,
      category: 'playground' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-token-004',
      filename: 'token4.png',
      url: '/tokens/token4.png',
      thumbnailUrl: '/tokens/token4.png',
      width: 180,
      height: 180,
      category: 'playground' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-token-005',
      filename: 'token5.png',
      url: '/tokens/token5.png',
      thumbnailUrl: '/tokens/token5.png',
      width: 198,
      height: 200,
      category: 'playground' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
    {
      id: 'asset-seed-token-006',
      filename: 'token6.png',
      url: '/tokens/token6.png',
      thumbnailUrl: '/tokens/token6.png',
      width: 200,
      height: 200,
      category: 'playground' as const,
      source: 'builtin' as const,
      campaignId: null,
    },
  ];

  for (const asset of BUILTIN_ASSETS) {
    await prisma.tileAsset.upsert({
      where: { id: asset.id },
      update: {
        filename: asset.filename,
        url: asset.url,
        thumbnailUrl: asset.thumbnailUrl,
        width: asset.width,
        height: asset.height,
        category: asset.category,
        source: asset.source,
      },
      create: asset,
    });
    console.log(`  ✓ Upserted built-in asset: ${asset.filename}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
