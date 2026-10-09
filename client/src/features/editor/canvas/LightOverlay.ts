// LightOverlay — Phase 5G
// Editor-only gizmos for authored lights (position marker + radius ring), mounted
// on the Foreground layer. No glow rendering — that is play-area PM4 runtime work.
import { Container, Graphics } from 'pixi.js';

import type { LightSource } from '@vtt/shared';

import { hexToNumber } from '../utils/light-placement';

export const LIGHT_GIZMO_COLORS = {
  outline: 0x000000,
  selection: 0xffffff,
} as const;

const RING_WIDTH = 2;
const RING_ALPHA = 0.9;
const INNER_RING_WIDTH = 1;
const INNER_RING_ALPHA = 0.45;
const MARKER_RADIUS = 6;
const MARKER_OUTLINE_WIDTH = 2;
const SELECTION_RING_WIDTH = 6;
const SELECTION_ALPHA = 0.5;
const SELECTION_MARKER_PADDING = 4;

export class LightOverlay extends Container {
  private readonly graphics: Graphics;

  constructor() {
    super();
    this.label = 'light-overlay';
    this.eventMode = 'none';
    this.graphics = new Graphics();
    this.graphics.eventMode = 'none';
    this.addChild(this.graphics);
  }

  setLights(lights: readonly LightSource[], selectedLightId: string | null, cellSize: number): void {
    const g = this.graphics;
    g.clear();

    for (const light of lights) {
      const color = hexToNumber(light.color);
      const radius = light.radius * cellSize;
      const isSelected = light.id === selectedLightId;

      if (isSelected) {
        g.circle(light.x, light.y, radius).stroke({
          width: SELECTION_RING_WIDTH,
          color: LIGHT_GIZMO_COLORS.selection,
          alpha: SELECTION_ALPHA,
        });
      }

      g.circle(light.x, light.y, radius).stroke({ width: RING_WIDTH, color, alpha: RING_ALPHA });

      // Inner ring marks where falloff begins; omitted when it coincides with the centre or edge
      const innerRadius = radius * (1 - light.falloff);
      if (light.falloff > 0 && innerRadius > 0) {
        g.circle(light.x, light.y, innerRadius).stroke({
          width: INNER_RING_WIDTH,
          color,
          alpha: INNER_RING_ALPHA,
        });
      }

      g.circle(light.x, light.y, MARKER_RADIUS)
        .fill({ color })
        .stroke({ width: MARKER_OUTLINE_WIDTH, color: LIGHT_GIZMO_COLORS.outline });

      if (isSelected) {
        g.circle(light.x, light.y, MARKER_RADIUS + SELECTION_MARKER_PADDING).stroke({
          width: MARKER_OUTLINE_WIDTH,
          color: LIGHT_GIZMO_COLORS.selection,
        });
      }
    }
  }
}
