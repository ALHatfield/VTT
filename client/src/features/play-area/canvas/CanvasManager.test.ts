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
    private _listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    addChild(child: MockContainer): MockContainer {
      this.children.push(child);
      return child;
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

  return {
    Application: vi.fn(() => new MockApplication()),
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    Assets: { load: vi.fn().mockResolvedValue({}) },
    AlphaFilter: MockAlphaFilter,
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
      const worldContainer = (
        manager as unknown as { worldContainer: { x: number; y: number } }
      ).worldContainer;

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
      const worldContainer = (
        manager as unknown as { worldContainer: { scale: { x: number } } }
      ).worldContainer;

      const initialZoom = worldContainer.scale.x;
      manager.zoom(1, 400, 300);
      expect(worldContainer.scale.x).toBeGreaterThan(initialZoom);
    });

    it('decreases scale when delta is negative', async () => {
      await manager.init(container);
      const worldContainer = (
        manager as unknown as { worldContainer: { scale: { x: number } } }
      ).worldContainer;

      const initialZoom = worldContainer.scale.x;
      manager.zoom(-1, 400, 300);
      expect(worldContainer.scale.x).toBeLessThan(initialZoom);
    });

    it('clamps zoom to MIN_ZOOM', async () => {
      await manager.init(container);
      // Apply many negative zooms to hit the floor
      for (let i = 0; i < 50; i++) manager.zoom(-1, 0, 0);
      const worldContainer = (
        manager as unknown as { worldContainer: { scale: { x: number } } }
      ).worldContainer;
      expect(worldContainer.scale.x).toBeCloseTo(0.25);
    });

    it('clamps zoom to MAX_ZOOM', async () => {
      await manager.init(container);
      // Apply many positive zooms to hit the ceiling
      for (let i = 0; i < 50; i++) manager.zoom(1, 0, 0);
      const worldContainer = (
        manager as unknown as { worldContainer: { scale: { x: number } } }
      ).worldContainer;
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
    it('fires onBackgroundClick on stage pointerup when pointer did not move', async () => {
      await manager.init(container);
      const cb = vi.fn();
      manager.onBackgroundClick = cb;

      const stage = (
        manager as unknown as { app: { stage: { emit: (e: string, ...args: unknown[]) => void } } }
      ).app.stage;

      stage.emit('pointerdown', { global: { x: 100, y: 100 } });
      stage.emit('pointerup', { global: { x: 100, y: 100 } });

      expect(cb).toHaveBeenCalledOnce();
    });

    it('fires onBackgroundClick when pointer moved less than threshold (micro-jitter)', async () => {
      await manager.init(container);
      const cb = vi.fn();
      manager.onBackgroundClick = cb;

      const stage = (
        manager as unknown as { app: { stage: { emit: (e: string, ...args: unknown[]) => void } } }
      ).app.stage;

      // 2px movement — within 4px threshold → still a click
      stage.emit('pointerdown', { global: { x: 100, y: 100 } });
      stage.emit('pointerup', { global: { x: 101, y: 101 } });

      expect(cb).toHaveBeenCalledOnce();
    });

    it('does not fire onBackgroundClick when pointer moved beyond threshold (pan gesture)', async () => {
      await manager.init(container);
      const cb = vi.fn();
      manager.onBackgroundClick = cb;

      const stage = (
        manager as unknown as { app: { stage: { emit: (e: string, ...args: unknown[]) => void } } }
      ).app.stage;

      // 20px movement — beyond 4px threshold → pan, not click
      stage.emit('pointerdown', { global: { x: 100, y: 100 } });
      stage.emit('pointerup', { global: { x: 120, y: 100 } });

      expect(cb).not.toHaveBeenCalled();
    });
  });
});
