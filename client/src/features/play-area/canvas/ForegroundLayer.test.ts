import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TokenVisionReveal, VisibilityPolygon } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG, FOG_OVERLAY_ALPHA } from '@vtt/shared';

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
    _moves = 0;

    clear(): this {
      this._circles = [];
      this._fills = [];
      this._moves = 0;
      return this;
    }
    moveTo(): this {
      this._moves += 1;
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
    rect(): this {
      return this;
    }
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
    destroy(): void {
      /* noop */
    }
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
  _moves: number;
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

describe('ForegroundLayer — setVisibilityPolygons() (PM3, legacy fog)', () => {
  let layer: ForegroundLayer;
  const reveals: TokenVisionReveal[] = [
    { tokenId: 'tok-1', x: 2, y: 3, visionRadius: 6, sceneId: 'scene-1' },
    { tokenId: 'tok-2', x: 9, y: 9, visionRadius: 6, sceneId: 'scene-1' },
  ];
  const polygon: VisibilityPolygon = {
    emitterId: 'tok-1',
    source: 'token',
    partyVisible: true,
    sceneId: 'scene-1',
    origin: { x: 160, y: 224 },
    radius: 384,
    points: [
      { x: 160, y: 0 },
      { x: 400, y: 224 },
      { x: 160, y: 400 },
    ],
  };

  beforeEach(() => {
    layer = new ForegroundLayer();
    layer.setMapBounds(2048, 2048);
    layer.setObfuscationEnabled(true);
    layer.setTokenVisionReveals(reveals, 64);
  });

  it('cuts the LOS polygon instead of the circle for an obstructed emitter', () => {
    layer.setVisibilityPolygons([polygon]);

    const fc = getFogCutouts(layer);
    expect(fc._moves).toBe(1);
    expect(fc._circles).toEqual([{ x: 9 * 64 + 32, y: 9 * 64 + 32, r: 384 }]);
  });

  it('restores the circle once the polygon is cleared', () => {
    layer.setVisibilityPolygons([polygon]);
    layer.setVisibilityPolygons([]);

    const fc = getFogCutouts(layer);
    expect(fc._moves).toBe(0);
    expect(fc._circles).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ForegroundLayer — setViewMode()
// ---------------------------------------------------------------------------

type MockFogContainer = {
  visible: boolean;
  children: { visible: boolean }[];
};

function getFogContainer(l: ForegroundLayer): MockFogContainer {
  return l.children[0] as unknown as MockFogContainer;
}

describe('ForegroundLayer — setViewMode()', () => {
  let layer: ForegroundLayer;

  beforeEach(() => {
    layer = new ForegroundLayer();
    layer.setMapBounds(2048, 2048);
  });

  it("'player' mode enables fog obfuscation (fogContainer visible)", () => {
    layer.setViewMode('player');
    layer.setFogRegions([]);
    expect(getFogContainer(layer).visible).toBe(true);
  });

  it("'dm' mode disables fog obfuscation (fogContainer hidden)", () => {
    layer.setViewMode('dm');
    layer.setFogRegions([]);
    expect(getFogContainer(layer).visible).toBe(false);
  });

  it('switching from player to dm hides fog container', () => {
    layer.setViewMode('player');
    layer.setFogRegions([]);
    expect(getFogContainer(layer).visible).toBe(true);

    layer.setViewMode('dm');
    layer.setFogRegions([]);
    expect(getFogContainer(layer).visible).toBe(false);
  });
});

describe('ForegroundLayer — peripheral vision (legacy fog)', () => {
  type MockLayerGraphics = {
    _circles: { x: number; y: number; r: number }[];
    _fills: { color: number; alpha: number }[];
  };
  type MockGroup = { visible: boolean; children: MockLayerGraphics[] };

  const groups = (l: ForegroundLayer): { fog: MockGroup; peripheral: MockGroup } => ({
    fog: l.children[0] as unknown as MockGroup,
    peripheral: l.children[1] as unknown as MockGroup,
  });

  let layer: ForegroundLayer;

  beforeEach(() => {
    layer = new ForegroundLayer();
    layer.setMapBounds(2048, 2048);
    layer.setObfuscationEnabled(true);
    layer.setTokenVisionReveals(
      [{ tokenId: 'tok-1', x: 2, y: 3, visionRadius: 6, sceneId: 'scene-1' }],
      64,
    );
  });

  it('keeps the standard overlay and no darkness layer when the radius is 0', () => {
    const { fog, peripheral } = groups(layer);
    expect(fog.children[0]._fills.at(-1)?.alpha).toBe(FOG_OVERLAY_ALPHA);
    expect(peripheral.visible).toBe(false);
  });

  it('dims to the peripheral shroud and blacks out beyond the peripheral radius', () => {
    layer.setFogMaskConfig({
      ...DEFAULT_FOG_MASK_CONFIG,
      peripheralVisionRadius: 4.5,
      peripheralShroudAlpha: 0.7,
    });

    const { fog, peripheral } = groups(layer);
    expect(fog.children[0]._fills.at(-1)?.alpha).toBe(0.7);
    expect(peripheral.visible).toBe(true);
    expect(peripheral.children[0]._fills.at(-1)?.alpha).toBe(1);
    expect(peripheral.children[1]._circles).toEqual([
      { x: 160, y: 224, r: 384 },
      { x: 160, y: 224, r: 288 },
    ]);
  });

  it('skips peripheral circles for blind emitters', () => {
    layer.setFogMaskConfig({ ...DEFAULT_FOG_MASK_CONFIG, peripheralVisionRadius: 3 });
    layer.setTokenVisionReveals(
      [{ tokenId: 'tok-1', x: 2, y: 3, visionRadius: 0, sceneId: 'scene-1' }],
      64,
    );

    expect(groups(layer).peripheral.children[1]._circles).toHaveLength(0);
  });
});

describe('ForegroundLayer — setFogSuppressed() (editor mode)', () => {
  let layer: ForegroundLayer;

  beforeEach(() => {
    layer = new ForegroundLayer();
    layer.setMapBounds(2048, 2048);
    layer.setViewMode('player');
    layer.setFogRegions([]);
  });

  it('hides player-preview fog while suppressed', () => {
    expect(getFogContainer(layer).visible).toBe(true);
    layer.setFogSuppressed(true);
    expect(getFogContainer(layer).visible).toBe(false);
  });

  it('stays hidden when fog state changes while suppressed', () => {
    layer.setFogSuppressed(true);
    layer.setTokenVisionReveals(
      [{ tokenId: 'tok-1', x: 1, y: 1, visionRadius: 6, sceneId: 'scene-1' }],
      64,
    );
    expect(getFogContainer(layer).visible).toBe(false);
    expect(getFogCutouts(layer)._circles).toHaveLength(0);
  });

  it('restores fog when suppression ends', () => {
    layer.setFogSuppressed(true);
    layer.setFogSuppressed(false);
    expect(getFogContainer(layer).visible).toBe(true);
  });
});
