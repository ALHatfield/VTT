import type { Server } from 'socket.io';

import type {
    DoorState,
    FogExplorationSyncPayload,
    FogVertex,
    TokenVisionReveal,
    TokenVisionSyncPayload,
    VisibilityPolygon,
    VisionUpdatedPayload,
} from '@vtt/shared';
import { FOG_CONFIG_EVENTS, TOKEN_VISION_EVENTS, VISION_EVENTS, isEnemyToken } from '@vtt/shared';

import { prisma } from '../../shared/db/prisma.js';
import { normalizeFogConfig } from './fog-config.service.js';
import { buildExplorationCandidates, recordExploration } from './fog-exploration.service.js';
import type { LosSegment } from './line-of-sight.js';
import {
    SegmentGrid,
    circleBounds,
    computeVisibilityPolygon,
    cullSegmentsToCircle,
    hasLineOfSight,
    inscribedRadius,
    isSegmentVisible,
} from './line-of-sight.js';
import { RoomMap } from './room-regions.js';
import { listTemporaryLights } from './temporary-lights.store.js';

interface TokenVisionRevealInternal extends TokenVisionReveal {
  /** ownerId is used for server-side role filtering; never sent to clients. */
  ownerId: string | null;
  /** type and npcSubtype are used for ally NPC vision sharing; never sent to clients. */
  type: string;
  npcSubtype: string | null;
  /** Footprint in grid cells, used for enemy line of sight; never sent to clients. */
  size: number;
}

/** Spatial-index bucket edge, in grid cells. */
const LOS_BUCKET_CELLS = 4;

/** Line-of-sight result for a scene. Doors are unfiltered; use `partyDoorIds` for players. */
export interface SceneVisibility {
  polygons: VisibilityPolygon[];
  doors: DoorState[];
  /** Doors visible from at least one player-shareable emitter. */
  partyDoorIds: Set<string>;
  /** Enemy tokens with a clear sight line from at least one party token. */
  visibleEnemyIds: Set<string>;
}

interface VisionSnapshot {
  reveals: TokenVisionRevealInternal[];
  visibility: SceneVisibility;
}

/** Party vision: player-owned tokens plus ally NPCs. Enemy NPCs stay DM-only. */
function isPartyReveal(reveal: TokenVisionRevealInternal): boolean {
  return reveal.ownerId !== null || (reveal.type === 'npc' && reveal.npcSubtype === 'ally');
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
      size: true,
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
    size: t.size,
  }));
}

/**
 * Persist newly explored areas for a scene and broadcast the delta. No-op
 * unless the scene runs the PM2 fog pipeline with persistent exploration.
 *
 * Only reveals that players are allowed to see contribute to exploration —
 * otherwise a hidden enemy NPC would permanently uncover the map for everyone.
 * Obstructed emitters (PM3) record only the circle inscribed in their visibility
 * polygon, so exploration can never uncover anything behind a wall.
 * Delivery follows the same role gate as vision sync: observers receive
 * nothing.
 */
export async function syncSceneExploration(
  io: Server,
  campaignId: string,
  sceneId: string,
  reveals: TokenVisionRevealInternal[],
  polygons: readonly VisibilityPolygon[] = [],
): Promise<void> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, campaignId },
    select: { cellSize: true, fogConfig: true },
  });

  if (!scene) return;

  const config = normalizeFogConfig(scene.fogConfig);
  if (config.fogMode !== 'pm2' || config.explorationMode !== 'persistent') return;

  const polygonsByEmitter = new Map(
    polygons.filter((p) => p.source === 'token').map((p) => [p.emitterId, p]),
  );
  const shareable = reveals.filter(isPartyReveal).map((reveal) => {
    const polygon = polygonsByEmitter.get(reveal.tokenId);
    if (!polygon) return reveal;
    return { ...reveal, radiusPx: inscribedRadius(polygon.origin, polygon.points) };
  });

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

interface SceneObstacles {
  sceneKey: string;
  width: number;
  height: number;
  cellSize: number;
  blockers: LosSegment[];
  grid: SegmentGrid;
  doorWalls: (LosSegment & { isOpen: boolean })[];
}

/** Scenes whose room map is kept between vision syncs. */
const ROOM_MAP_CACHE_LIMIT = 32;
const roomMapCache = new Map<string, { signature: string; roomMap: RoomMap | null }>();

