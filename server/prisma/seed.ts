import { PrismaClient } from '@prisma/client';
import { BCRYPT_ROUNDS, PLAYER_COLOR_PALETTE } from '@vtt/shared';
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
    { userId: 'dm-seed-user-001', role: 'dm' as const, color: PLAYER_COLOR_PALETTE[0] },
    { userId: 'player-seed-user-001', role: 'player' as const, color: PLAYER_COLOR_PALETTE[1] },
    { userId: 'player-seed-user-002', role: 'player' as const, color: PLAYER_COLOR_PALETTE[2] },
    { userId: 'player-seed-user-003', role: 'player' as const, color: PLAYER_COLOR_PALETTE[3] },
    { userId: 'player-seed-user-004', role: 'player' as const, color: PLAYER_COLOR_PALETTE[4] },
    { userId: 'player-seed-user-005', role: 'player' as const, color: PLAYER_COLOR_PALETTE[5] },
    { userId: 'player-seed-user-006', role: 'player' as const, color: PLAYER_COLOR_PALETTE[6] },
    { userId: 'observer-seed-user-001', role: 'observer' as const, color: PLAYER_COLOR_PALETTE[7] },
  ];

  for (const member of SEED_CAMPAIGN_MEMBERS) {
    await prisma.campaignPlayer.upsert({
      where: {
        campaignId_userId: {
          campaignId: SEED_CAMPAIGN_ID,
          userId: member.userId,
        },
      },
      update: { role: member.role, color: member.color },
      create: {
        campaignId: SEED_CAMPAIGN_ID,
        userId: member.userId,
        role: member.role,
        color: member.color,
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
    update: {
      name: 'Default Scene',
      imageUrl: null,
      width: 2048,
      height: 2048,
      cellSize: 70,
      isActive: true,
    },
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
    x: number;
    y: number;
    visionRadius: number;
    auraRadius: number | null;
    auraColor: string | null;
    auraVisible: boolean;
    auraType: string | null;
    auraCondition: string | null;
  }> = [
    {
      id: 'token-seed-player-001',
      userId: 'player-seed-user-001',
      username: 'TestPlayer1',
      color: '#4a9eff',
      x: 8,
      y: 12,
      visionRadius: 3,
      auraRadius: 2,
      auraColor: '#4a9eff',
      auraVisible: true,
      auraType: 'presence',
      auraCondition: null,
    },
    {
      id: 'token-seed-player-002',
      userId: 'player-seed-user-002',
      username: 'TestPlayer2',
      color: '#ff6b6b',
      x: 1,
      y: 5,
      visionRadius: 3,
      auraRadius: 3,
      auraColor: '#4caf6e',
      auraVisible: true,
      auraType: 'presence',
      auraCondition: null,
    },
    {
      id: 'token-seed-player-003',
      userId: 'player-seed-user-003',
      username: 'TestPlayer3',
      color: '#51cf66',
      x: 2,
      y: 0,
      visionRadius: 3,
      auraRadius: null,
      auraColor: null,
      auraVisible: false,
      auraType: null,
      auraCondition: null,
    },
    {
      id: 'token-seed-player-004',
      userId: 'player-seed-user-004',
      username: 'TestPlayer4',
      color: '#ffd43b',
      x: 0,
      y: 1,
      visionRadius: 6,
      auraRadius: null,
      auraColor: null,
      auraVisible: false,
      auraType: null,
      auraCondition: null,
    },
    {
      id: 'token-seed-player-005',
      userId: 'player-seed-user-005',
      username: 'TestPlayer5',
      color: '#cc5de8',
      x: 1,
      y: 1,
      visionRadius: 6,
      auraRadius: null,
      auraColor: null,
      auraVisible: false,
      auraType: null,
      auraCondition: null,
    },
    {
      id: 'token-seed-player-006',
      userId: 'player-seed-user-006',
      username: 'TestPlayer6',
      color: '#ff922b',
      x: 2,
      y: 1,
      visionRadius: 6,
      auraRadius: null,
      auraColor: null,
      auraVisible: false,
      auraType: null,
      auraCondition: null,
    },
  ];

  for (const t of PLAYER_TOKEN_DEFAULTS) {
    await prisma.token.upsert({
      where: { id: t.id },
      update: {
        name: t.username,
        color: t.color,
        x: t.x,
        y: t.y,
        visionRadius: t.visionRadius,
        auraRadius: t.auraRadius,
        auraColor: t.auraColor,
        auraVisible: t.auraVisible,
        auraType: t.auraType,
        auraCondition: t.auraCondition,
      },
      create: {
        id: t.id,
        sceneId: SEED_SCENE_ID,
        campaignId: SEED_CAMPAIGN_ID,
        ownerId: t.userId,
        name: t.username,
        type: 'player',
        color: t.color,
        x: t.x,
        y: t.y,
        size: 1,
        visionRadius: t.visionRadius,
        auraRadius: t.auraRadius,
        auraColor: t.auraColor,
        auraVisible: t.auraVisible,
        auraType: t.auraType,
        auraCondition: t.auraCondition,
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
      x: 4,
      y: 3,
      visionRadius: 6,
      auraRadius: null,
      auraColor: null,
      auraVisible: false,
      auraType: null,
      auraCondition: null,
    },
    {
      id: 'token-seed-npc-enemy-001',
      name: 'Goblin',
      type: 'npc' as const,
      npcSubtype: 'enemy' as const,
      color: '#ff6b6b',
      x: 16,
      y: 12,
      visionRadius: 6,
      auraRadius: 4,
      auraColor: '#e05050',
      auraVisible: true,
      auraType: 'presence',
      auraCondition: null,
    },
    {
      id: 'token-seed-npc-ally-002',
      name: 'Ally',
      type: 'npc' as const,
      npcSubtype: 'ally' as const,
      color: '#4a9eff',
      x: 6,
      y: 3,
      visionRadius: 6,
      auraRadius: 3,
      auraColor: '#4caf6e',
      auraVisible: true,
      auraType: 'presence',
      auraCondition: null,
    },
    {
      id: 'token-seed-npc-enemy-002',
      name: 'Enemy',
      type: 'npc' as const,
      npcSubtype: 'enemy' as const,
      color: '#4a9eff',
      x: 20,
      y: 9,
      visionRadius: 6,
      auraRadius: null,
      auraColor: null,
      auraVisible: false,
      auraType: null,
      auraCondition: null,
    },
  ];

  for (const t of NPC_TOKENS) {
    await prisma.token.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        color: t.color,
        x: t.x,
        y: t.y,
        npcSubtype: t.npcSubtype,
        visionRadius: t.visionRadius,
        auraRadius: t.auraRadius,
        auraColor: t.auraColor,
        auraVisible: t.auraVisible,
        auraType: t.auraType,
        auraCondition: t.auraCondition,
      },
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
        visionRadius: t.visionRadius,
        auraRadius: t.auraRadius,
        auraColor: t.auraColor,
        auraVisible: t.auraVisible,
        auraType: t.auraType,
        auraCondition: t.auraCondition,
      },
    });
    console.log(`  ✓ Upserted ${t.npcSubtype} NPC token: ${t.name}`);
  }

  await prisma.token.deleteMany({
    where: {
      campaignId: SEED_CAMPAIGN_ID,
      id: { notIn: [...PLAYER_TOKEN_DEFAULTS, ...NPC_TOKENS].map((token) => token.id) },
    },
  });

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

  console.log('Seeding fog regions...');
  const SEED_FOG_REGIONS = [
    {
      id: '9082ad2d-d1dc-47bf-ba04-7eaa87430cdd',
      vertices: [
        { x: 478.0040241448692, y: 789.1187122736419 },
        { x: 700.523138832998, y: 789.1187122736419 },
        { x: 700.523138832998, y: 991.0342052313883 },
        { x: 478.0040241448692, y: 991.0342052313883 },
      ],
    },
    {
      id: '0fb05729-ea2a-4be7-a629-1a987f764bd0',
      vertices: [
        { x: 902.4386317907445, y: 694.3420523138833 },
        { x: 1030.181086519115, y: 694.3420523138833 },
        { x: 1030.181086519115, y: 1118.776659959758 },
        { x: 902.4386317907445, y: 1118.776659959758 },
      ],
    },
    {
      id: '41680482-4f26-4def-b4b5-f18df192688b',
      vertices: [
        { x: 659.3158953722334, y: 826.2052313883299 },
        { x: 1260.941649899396, y: 826.2052313883299 },
        { x: 1260.941649899396, y: 920.9818913480885 },
        { x: 659.3158953722334, y: 920.9818913480885 },
      ],
    },
  ];

  await prisma.fogRegion.deleteMany({
    where: {
      sceneId: SEED_SCENE_ID,
      id: { notIn: SEED_FOG_REGIONS.map((region) => region.id) },
    },
  });

  for (const region of SEED_FOG_REGIONS) {
    await prisma.fogRegion.upsert({
      where: { id: region.id },
      update: { vertices: region.vertices },
      create: {
        ...region,
        campaignId: SEED_CAMPAIGN_ID,
        sceneId: SEED_SCENE_ID,
        createdByUserId: 'dm-seed-user-001',
      },
    });
    console.log(`  ✓ Upserted fog region: ${region.id}`);
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

  // ---------------------------------------------------------------------------
  // Seed tile placements (Phase 5B)
  // ---------------------------------------------------------------------------
  console.log('Seeding tile placements (Phase 5B)...');

  const SEED_PLACEMENT_IDS = new Set(['placement-seed-tile-001']);

  // Remove any non-seed placements on the seed scene (e.g. manually placed during dev)
  await prisma.tilePlacement.deleteMany({
    where: {
      sceneId: SEED_SCENE_ID,
      id: { notIn: [...SEED_PLACEMENT_IDS] },
    },
  });

  await prisma.tilePlacement.upsert({
    where: { id: 'placement-seed-tile-001' },
    update: {
      x: 0,
      y: 40,
      width: 1733,
      height: 1314,
      rotation: 0,
      zIndex: 0,
      category: 'background',
    },
    create: {
      id: 'placement-seed-tile-001',
      sceneId: SEED_SCENE_ID,
      campaignId: SEED_CAMPAIGN_ID,
      assetId: 'asset-seed-tile-001',
      x: 0,
      y: 40,
      width: 1733,
      height: 1314,
      rotation: 0,
      zIndex: 0,
      category: 'background',
    },
  });
  console.log('  ✓ Upserted tile placement: tile1.png');

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
