import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasManager } from './CanvasManager';

// ---------------------------------------------------------------------------
// Mock pixi.js — provides enough surface area for CanvasManager, BackgroundLayer,
// PlaygroundLayer, and ForegroundLayer without requiring a WebGL context.
// ---------------------------------------------------------------------------
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
    x = 0;
    y = 0;
    scale = new MockPoint();
    visible = true;
    eventMode = 'none';
    zIndex = 0;
    sortableChildren = false;
    private _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    addChild(child: MockContainer): MockContainer {
      this.children.push(child);
      return child;
    }

    removeChild(child: MockContainer): MockContainer | null {
      const idx = this.children.indexOf(child);
      if (idx === -1) return null;
      this.children.splice(idx, 1);
      return child;
    }

    removeChildren(): MockContainer[] {
      return this.children.splice(0, this.children.length);
    }

    on(event: string, handler: (...args: unknown[]) => void, context?: unknown): this {
      const bound = context !== undefined ? handler.bind(context) : handler;
      (this._listeners[event] ??= []).push(bound);
      return this;
    }

    off(event: string, handler: (...args: unknown[]) => void, _context?: unknown): this {
      this._listeners[event] = (this._listeners[event] ?? []).filter((h) => h !== handler);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      for (const fn of this._listeners[event] ?? []) fn(...args);
    }

    destroy(): void {
      /* noop */
    }
  }

  class MockGraphics extends MockContainer {
    clear(): this {
      return this;
    }
    moveTo(): this {
      return this;
    }
    lineTo(): this {
      return this;
    }
    stroke(): this {
      return this;
    }
    rect(): this {
      return this;
    }
    fill(): this {
      return this;
    }
  }

  class MockSprite extends MockContainer {}

  class MockApplication {
    stage = new MockContainer();
    screen = { width: 800, height: 600 };
    canvas = document.createElement('canvas');
    init = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
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

  class MockRenderTexture {
    constructor(
      public width = 0,
      public height = 0,
    ) {}
    static create(opts: { width: number; height: number }): MockRenderTexture {
      return new MockRenderTexture(opts.width, opts.height);
    }
    destroy(): void {
      /* noop */
    }
  }

  return {
    Application: vi.fn(() => new MockApplication()),
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    Rectangle: class MockRectangle {
      constructor(
        public x = 0,
        public y = 0,
        public width = 0,
        public height = 0,
      ) {}
    },
    Assets: { load: vi.fn().mockResolvedValue({}) },
    AlphaFilter: MockAlphaFilter,
    BlurFilter: MockBlurFilter,
    RenderTexture: MockRenderTexture,
  };
});

// ---------------------------------------------------------------------------

