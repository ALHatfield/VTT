import type {
  FogExplorationSyncPayload,
  TokenVisionReveal,
  TokenVisionSyncPayload,
} from '@vtt/shared';
import { FOG_CONFIG_EVENTS, TOKEN_VISION_EVENTS } from '@vtt/shared';
import type { Server } from 'socket.io';

import { prisma } from '../../shared/db/prisma.js';
import { normalizeFogConfig } from './fog-config.service.js';
import { buildExplorationCandidates, recordExploration } from './fog-exploration.service.js';

interface TokenVisionRevealInternal extends TokenVisionReveal {
  /** ownerId is used for server-side role filtering; never sent to clients. */
  ownerId: string | null;
  /** type and npcSubtype are used for ally NPC vision sharing; never sent to clients. */
  type: string;
  npcSubtype: string | null;
}

/**
 * Compute the current vision reveal circles for all tokens on a scene.
 * Not persisted — computed on demand from current token positions.
 */
export async function computeTokenVisionRegions(
  sceneId: string,
  campaignId: string,
): Promise<TokenVisionRevealInternal[]> {
  const tokens = await prisma.token.findMany({
    where: { sceneId, campaignId },
    select: {
      id: true,
      x: true,
      y: true,
      visionRadius: true,
      ownerId: true,
      type: true,
      npcSubtype: true,
    },
  });

  return tokens.map((t) => ({
    tokenId: t.id,
    x: t.x,
    y: t.y,
    visionRadius: t.visionRadius,
    sceneId,
    ownerId: t.ownerId,
    type: t.type,
    npcSubtype: t.npcSubtype,
  }));
}

/**
 * Persist newly explored areas for a scene and broadcast the delta. No-op
 * unless the scene runs the PM2 fog pipeline with persistent exploration.
 *
 * Only reveals that players are allowed to see contribute to exploration —
 * otherwise a hidden enemy NPC would permanently uncover the map for everyone.
 * Delivery follows the same role gate as vision sync: observers receive
 * nothing.
 */
export async function syncSceneExploration(
  io: Server,
  campaignId: string,
  sceneId: string,
  reveals: TokenVisionRevealInternal[],
): Promise<void> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { cellSize: true, fogConfig: true },
  });

  if (!scene) return;

  const config = normalizeFogConfig(scene.fogConfig);
  if (config.fogMode !== 'pm2' || config.explorationMode !== 'persistent') return;

  const shareable = reveals.filter(
    (r) => r.ownerId !== null || (r.type === 'npc' && r.npcSubtype === 'ally'),
  );

  const candidates = buildExplorationCandidates(shareable, scene.cellSize);
  const stamps = await recordExploration(sceneId, campaignId, candidates);
  if (stamps.length === 0) return;

  const payload: FogExplorationSyncPayload = { campaignId, sceneId, mode: 'append', stamps };
  const sockets = await io.in(`campaign:${campaignId}`).fetchSockets();

  for (const socket of sockets) {
    const role = socket.data.campaignRole as string | undefined;
    if (role !== 'dm' && role !== 'player') continue;
    socket.emit(FOG_CONFIG_EVENTS.FOG_EXPLORATION_SYNC, payload);
  }
}

/**
 * Emit a role-gated `play-area:token:vision:sync` to every socket in the campaign room.
 * - DM sockets receive reveals for ALL tokens (player and NPC/monster).
 * - Player sockets receive reveals for ALL player-owned tokens (shared party vision).
 * - Observer sockets receive an empty reveals array.
 */
export async function emitVisionSync(
  io: Server,
  campaignId: string,
  sceneId: string,
): Promise<void> {
  const reveals = await computeTokenVisionRegions(sceneId, campaignId);
  const room = `campaign:${campaignId}`;
  const sockets = await io.in(room).fetchSockets();

  for (const socket of sockets) {
    const role = socket.data.campaignRole as string | undefined;
    const userId = socket.data.userId as string | undefined;
    emitToSocket(socket, reveals, sceneId, campaignId, role, userId);
  }

  await syncSceneExploration(io, campaignId, sceneId, reveals);
}

/**
 * Emit a role-gated vision sync to a single socket (e.g. the joining socket on room join).
 * Computes token reveals fresh from the database.
 */
export async function emitVisionSyncToSocket(
  socket: { data: Record<string, unknown>; emit: (event: string, payload: unknown) => void },
  campaignId: string,
  sceneId: string,
): Promise<void> {
  const reveals = await computeTokenVisionRegions(sceneId, campaignId);
  const role = socket.data.campaignRole as string | undefined;
  const userId = socket.data.userId as string | undefined;
  emitToSocket(socket, reveals, sceneId, campaignId, role, userId);
}

function emitToSocket(
  socket: { emit: (event: string, payload: unknown) => void },
  reveals: TokenVisionRevealInternal[],
  sceneId: string,
  campaignId: string,
  role: string | undefined,
  userId: string | undefined,
): void {
  let filteredReveals: TokenVisionReveal[];

  if (role === 'dm') {
    filteredReveals = reveals.map(
      ({ ownerId: _ownerId, type: _type, npcSubtype: _npcSubtype, ...rest }) => rest,
    );
  } else if (role === 'player') {
    // Players share vision — each player sees all player-owned token reveals,
    // not just their own. Ally NPC tokens (type='npc', npcSubtype='ally') are
    // also included so players can benefit from friendly NPC sight.
    // Enemy NPC tokens remain DM-only regardless of position.
    filteredReveals = reveals
      .filter((r) => r.ownerId !== null || (r.type === 'npc' && r.npcSubtype === 'ally'))
      .map(({ ownerId: _ownerId, type: _type, npcSubtype: _npcSubtype, ...rest }) => rest);
  } else {
    filteredReveals = [];
  }

  const payload: TokenVisionSyncPayload = {
    reveals: filteredReveals,
    sceneId,
    campaignId,
  };

  socket.emit(TOKEN_VISION_EVENTS.TOKEN_VISION_SYNC, payload);
}
