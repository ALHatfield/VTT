// DoorLayer — Phase PM3
// Play-mode door markers above the fog so visible doors stay clickable. Doors come
// pre-filtered by the server: DMs get every door, players only doors the party can see.
import type { FederatedPointerEvent } from 'pixi.js';
import { Container, Graphics, Polygon } from 'pixi.js';

import type { DoorState } from '@vtt/shared';

export const DOOR_COLOR = 0xffb300;
const DOOR_OUTLINE_COLOR = 0x1a1a2e;
const DOOR_LINE_WIDTH = 5;
const OPEN_DOOR_LINE_ALPHA = 0.35;
export const DOOR_MARKER_RADIUS = 9;
const DOOR_MARKER_OUTLINE_WIDTH = 2;
const DOOR_SELECTED_COLOR = 0xffffff;
const DOOR_SELECTED_LINE_WIDTH = 11;
const DOOR_SELECTED_RING_RADIUS = DOOR_MARKER_RADIUS + 3;
/** Half-width of the clickable band around a door line, in world pixels. */
const DOOR_HIT_PADDING = DOOR_MARKER_RADIUS;

/** Rectangle around the door line, padded on every side, so the whole door is clickable. */
export function doorHitArea(door: DoorState): Polygon {
  const dx = door.x2 - door.x1;
  const dy = door.y2 - door.y1;
  const length = Math.hypot(dx, dy) || 1;
  const ux = (dx / length) * DOOR_HIT_PADDING;
  const uy = (dy / length) * DOOR_HIT_PADDING;
  return new Polygon([
    door.x1 - ux - uy,
    door.y1 - uy + ux,
    door.x2 + ux - uy,
    door.y2 + uy + ux,
    door.x2 + ux + uy,
    door.y2 + uy - ux,
    door.x1 - ux + uy,
    door.y1 - uy - ux,
  ]);
}

export class DoorLayer extends Container {
  /** Fired when a door is clicked while interactive. */
  onSelect?: (wallId: string) => void;

  private readonly highlight: Graphics;
  private readonly lines: Graphics;
  private readonly markers = new Map<string, Graphics>();
  private doors: readonly DoorState[] = [];
  private selectedId: string | null = null;

  constructor() {
    super();
    this.label = 'door-layer';
    this.eventMode = 'none';
    this.highlight = new Graphics();
    this.highlight.eventMode = 'none';
    this.addChild(this.highlight);
    this.lines = new Graphics();
    this.lines.eventMode = 'none';
    this.addChild(this.lines);
  }

  setDoors(doors: readonly DoorState[], interactive: boolean): void {
    this.doors = doors;
    this.eventMode = interactive ? 'passive' : 'none';
    this.clearMarkers();
    this.lines.clear();

    for (const door of doors) {
      this.lines
        .moveTo(door.x1, door.y1)
        .lineTo(door.x2, door.y2)
        .stroke({
          width: DOOR_LINE_WIDTH,
          color: DOOR_COLOR,
          alpha: door.isOpen ? OPEN_DOOR_LINE_ALPHA : 1,
        });
      this.addMarker(door, interactive);
    }
    this.drawHighlight();
  }

  /** Outline the selected door; ids not in the current door list draw nothing. */
  setSelectedDoor(wallId: string | null): void {
    this.selectedId = wallId;
    this.drawHighlight();
  }

  getMarkerCount(): number {
    return this.markers.size;
  }

  private drawHighlight(): void {
    this.highlight.clear();
    const door = this.doors.find((d) => d.id === this.selectedId);
    if (!door) return;
    this.highlight
      .moveTo(door.x1, door.y1)
      .lineTo(door.x2, door.y2)
      .stroke({ width: DOOR_SELECTED_LINE_WIDTH, color: DOOR_SELECTED_COLOR, cap: 'round' });
    this.highlight
      .circle((door.x1 + door.x2) / 2, (door.y1 + door.y2) / 2, DOOR_SELECTED_RING_RADIUS)
      .fill({ color: DOOR_SELECTED_COLOR });
  }

  private addMarker(door: DoorState, interactive: boolean): void {
    const marker = new Graphics();
    const cx = (door.x1 + door.x2) / 2;
    const cy = (door.y1 + door.y2) / 2;
    marker.circle(cx, cy, DOOR_MARKER_RADIUS).fill({
      color: door.isOpen ? DOOR_OUTLINE_COLOR : DOOR_COLOR,
    });
    marker.circle(cx, cy, DOOR_MARKER_RADIUS).stroke({
      width: DOOR_MARKER_OUTLINE_WIDTH,
      color: door.isOpen ? DOOR_COLOR : DOOR_OUTLINE_COLOR,
    });
    marker.label = `door-${door.id}`;
    marker.eventMode = interactive ? 'static' : 'none';
    marker.cursor = interactive ? 'pointer' : 'default';

    if (interactive) {
      marker.hitArea = doorHitArea(door);
      // Stop the stage from starting a marquee selection under the door.
      marker.on('pointerdown', (e: FederatedPointerEvent) => e.stopPropagation());
      marker.on('pointertap', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        this.onSelect?.(door.id);
      });
    }

    this.markers.set(door.id, marker);
    this.addChild(marker);
  }

  private clearMarkers(): void {
    for (const marker of this.markers.values()) {
      this.removeChild(marker);
      marker.destroy();
    }
    this.markers.clear();
  }
}
