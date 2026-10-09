import type { CampaignRole, NpcSubtype, TokenType, TokenVisionReveal } from '@vtt/shared';
import { isEnemyToken } from '@vtt/shared';

import type { FogViewMode } from './useFogViewMode';

interface VisionSourceToken {
  id: string;
  ownerId: string | null;
  type: TokenType;
  npcSubtype: NpcSubtype | null;
}

interface FilterVisionRevealsParams {
  reveals: TokenVisionReveal[];
  tokens: VisionSourceToken[];
  role: CampaignRole | null;
  fogViewMode: FogViewMode;
}

function isPlayerVisibleVisionSource(token: VisionSourceToken): boolean {
  return token.ownerId !== null || (token.type === 'npc' && token.npcSubtype === 'ally');
}

/**
 * DM-only "player view" preview should match the server's player role-gating:
 * keep player-owned tokens and ally NPCs, exclude enemy NPCs and other DM tokens.
 */
export function filterVisionRevealsForFogPreview({
  reveals,
  tokens,
  role,
  fogViewMode,
}: FilterVisionRevealsParams): TokenVisionReveal[] {
  if (role !== 'dm' || fogViewMode !== 'player') {
    return reveals;
  }

  const visibleTokenIds = new Set(
    tokens.filter((token) => isPlayerVisibleVisionSource(token)).map((token) => token.id),
  );

  return reveals.filter((reveal) => visibleTokenIds.has(reveal.tokenId));
}

/** Drop enemy tokens the party has no line of sight to; null keeps every token. */
export function filterTokensByPartySight<T extends VisionSourceToken>(
  tokens: T[],
  visibleEnemyTokenIds: ReadonlySet<string> | null,
): T[] {
  if (visibleEnemyTokenIds === null) return tokens;
  return tokens.filter((token) => !isEnemyToken(token) || visibleEnemyTokenIds.has(token.id));
}