/** Room map for the scene's current blockers; rebuilt only when walls, doors, or bounds change. */
function getRoomMap(obstacles: SceneObstacles): RoomMap | null {
  const { sceneKey, width, height, cellSize, blockers, grid } = obstacles;
  const signature = [
    width,
    height,
    cellSize,
    ...blockers.map((b) => `${b.id}:${b.x1},${b.y1},${b.x2},${b.y2}`),
  ].join('|');
  const cached = roomMapCache.get(sceneKey);
  if (cached?.signature === signature) return cached.roomMap;

  const roomMap = RoomMap.build(width, height, cellSize, grid);
  roomMapCache.delete(sceneKey);
  roomMapCache.set(sceneKey, { signature, roomMap });
  if (roomMapCache.size > ROOM_MAP_CACHE_LIMIT) {
    const oldest = roomMapCache.keys().next().value;
    if (oldest !== undefined) roomMapCache.delete(oldest);
  }
  return roomMap;
}

/** Load the scene's walls and index the light-blockers (open doors excluded). Null when no scene. */
async function loadSceneObstacles(
  campaignId: string,
  sceneId: string,
): Promise<SceneObstacles | null> {
  const [scene, walls] = await Promise.all([
    prisma.scene.findFirst({
      where: { id: sceneId, campaignId },
      select: { cellSize: true, width: true, height: true },
    }),
    prisma.wallSegment.findMany({
      where: { campaignId, sceneId },
      select: {
        id: true,
        x1: true,
        y1: true,
        x2: true,
        y2: true,
        blocksLight: true,
        isDoor: true,
        isOpen: true,
      },
    }),
  ]);
  if (!scene) return null;

  const blockers: LosSegment[] = walls.filter((w) => w.blocksLight && !(w.isDoor && w.isOpen));
  return {
    sceneKey: `${campaignId}:${sceneId}`,
    width: scene.width,
    height: scene.height,
    cellSize: scene.cellSize,
    blockers,
    grid: new SegmentGrid(blockers, scene.cellSize * LOS_BUCKET_CELLS),
    doorWalls: walls.filter((w) => w.isDoor),
  };
}

interface LightEmitter {
  id: string;
  /** World pixels. */
  x: number;
  y: number;
  /** Grid cells. */
  radius: number;
  alwaysVisible: boolean;
}

/** Authored (editor 5G) plus temporary (PM4) lights on the scene. */
async function loadSceneLights(campaignId: string, sceneId: string): Promise<LightEmitter[]> {
  const authored = await prisma.lightSource.findMany({
    where: { campaignId, sceneId },
    select: { id: true, x: true, y: true, radius: true, alwaysVisible: true },
  });
  const temporary = listTemporaryLights(campaignId, sceneId).map(({ id, x, y, radius }) => ({
    id,
    x,
    y,
    radius,
    alwaysVisible: false,
  }));
  return [...authored, ...temporary];
}

interface EmitterGeometry {
  origin: FogVertex;
  radius: number;
  /** Blocking segments that enter this emitter's vision circle. */
  candidates: LosSegment[];
}

function circleGeometry(origin: FogVertex, radius: number, { grid }: SceneObstacles): EmitterGeometry {
  const candidates = cullSegmentsToCircle(origin, radius, grid.query(circleBounds(origin, radius)));
  return { origin, radius, candidates };
}

function emitterGeometry(
  reveal: TokenVisionRevealInternal,
  obstacles: SceneObstacles,
): EmitterGeometry {
  const { cellSize } = obstacles;
  const origin = { x: reveal.x * cellSize + cellSize / 2, y: reveal.y * cellSize + cellSize / 2 };
  return circleGeometry(origin, reveal.visionRadius * cellSize, obstacles);
}

/** Unlimited-range line of sight, testing only walls near the sight line. */
function canSeePoint(viewer: FogVertex, target: FogVertex, { grid }: SceneObstacles): boolean {
  const nearLine = grid.query({
    minX: Math.min(viewer.x, target.x),
    minY: Math.min(viewer.y, target.y),
    maxX: Math.max(viewer.x, target.x),
    maxY: Math.max(viewer.y, target.y),
  });
  return hasLineOfSight(viewer, target, Infinity, nearLine);
}

