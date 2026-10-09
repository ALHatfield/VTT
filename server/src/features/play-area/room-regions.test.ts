import { describe, expect, it } from 'vitest';

import type { LosSegment } from './line-of-sight.js';
import { SegmentGrid } from './line-of-sight.js';
import { MAX_ROOM_NODES, RoomMap } from './room-regions.js';

const CELL = 64;
const MAP = 12 * CELL;

function seg(id: string, x1: number, y1: number, x2: number, y2: number): LosSegment {
  return { id, x1, y1, x2, y2 };
}

/** Sealed box from (64,64) to (576,448) with a partial inner wall at x=320 (gap at the bottom). */
const L_ROOM = [
  seg('n', 64, 64, 576, 64),
  seg('e', 576, 64, 576, 448),
  seg('s', 576, 448, 64, 448),
  seg('w', 64, 448, 64, 64),
  seg('inner', 320, 64, 320, 320),
];

function build(segments: LosSegment[], size = MAP): RoomMap {
  const map = RoomMap.build(size, size, CELL, new SegmentGrid(segments, CELL * 4));
  if (!map) throw new Error('room map not built');
  return map;
}

function shareRoom(map: RoomMap, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const roomsA = map.roomsAt(a);
  return [...map.roomsAt(b)].some((room) => roomsA.has(room));
}

describe('RoomMap', () => {
  it('connects points around a corner inside a sealed room', () => {
    const map = build(L_ROOM);
    expect(shareRoom(map, { x: 160, y: 160 }, { x: 448, y: 128 })).toBe(true);
  });

  it('separates the two halves once the gap is walled off', () => {
    const map = build([...L_ROOM, seg('gap', 320, 320, 320, 448)]);
    expect(shareRoom(map, { x: 160, y: 160 }, { x: 448, y: 128 })).toBe(false);
    expect(map.roomsAt({ x: 160, y: 160 }).size).toBe(1);
  });

  it('treats a region that reaches the map edge as no room at all', () => {
    const leaky = L_ROOM.filter((s) => s.id !== 'n');
    const map = build(leaky);
    expect(map.roomsAt({ x: 160, y: 160 }).size).toBe(0);
    expect(shareRoom(map, { x: 160, y: 160 }, { x: 448, y: 128 })).toBe(false);
  });

  it('keeps inside and outside of a sealed room apart', () => {
    const map = build(L_ROOM);
    // Outside the box but on the map
    expect(map.roomsAt({ x: 700, y: 700 }).size).toBe(0);
  });

  it('counts a room sealed by walls on the map boundary', () => {
    const edgeBox = [
      seg('n', 0, 0, 256, 0),
      seg('e', 256, 0, 256, 256),
      seg('s', 256, 256, 0, 256),
      seg('w', 0, 256, 0, 0),
    ];
    expect(build(edgeBox).roomsAt({ x: 96, y: 96 }).size).toBe(1);
  });

  it('assigns a wall-mounted point to the room on each side', () => {
    const twoRooms = [...L_ROOM, seg('gap', 320, 320, 320, 448)];
    const map = build(twoRooms);
    const mounted = { x: 320, y: 224 };
    expect(shareRoom(map, mounted, { x: 160, y: 160 })).toBe(true);
    expect(shareRoom(map, mounted, { x: 448, y: 128 })).toBe(true);
  });

  it('skips scenes too large to index', () => {
    const side = Math.ceil(Math.sqrt(MAX_ROOM_NODES + 1)) * CELL;
    expect(RoomMap.build(side, side, CELL, new SegmentGrid([], CELL * 4))).toBeNull();
  });
});