describe('CanvasManager', () => {
  let manager: CanvasManager;
  let container: HTMLDivElement;

  beforeEach(() => {
    manager = new CanvasManager();
    container = document.createElement('div');
  });

  describe('init()', () => {
    it('calls Application.init with the provided canvas', async () => {
      const { Application } = await import('pixi.js');
      await manager.init(container);
      // The Application constructor was called
      expect(Application).toHaveBeenCalled();
    });

    it('adds backgroundLayer, playgroundLayer, foregroundLayer to the world container in order', async () => {
      await manager.init(container);

      // Access private worldContainer via type assertion for test inspection
      const worldContainer = (manager as unknown as { worldContainer: { children: unknown[] } })
        .worldContainer;

      expect(worldContainer.children[0]).toBe(manager.backgroundLayer);
      expect(worldContainer.children[1]).toBe(manager.playgroundLayer);
      expect(worldContainer.children[2]).toBe(manager.foregroundLayer);
    });

    it('adds the world container to the stage', async () => {
      await manager.init(container);

      const app = (manager as unknown as { app: { stage: { children: unknown[] } } }).app;
      const worldContainer = (manager as unknown as { worldContainer: unknown }).worldContainer;

      expect(app.stage.children).toContain(worldContainer);
    });
  });

  describe('pan()', () => {
    it('translates the world container by dx/dy', async () => {
      await manager.init(container);
      const worldContainer = (manager as unknown as { worldContainer: { x: number; y: number } })
        .worldContainer;

      manager.pan(50, 30);
      expect(worldContainer.x).toBe(50);
      expect(worldContainer.y).toBe(30);

      manager.pan(-20, 10);
      expect(worldContainer.x).toBe(30);
      expect(worldContainer.y).toBe(40);
    });
  });

  describe('zoom()', () => {
    it('increases scale when delta is positive', async () => {
      await manager.init(container);
      const worldContainer = (manager as unknown as { worldContainer: { scale: { x: number } } })
        .worldContainer;

      const initialZoom = worldContainer.scale.x;
      manager.zoom(1, 400, 300);
      expect(worldContainer.scale.x).toBeGreaterThan(initialZoom);
    });

    it('decreases scale when delta is negative', async () => {
      await manager.init(container);
      const worldContainer = (manager as unknown as { worldContainer: { scale: { x: number } } })
        .worldContainer;

      const initialZoom = worldContainer.scale.x;
      manager.zoom(-1, 400, 300);
      expect(worldContainer.scale.x).toBeLessThan(initialZoom);
    });

    it('clamps zoom to MIN_ZOOM', async () => {
      await manager.init(container);
      // Apply many negative zooms to hit the floor
      for (let i = 0; i < 50; i++) manager.zoom(-1, 0, 0);
      const worldContainer = (manager as unknown as { worldContainer: { scale: { x: number } } })
        .worldContainer;
      expect(worldContainer.scale.x).toBeCloseTo(0.25);
    });

    it('clamps zoom to MAX_ZOOM', async () => {
      await manager.init(container);
      // Apply many positive zooms to hit the ceiling
      for (let i = 0; i < 50; i++) manager.zoom(1, 0, 0);
      const worldContainer = (manager as unknown as { worldContainer: { scale: { x: number } } })
        .worldContainer;
      expect(worldContainer.scale.x).toBeCloseTo(4);
    });
  });

  describe('getViewportBounds()', () => {
    it('returns correct bounds based on world container position and scale', async () => {
      await manager.init(container);
      // Pan 200 left and 100 up, keep scale at 1
      manager.pan(-200, -100);
      const bounds = manager.getViewportBounds();

      expect(bounds.x).toBe(200);
      expect(bounds.y).toBe(100);
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });
  });

  describe('destroy()', () => {
    it('calls app.destroy', async () => {
      await manager.init(container);
      const app = (manager as unknown as { app: { destroy: ReturnType<typeof vi.fn> } }).app;
      manager.destroy();
      expect(app.destroy).toHaveBeenCalled();
    });
  });

  describe('onBackgroundClick', () => {
    // Helper: emit a stage event that includes the stage as `target`, matching what
    // PixiJS does for events that reach the stage without being consumed by a child.
    function stageOf(mgr: CanvasManager): {
      emit: (e: string, ...args: unknown[]) => void;
    } & { self: unknown } {
      const stage = (
        mgr as unknown as {
          app: { stage: { emit: (e: string, ...args: unknown[]) => void } };
        }
      ).app.stage;
      return { emit: stage.emit.bind(stage), self: stage };
    }

    it('fires onBackgroundClick on stage pointerup when pointer did not move', async () => {
      await manager.init(container);
      const cb = vi.fn();
      manager.onBackgroundClick = cb;

      const stage = stageOf(manager);

      stage.emit('pointerdown', { global: { x: 100, y: 100 }, target: stage.self });
      stage.emit('pointerup', { global: { x: 100, y: 100 }, target: stage.self });

      expect(cb).toHaveBeenCalledOnce();
    });

    it('fires onBackgroundClick when pointer moved less than threshold (micro-jitter)', async () => {
      await manager.init(container);
      const cb = vi.fn();
      manager.onBackgroundClick = cb;

      const stage = stageOf(manager);

      // 2px movement — within 4px threshold → still a click
      stage.emit('pointerdown', { global: { x: 100, y: 100 }, target: stage.self });
      stage.emit('pointerup', { global: { x: 101, y: 101 }, target: stage.self });

      expect(cb).toHaveBeenCalledOnce();
    });

    it('does not fire onBackgroundClick when pointer moved beyond threshold (pan gesture)', async () => {
      await manager.init(container);
      const cb = vi.fn();
      manager.onBackgroundClick = cb;

      const stage = stageOf(manager);

      // In play mode: >4px movement is a pan/pan-attempt gesture and should not
      // register as a background click. (Marquee only activates in editor mode.)
      stage.emit('pointerdown', { global: { x: 100, y: 100 }, target: stage.self });
      stage.emit('pointerup', { global: { x: 120, y: 100 }, target: stage.self });

      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 5B — tile selection & marquee
  // ---------------------------------------------------------------------------

  describe('tile selection (multi-select)', () => {
    it('starts with an empty selection', async () => {
      await manager.init(container);
      expect(manager.getSelectedTilePlacementIds().size).toBe(0);
    });

    it('setTileSelection replaces the selection and fires onSelectionChange', async () => {
      await manager.init(container);
      const spy = vi.fn();
      manager.onSelectionChange = spy;

      manager.setTileSelection(new Set(['a', 'b']));

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect([...received].sort()).toEqual(['a', 'b']);
      expect([...manager.getSelectedTilePlacementIds()].sort()).toEqual(['a', 'b']);
    });

    it('setTileSelection is a no-op when the selection is unchanged', async () => {
      await manager.init(container);
      manager.setTileSelection(new Set(['a', 'b']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;

      manager.setTileSelection(new Set(['b', 'a']));

      expect(spy).not.toHaveBeenCalled();
    });

    it('clearTileSelection empties selection and fires onSelectionChange', async () => {
      await manager.init(container);
      manager.setTileSelection(new Set(['a']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;

      manager.clearTileSelection();

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect(received.size).toBe(0);
      expect(manager.getSelectedTilePlacementIds().size).toBe(0);
    });

    it('clearTileSelection is a no-op when already empty', async () => {
      await manager.init(container);
      const spy = vi.fn();
      manager.onSelectionChange = spy;

      manager.clearTileSelection();

      expect(spy).not.toHaveBeenCalled();
    });

    it('getSelectedTilePlacementIds returns a snapshot — external mutation does not leak', async () => {
      await manager.init(container);
      manager.setTileSelection(new Set(['a']));

      const snap = manager.getSelectedTilePlacementIds() as Set<string>;
      snap.add('b');

      expect(manager.getSelectedTilePlacementIds().size).toBe(1);
    });
  });

  describe('editor mode selection lifecycle', () => {
    function stageOf(mgr: CanvasManager): {
      emit: (e: string, ...args: unknown[]) => void;
      self: unknown;
    } {
      const stage = (
        mgr as unknown as {
          app: { stage: { emit: (e: string, ...args: unknown[]) => void } };
        }
      ).app.stage;
      return { emit: stage.emit.bind(stage), self: stage };
    }

    it('clears selection on background click in editor mode', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      manager.setTileSelection(new Set(['a']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;
      const stage = stageOf(manager);

      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: false,
        target: stage.self,
      });
      stage.emit('pointerup', { global: { x: 100, y: 100 }, target: stage.self });

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect(received.size).toBe(0);
    });

    it('does NOT clear selection on background click in play mode', async () => {
      await manager.init(container);
      manager.setTileSelection(new Set(['a']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;
      const stage = stageOf(manager);

      stage.emit('pointerdown', { global: { x: 100, y: 100 }, target: stage.self });
      stage.emit('pointerup', { global: { x: 100, y: 100 }, target: stage.self });

      expect(spy).not.toHaveBeenCalled();
      expect(manager.getSelectedTilePlacementIds().size).toBe(1);
    });

    it('does NOT clear selection when Shift is held on background click', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      manager.setTileSelection(new Set(['a']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;
      const stage = stageOf(manager);

      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: true,
        target: stage.self,
      });
      stage.emit('pointerup', { global: { x: 100, y: 100 }, target: stage.self });

      expect(spy).not.toHaveBeenCalled();
      expect(manager.getSelectedTilePlacementIds().size).toBe(1);
    });

    it('setEditorMode(false) clears any active selection', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      manager.setTileSelection(new Set(['a', 'b']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;

      manager.setEditorMode(false);

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect(received.size).toBe(0);
    });
  });

  describe('marquee (rubber-band) selection', () => {
    // Inject a lightweight fake sprite into a layer's map so we can exercise the
    // marquee commit logic without instantiating a real TilePlacementSprite.
    interface FakeSprite {
      placementId: string;
      setSelected: ReturnType<typeof vi.fn>;
      getWorldBounds: () => { x: number; y: number; width: number; height: number };
      destroy: () => void;
    }

    function makeFake(
      placementId: string,
      x: number,
      y: number,
      width: number,
      height: number,
    ): FakeSprite {
      return {
        placementId,
        setSelected: vi.fn(),
        getWorldBounds: () => ({ x, y, width, height }),
        destroy: () => {
          /* noop */
        },
      };
    }

    function injectSprite(mgr: CanvasManager, fake: FakeSprite): void {
      const map = (
        mgr.playgroundLayer as unknown as {
          tileSpriteMap: Map<string, FakeSprite>;
        }
      ).tileSpriteMap;
      map.set(fake.placementId, fake);
    }

    function stageOf(mgr: CanvasManager): {
      emit: (e: string, ...args: unknown[]) => void;
      self: unknown;
    } {
      const stage = (
        mgr as unknown as {
          app: { stage: { emit: (e: string, ...args: unknown[]) => void } };
        }
      ).app.stage;
      return { emit: stage.emit.bind(stage), self: stage };
    }

    it('activates marquee graphic in play mode when tool is select (4F.3)', async () => {
      await manager.init(container);
      // Default tool mode is 'select', play mode (editorModeEnabled = false)
      const stage = stageOf(manager);

      stage.emit('pointerdown', { global: { x: 100, y: 100 }, target: stage.self });
      stage.emit('globalpointermove', { global: { x: 200, y: 200 } });

      const marquee = manager as unknown as { marqueeGraphic: unknown; marqueeActive: boolean };
      // Rubber-band selection is now active in play mode with select tool
      expect(marquee.marqueeActive).toBe(true);
      expect(marquee.marqueeGraphic).not.toBeNull();
    });

    it('activates and creates a graphic when dragging past the activation threshold in editor mode', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const stage = stageOf(manager);

      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: false,
        target: stage.self,
      });
      stage.emit('globalpointermove', { global: { x: 200, y: 200 } });

      const marquee = manager as unknown as {
        marqueeGraphic: unknown;
        marqueeActive: boolean;
      };
      expect(marquee.marqueeActive).toBe(true);
      expect(marquee.marqueeGraphic).not.toBeNull();
    });

    it('does not activate for movements below the threshold', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const stage = stageOf(manager);

      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: false,
        target: stage.self,
      });
      // 2px drift — below 4px threshold
      stage.emit('globalpointermove', { global: { x: 102, y: 101 } });

      const marquee = manager as unknown as {
        marqueeGraphic: unknown;
        marqueeActive: boolean;
      };
      expect(marquee.marqueeActive).toBe(false);
      expect(marquee.marqueeGraphic).toBeNull();
    });

    it('commit selects sprites whose bounds intersect the marquee', async () => {
      await manager.init(container);
      manager.setEditorMode(true);

      // Inside marquee (world 100,100 → 300,300)
      injectSprite(manager, makeFake('inside', 150, 150, 64, 64));
      // Outside marquee
      injectSprite(manager, makeFake('outside', 500, 500, 64, 64));
      // Partial overlap on edge
      injectSprite(manager, makeFake('overlap', 280, 280, 100, 100));

      const spy = vi.fn();
      manager.onSelectionChange = spy;

      const stage = stageOf(manager);
      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: false,
        target: stage.self,
      });
      stage.emit('globalpointermove', { global: { x: 300, y: 300 } });
      stage.emit('pointerup', { global: { x: 300, y: 300 }, target: stage.self });

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect([...received].sort()).toEqual(['inside', 'overlap']);

      // Marquee graphic should be cleaned up after commit
      const marquee = manager as unknown as {
        marqueeGraphic: unknown;
        marqueeActive: boolean;
      };
      expect(marquee.marqueeActive).toBe(false);
      expect(marquee.marqueeGraphic).toBeNull();
    });

    it('Shift-drag unions marquee hits with the existing selection', async () => {
      await manager.init(container);
      manager.setEditorMode(true);

      injectSprite(manager, makeFake('previously-selected', 800, 800, 32, 32));
      injectSprite(manager, makeFake('new-hit', 150, 150, 64, 64));

      // Pre-existing selection
      manager.setTileSelection(new Set(['previously-selected']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;

      const stage = stageOf(manager);
      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: true,
        target: stage.self,
      });
      stage.emit('globalpointermove', { global: { x: 300, y: 300 } });
      stage.emit('pointerup', { global: { x: 300, y: 300 }, target: stage.self });

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect([...received].sort()).toEqual(['new-hit', 'previously-selected']);
    });

    it('non-shift marquee replaces the previous selection', async () => {
      await manager.init(container);
      manager.setEditorMode(true);

      injectSprite(manager, makeFake('previously-selected', 800, 800, 32, 32));
      injectSprite(manager, makeFake('new-hit', 150, 150, 64, 64));

      manager.setTileSelection(new Set(['previously-selected']));

      const spy = vi.fn();
      manager.onSelectionChange = spy;

      const stage = stageOf(manager);
      stage.emit('pointerdown', {
        global: { x: 100, y: 100 },
        shiftKey: false,
        target: stage.self,
      });
      stage.emit('globalpointermove', { global: { x: 300, y: 300 } });
      stage.emit('pointerup', { global: { x: 300, y: 300 }, target: stage.self });

      expect(spy).toHaveBeenCalledOnce();
      const received = spy.mock.calls[0]?.[0] as ReadonlySet<string>;
      expect([...received]).toEqual(['new-hit']);
    });
  });

  // ---------------------------------------------------------------------------
  // Arrow-key nudge — fine-tune tile position in editor mode
  // ---------------------------------------------------------------------------

  describe('arrow key nudge', () => {
    /** Inject a fake sprite directly into backgroundLayer's sprite map for testing. */
    function addFakeSprite(
      mgr: CanvasManager,
      id: string,
      x = 100,
      y = 200,
    ): { x: number; y: number; placementId: string } {
      const sprite = {
        x,
        y,
        placementId: id,
        setSelected: vi.fn(),
        setInteractive: vi.fn(),
      } as unknown as import('./TilePlacementSprite').TilePlacementSprite;
      const layer = mgr.backgroundLayer as unknown as {
        tileSpriteMap: Map<string, typeof sprite>;
      };
      layer.tileSpriteMap.set(id, sprite);
      return sprite;
    }

    it('moves selected tiles left by 1px on ArrowLeft', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(sprite.x).toBe(99);
      expect(sprite.y).toBe(200);
    });

    it('moves selected tiles right by 1px on ArrowRight', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      expect(sprite.x).toBe(101);
    });

    it('moves selected tiles up by 1px on ArrowUp', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      expect(sprite.y).toBe(199);
    });

    it('moves selected tiles down by 1px on ArrowDown', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(sprite.y).toBe(201);
    });

    it('moves by a full grid cell when Shift is held', async () => {
      await manager.init(container);
      await manager.loadMap({
        id: 'map-1',
        campaignId: 'c-1',
        name: 'Test Map',
        imageUrl: null,
        width: 1024,
        height: 1024,
        gridConfig: { cellSize: 64, color: 0xffffff, alpha: 0.2, visible: true },
      });
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }),
      );
      expect(sprite.x).toBe(164); // 100 + 64
    });

    it('fires onTileMoveEnd for each moved tile', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      const spy = vi.fn();
      manager.onTileMoveEnd = spy;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith('tile-1', sprite.x, sprite.y);
    });

    it('does not move tiles when not in editor mode', async () => {
      await manager.init(container);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(sprite.x).toBe(100);
    });

    it('does not move tiles when no tiles are selected', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(sprite.x).toBe(100);
    });

    it('removes the keydown listener when leaving editor mode', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const sprite = addFakeSprite(manager, 'tile-1', 100, 200);
      manager.setTileSelection(new Set(['tile-1']));
      manager.setEditorMode(false);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      expect(sprite.x).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Phase 4F.3 — tool mode and play-mode rubber-band token selection
  // ---------------------------------------------------------------------------

  describe('setToolMode()', () => {
    it('defaults to select mode', () => {
      const mode = (manager as unknown as { currentToolMode: string }).currentToolMode;
      expect(mode).toBe('select');
    });

    it('updates currentToolMode to pan', async () => {
      await manager.init(container);
      manager.setToolMode('pan');
      const mode = (manager as unknown as { currentToolMode: string }).currentToolMode;
      expect(mode).toBe('pan');
    });

    it('cancels any active marquee when switching modes', async () => {
      await manager.init(container);
      manager.setEditorMode(true);
      const stage = (
        manager as unknown as {
          app: { stage: { emit: (e: string, ...args: unknown[]) => void } };
        }
      ).app.stage;
      stage.emit('pointerdown', { global: { x: 100, y: 100 }, shiftKey: false });
      stage.emit('globalpointermove', { global: { x: 300, y: 300 } });
      const before = (manager as unknown as { marqueeActive: boolean }).marqueeActive;
      expect(before).toBe(true);

      manager.setToolMode('pan');
      const after = (manager as unknown as { marqueeActive: boolean }).marqueeActive;
      expect(after).toBe(false);
    });
  });

  describe('play-mode rubber-band token selection', () => {
    interface FakeTokenSprite {
      getTokenBounds: () => { x: number; y: number; size: number };
      setSelected: ReturnType<typeof vi.fn>;
      canInteract: boolean;
    }

    function injectToken(
      mgr: CanvasManager,
      tokenId: string,
      x: number,
      y: number,
      size: number,
      canInteract = true,
    ): void {
      const sprite: FakeTokenSprite = {
        getTokenBounds: () => ({ x, y, size }),
        setSelected: vi.fn(),
        canInteract,
      };
      const map = (
        mgr.playgroundLayer as unknown as {
          tokenSprites: Map<string, FakeTokenSprite>;
        }
      ).tokenSprites;
      map.set(tokenId, sprite);
    }

    function stageOf(mgr: CanvasManager): { emit: (e: string, ...args: unknown[]) => void } {
      const stage = (
        mgr as unknown as {
          app: { stage: { emit: (e: string, ...args: unknown[]) => void } };
        }
      ).app.stage;
      return { emit: stage.emit.bind(stage) };
    }

    it('activates marquee in play mode when tool is select', async () => {
      await manager.init(container);
      manager.setToolMode('select');
      const stage = stageOf(manager);
      stage.emit('pointerdown', { global: { x: 0, y: 0 }, shiftKey: false });
      stage.emit('globalpointermove', { global: { x: 200, y: 200 } });
      const marquee = manager as unknown as { marqueeActive: boolean };
      expect(marquee.marqueeActive).toBe(true);
    });

    it('does not activate marquee in play mode when tool is pan', async () => {
      await manager.init(container);
      manager.setToolMode('pan');
      const stage = stageOf(manager);
      stage.emit('pointerdown', { global: { x: 0, y: 0 }, shiftKey: false });
      stage.emit('globalpointermove', { global: { x: 200, y: 200 } });
      const marquee = manager as unknown as { marqueeActive: boolean };
      expect(marquee.marqueeActive).toBe(false);
    });

    it('fires onTokensSelected with token IDs in the rubber-band rect', async () => {
      await manager.init(container);
      manager.setToolMode('select');

      // Token at world (150, 150) size 64 — inside marquee (100,100)→(300,300)
      injectToken(manager, 'token-in', 150, 150, 64);
      // Token at world (500, 500) — outside
      injectToken(manager, 'token-out', 500, 500, 64);

      const spy = vi.fn();
      manager.onTokensSelected = spy;

      const stage = stageOf(manager);
      stage.emit('pointerdown', { global: { x: 100, y: 100 }, shiftKey: false });
      stage.emit('globalpointermove', { global: { x: 300, y: 300 } });
      stage.emit('pointerup', { global: { x: 300, y: 300 } });

      expect(spy).toHaveBeenCalledOnce();
      const ids = spy.mock.calls[0]?.[0] as string[];
      expect(ids).toContain('token-in');
      expect(ids).not.toContain('token-out');
    });

    it('fires onTokensSelected with empty array when no tokens in rect', async () => {
      await manager.init(container);
      manager.setToolMode('select');

      const spy = vi.fn();
      manager.onTokensSelected = spy;

      const stage = stageOf(manager);
      stage.emit('pointerdown', { global: { x: 100, y: 100 }, shiftKey: false });
      stage.emit('globalpointermove', { global: { x: 200, y: 200 } });
      stage.emit('pointerup', { global: { x: 200, y: 200 } });

      expect(spy).toHaveBeenCalledWith([]);
    });
  });

  describe('setTokensSelected()', () => {
    it('is callable without error', async () => {
      await manager.init(container);
      expect(() => {
        manager.setTokensSelected(new Set(['a', 'b']), new Set());
      }).not.toThrow();
    });
  });
});
