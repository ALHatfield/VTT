import { describe, expect, it, vi } from 'vitest';

import type { WallSegment } from '@vtt/shared';

vi.mock('pixi.js', () => {
  class MockGraphics {
    eventMode = 'auto';
    strokes: { width: number; color: number; alpha?: number }[] = [];
    lines: { from: [number, number]; to: [number, number] }[] = [];
    private cursor: [number, number] = [0, 0];

    clear(): this {
      this.strokes = [];
      this.lines = [];
      return this;
    }
    moveTo(x: number, y: number): this {
      this.cursor = [x, y];
      return this;
    }
    lineTo(x: number, y: number): this {
      this.lines.push({ from: this.cursor, to: [x, y] });
      return this;
    }
    circle(): this {
      return this;
    }
    fill(): this {
      return this;
    }
    stroke(opts: { width: number; color: number; alpha?: number }): this {
      this.strokes.push(opts);
      return this;
    }
  }

  class MockContainer {
    children: unknown[] = [];
    eventMode = 'auto';
    label = '';
    visible = true;
    addChild(child: unknown): void {
      this.children.push(child);
    }
  }

  return { Container: MockContainer, Graphics: MockGraphics };
});

const { WALL_COLORS, WallOverlay, wallColor } = await import('./WallOverlay');

interface MockGraphicsShape {
  strokes: { width: number; color: number; alpha?: number }[];
  lines: { from: [number, number]; to: [number, number] }[];
}

function makeWall(overrides: Partial<WallSegment> = {}): WallSegment {
  return {
    id: 'w1',
    sceneId: 's',
    campaignId: 'c',
    x1: 0,
    y1: 0,
    x2: 64,
    y2: 0,
    blocksLight: true,
    blocksMovement: true,
    isDoor: false,
    isOpen: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function graphicsOf(
  overlay: InstanceType<typeof WallOverlay>,
): { walls: MockGraphicsShape; draft: MockGraphicsShape } {
  const [walls, draft] = (overlay as unknown as { children: MockGraphicsShape[] }).children;
  return { walls, draft };
}

describe('wallColor', () => {
  it('prioritises door over window over passable', () => {
    expect(wallColor(makeWall())).toBe(WALL_COLORS.wall);
    expect(wallColor(makeWall({ blocksMovement: false }))).toBe(WALL_COLORS.passable);
    expect(wallColor(makeWall({ blocksLight: false, blocksMovement: false }))).toBe(
      WALL_COLORS.window,
    );
    expect(wallColor(makeWall({ isDoor: true, blocksLight: false }))).toBe(WALL_COLORS.door);
  });
});

describe('WallOverlay', () => {
  it('is non-interactive', () => {
    const overlay = new WallOverlay();
    expect(overlay.eventMode).toBe('none');
  });

  it('draws one stroke per wall', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall(), makeWall({ id: 'w2', isDoor: true })], null);

    const { walls } = graphicsOf(overlay);
    expect(walls.lines).toHaveLength(2);
    expect(walls.strokes.map((s) => s.color)).toEqual([WALL_COLORS.wall, WALL_COLORS.door]);
  });

  it('renders open doors translucent', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall({ isDoor: true, isOpen: true })], null);
    expect(graphicsOf(overlay).walls.strokes[0].alpha).toBeLessThan(1);
  });

  it('adds a selection highlight and handles for the selected wall', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall()], 'w1');

    const colors = graphicsOf(overlay).walls.strokes.map((s) => s.color);
    expect(colors.filter((c) => c === WALL_COLORS.selection)).toHaveLength(2);
  });

  it('draws the draft in place of the wall it replaces', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall()], 'w1');
    overlay.setDraft({ start: { x: 0, y: 0 }, end: { x: 128, y: 0 }, replacesWallId: 'w1' });

    const { walls, draft } = graphicsOf(overlay);
    expect(walls.lines).toHaveLength(0);
    expect(draft.lines).toEqual([{ from: [0, 0], to: [128, 0] }]);
    expect(draft.strokes.map((s) => s.color)).toEqual([WALL_COLORS.draft]);
  });

  it('restores the replaced wall when the draft clears', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall()], null);
    overlay.setDraft({ start: { x: 0, y: 0 }, end: { x: 128, y: 0 }, replacesWallId: 'w1' });
    overlay.setDraft(null);

    const { walls, draft } = graphicsOf(overlay);
    expect(walls.lines).toHaveLength(1);
    expect(draft.lines).toHaveLength(0);
  });

  it('does not redraw walls for chain drafts', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall()], null);
    const { walls } = graphicsOf(overlay);
    const clearSpy = vi.spyOn(walls as unknown as { clear: () => void }, 'clear');

    overlay.setDraft({ start: { x: 0, y: 0 }, end: { x: 64, y: 64 } });
    overlay.setDraft({ start: { x: 0, y: 0 }, end: { x: 128, y: 64 } });

    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('clears previous geometry on each update', () => {
    const overlay = new WallOverlay();
    overlay.setWalls([makeWall()], null);
    overlay.setWalls([], null);
    expect(graphicsOf(overlay).walls.lines).toHaveLength(0);
  });
});
