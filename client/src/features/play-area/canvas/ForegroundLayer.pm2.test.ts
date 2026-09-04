import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FogMaskConfig, FogRegion, TokenVisionReveal, VisionStamp } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG } from '@vtt/shared';

// ---------------------------------------------------------------------------
// pixi.js mock — extends the legacy layer mock with the display objects the
// PM2 mask pipeline needs (Sprite, RenderTexture, BlurFilter).
// ---------------------------------------------------------------------------
vi.mock('pixi.js', () => {
  class MockGraphics {
    visible = true;
    blendMode: string | undefined = undefined;
    eventMode = 'none';
    _circles: { x: number; y: number; r: number; alpha: number }[] = [];
    _rects: { w: number; h: number }[] = [];
    _fills: { color: number; alpha: number }[] = [];
    private _pendingCircle: { x: number; y: number; r: number } | null = null;

    clear(): this {
      this._circles = [];
      this._rects = [];
      this._fills = [];
      this._pendingCircle = null;
      return this;
    }
    moveTo(): this {
      return this;
    }
    lineTo(): this {
      return this;
    }
    closePath(): this {
      return this;
    }
    stroke(): this {
      return this;
    }
    rect(_x: number, _y: number, w: number, h: number): this {
      this._rects.push({ w, h });
      return this;
    }
    fill(opts: { color: number; alpha: number }): this {
      this._fills.push(opts);
      if (this._pendingCircle) {
        this._circles.push({ ...this._pendingCircle, alpha: opts.alpha });
        this._pendingCircle = null;
      }
      return this;
    }
    circle(x: number, y: number, r: number): this {
      this._pendingCircle = { x, y, r };
      return this;
    }
    destroy(): void {
      /* noop */
    }
  }

  class MockContainer {
    children: MockContainer[] = [];
    visible = true;
    sortableChildren = false;
    eventMode = 'none';
    filters: unknown[] = [];
    destroyed = false;

    addChild(child: MockContainer): MockContainer {
      this.children.push(child);
      return child;
    }
    removeChildren(): void {
      this.children = [];
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  class MockPoint {
    x = 0;
    y = 0;
    set(x: number, y = x): void {
      this.x = x;
      this.y = y;
    }
  }

  class MockSprite {
    texture: unknown = null;
    blendMode: string | undefined = undefined;
    position = new MockPoint();
    scale = new MockPoint();
    destroy(): void {
      /* noop */
    }
  }

  class MockRenderTexture {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    static create(opts: { width: number; height: number }): MockRenderTexture {
      return new MockRenderTexture(opts.width, opts.height);
    }
    destroy(): void {
      /* noop */
    }
  }

  class MockAlphaFilter {
    alpha = 1;
    constructor(_opts?: { alpha?: number }) {}
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

  return {
    AlphaFilter: MockAlphaFilter,
    BlurFilter: MockBlurFilter,
    Container: MockContainer,
    Graphics: MockGraphics,
    RenderTexture: MockRenderTexture,
    Sprite: MockSprite,
  };
});

import { ForegroundLayer } from './ForegroundLayer';

interface RenderCall {
  target: { width: number; height: number };
  circles: { x: number; y: number; r: number; alpha: number }[];
}

interface LayerInternals {
  fogContainer: { visible: boolean };
  pm2Container: { visible: boolean; children: { destroyed: boolean }[] };
  hiddenOverlay: { _fills: { color: number; alpha: number }[] } | null;
  shroudOverlay: { _fills: { color: number; alpha: number }[] } | null;
  activeMaskSprite: { scale: { x: number }; texture: unknown } | null;
  exploredMaskSprite: { scale: { x: number }; texture: unknown } | null;
}

function internals(layer: ForegroundLayer): LayerInternals {
  return layer as unknown as LayerInternals;
}

function makeConfig(overrides?: Partial<FogMaskConfig>): FogMaskConfig {
  return { ...DEFAULT_FOG_MASK_CONFIG, fogMode: 'pm2', ...overrides };
}

function makeReveal(overrides?: Partial<TokenVisionReveal>): TokenVisionReveal {
  return { tokenId: 'tok-1', x: 2, y: 3, visionRadius: 6, sceneId: 'scene-1', ...overrides };
}

function makeRegion(): FogRegion {
  return {
    id: 'region-1',
    campaignId: 'campaign-1',
    sceneId: 'scene-1',
    vertices: [
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 64, y: 64 },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ForegroundLayer — PM2 mask pipeline', () => {
  let layer: ForegroundLayer;
  let calls: RenderCall[];

  beforeEach(() => {
    calls = [];
    layer = new ForegroundLayer();
    layer.setMapBounds(2048, 1024);
    layer.setObfuscationEnabled(true);
    layer.attachRenderer({
      render: (options): void => {
        const container = options.container as unknown as {
          children: { visible: boolean; _circles: RenderCall['circles'] }[];
        };
        const circles: RenderCall['circles'] = [];
        for (const child of container.children) {
          if (child.visible) circles.push(...child._circles);
        }
        calls.push({ target: options.target as unknown as RenderCall['target'], circles });
      },
    });
  });

  it('stays on the legacy renderer while fogMode is legacy', () => {
    layer.setFogMaskConfig({ ...DEFAULT_FOG_MASK_CONFIG, fogMode: 'legacy' });
    layer.setTokenVisionReveals([makeReveal()], 64);

    expect(internals(layer).fogContainer.visible).toBe(true);
    expect(internals(layer).pm2Container.visible).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('switches to the mask pipeline when fogMode is pm2', () => {
    layer.setFogMaskConfig(makeConfig());
    layer.setTokenVisionReveals([makeReveal()], 64);

    expect(internals(layer).fogContainer.visible).toBe(false);
    expect(internals(layer).pm2Container.visible).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('applies the configured shroud and hidden opacities', () => {
    layer.setFogMaskConfig(makeConfig({ shroudAlpha: 0.4, hiddenAlpha: 0.7 }));
    layer.setTokenVisionReveals([makeReveal()], 64);

    expect(internals(layer).hiddenOverlay?._fills.at(-1)?.alpha).toBe(0.7);
    expect(internals(layer).shroudOverlay?._fills.at(-1)?.alpha).toBe(0.4);
  });

  it('scales mask sprites by the inverse mask scale so reveals stay pinned to world space', () => {
    layer.setFogMaskConfig(makeConfig({ maskResolutionScale: 0.5 }));
    layer.setTokenVisionReveals([makeReveal()], 64);

    expect(internals(layer).activeMaskSprite?.scale.x).toBe(2);
    expect(internals(layer).exploredMaskSprite?.scale.x).toBe(2);
  });

  it('keeps the explored mask equal to the active mask when exploration is off', () => {
    layer.setFogMaskConfig(makeConfig({ explorationMode: 'off' }));
    layer.setExplorationStamps([{ id: 'old', x: 1000, y: 1000, radius: 100 }]);
    layer.setTokenVisionReveals([makeReveal()], 64);

    const [active, explored] = calls.slice(-2);
    expect(explored.circles).toEqual(active.circles);
  });

  it('adds persisted stamps to the explored mask when exploration is persistent', () => {
    const persisted: VisionStamp[] = [{ id: 'old', x: 1000, y: 1000, radius: 100 }];
    layer.setFogMaskConfig(makeConfig({ explorationMode: 'persistent' }));
    layer.setExplorationStamps(persisted);
    layer.setTokenVisionReveals([makeReveal()], 64);

    const [active, explored] = calls.slice(-2);
    expect(active.circles).toHaveLength(1);
    expect(explored.circles).toHaveLength(2);
  });

  it('renders DM regions plus vision stamps into the mask', () => {
    layer.setFogMaskConfig(makeConfig());
    layer.setFogRegions([makeRegion()]);
    layer.setTokenVisionReveals([makeReveal(), makeReveal({ tokenId: 'tok-2', x: 8 })], 64);

    expect(calls.at(-1)?.circles).toHaveLength(2);
  });

  it('hides the mask overlay in the DM (unobfuscated) view', () => {
    layer.setFogMaskConfig(makeConfig());
    layer.setObfuscationEnabled(false);
    layer.setFogRegions([makeRegion()]);

    expect(internals(layer).pm2Container.visible).toBe(false);
    expect(internals(layer).fogContainer.visible).toBe(false);
  });

  it('releases mask resources on destroyFogMask', () => {
    layer.setFogMaskConfig(makeConfig());
    layer.setTokenVisionReveals([makeReveal()], 64);

    const groups = internals(layer).pm2Container.children;
    expect(groups).toHaveLength(2);

    layer.destroyFogMask();

    expect(groups.every((g) => g.destroyed)).toBe(true);
    expect(internals(layer).pm2Container.children).toHaveLength(0);
    expect(internals(layer).activeMaskSprite).toBeNull();
    expect(layer.getFogCompositionMs()).toBe(0);
  });

  it('does not stack a second overlay pair when the renderer is re-attached', () => {
    layer.destroyFogMask();
    layer.attachRenderer({ render: (): void => undefined });

    expect(internals(layer).pm2Container.children).toHaveLength(2);
  });
});
