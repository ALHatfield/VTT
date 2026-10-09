import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VisibilityPolygon } from '@vtt/shared';

import type { RenderableLight } from './LightLayer';
import { EMBERS_PER_EMITTER, LightLayer, MAX_ANIMATED_LIGHTS, MAX_EMBER_EMITTERS } from './LightLayer';

vi.mock('pixi.js', () => {
  class MockPoint {
    x = 1;
    y = 1;
    set(v: number): void {
      this.x = v;
      this.y = v;
    }
  }

  class MockContainer {
    children: MockContainer[] = [];
    label = '';
    eventMode = 'auto';
    blendMode = 'normal';
    destroyed = false;
    addChild(child: MockContainer): MockContainer {
      this.children.push(child);
      return child;
    }
    removeChild(child: MockContainer): MockContainer {
      this.children = this.children.filter((c) => c !== child);
      return child;
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  class MockGraphics extends MockContainer {
    circles = 0;
    polys: unknown[] = [];
    clear(): this {
      this.circles = 0;
      this.polys = [];
      return this;
    }
    circle(): this {
      this.circles++;
      return this;
    }
    poly(points: unknown): this {
      this.polys.push(points);
      return this;
    }
    fill(): this {
      return this;
    }
  }

  class MockTexture {
    static WHITE = new MockTexture();
    static from = vi.fn(() => new MockTexture());
    destroy = vi.fn();
  }

  class MockSprite extends MockContainer {
    x = 0;
    y = 0;
    alpha = 1;
    tint = 0xffffff;
    mask: unknown = null;
    scale = new MockPoint();
    anchor = new MockPoint();
    constructor(public texture: MockTexture) {
      super();
    }
  }

  return { Container: MockContainer, Graphics: MockGraphics, Sprite: MockSprite, Texture: MockTexture };
});

interface MockSpriteShape {
  x: number;
  y: number;
  alpha: number;
  tint: number;
  blendMode: string;
  scale: { x: number };
  destroyed: boolean;
}

function makeLight(id: string, overrides: Partial<RenderableLight> = {}): RenderableLight {
  return {
    id,
    x: 100,
    y: 200,
    radius: 4,
    color: '#ff9a3c',
    intensity: 0.8,
    falloff: 0.5,
    emitterType: 'torch',
    animationMode: 'flicker',
    animationSeed: 1234,
    ...overrides,
  };
}

function sprites(layer: LightLayer): MockSpriteShape[] {
  const glow = (layer as unknown as { glowContainer: { children: MockSpriteShape[] } }).glowContainer;
  return glow.children;
}

function emberCircles(layer: LightLayer): number {
  return (layer as unknown as { emberGraphics: { circles: number } }).emberGraphics.circles;
}

describe('LightLayer', () => {
  let layer: LightLayer;

  beforeEach(() => {
    // jsdom has no 2D canvas; the layer must fall back to a solid texture
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    layer = new LightLayer();
    layer.setCellSize(50);
  });

  it('renders one additive, tinted sprite per light at its world position', () => {
    layer.setLights([makeLight('a'), makeLight('b', { x: 10, y: 20, color: '#00ff00' })]);
    const [a, b] = sprites(layer);
    expect(a).toMatchObject({ x: 100, y: 200, tint: 0xff9a3c, blendMode: 'add', alpha: 0.8 });
    expect(b).toMatchObject({ x: 10, y: 20, tint: 0x00ff00 });
  });

  it('scales sprites to radius × cell size', () => {
    layer.setLights([makeLight('a', { radius: 4 })]);
    const small = sprites(layer)[0]!.scale.x;
    layer.setLights([makeLight('a', { radius: 8 })]);
    expect(sprites(layer)[0]!.scale.x).toBeCloseTo(small * 2);
  });

  it('reconciles by id — removes deleted lights and reuses existing sprites', () => {
    layer.setLights([makeLight('a'), makeLight('b')]);
    const [a, b] = sprites(layer);
    layer.setLights([makeLight('a', { intensity: 0.3 })]);
    expect(sprites(layer)).toEqual([a]);
    expect(a!.alpha).toBe(0.3);
    expect(b!.destroyed).toBe(true);
  });

  it('animates flicker lights deterministically and within intensity', () => {
    layer.setLights([makeLight('a')]);
    layer.update(1000);
    const first = sprites(layer)[0]!.alpha;
    layer.update(1000);
    expect(sprites(layer)[0]!.alpha).toBe(first);
    expect(first).toBeLessThanOrEqual(0.8);
    expect(first).toBeGreaterThan(0);
  });

  it('leaves static lights untouched on update', () => {
    layer.setLights([makeLight('a', { animationMode: 'none', intensity: 0.5 })]);
    layer.update(1234);
    expect(sprites(layer)[0]!.alpha).toBe(0.5);
    expect(layer.getStats().animated).toBe(0);
  });

  it('draws embers only for lit fireplace emitters, scaled by intensity', () => {
    layer.setLights([
      makeLight('torch'),
      makeLight('fire', { emitterType: 'fireplace' }),
      makeLight('out', { emitterType: 'fireplace', intensity: 0 }),
    ]);
    layer.update(500);
    expect(emberCircles(layer)).toBe(EMBERS_PER_EMITTER);
  });

  it('freezes animation and hides embers under reduced motion', () => {
    layer.setLights([makeLight('fire', { emitterType: 'fireplace', intensity: 0.6 })]);
    layer.update(500);
    expect(emberCircles(layer)).toBeGreaterThan(0);

    layer.setReducedMotion(true);
    expect(emberCircles(layer)).toBe(0);
    expect(sprites(layer)[0]!.alpha).toBe(0.6);

    layer.update(900);
    expect(emberCircles(layer)).toBe(0);
    expect(sprites(layer)[0]!.alpha).toBe(0.6);
  });

  describe('wall occlusion', () => {
    const square = [
      { x: 90, y: 190 },
      { x: 110, y: 190 },
      { x: 110, y: 210 },
      { x: 90, y: 210 },
    ];
    function lightPolygon(
      emitterId: string,
      origin = { x: 100, y: 200 },
    ): VisibilityPolygon {
      return {
        emitterId,
        source: 'light',
        partyVisible: true,
        sceneId: 's1',
        origin,
        radius: 200,
        points: square,
      };
    }
    function maskOf(index: number): { polys: unknown[]; destroyed: boolean } | null {
      return (sprites(layer)[index] as unknown as { mask: { polys: unknown[]; destroyed: boolean } | null })
        .mask;
    }

    it('clips a glow to its light polygon', () => {
      layer.setLights([makeLight('a')]);
      layer.setOcclusionPolygons([lightPolygon('a')]);
      expect(maskOf(0)?.polys).toEqual([square]);
    });

    it('applies polygons that arrive before the light', () => {
      layer.setOcclusionPolygons([lightPolygon('a')]);
      layer.setLights([makeLight('a')]);
      expect(maskOf(0)).not.toBeNull();
    });

    it('ignores token polygons and stale polygons from a previous light position', () => {
      layer.setLights([makeLight('a'), makeLight('b')]);
      layer.setOcclusionPolygons([
        { ...lightPolygon('a'), source: 'token' },
        lightPolygon('b', { x: 0, y: 0 }),
      ]);
      expect(maskOf(0)).toBeNull();
      expect(maskOf(1)).toBeNull();
    });

    it('removes the mask when the polygon goes away', () => {
      layer.setLights([makeLight('a')]);
      layer.setOcclusionPolygons([lightPolygon('a')]);
      const mask = maskOf(0)!;
      layer.setOcclusionPolygons([]);
      expect(maskOf(0)).toBeNull();
      expect(mask.destroyed).toBe(true);
    });
  });

  describe('render-budget guardrails', () => {
    it(`caps animated lights at ${MAX_ANIMATED_LIGHTS} but still renders every light`, () => {
      const lights = Array.from({ length: MAX_ANIMATED_LIGHTS + 25 }, (_, i) => makeLight(`l${i}`));
      layer.setLights(lights);
      expect(layer.getStats()).toMatchObject({
        rendered: MAX_ANIMATED_LIGHTS + 25,
        animated: MAX_ANIMATED_LIGHTS,
      });
    });

    it(`caps ember emitters at ${MAX_EMBER_EMITTERS}`, () => {
      const lights = Array.from({ length: MAX_EMBER_EMITTERS + 10 }, (_, i) =>
        makeLight(`f${i}`, { emitterType: 'fireplace' }),
      );
      layer.setLights(lights);
      layer.update(100);
      expect(layer.getStats().emberEmitters).toBe(MAX_EMBER_EMITTERS);
      expect(emberCircles(layer)).toBe(MAX_EMBER_EMITTERS * EMBERS_PER_EMITTER);
    });

    it('shares one gradient texture per quantized falloff step', async () => {
      const { Texture } = await import('pixi.js');
      const from = vi.mocked(Texture.from);
      from.mockClear();
      const fakeCtx = {
        createRadialGradient: () => ({ addColorStop: vi.fn() }),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillStyle: '',
      };
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(
        fakeCtx as unknown as ReturnType<HTMLCanvasElement['getContext']>,
      );

      layer.setLights([
        ...Array.from({ length: 40 }, (_, i) => makeLight(`soft${i}`, { falloff: 0.5 })),
        ...Array.from({ length: 10 }, (_, i) => makeLight(`hard${i}`, { falloff: 0 })),
      ]);

      expect(from).toHaveBeenCalledTimes(2);
      const textureOf = (s: MockSpriteShape): unknown => (s as unknown as { texture: unknown }).texture;
      const [firstSoft] = sprites(layer);
      const hard = sprites(layer)[40]!;
      expect(new Set(sprites(layer).slice(0, 40).map(textureOf)).size).toBe(1);
      expect(textureOf(hard)).not.toBe(textureOf(firstSoft!));
    });

    it('keeps a 50-light animated frame under 3 ms on average', () => {
      layer.setLights(
        Array.from({ length: 50 }, (_, i) =>
          makeLight(`l${i}`, { animationSeed: i, emitterType: i % 5 === 0 ? 'fireplace' : 'torch' }),
        ),
      );
      const frames = 60;
      let total = 0;
      for (let f = 0; f < frames; f++) {
        layer.update(f * 16);
        total += layer.lastUpdateMs;
      }
      expect(total / frames).toBeLessThan(3);
    });
  });
});
