import { describe, expect, it, vi } from 'vitest';

import type { LightSource } from '@vtt/shared';

interface Circle {
  x: number;
  y: number;
  r: number;
}

vi.mock('pixi.js', () => {
  class MockGraphics {
    eventMode = 'auto';
    circles: Circle[] = [];
    strokes: { width: number; color: number; alpha?: number }[] = [];
    fills: { color: number }[] = [];

    clear(): this {
      this.circles = [];
      this.strokes = [];
      this.fills = [];
      return this;
    }
    circle(x: number, y: number, r: number): this {
      this.circles.push({ x, y, r });
      return this;
    }
    fill(opts: { color: number }): this {
      this.fills.push(opts);
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

const { LIGHT_GIZMO_COLORS, LightOverlay } = await import('./LightOverlay');

interface MockGraphicsShape {
  circles: Circle[];
  strokes: { width: number; color: number; alpha?: number }[];
  fills: { color: number }[];
}

const CELL = 64;

function makeLight(overrides: Partial<LightSource> = {}): LightSource {
  return {
    id: 'l1',
    sceneId: 's',
    campaignId: 'c',
    x: 100,
    y: 200,
    radius: 2,
    color: '#ff9a3c',
    intensity: 0.8,
    falloff: 0.5,
    emitterType: 'torch',
    animationMode: 'flicker',
    animationSeed: 1,
    alwaysVisible: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function graphicsOf(overlay: InstanceType<typeof LightOverlay>): MockGraphicsShape {
  return (overlay as unknown as { children: MockGraphicsShape[] }).children[0];
}

describe('LightOverlay', () => {
  it('is non-interactive', () => {
    expect(new LightOverlay().eventMode).toBe('none');
  });

  it('draws a radius ring in grid cells, a falloff ring, and a marker in the light colour', () => {
    const overlay = new LightOverlay();
    overlay.setLights([makeLight()], null, CELL);

    const g = graphicsOf(overlay);
    const radii = g.circles.map((c) => c.r);
    expect(radii).toContain(2 * CELL);
    expect(radii).toContain(CELL);
    expect(g.fills).toEqual([{ color: 0xff9a3c }]);
    expect(g.circles.every((c) => c.x === 100 && c.y === 200)).toBe(true);
  });

  it('omits the falloff ring for hard-edged and full-falloff lights', () => {
    const overlay = new LightOverlay();
    overlay.setLights([makeLight({ falloff: 0 }), makeLight({ id: 'l2', falloff: 1 })], null, CELL);
    // ring + marker per light
    expect(graphicsOf(overlay).circles).toHaveLength(4);
  });

  it('highlights the selected light', () => {
    const overlay = new LightOverlay();
    overlay.setLights([makeLight(), makeLight({ id: 'l2' })], 'l2', CELL);

    const selectionStrokes = graphicsOf(overlay).strokes.filter(
      (s) => s.color === LIGHT_GIZMO_COLORS.selection,
    );
    expect(selectionStrokes).toHaveLength(2);
  });

  it('clears previous geometry on each update', () => {
    const overlay = new LightOverlay();
    overlay.setLights([makeLight()], null, CELL);
    overlay.setLights([], null, CELL);
    expect(graphicsOf(overlay).circles).toHaveLength(0);
  });
});
