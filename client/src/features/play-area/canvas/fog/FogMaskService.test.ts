import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FogMaskConfig, FogRegion, VisionStamp } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

import { FogMaskService } from './FogMaskService';

interface MockCircle {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

vi.mock('pixi.js', () => {
  class MockGraphics {
    circles: MockCircle[] = [];
    polygonPoints: { x: number; y: number }[][] = [];
    visible = true;
    eventMode = 'auto';
    destroyed = false;
    private pending: { x: number; y: number }[] = [];
    private lastCircle: { x: number; y: number; r: number } | null = null;

    clear(): this {
      this.circles = [];
      this.polygonPoints = [];
      this.pending = [];
      this.lastCircle = null;
      return this;
    }
    circle(x: number, y: number, r: number): this {
      this.lastCircle = { x, y, r };
      return this;
    }
    moveTo(x: number, y: number): this {
      this.pending = [{ x, y }];
      return this;
    }
    lineTo(x: number, y: number): this {
      this.pending.push({ x, y });
      return this;
    }
    closePath(): this {
      return this;
    }
    fill(opts: { color: number; alpha: number }): this {
      if (this.lastCircle) {
        this.circles.push({ ...this.lastCircle, alpha: opts.alpha });
        this.lastCircle = null;
      } else if (this.pending.length > 0) {
        this.polygonPoints.push([...this.pending]);
        this.pending = [];
      }
      return this;
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  class MockContainer {
    children: MockGraphics[] = [];
    filters: unknown[] = [];
    destroyed = false;
    addChild(child: MockGraphics): MockGraphics {
      this.children.push(child);
      return child;
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  class MockBlurFilter {
    strength: number;
    constructor(opts: { strength: number }) {
      this.strength = opts.strength;
    }
    destroy(): void {
      /* noop */
    }
  }

  class MockRenderTexture {
    width: number;
    height: number;
    destroyed = false;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    static create(opts: { width: number; height: number }): MockRenderTexture {
      return new MockRenderTexture(opts.width, opts.height);
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  return {
    BlurFilter: MockBlurFilter,
    Container: MockContainer,
    Graphics: MockGraphics,
    RenderTexture: MockRenderTexture,
  };
});

interface RenderCall {
  target: { width: number; height: number };
  clear?: boolean;
  circles: MockCircle[];
  polygons: { x: number; y: number }[][];
}

function makeRenderer(): {
  render: (options: { container: unknown; target: unknown; clear?: boolean }) => void;
  calls: RenderCall[];
} {
  const calls: RenderCall[] = [];
  return {
    calls,
    render(options): void {
      const container = options.container as {
        children: {
          circles: MockCircle[];
          polygonPoints: { x: number; y: number }[][];
          visible: boolean;
        }[];
      };
      const circles: MockCircle[] = [];
      const polygons: { x: number; y: number }[][] = [];
      for (const child of container.children) {
        if (!child.visible) continue;
        circles.push(...child.circles);
        polygons.push(...child.polygonPoints);
      }
      calls.push({
        target: options.target as { width: number; height: number },
        clear: options.clear,
        circles,
        polygons,
      });
    },
  };
}

function makeConfig(overrides?: Partial<FogMaskConfig>): FogMaskConfig {
  return { ...DEFAULT_FOG_MASK_CONFIG, fogMode: 'pm2', ...overrides };
}

function makeStamp(overrides?: Partial<VisionStamp>): VisionStamp {
  return { id: 'stamp-1', x: 100, y: 200, radius: 50, ...overrides };
}

function makeRegion(): FogRegion {
  return {
    id: 'region-1',
    campaignId: 'campaign-1',
    sceneId: 'scene-1',
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('FogMaskService', () => {
  let renderer: ReturnType<typeof makeRenderer>;
  let service: FogMaskService;

  beforeEach(() => {
    renderer = makeRenderer();
    service = new FogMaskService(renderer);
    service.setConfig(makeConfig({ maskResolutionScale: 0.5 }));
    service.resize(2048, 1024);
  });

  it('allocates active and explored mask textures at the configured resolution', () => {
    expect(service.maskScale).toBe(0.5);
    expect(service.activeMaskTexture).toMatchObject({ width: 1024, height: 512 });
    expect(service.exploredMaskTexture).toMatchObject({ width: 1024, height: 512 });
  });

  it('composes both masks in exactly two batched render passes', () => {
    const stamps = Array.from({ length: 10 }, (_, i) =>
      makeStamp({ id: `s-${i.toString()}`, x: i * 10 }),
    );

    service.update({ activeStamps: stamps, exploredStamps: stamps, regions: [] });

    expect(renderer.calls).toHaveLength(2);
    expect(renderer.calls[0].clear).toBe(true);
    expect(renderer.calls[0].circles).toHaveLength(10);
  });

  it('scales stamps from world space into mask space', () => {
    service.update({ activeStamps: [makeStamp()], exploredStamps: [], regions: [] });

    expect(renderer.calls[0].circles[0]).toEqual({ x: 50, y: 100, r: 25, alpha: 1 });
  });

  it('renders DM-drawn regions into both masks', () => {
    service.update({ activeStamps: [], exploredStamps: [], regions: [makeRegion()] });

    expect(renderer.calls[0].polygons[0]).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
    ]);
    expect(renderer.calls[1].polygons).toHaveLength(1);
  });

  it('emits concentric falloff rings when radial softness is enabled', () => {
    service.setConfig(makeConfig({ edgeSoftness: 'radial', edgeSoftnessRatio: 0.5 }));
    service.update({ activeStamps: [makeStamp()], exploredStamps: [], regions: [] });

    const circles = renderer.calls[0].circles;
    expect(circles.length).toBeGreaterThan(1);
    expect(circles.at(-1)?.alpha).toBe(1);
  });

  it('applies a blur filter only in filter softness mode', () => {
    const container = (service as unknown as { stampContainer: { filters: unknown[] } })
      .stampContainer;

    service.setConfig(makeConfig({ edgeSoftness: 'filter' }));
    expect(container.filters).toHaveLength(1);

    service.setConfig(makeConfig({ edgeSoftness: 'off' }));
    expect(container.filters).toHaveLength(0);
  });

  it('reallocates textures when the mask resolution changes', () => {
    const before = service.activeMaskTexture;
    service.setConfig(makeConfig({ maskResolutionScale: 0.25 }));

    expect(service.activeMaskTexture).not.toBe(before);
    expect(service.activeMaskTexture).toMatchObject({ width: 512, height: 256 });
  });

  it('records the duration of the last composition', () => {
    service.update({ activeStamps: [makeStamp()], exploredStamps: [], regions: [] });
    expect(service.getLastCompositionMs()).toBeGreaterThanOrEqual(0);
  });

  it('does nothing before textures are allocated', () => {
    const fresh = new FogMaskService(makeRenderer());
    fresh.update({ activeStamps: [makeStamp()], exploredStamps: [], regions: [] });

    expect(fresh.getLastCompositionMs()).toBe(0);
  });

  it('releases textures on destroy', () => {
    const texture = service.activeMaskTexture as unknown as { destroyed: boolean };
    service.destroy();

    expect(texture.destroyed).toBe(true);
    expect(service.activeMaskTexture).toBeNull();
  });
});
