// WallOverlay — Phase 5F
// Editor-only render of wall segments, mounted on the Foreground layer.
// Non-interactive: pointer handling lives in the WallToolOverlay DOM layer.
import { Container, Graphics } from 'pixi.js';

import type { WallSegment } from '@vtt/shared';

import type { WallPoint } from '../utils/wall-geometry';

/** An in-progress segment: the next chain segment, or an endpoint being dragged. */
export interface WallDraft {
  start: WallPoint;
  end: WallPoint;
  /** Wall hidden while its endpoint is dragged (drawn from the draft instead). */
  replacesWallId?: string;
}

export const WALL_COLORS = {
  wall: 0xff5252,
  door: 0xffb300,
  window: 0x4fc3f7,
  passable: 0xb388ff,
  draft: 0x7cfc00,
  selection: 0xffffff,
} as const;

const WALL_WIDTH = 4;
const SELECTION_WIDTH = 10;
const SELECTION_ALPHA = 0.45;
const OPEN_DOOR_ALPHA = 0.4;
const VERTEX_RADIUS = 3;
const HANDLE_RADIUS = 7;
const DRAFT_WIDTH = 2;

/** Colour encodes the most significant behaviour: door > window > passable > wall. */
export function wallColor(wall: WallSegment): number {
  if (wall.isDoor) return WALL_COLORS.door;
  if (!wall.blocksLight) return WALL_COLORS.window;
  if (!wall.blocksMovement) return WALL_COLORS.passable;
  return WALL_COLORS.wall;
}

export class WallOverlay extends Container {
  private readonly wallsGraphics: Graphics;
  private readonly draftGraphics: Graphics;
  private walls: readonly WallSegment[] = [];
  private selectedWallId: string | null = null;
  private hiddenWallId: string | undefined;

  constructor() {
    super();
    this.label = 'wall-overlay';
    this.eventMode = 'none';
    this.wallsGraphics = new Graphics();
    this.wallsGraphics.eventMode = 'none';
    this.draftGraphics = new Graphics();
    this.draftGraphics.eventMode = 'none';
    this.addChild(this.wallsGraphics);
    this.addChild(this.draftGraphics);
  }

  setWalls(walls: readonly WallSegment[], selectedWallId: string | null): void {
    this.walls = walls;
    this.selectedWallId = selectedWallId;
    this.redrawWalls();
  }

  /** Cheap per-pointermove update; walls only redraw when the hidden wall changes. */
  setDraft(draft: WallDraft | null): void {
    if (draft?.replacesWallId !== this.hiddenWallId) {
      this.hiddenWallId = draft?.replacesWallId;
      this.redrawWalls();
    }

    const g = this.draftGraphics;
    g.clear();
    if (!draft) return;
    g.moveTo(draft.start.x, draft.start.y)
      .lineTo(draft.end.x, draft.end.y)
      .stroke({ width: DRAFT_WIDTH, color: WALL_COLORS.draft });
    g.circle(draft.start.x, draft.start.y, VERTEX_RADIUS)
      .circle(draft.end.x, draft.end.y, VERTEX_RADIUS)
      .fill({ color: WALL_COLORS.draft });
  }

  private redrawWalls(): void {
    const g = this.wallsGraphics;
    g.clear();

    const hiddenId = this.hiddenWallId;
    const selected = this.walls.find((w) => w.id === this.selectedWallId && w.id !== hiddenId);
    if (selected) {
      g.moveTo(selected.x1, selected.y1)
        .lineTo(selected.x2, selected.y2)
        .stroke({ width: SELECTION_WIDTH, color: WALL_COLORS.selection, alpha: SELECTION_ALPHA });
    }

    for (const wall of this.walls) {
      if (wall.id === hiddenId) continue;
      const color = wallColor(wall);
      const alpha = wall.isDoor && wall.isOpen ? OPEN_DOOR_ALPHA : 1;
      g.moveTo(wall.x1, wall.y1)
        .lineTo(wall.x2, wall.y2)
        .stroke({ width: WALL_WIDTH, color, alpha });
      g.circle(wall.x1, wall.y1, VERTEX_RADIUS)
        .circle(wall.x2, wall.y2, VERTEX_RADIUS)
        .fill({ color });
    }

    if (selected) {
      g.circle(selected.x1, selected.y1, HANDLE_RADIUS)
        .circle(selected.x2, selected.y2, HANDLE_RADIUS)
        .stroke({ width: 2, color: WALL_COLORS.selection });
    }
  }
}