/** Enemies seen by any party token; any occupied cell center in sight counts. */
function findVisibleEnemies(
  reveals: TokenVisionRevealInternal[],
  obstacles: SceneObstacles,
): Set<string> {
  const { cellSize } = obstacles;
  const viewers = reveals
    .filter((r) => isPartyReveal(r) && r.visionRadius > 0)
    .map((r) => ({ x: r.x * cellSize + cellSize / 2, y: r.y * cellSize + cellSize / 2 }));
  const visible = new Set<string>();
  if (viewers.length === 0) return visible;

  for (const enemy of reveals.filter(isEnemyToken)) {
    const cells: FogVertex[] = [];
    for (let dx = 0; dx < enemy.size; dx += 1) {
      for (let dy = 0; dy < enemy.size; dy += 1) {
        cells.push({
          x: (enemy.x + dx) * cellSize + cellSize / 2,
          y: (enemy.y + dy) * cellSize + cellSize / 2,
        });
      }
    }
    const seen = viewers.some((viewer) =>
      cells.some((cell) => canSeePoint(viewer, cell, obstacles)),
    );
    if (seen) visible.add(enemy.tokenId);
  }
  return visible;
}

/**
 * Raycast every emitter against the scene's light-blocking walls (open doors
 * excluded). Tokens whose vision circle touches no obstacle are omitted so the
 * client keeps its cheaper circular reveal for them. Lights always produce a
 * polygon — they have no reveal circle to fall back on.
 */
export async function computeSceneVisibility(
  campaignId: string,
  sceneId: string,
  reveals: TokenVisionRevealInternal[],
): Promise<SceneVisibility> {
  const [obstacles, lights] = await Promise.all([
    loadSceneObstacles(campaignId, sceneId),
    loadSceneLights(campaignId, sceneId),
  ]);
  if (!obstacles) {
    return { polygons: [], doors: [], partyDoorIds: new Set(), visibleEnemyIds: new Set() };
  }

  const polygons: VisibilityPolygon[] = [];
  const partyDoorIds = new Set<string>();
  const partyOrigins: FogVertex[] = [];

  for (const reveal of reveals) {
    if (reveal.visionRadius <= 0) continue;
    const { origin, radius, candidates } = emitterGeometry(reveal, obstacles);
    const partyVisible = isPartyReveal(reveal);

    if (candidates.length > 0) {
      polygons.push({
        emitterId: reveal.tokenId,
        source: 'token',
        partyVisible,
        sceneId,
        origin,
        radius,
        points: computeVisibilityPolygon(origin, radius, candidates),
      });
    }

    if (!partyVisible) continue;
    partyOrigins.push(origin);
    for (const door of obstacles.doorWalls) {
      if (partyDoorIds.has(door.id)) continue;
      if (isSegmentVisible(origin, radius, door, candidates)) partyDoorIds.add(door.id);
    }
  }

  // Built lazily: only needed when some light is out of the party's direct sight
  let partyRooms: Set<number> | null = null;
  let roomMap: RoomMap | null = null;
  const sharesPartyRoom = (point: FogVertex): boolean => {
    if (partyOrigins.length === 0) return false;
    if (partyRooms === null) {
      roomMap = getRoomMap(obstacles);
      partyRooms = new Set(partyOrigins.flatMap((origin) => [...(roomMap?.roomsAt(origin) ?? [])]));
    }
    if (!roomMap || partyRooms.size === 0) return false;
    for (const room of roomMap.roomsAt(point)) if (partyRooms.has(room)) return true;
    return false;
  };

  for (const light of lights) {
    if (light.radius <= 0) continue;
    const { origin, radius, candidates } = circleGeometry(
      { x: light.x, y: light.y },
      light.radius * obstacles.cellSize,
      obstacles,
    );
    polygons.push({
      emitterId: light.id,
      source: 'light',
      // Seen from any distance with a clear sight line, or from anywhere in the same sealed room.
      partyVisible:
        light.alwaysVisible ||
        partyOrigins.some((viewer) => canSeePoint(viewer, origin, obstacles)) ||
        sharesPartyRoom(origin),
      sceneId,
      origin,
      radius,
      points: computeVisibilityPolygon(origin, radius, candidates),
    });
  }

  return {
    polygons,
    doors: obstacles.doorWalls.map(({ id, x1, y1, x2, y2, isOpen }) => ({
      id,
      x1,
      y1,
      x2,
      y2,
      isOpen,
    })),
    partyDoorIds,
    visibleEnemyIds: findVisibleEnemies(reveals, obstacles),
  };
}

