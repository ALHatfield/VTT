import { BlurFilter, Container, Graphics, RenderTexture } from 'pixi.js';

import type { FogMaskConfig, FogRegion, VisionStamp } from '@vtt/shared';
import { DEFAULT_FOG_MASK_CONFIG, FOG_MASK_BLUR_STRENGTH } from '@vtt/shared';

import {
  batchStamps,
  buildSoftEdgeRings,
  computeMaskDimensions,
  worldToMask,
  type MaskDimensions,
} from './fog-mask-math';

/** Minimal slice of the PixiJS renderer the mask pipeline depends on. */
export interface FogMaskRenderer {
  render(options: { container: Container; target: RenderTexture; clear?: boolean }): void;
}

export interface FogMaskUpdate {
  /** Emitters that are currently visible. */
  activeStamps: VisionStamp[];
  /** Emitters that have ever been visible (already includes active stamps). */
  exploredStamps: VisionStamp[];
  /** DM-drawn permanent reveal polygons. Always fully visible. */
  regions: FogRegion[];
}

const MASK_COLOR = 0xffffff;

/**
 * Composes the fog reveal masks into GPU RenderTextures.
 *
 * Two textures are produced per update:
 *   - active   — what the party can see right now
 *   - explored — active ∪ everything previously seen
 *
 * ForegroundLayer erases a dark overlay with each texture, which yields the
 * three visibility states (active / explored shroud / hidden) without any
 * per-pixel CPU work. Stamps are rendered as batched Graphics children of a
 * single container, so one `renderer.render` call composes the whole mask.
 */
export class FogMaskService {
  private readonly renderer: FogMaskRenderer;
  private readonly stampContainer: Container;
  private readonly graphicsPool: Graphics[] = [];
  private readonly blurFilter: BlurFilter;

  private config: FogMaskConfig = { ...DEFAULT_FOG_MASK_CONFIG };
  private dimensions: MaskDimensions = { width: 0, height: 0, scale: 0 };
  private mapWidth = 0;
  private mapHeight = 0;

  private activeTexture: RenderTexture | null = null;
  private exploredTexture: RenderTexture | null = null;
  private lastCompositionMs = 0;

  constructor(renderer: FogMaskRenderer) {
    this.renderer = renderer;
    this.stampContainer = new Container();
    this.blurFilter = new BlurFilter({ strength: FOG_MASK_BLUR_STRENGTH });
  }

  setConfig(config: FogMaskConfig): void {
    const resolutionChanged = config.maskResolutionScale !== this.config.maskResolutionScale;
    this.config = { ...config };
    this.stampContainer.filters = config.edgeSoftness === 'filter' ? [this.blurFilter] : [];

    if (resolutionChanged) {
      this.resize(this.mapWidth, this.mapHeight);
    }
  }

  /** (Re)allocate the mask textures for the given map size. */
  resize(mapWidth: number, mapHeight: number): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    const next = computeMaskDimensions(mapWidth, mapHeight, this.config.maskResolutionScale);
    if (
      next.width === this.dimensions.width &&
      next.height === this.dimensions.height &&
      this.activeTexture !== null
    ) {
      this.dimensions = next;
      return;
    }

    this.releaseTextures();
    this.dimensions = next;

    if (next.width <= 0 || next.height <= 0) return;

    this.activeTexture = RenderTexture.create({ width: next.width, height: next.height });
    this.exploredTexture = RenderTexture.create({ width: next.width, height: next.height });
  }

  get maskScale(): number {
    return this.dimensions.scale;
  }

  get maskDimensions(): MaskDimensions {
    return this.dimensions;
  }

  get activeMaskTexture(): RenderTexture | null {
    return this.activeTexture;
  }

  get exploredMaskTexture(): RenderTexture | null {
    return this.exploredTexture;
  }

  /** Duration of the most recent mask recomposition, in milliseconds. */
  getLastCompositionMs(): number {
    return this.lastCompositionMs;
  }

  update(payload: FogMaskUpdate): void {
    if (!this.activeTexture || !this.exploredTexture) return;

    const start = performance.now();
    this.composeInto(this.activeTexture, payload.activeStamps, payload.regions);
    this.composeInto(this.exploredTexture, payload.exploredStamps, payload.regions);
    this.lastCompositionMs = performance.now() - start;
  }

  destroy(): void {
    this.releaseTextures();
    this.stampContainer.filters = [];
    this.blurFilter.destroy();
    for (const graphics of this.graphicsPool) graphics.destroy();
    this.graphicsPool.length = 0;
    this.stampContainer.destroy();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private composeInto(target: RenderTexture, stamps: VisionStamp[], regions: FogRegion[]): void {
    const { scale } = this.dimensions;
    const batches = batchStamps(stamps);
    // Regions ride along in the first batch so an empty stamp set still renders them.
    const passCount = Math.max(1, batches.length);

    this.ensurePool(passCount);

    for (let i = 0; i < this.graphicsPool.length; i += 1) {
      const graphics = this.graphicsPool[i];
      graphics.clear();
      graphics.visible = i < passCount;
      if (i >= passCount) continue;

      if (i === 0) {
        for (const region of regions) {
          if (region.vertices.length < 3) continue;
          const first = worldToMask(region.vertices[0], scale);
          graphics.moveTo(first.x, first.y);
          for (let v = 1; v < region.vertices.length; v += 1) {
            const vertex = worldToMask(region.vertices[v], scale);
            graphics.lineTo(vertex.x, vertex.y);
          }
          graphics.closePath();
          graphics.fill({ color: MASK_COLOR, alpha: 1 });
        }
      }

      const batch = batches[i] ?? [];
      for (const stamp of batch) {
        this.drawStamp(graphics, stamp, scale);
      }
    }

    this.renderer.render({ container: this.stampContainer, target, clear: true });
  }

  private drawStamp(graphics: Graphics, stamp: VisionStamp, scale: number): void {
    const center = worldToMask(stamp, scale);
    const radius = stamp.radius * scale;

    if (this.config.edgeSoftness !== 'radial') {
      graphics.circle(center.x, center.y, radius).fill({ color: MASK_COLOR, alpha: 1 });
      return;
    }

    for (const ring of buildSoftEdgeRings(radius, this.config.edgeSoftnessRatio)) {
      graphics
        .circle(center.x, center.y, ring.radius)
        .fill({ color: MASK_COLOR, alpha: ring.alpha });
    }
  }

  private ensurePool(size: number): void {
    while (this.graphicsPool.length < size) {
      const graphics = new Graphics();
      graphics.eventMode = 'none';
      this.graphicsPool.push(graphics);
      this.stampContainer.addChild(graphics);
    }
  }

  private releaseTextures(): void {
    this.activeTexture?.destroy(true);
    this.exploredTexture?.destroy(true);
    this.activeTexture = null;
    this.exploredTexture = null;
  }
}
