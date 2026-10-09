// Enclosed-room detection — follow-up to PM3/PM4
// Flood-fills the scene on a one-sample-per-cell lattice, treating light-blocking walls
// (closed doors included, open doors excluded) as barriers. A region counts as a room
// only when it is sealed — it cannot leak past the map edge.
import type { FogVertex } from '@vtt/shared';

import type { SegmentGrid } from './line-of-sight.js';
import { hasLineOfSight } from './line-of-sight.js';

/** Scenes larger than this many lattice nodes skip room detection (sight-line only). */
export const MAX_ROOM_NODES = 250_000;

const NEIGHBOR_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function isOpenPath(a: FogVertex, b: FogVertex, grid: SegmentGrid): boolean {
  const nearby = grid.query({
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  });
  return hasLineOfSight(a, b, Infinity, nearby);
}

export class RoomMap {
  private constructor(
    private readonly cols: number,
    private readonly rows: number,
    private readonly cellSize: number,
    /** Room id per node; -1 for nodes whose region reaches the map edge. */
    private readonly roomIds: Int32Array,
    private readonly grid: SegmentGrid,
  ) {}

  /** Null when the scene is too large to index. */
  static build(width: number, height: number, cellSize: number, grid: SegmentGrid): RoomMap | null {
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    if (cols <= 0 || rows <= 0 || cols * rows > MAX_ROOM_NODES) return null;

    const center = (col: number, row: number): FogVertex => ({
      x: (col + 0.5) * cellSize,
      y: (row + 0.5) * cellSize,
    });
    const roomIds = new Int32Array(cols * rows).fill(-2);
    const queue = new Int32Array(cols * rows);
    let nextRoom = 0;

    for (let start = 0; start < roomIds.length; start += 1) {
      if (roomIds[start] !== -2) continue;
      const room = nextRoom++;
      let head = 0;
      let tail = 0;
      let leaks = false;
      queue[tail++] = start;
      roomIds[start] = room;

      while (head < tail) {
        const node = queue[head++];
        const col = node % cols;
        const row = (node - col) / cols;
        const here = center(col, row);

        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nc = col + dc;
          const nr = row + dr;
          const there = center(nc, nr);
          if (!isOpenPath(here, there, grid)) continue;
          // An unblocked step off the map means this region is not sealed
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) {
            leaks = true;
            continue;
          }
          const next = nr * cols + nc;
          if (roomIds[next] !== -2) continue;
          roomIds[next] = room;
          queue[tail++] = next;
        }
      }

      if (leaks) {
        for (let i = 0; i < tail; i += 1) roomIds[queue[i]] = -1;
      }
    }

    return new RoomMap(cols, rows, cellSize, roomIds, grid);
  }

  /**
   * Sealed rooms a point belongs to: its own lattice node plus neighbours it can see
   * directly, so a light mounted on a wall counts for the rooms on both sides.
   */
  roomsAt(point: FogVertex): Set<number> {
    const rooms = new Set<number>();
    const col = Math.floor(point.x / this.cellSize);
    const row = Math.floor(point.y / this.cellSize);

    for (const [dc, dr] of [[0, 0], ...NEIGHBOR_OFFSETS] as const) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
      const room = this.roomIds[r * this.cols + c];
      if (room < 0 || rooms.has(room)) continue;
      const nodeCenter = { x: (c + 0.5) * this.cellSize, y: (r + 0.5) * this.cellSize };
      if (isOpenPath(point, nodeCenter, this.grid)) rooms.add(room);
    }
    return rooms;
  }
}
