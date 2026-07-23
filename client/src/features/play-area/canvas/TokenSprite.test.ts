import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Token } from '@vtt/shared';

// ---------------------------------------------------------------------------
// Mock pixi.js — same pattern as CanvasManager.test.ts
// ---------------------------------------------------------------------------
vi.mock('pixi.js', () => {
  class MockPoint {
    x = 0;
    y = 0;
    set(v: number): void {
      this.x = v;
      this.y = v;
    }
  }

  class MockContainer {
    children: MockContainer[] = [];
    x = 0;
    y = 0;
    zIndex = 0;
    visible = true;
    alpha = 1;
    tint = 0xffffff;
    eventMode = 'none';
    cursor = 'default';
    hitArea: unknown = null;
    scale = new MockPoint();
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

    off(event: string, _handler: (...args: unknown[]) => void, _context?: unknown): this {
      // Simplified: removes ALL listeners for the event.
      // TokenSprite only registers one handler per event, so this is safe for tests.
      delete this._listeners[event];
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
    circle(): this { return this; }
    fill(): this { return this; }
    stroke(): this { return this; }
    clear(): this { return this; }
    moveTo(): this { return this; }
    lineTo(): this { return this; }
    rect(): this { return this; }
  }

  class MockText extends MockContainer {
    text = '';
    anchor = { set: vi.fn() };
    constructor({ text }: { text: string; style?: unknown }) {
      super();
      this.text = text;
    }
  }

  class MockTextStyle {}

  class MockCircle {
    constructor(
      public x: number,
      public y: number,
      public radius: number,
    ) {}
  }

  return {
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    TextStyle: MockTextStyle,
    Circle: MockCircle,
    Assets: { load: vi.fn().mockResolvedValue({}) },
  };
});

// Mock gsap — TokenSprite uses gsap.to() for drop tween and revert
vi.mock('gsap', () => ({
  default: {
    to: vi.fn((_target: unknown, vars: Record<string, unknown>) => {
      // Immediately invoke onComplete if provided, so tests don't hang
      if (typeof vars.onComplete === 'function') vars.onComplete();
    }),
    killTweensOf: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------

import { TokenSprite } from './TokenSprite';

// ---------------------------------------------------------------------------
// Test helper — emits a PixiJS event with a plain object payload.
// Bypasses TypeScript's typed emit signatures (FederatedPointerEvent, Point)
// which are not satisfied by the lightweight mock objects used in tests.
// ---------------------------------------------------------------------------
function emitEvent(sprite: TokenSprite, event: string, data: object = {}): void {
  (sprite as unknown as { emit(e: string, d: object): void }).emit(event, data);
}

// ---------------------------------------------------------------------------

function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    id: 'tok-1',
    name: 'Goblin',
    type: 'monster',
    x: 2,
    y: 3,
    size: 1,
    color: '#ff4444',
    hp: 10,
    maxHp: 10,
    ac: 12,
    visionRadius: 6,
    iconUrl: null,
    ownerId: null,
    ownerName: null,
    sceneId: 'scene-1',
    campaignId: 'campaign-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    npcSubtype: null,
    ...overrides,
  };
}

const CELL_SIZE = 64;

// ---------------------------------------------------------------------------

describe('TokenSprite', () => {
  describe('setSelected()', () => {
    let sprite: TokenSprite;

    beforeEach(() => {
      sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
    });

    it('makes the selection ring visible when selected = true', () => {
      sprite.setSelected(true);
      const ring = (sprite as unknown as { selectionRing: { visible: boolean } }).selectionRing;
      expect(ring.visible).toBe(true);
    });

    it('hides the selection ring when selected = false', () => {
      sprite.setSelected(true);
      sprite.setSelected(false);
      const ring = (sprite as unknown as { selectionRing: { visible: boolean } }).selectionRing;
      expect(ring.visible).toBe(false);
    });

    it('starts with selection ring hidden', () => {
      const ring = (sprite as unknown as { selectionRing: { visible: boolean } }).selectionRing;
      expect(ring.visible).toBe(false);
    });
  });

  describe('ghost indicator during drag', () => {
    it('ghost indicator starts hidden', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const ghost = (sprite as unknown as { ghostIndicator: { visible: boolean } }).ghostIndicator;
      expect(ghost.visible).toBe(false);
    });

    it('ghost indicator becomes visible on pointermove after threshold', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);

      // Simulate pointerdown at (100, 100)
      emitEvent(sprite, 'pointerdown', {
        stopPropagation: vi.fn(),
        global: { x: 100, y: 100 },
      });

      // Simulate parent for toLocal
      const mockParent = {
        toLocal: (global: { x: number; y: number }) => ({ x: global.x, y: global.y }),
      };
      (sprite as unknown as { parent: unknown }).parent = mockParent;

      // Simulate pointermove well past threshold
      emitEvent(sprite, 'globalpointermove', {
        global: { x: 120, y: 120 },
      });

      const ghost = (sprite as unknown as { ghostIndicator: { visible: boolean } }).ghostIndicator;
      expect(ghost.visible).toBe(true);
    });

    it('ghost indicator is hidden after pointerup', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);

      emitEvent(sprite, 'pointerdown', {
        stopPropagation: vi.fn(),
        global: { x: 100, y: 100 },
      });

      const mockParent = {
        toLocal: (global: { x: number; y: number }) => ({ x: global.x, y: global.y }),
      };
      (sprite as unknown as { parent: unknown }).parent = mockParent;

      emitEvent(sprite, 'globalpointermove', { global: { x: 120, y: 120 } });
      emitEvent(sprite, 'pointerup', {});

      const ghost = (sprite as unknown as { ghostIndicator: { visible: boolean } }).ghostIndicator;
      expect(ghost.visible).toBe(false);
    });
  });

  describe('onTokenClick', () => {
    it('fires onTokenClick when pointer barely moves (click, not drag)', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const onClick = vi.fn();
      sprite.onTokenClick = onClick;

      emitEvent(sprite, 'pointerdown', {
        stopPropagation: vi.fn(),
        global: { x: 100, y: 100 },
      });

      const mockParent = {
        toLocal: (global: { x: number; y: number }) => ({ x: global.x, y: global.y }),
      };
      (sprite as unknown as { parent: unknown }).parent = mockParent;

      // Move less than DRAG_THRESHOLD (4px)
      emitEvent(sprite, 'globalpointermove', { global: { x: 101, y: 101 } });
      emitEvent(sprite, 'pointerup', {});

      expect(onClick).toHaveBeenCalledWith('tok-1');
    });

    it('does not fire onTokenClick when a full drag occurs', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const onClick = vi.fn();
      sprite.onTokenClick = onClick;

      emitEvent(sprite, 'pointerdown', {
        stopPropagation: vi.fn(),
        global: { x: 100, y: 100 },
      });

      const mockParent = {
        toLocal: (global: { x: number; y: number }) => ({ x: global.x, y: global.y }),
      };
      (sprite as unknown as { parent: unknown }).parent = mockParent;

      emitEvent(sprite, 'globalpointermove', { global: { x: 150, y: 150 } });
      emitEvent(sprite, 'pointerup', {});

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('non-interactive sprite', () => {
    it('does not register drag event listeners when canInteract is false', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, false);
      const onClick = vi.fn();
      sprite.onTokenClick = onClick;

      emitEvent(sprite, 'pointerdown', {
        stopPropagation: vi.fn(),
        global: { x: 100, y: 100 },
      });
      emitEvent(sprite, 'pointerup', {});

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('PP drag behavior — token stays at origin', () => {
    function setupDrag(sprite: TokenSprite, startX = 100, startY = 100) {
      emitEvent(sprite, 'pointerdown', {
        stopPropagation: vi.fn(),
        global: { x: startX, y: startY },
      });
      (sprite as unknown as { parent: unknown }).parent = {
        toLocal: (global: { x: number; y: number }) => ({ x: global.x, y: global.y }),
      };
    }

    it('token position does not change during drag', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const initialX = sprite.x;
      const initialY = sprite.y;

      setupDrag(sprite);
      emitEvent(sprite, 'globalpointermove', { global: { x: 150, y: 150 } });

      expect(sprite.x).toBe(initialX);
      expect(sprite.y).toBe(initialY);
    });

    it('fires onTokenDragStart once when drag threshold is first crossed', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const onDragStart = vi.fn();
      sprite.onTokenDragStart = onDragStart;

      setupDrag(sprite);

      // Below threshold (< 4 px) — must not fire
      emitEvent(sprite, 'globalpointermove', { global: { x: 101, y: 101 } });
      expect(onDragStart).not.toHaveBeenCalled();

      // Above threshold — fires exactly once
      emitEvent(sprite, 'globalpointermove', { global: { x: 150, y: 150 } });
      expect(onDragStart).toHaveBeenCalledOnce();

      // Subsequent moves must not fire again
      emitEvent(sprite, 'globalpointermove', { global: { x: 160, y: 160 } });
      expect(onDragStart).toHaveBeenCalledOnce();
    });

    it('does not fire onTokenDragStart on click without drag', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const onDragStart = vi.fn();
      sprite.onTokenDragStart = onDragStart;

      setupDrag(sprite);
      emitEvent(sprite, 'globalpointermove', { global: { x: 101, y: 101 } }); // below threshold
      emitEvent(sprite, 'pointerup', {});

      expect(onDragStart).not.toHaveBeenCalled();
    });

    it('snap highlight and drag line become visible during drag', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);

      setupDrag(sprite);
      emitEvent(sprite, 'globalpointermove', { global: { x: 150, y: 150 } });

      const internal = sprite as unknown as {
        snapHighlight: { visible: boolean };
        dragLine: { visible: boolean };
      };
      expect(internal.snapHighlight.visible).toBe(true);
      expect(internal.dragLine.visible).toBe(true);
    });

    it('ESC key cancels drag and hides all preview graphics', () => {
      const sprite = new TokenSprite(makeToken(), CELL_SIZE, true);
      const onDragStateChange = vi.fn();
      sprite.onDragStateChange = onDragStateChange;

      setupDrag(sprite);
      emitEvent(sprite, 'globalpointermove', { global: { x: 150, y: 150 } });

      const internal = sprite as unknown as {
        ghostIndicator: { visible: boolean };
        snapHighlight: { visible: boolean };
        dragLine: { visible: boolean };
        isDragging: boolean;
      };
      expect(internal.ghostIndicator.visible).toBe(true);

      // Dispatch real keydown ESC — the handler was registered on window during pointerdown
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      window.dispatchEvent(escEvent);

      expect(internal.ghostIndicator.visible).toBe(false);
      expect(internal.snapHighlight.visible).toBe(false);
      expect(internal.dragLine.visible).toBe(false);
      expect(internal.isDragging).toBe(false);
    });
  });
});