async function buildVisionSnapshot(campaignId: string, sceneId: string): Promise<VisionSnapshot> {
  const reveals = await computeTokenVisionRegions(sceneId, campaignId);
  const visibility = await computeSceneVisibility(campaignId, sceneId, reveals);
  return { reveals, visibility };
}

/**
 * Emit role-gated `play-area:vision:updated` + `play-area:token:vision:sync` to every
 * socket in the campaign room.
 * - DM sockets receive reveals/polygons for ALL tokens and every door.
 * - Player sockets receive party reveals/polygons and only doors the party can see.
 * - Observer sockets receive empty reveals, polygons, and doors.
 */
export async function emitVisionSync(
  io: Server,
  campaignId: string,
  sceneId: string,
): Promise<void> {
  const snapshot = await buildVisionSnapshot(campaignId, sceneId);
  const room = `campaign:${campaignId}`;
  const sockets = await io.in(room).fetchSockets();

  for (const socket of sockets) {
    const role = socket.data.campaignRole as string | undefined;
    emitToSocket(socket, snapshot, sceneId, campaignId, role);
  }

  await syncSceneExploration(
    io,
    campaignId,
    sceneId,
    snapshot.reveals,
    snapshot.visibility.polygons,
  );
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
  const snapshot = await buildVisionSnapshot(campaignId, sceneId);
  const role = socket.data.campaignRole as string | undefined;
  emitToSocket(socket, snapshot, sceneId, campaignId, role);
}

/** True when the party (player-shareable emitters) can currently see the door. No polygons are built. */
export async function isDoorVisibleToParty(
  campaignId: string,
  sceneId: string,
  wallId: string,
): Promise<boolean> {
  const obstacles = await loadSceneObstacles(campaignId, sceneId);
  const door = obstacles?.doorWalls.find((d) => d.id === wallId);
  if (!obstacles || !door) return false;

  const reveals = await computeTokenVisionRegions(sceneId, campaignId);
  return reveals.some((reveal) => {
    if (reveal.visionRadius <= 0 || !isPartyReveal(reveal)) return false;
    const { origin, radius, candidates } = emitterGeometry(reveal, obstacles);
    return isSegmentVisible(origin, radius, door, candidates);
  });
}

function emitToSocket(
  socket: { emit: (event: string, payload: unknown) => void },
  { reveals, visibility }: VisionSnapshot,
  sceneId: string,
  campaignId: string,
  role: string | undefined,
): void {
  let filteredReveals: TokenVisionReveal[];
  let doors: DoorState[];

  if (role === 'dm') {
    filteredReveals = reveals.map(
      ({ ownerId: _ownerId, type: _type, npcSubtype: _npcSubtype, size: _size, ...rest }) => rest,
    );
    doors = visibility.doors;
  } else if (role === 'player') {
    // Players share vision — each player sees all player-owned token reveals,
    // not just their own. Ally NPC tokens (type='npc', npcSubtype='ally') are
    // also included so players can benefit from friendly NPC sight.
    // Enemy NPC tokens remain DM-only regardless of position.
    filteredReveals = reveals
      .filter(isPartyReveal)
      .map(
        ({ ownerId: _ownerId, type: _type, npcSubtype: _npcSubtype, size: _size, ...rest }) =>
          rest,
      );
    doors = visibility.doors.filter((d) => visibility.partyDoorIds.has(d.id));
  } else {
    filteredReveals = [];
    doors = [];
  }

  // Polygons go first so the client never renders a new reveal with a stale polygon.
  socket.emit(VISION_EVENTS.VISION_UPDATED, {
    campaignId,
    sceneId,
    polygons: visibility.polygons.filter((p) =>
      role === 'dm' ? true : role === 'player' && p.partyVisible,
    ),
    doors,
    visibleEnemyTokenIds:
      role === 'dm' || role === 'player' ? [...visibility.visibleEnemyIds] : [],
  } satisfies VisionUpdatedPayload);

  const payload: TokenVisionSyncPayload = {
    reveals: filteredReveals,
    sceneId,
    campaignId,
  };

  socket.emit(TOKEN_VISION_EVENTS.TOKEN_VISION_SYNC, payload);
}
