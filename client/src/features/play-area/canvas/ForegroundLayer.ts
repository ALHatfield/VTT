import { AlphaFilter, Container, Graphics } from 'pixi.js';

import type { FogRegion, FogVertex, TokenVisionReveal } from '@vtt/shared';
import { FOG_OVERLAY_ALPHA, FOG_OVERLAY_COLOR } from '@vtt/shared';

import type { TilePlacementSprite } from './TilePlacementSprite';

/**
 * ForegroundLayer — highest z-index.
 * Reserved for fog of war, weather effects, and lighting overlays (Phase 4F+).
 *
 * Fog-of-war compositing approach:
 *   fogContainer (filters=[AlphaFilter(1)] — forces isolated render texture)
 *     ├─ fogOverlay  – solid dark rect covering the whole map
 *     └─ fogCutouts  – blendMode='erase'; draws revealed polygons + vision circles
 *
 * Applying any Filter forces PixiJS to render the container into its own texture
 * before compositing to the main scene. fogCutouts 'erase' therefore only removes
 * fogOverlay pixels within that isolated texture, leaving transparent holes that
 * reveal the Background + Playground layers underneath when composited back.
 */
export class ForegroundLayer extends Container {
  /** Isolated render group — fog composites here before the main scene. */
  private readonly fogContainer: Container;
  private readonly fogOverlay: Graphics;
  private readonly fogCutouts: Graphics;
  private readonly fogDebug: Graphics;
  private readonly brushPreview: Graphics;
  private readonly tilePlacementsContainer: Container;
  private readonly tileSpriteMap = new Map<string, TilePlacementSprite>();

  private mapWidth = 0;
  private mapHeight = 0;
  private obfuscateForPlayer = true;

  private currentRegions: FogRegion[] = [];
  private currentReveals: TokenVisionReveal[] = [];
  private currentCellSize = 64;

  constructor() {
    super();
    this.eventMode = 'none';

    this.fogContainer = new Container();
    // A filter forces PixiJS to render this container into its OWN texture before
    // compositing to the main scene. This is the only reliable way to isolate
    // blendMode='erase' so it only erases fogOverlay pixels — not the main scene.
    this.fogContainer.filters = [new AlphaFilter({ alpha: 1 })];
    this.fogContainer.eventMode = 'none';

    this.fogOverlay = new Graphics();
    this.fogOverlay.eventMode = 'none';

    this.fogCutouts = new Graphics();
    this.fogCutouts.eventMode = 'none';
    this.fogCutouts.blendMode = 'erase';

    this.fogDebug = new Graphics();
    this.fogDebug.eventMode = 'none';

    this.brushPreview = new Graphics();
    this.brushPreview.eventMode = 'none';

    this.fogContainer.addChild(this.fogOverlay);
    this.fogContainer.addChild(this.fogCutouts);

    // Tile placements sit above fog — rendered after the fog composite
    this.tilePlacementsContainer = new Container();
    this.tilePlacementsContainer.sortableChildren = true;

    this.addChild(this.fogContainer);
    this.addChild(this.fogDebug);
    this.addChild(this.brushPreview);
    this.addChild(this.tilePlacementsContainer);
  }

