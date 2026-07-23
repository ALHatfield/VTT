import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TokenVisionReveal } from '@vtt/shared';

// ---------------------------------------------------------------------------
// Minimal pixi.js mock — tracks circle() calls on each Graphics
// ---------------------------------------------------------------------------
vi.mock('pixi.js', () => {
  class MockGraphics {
    visible = true;
    blendMode: string | undefined = undefined;
    eventMode = 'none';
    _circles: { x: number; y: number; r: number }[] = [];
    _fills: { color: number; alpha: number }[] = [];

    clear(): this {
      this._circles = [];
      this._fills = [];
      return this;
    }
    moveTo(): this { return this; }
    lineTo(): this { return this; }
    closePath(): this { return this; }
    stroke(): this { return this; }
    rect(): this { return this; }
    fill(opts: { color: number; alpha: number }): this {
      this._fills.push(opts);
      return this;
    }
    circle(x: number, y: number, r: number): this {
      this._circles.push({ x, y, r });
      return this;
    }
  }

  class MockContainer {
    children: MockContainer[] = [];
    visible = true;
    isRenderGroup = false;
    eventMode = 'none';

    addChild(child: MockContainer): MockContainer {
      this.children.push(child);
      return child;
    }
    destroy(): void { /* noop */ }
  }

  class MockAlphaFilter {
    alpha = 1;
    constructor(_opts?: { alpha?: number }) {}
  }

  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    AlphaFilter: MockAlphaFilter,
  };
});

import { ForegroundLayer } from './ForegroundLayer';

// ---------------------------------------------------------------------------
// Helper: access the fogCutouts Graphics (child index 1) which now holds
// both fog-region polygon cutouts AND vision-circle cutouts.
// ---------------------------------------------------------------------------

type MockFogCutouts = {
  visible: boolean;
  _circles: { x: number; y: number; r: number }[];
};

function getFogCutouts(l: ForegroundLayer): MockFogCutouts {
  // ForegroundLayer children: [fogContainer(0), fogDebug(1), brushPreview(2)]
  // fogContainer children:    [fogOverlay(0), fogCutouts(1)]
  const fogContainer = l.children[0] as unknown as { children: MockFogCutouts[] };
  return fogContainer.children[1];
}

// ---------------------------------------------------------------------------

describe('ForegroundLayer — setTokenVisionReveals()', () => {
  let layer: ForegroundLayer;

  beforeEach(() => {
    layer = new ForegroundLayer();
    layer.setMapBounds(2048, 2048);
    layer.setObfuscationEnabled(true);
  });

  it('draws a circle for each reveal at the correct position and radius', () => {
    const reveals: TokenVisionReveal[] = [
      { tokenId: 'tok-1', x: 2, y: 3, visionRadius: 6, sceneId: 'scene-1' },
    ];

    layer.setTokenVisionReveals(reveals, 64);

    const fc = getFogCutouts(layer);
    expect(fc._circles).toHaveLength(1);
    // x=2*64+32=160, y=3*64+32=224, r=6*64=384
    expect(fc._circles[0]).toEqual({ x: 160, y: 224, r: 384 });
  });

  it('draws multiple circles for multiple reveals', () => {
    const reveals: TokenVisionReveal[] = [
      { tokenId: 'tok-1', x: 0, y: 0, visionRadius: 4, sceneId: 'scene-1' },
      { tokenId: 'tok-2', x: 5, y: 5, visionRadius: 8, sceneId: 'scene-1' },
    ];

    layer.setTokenVisionReveals(reveals, 64);

    const fc = getFogCutouts(layer);
    expect(fc._circles).toHaveLength(2);
    expect(fc._circles[0]).toEqual({ x: 32, y: 32, r: 256 });
    expect(fc._circles[1]).toEqual({ x: 352, y: 352, r: 512 });
  });

  it('clears previous circles when called again with new reveals', () => {
    layer.setTokenVisionReveals(
      [{ tokenId: 'tok-1', x: 1, y: 1, visionRadius: 6, sceneId: 'scene-1' }],
      64,
    );

    layer.setTokenVisionReveals([], 64);

    const fc = getFogCutouts(layer);
    expect(fc._circles).toHaveLength(0);
  });

  it('does NOT draw vision circles when obfuscation is disabled (DM view)', () => {
    layer.setObfuscationEnabled(false);

    layer.setTokenVisionReveals(
      [{ tokenId: 'tok-1', x: 1, y: 1, visionRadius: 6, sceneId: 'scene-1' }],
      64,
    );

    const fc = getFogCutouts(layer);
    expect(fc._circles).toHaveLength(0);
  });

  it('redrawAll merges fog region polygons and vision circles together', () => {
    // setFogRegions and setTokenVisionReveals both call redrawAll.
    // Circles must still be present after setFogRegions is called (and vice versa),
    // because redrawAll draws BOTH into fogCutouts on every call.
    layer.setTokenVisionReveals(
      [{ tokenId: 'tok-1', x: 2, y: 2, visionRadius: 3, sceneId: 'scene-1' }],
      64,
    );
    // Calling setFogRegions reruns redrawAll — vision circles must survive.
    layer.setFogRegions([]);

    const fc = getFogCutouts(layer);
    expect(fc._circles).toHaveLength(1);
  });
});
