import type { TokenVisionReveal } from '@vtt/shared';
import { describe, expect, it } from 'vitest';

import { filterTokensByPartySight, filterVisionRevealsForFogPreview } from './vision-filter';

const BASE_REVEALS: TokenVisionReveal[] = [
  { tokenId: 'player-token', x: 1, y: 1, visionRadius: 6, sceneId: 'scene-1' },
  { tokenId: 'ally-npc-token', x: 2, y: 2, visionRadius: 6, sceneId: 'scene-1' },
  { tokenId: 'enemy-npc-token', x: 3, y: 3, visionRadius: 6, sceneId: 'scene-1' },
  { tokenId: 'monster-token', x: 4, y: 4, visionRadius: 6, sceneId: 'scene-1' },
];

describe('filterVisionRevealsForFogPreview', () => {
  it('returns all reveals when role is not dm', () => {
    const result = filterVisionRevealsForFogPreview({
      reveals: BASE_REVEALS,
      tokens: [],
      role: 'player',
      fogViewMode: 'player',
    });

    expect(result).toEqual(BASE_REVEALS);
  });

  it('returns all reveals when dm is in dm fog mode', () => {
    const result = filterVisionRevealsForFogPreview({
      reveals: BASE_REVEALS,
      tokens: [],
      role: 'dm',
      fogViewMode: 'dm',
    });

    expect(result).toEqual(BASE_REVEALS);
  });

  it('keeps player-owned tokens and ally NPCs for dm player preview', () => {
    const result = filterVisionRevealsForFogPreview({
      reveals: BASE_REVEALS,
      tokens: [
        { id: 'player-token', ownerId: 'user-1', type: 'player', npcSubtype: null },
        { id: 'ally-npc-token', ownerId: null, type: 'npc', npcSubtype: 'ally' },
        { id: 'enemy-npc-token', ownerId: null, type: 'npc', npcSubtype: 'enemy' },
        { id: 'monster-token', ownerId: null, type: 'monster', npcSubtype: null },
      ],
      role: 'dm',
      fogViewMode: 'player',
    });

    expect(result).toEqual([
      { tokenId: 'player-token', x: 1, y: 1, visionRadius: 6, sceneId: 'scene-1' },
      { tokenId: 'ally-npc-token', x: 2, y: 2, visionRadius: 6, sceneId: 'scene-1' },
    ]);
  });
});

describe('filterTokensByPartySight', () => {
  const TOKENS = [
    { id: 'player', ownerId: 'user-1', type: 'player' as const, npcSubtype: null },
    { id: 'ally', ownerId: null, type: 'npc' as const, npcSubtype: 'ally' as const },
    { id: 'enemy', ownerId: null, type: 'npc' as const, npcSubtype: 'enemy' as const },
    { id: 'unset-npc', ownerId: null, type: 'npc' as const, npcSubtype: null },
    { id: 'monster', ownerId: null, type: 'monster' as const, npcSubtype: null },
    { id: 'crate', ownerId: null, type: 'misc' as const, npcSubtype: null },
  ];

  it('keeps every token when no sight filter applies', () => {
    expect(filterTokensByPartySight(TOKENS, null)).toBe(TOKENS);
  });

  it('drops monsters and non-ally NPCs the party cannot see', () => {
    const ids = filterTokensByPartySight(TOKENS, new Set(['monster'])).map((t) => t.id);
    expect(ids).toEqual(['player', 'ally', 'monster', 'crate']);
  });
});