  setMapBounds(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  setObfuscationEnabled(enabled: boolean): void {
    this.obfuscateForPlayer = enabled;
  }

  setViewMode(mode: 'dm' | 'player'): void {
    this.setObfuscationEnabled(mode === 'player');
  }

  setBrushPreview(vertices: FogVertex[] | null): void {
    this.brushPreview.clear();
    if (!vertices || vertices.length < 3) return;

    this.drawPolygon(this.brushPreview, vertices, 0x79c7ff, 0.12, 0x79c7ff, 0.95, 2);
  }

  setFogRegions(regions: FogRegion[]): void {
    this.currentRegions = regions;
    this.redrawAll();
  }

  /**
   * Render token vision reveals as circular cutouts punched into the fog overlay.
   * Circles are drawn into the same fogCutouts Graphics as fog-region polygons so
   * they share the same erase blend context and correctly reveal the map underneath.
   *
   * @param reveals  - Array of token vision reveal payloads from the server.
   * @param cellSize - Current grid cell size in pixels.
   */
  setTokenVisionReveals(reveals: TokenVisionReveal[], cellSize: number): void {
    this.currentReveals = reveals;
    this.currentCellSize = cellSize;
    this.redrawAll();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private redrawAll(): void {
    this.fogOverlay.clear();
    this.fogCutouts.clear();
    this.fogDebug.clear();

    if (this.mapWidth <= 0 || this.mapHeight <= 0) return;

    if (this.obfuscateForPlayer) {
      this.fogContainer.visible = true;
      this.fogDebug.visible = false;

      // Fog overlay — solid dark rect covering the entire map.
      this.fogOverlay
        .rect(0, 0, this.mapWidth, this.mapHeight)
        .fill({ color: FOG_OVERLAY_COLOR, alpha: FOG_OVERLAY_ALPHA });

      // Erase-blend cutouts — rendered inside the filter-isolated fogContainer
      // texture, so erase only removes fogOverlay pixels (not the main scene).

      // DM-drawn fog region reveals
      for (const region of this.currentRegions) {
        if (region.vertices.length < 3) continue;
        this.drawPolygon(this.fogCutouts, region.vertices, 0xffffff, 1);
      }

      // Token vision circles
      for (const reveal of this.currentReveals) {
        const centerX = reveal.x * this.currentCellSize + this.currentCellSize / 2;
        const centerY = reveal.y * this.currentCellSize + this.currentCellSize / 2;
        const radius = reveal.visionRadius * this.currentCellSize;
        this.fogCutouts.circle(centerX, centerY, radius).fill({ color: 0xffffff, alpha: 1 });
      }

      return;
    }

    // DM view: no fog, just guide outlines for drawn regions.
    this.fogContainer.visible = false;
    this.fogDebug.visible = true;

    for (const region of this.currentRegions) {
      if (region.vertices.length < 3) continue;
      this.drawPolygon(this.fogDebug, region.vertices, 0x5eff95, 0.08, 0x5eff95, 0.9, 1.5);
    }
  }

  private drawPolygon(
    target: Graphics,
    vertices: FogVertex[],
    fillColor: number,
    fillAlpha: number,
    strokeColor?: number,
    strokeAlpha = 1,
    strokeWidth = 1,
  ): void {
    const first = vertices[0];
    target.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i += 1) {
      const point = vertices[i];
      target.lineTo(point.x, point.y);
    }
    target.closePath();
    target.fill({ color: fillColor, alpha: fillAlpha });

    if (strokeColor !== undefined) {
      target.moveTo(first.x, first.y);
      for (let i = 1; i < vertices.length; i += 1) {
        const point = vertices[i];
        target.lineTo(point.x, point.y);
      }
      target.closePath();
      target.stroke({ color: strokeColor, alpha: strokeAlpha, width: strokeWidth });
    }
  }

  // ---------------------------------------------------------------------------
  // Tile placement management
  // ---------------------------------------------------------------------------

  addTilePlacement(sprite: TilePlacementSprite): void {
    this.removeTilePlacement(sprite.placementId);
    this.tileSpriteMap.set(sprite.placementId, sprite);
    this.tilePlacementsContainer.addChild(sprite);
  }

  removeTilePlacement(id: string): void {
    const existing = this.tileSpriteMap.get(id);
    if (existing) {
      existing.destroy();
      this.tileSpriteMap.delete(id);
    }
  }

  clearTilePlacements(): void {
    for (const id of this.tileSpriteMap.keys()) {
      this.removeTilePlacement(id);
    }
  }

  getTilePlacementSprite(id: string): TilePlacementSprite | undefined {
    return this.tileSpriteMap.get(id);
  }

  iterateTilePlacements(cb: (sprite: TilePlacementSprite) => void): void {
    for (const sprite of this.tileSpriteMap.values()) cb(sprite);
  }

  iterateTilePlacementIds(cb: (id: string) => void): void {
    for (const id of this.tileSpriteMap.keys()) cb(id);
  }
}
