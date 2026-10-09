import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DoorState } from '@vtt/shared';

vi.mock('pixi.js', () => {
  class MockContainer {
    children: MockContainer[] = [];
    label = '';
    eventMode = 'auto';
    cursor = 'default';
    destroyed = false;
    private listeners: Record<string, ((e: unknown) => void)[]> = {};

    addChild(child: MockContainer): MockContainer {
      this.children.push(child);
      return child;
    }
    removeChild(child: MockContainer): MockContainer {
      this.children = this.children.filter((c) => c !== child);
      return child;
    }
    on(event: string, handler: (e: unknown) => void): this {
      (this.listeners[event] ??= []).push(handler);
      return this;
    }
    emit(event: string, e: unknown): void {
      for (const fn of this.listeners[event] ?? []) fn(e);
    }
    listenerCount(event: string): number {
      return this.listeners[event]?.length ?? 0;
    }
    destroy(): void {
      this.destroyed = true;
    }
  }

  class MockGraphics extends MockContainer {
    strokes: { alpha?: number }[] = [];
    hitArea: unknown = null;
    clear(): this {
      this.strokes = [];
      return this;
    }
    moveTo(): this {
      return this;
    }
    lineTo(): this {
      return this;
    }
    circle(): this {
      return this;
    }
    fill(): this {
      return this;
    }
    stroke(opts: { alpha?: number }): this {
      this.strokes.push(opts);
      return this;
    }
  }

  class MockPolygon {
    constructor(public points: number[]) {}
  }

  return { Container: MockContainer, Graphics: MockGraphics, Polygon: MockPolygon };
});

const { DoorLayer, doorHitArea } = await import('./DoorLayer');

interface MockMarker {
  label: string;
  eventMode: string;
  cursor: string;
  destroyed: boolean;
  hitArea: unknown;
  emit: (event: string, e: unknown) => void;
  listenerCount: (event: string) => number;
}

function door(id: string, isOpen = false): DoorState {
  return { id, x1: 0, y1: 0, x2: 64, y2: 0, isOpen };
}

function markers(layer: InstanceType<typeof DoorLayer>): MockMarker[] {
  return (layer.children as unknown as MockMarker[]).filter((c) => c.label.startsWith('door-'));
}

describe('DoorLayer', () => {
  let layer: InstanceType<typeof DoorLayer>;

  beforeEach(() => {
    layer = new DoorLayer();
  });

  it('creates one marker per door', () => {
    layer.setDoors([door('a'), door('b', true)], true);
    expect(layer.getMarkerCount()).toBe(2);
    expect(markers(layer).map((m) => m.label)).toEqual(['door-a', 'door-b']);
  });

  it('fires onSelect with the wall id when an interactive door is tapped', () => {
    const onSelect = vi.fn();
    layer.onSelect = onSelect;
    layer.setDoors([door('a')], true);

    const stopPropagation = vi.fn();
    markers(layer)[0]?.emit('pointertap', { stopPropagation });

    expect(onSelect).toHaveBeenCalledWith('a');
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('makes the whole door line clickable', () => {
    layer.setDoors([door('a')], true);
    expect(markers(layer)[0]?.hitArea).not.toBeNull();
  });

  it('pads the hit area around the door on every side', () => {
    const { points } = doorHitArea(door('a')) as unknown as { points: number[] };
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(64);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(0);
  });

  it('stops pointerdown so the stage does not start a marquee under the marker', () => {
    layer.setDoors([door('a')], true);
    const stopPropagation = vi.fn();
    markers(layer)[0]?.emit('pointerdown', { stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('renders non-interactive markers for viewers who cannot toggle doors', () => {
    layer.setDoors([door('a')], false);
    const [marker] = markers(layer);

    expect(layer.eventMode).toBe('none');
    expect(marker?.eventMode).toBe('none');
    expect(marker?.listenerCount('pointertap')).toBe(0);
    expect(marker?.hitArea).toBeNull();
  });

  it('destroys previous markers when doors are replaced', () => {
    layer.setDoors([door('a')], true);
    const [old] = markers(layer);

    layer.setDoors([door('b')], true);

    expect(old?.destroyed).toBe(true);
    expect(markers(layer).map((m) => m.label)).toEqual(['door-b']);
  });

  it('dims the door line when open', () => {
    layer.setDoors([door('a', true)], true);
    const lines = layer.children[1] as unknown as { strokes: { alpha?: number }[] };
    expect(lines.strokes[0]?.alpha).toBeLessThan(1);
  });

  it('highlights only the selected door and survives door updates', () => {
    const highlight = layer.children[0] as unknown as { strokes: unknown[] };
    layer.setDoors([door('a'), door('b')], true);
    expect(highlight.strokes).toHaveLength(0);

    layer.setSelectedDoor('b');
    expect(highlight.strokes).toHaveLength(1);

    layer.setDoors([door('a'), door('b', true)], true);
    expect(highlight.strokes).toHaveLength(1);

    layer.setDoors([door('a')], true);
    expect(highlight.strokes).toHaveLength(0);

    layer.setSelectedDoor(null);
    expect(highlight.strokes).toHaveLength(0);
  });
});
