import { AlphaFilter, Container, Graphics, Sprite } from 'pixi.js';

import type {
    FogMaskConfig,
    FogRegion,
    FogVertex,
    TokenVisionReveal,
    VisibilityPolygon,
    VisionStamp,
} from '@vtt/shared';
import {
    DEFAULT_FOG_MASK_CONFIG,
    FOG_OVERLAY_ALPHA,
    FOG_OVERLAY_COLOR,
    PERIPHERAL_DARKNESS_ALPHA,
} from '@vtt/shared';

import type { TilePlacementSprite } from './TilePlacementSprite';
import { FogMaskService, type FogMaskRenderer } from './fog/FogMaskService';
import {
    buildPeripheralStamps,
    resolveActiveVision,
    resolveExploredStamps,
    type ActiveVision,
} from './fog/fog-mask-math';
import { applyMapClip, type MapClipBounds } from './map-clip';

/**
 * ForegroundLayer — highest z-index.
 * Reserved for fog of war, weather effects, and lighting overlays (Phase 4F+).
 *
 * Two fog renderers live here, selected by `FogMaskConfig.fogMode`:
 *
 * `legacy` (Phase 4F) — CPU polygon compositing:
 *   fogContainer (filters=[AlphaFilter(1)] — forces isolated render texture)
 *     ├─ fogOverlay  – solid dark rect covering the whole map
 *     └─ fogCutouts  – blendMode='erase'; draws revealed polygons + vision circles
 *   peripheralContainer (isolated, peripheral vision only)
 *     ├─ peripheralOverlay – opaque rect
 *     └─ peripheralCutouts – erases reveals + wall-ignoring peripheral circles
 *
 * `pm2` (Phase PM2) — GPU RenderTexture mask compositing:
 *   pm2Container
 *     ├─ hiddenGroup (isolated)  – dark rect erased by the EXPLORED mask
 *     └─ shroudGroup (isolated)  – dark rect erased by the ACTIVE mask
 *   Never-explored pixels receive both layers (darkest), explored-but-unseen
 *   pixels receive only the shroud, and actively visible pixels receive neither.
 *
 * Applying any Filter forces PixiJS to render the container into its own texture
 * before compositing to the main scene. `erase` therefore only removes that
 * group's overlay pixels, leaving transparent holes that reveal the Background +
 * Playground layers underneath.
 *
 * Masks are built in world space and live inside the world container, so pan and
 * zoom stay aligned without recomputing the texture.
 */
export class ForegroundLayer extends Container {
  /** Isolated render group — fog composites here before the main scene. */
  private readonly fogContainer: Container;
  private readonly fogOverlay: Graphics;
  private readonly fogCutouts: Graphics;
  private readonly peripheralContainer: Container;
  private readonly peripheralOverlay: Graphics;
  private readonly peripheralCutouts: Graphics;
  private readonly fogDebug: Graphics;
  private readonly brushPreview: Graphics;
  private readonly pm2Container: Container;
  private readonly tilePlacementsContainer: Container;
  private readonly tileClipMask: Graphics;
  private readonly tileSpriteMap = new Map<string, TilePlacementSprite>();

  private maskService: FogMaskService | null = null;
  private hiddenOverlay: Graphics | null = null;
  private shroudOverlay: Graphics | null = null;
  private exploredMaskSprite: Sprite | null = null;
  private activeMaskSprite: Sprite | null = null;

  private mapWidth = 0;
  private mapHeight = 0;
  private obfuscateForPlayer = true;
  // Editor mode shows the whole map regardless of fog state or DM preview mode
  private fogSuppressed = false;

  private currentRegions: FogRegion[] = [];
  private currentReveals: TokenVisionReveal[] = [];
  private visibilityPolygons: VisibilityPolygon[] = [];
  private currentCellSize = 64;
  private fogConfig: FogMaskConfig = { ...DEFAULT_FOG_MASK_CONFIG };
  private explorationStamps: VisionStamp[] = [];

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

    this.peripheralContainer = new Container();
    this.peripheralContainer.filters = [new AlphaFilter({ alpha: 1 })];
    this.peripheralContainer.eventMode = 'none';
    this.peripheralContainer.visible = false;

    this.peripheralOverlay = new Graphics();
    this.peripheralOverlay.eventMode = 'none';

    this.peripheralCutouts = new Graphics();
    this.peripheralCutouts.eventMode = 'none';
    this.peripheralCutouts.blendMode = 'erase';

    this.peripheralContainer.addChild(this.peripheralOverlay);
    this.peripheralContainer.addChild(this.peripheralCutouts);

    // PM2 mask groups are populated lazily once a renderer is attached.
    this.pm2Container = new Container();
    this.pm2Container.eventMode = 'none';
    this.pm2Container.visible = false;

    // Tile placements sit above fog — rendered after the fog composite
    this.tilePlacementsContainer = new Container();
    this.tilePlacementsContainer.sortableChildren = true;

    this.tileClipMask = new Graphics();
    this.tileClipMask.eventMode = 'none';

    this.addChild(this.fogContainer);
    this.addChild(this.peripheralContainer);
    this.addChild(this.pm2Container);
    this.addChild(this.fogDebug);
    this.addChild(this.brushPreview);
    this.addChild(this.tilePlacementsContainer);
    this.addChild(this.tileClipMask);
  }

  /**
   * Provide the PixiJS renderer used to compose fog mask textures. Required
   * before `fogMode: 'pm2'` can render; without it the layer stays on the
   * legacy polygon path.
   */
  attachRenderer(renderer: FogMaskRenderer): void {
    if (this.maskService) return;

    this.maskService = new FogMaskService(renderer);
    this.maskService.setConfig(this.fogConfig);

    const hiddenGroup = new Container();
    hiddenGroup.eventMode = 'none';
    hiddenGroup.filters = [new AlphaFilter({ alpha: 1 })];
    this.hiddenOverlay = new Graphics();
    this.exploredMaskSprite = new Sprite();
    this.exploredMaskSprite.blendMode = 'erase';
    hiddenGroup.addChild(this.hiddenOverlay);
    hiddenGroup.addChild(this.exploredMaskSprite);

    const shroudGroup = new Container();
    shroudGroup.eventMode = 'none';
    shroudGroup.filters = [new AlphaFilter({ alpha: 1 })];
    this.shroudOverlay = new Graphics();
    this.activeMaskSprite = new Sprite();
    this.activeMaskSprite.blendMode = 'erase';
    shroudGroup.addChild(this.shroudOverlay);
    shroudGroup.addChild(this.activeMaskSprite);

    this.pm2Container.addChild(hiddenGroup);
    this.pm2Container.addChild(shroudGroup);

    this.redrawAll();
  }

  setMapBounds(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    if (this.maskService) {
      // resize() allocates blank textures — recompose immediately so PM2 fog is
      // never left fully opaque between a map load and the next fog event.
      this.maskService.resize(width, height);
      this.redrawAll();
    }
  }

  setFogMaskConfig(config: FogMaskConfig): void {
    this.fogConfig = { ...config };
    this.maskService?.setConfig(this.fogConfig);
    this.redrawAll();
  }

  getFogMaskConfig(): FogMaskConfig {
    return this.fogConfig;
  }

  /** Persisted explored areas in world pixel space (Phase PM2). */
  setExplorationStamps(stamps: VisionStamp[]): void {
    this.explorationStamps = stamps;
    this.redrawAll();
  }

  /** Duration of the most recent PM2 mask recomposition, in milliseconds. */
  getFogCompositionMs(): number {
    return this.maskService?.getLastCompositionMs() ?? 0;
  }

  setObfuscationEnabled(enabled: boolean): void {
    this.obfuscateForPlayer = enabled;
  }

  setViewMode(mode: 'dm' | 'player'): void {
    this.setObfuscationEnabled(mode === 'player');
  }

  /** Hide all fog (and DM fog guides) without discarding fog state. */
  setFogSuppressed(suppressed: boolean): void {
    if (this.fogSuppressed === suppressed) return;
    this.fogSuppressed = suppressed;
    this.redrawAll();
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

  /**
   * Line-of-sight polygons (Phase PM3). A reveal with a matching polygon is
   * drawn as that polygon instead of its circle, in both fog renderers.
   */
  setVisibilityPolygons(polygons: VisibilityPolygon[]): void {
    this.visibilityPolygons = polygons;
    this.redrawAll();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private redrawAll(): void {
    this.fogOverlay.clear();
    this.fogCutouts.clear();
    this.peripheralOverlay.clear();
    this.peripheralCutouts.clear();
    this.peripheralContainer.visible = false;
    this.fogDebug.clear();

    const usePm2 = this.fogConfig.fogMode === 'pm2' && this.maskService !== null;
    this.pm2Container.visible = false;

    if (this.mapWidth <= 0 || this.mapHeight <= 0) return;

    if (this.fogSuppressed) {
      this.fogContainer.visible = false;
      this.fogDebug.visible = false;
      return;
    }

    this.pm2Container.visible = usePm2 && this.obfuscateForPlayer;

    if (usePm2) {
      this.fogContainer.visible = false;
      if (this.obfuscateForPlayer) {
        this.fogDebug.visible = false;
        this.redrawPm2();
        return;
      }
      this.drawDmGuides();
      return;
    }

    if (this.obfuscateForPlayer) {
      this.fogContainer.visible = true;
      this.fogDebug.visible = false;

      const peripheral = this.fogConfig.peripheralVisionRadius > 0;

      // Fog overlay — solid dark rect covering the entire map.
      this.fogOverlay
        .rect(0, 0, this.mapWidth, this.mapHeight)
        .fill({
          color: FOG_OVERLAY_COLOR,
          alpha: peripheral ? this.fogConfig.peripheralShroudAlpha : FOG_OVERLAY_ALPHA,
        });

      // Erase-blend cutouts — rendered inside the filter-isolated fogContainer
      // texture, so erase only removes fogOverlay pixels (not the main scene).
      const vision = resolveActiveVision(
        this.currentReveals,
        this.visibilityPolygons,
        this.currentCellSize,
      );
      this.drawRevealCutouts(this.fogCutouts, vision);

      if (peripheral) {
        this.peripheralContainer.visible = true;
        this.peripheralOverlay
          .rect(0, 0, this.mapWidth, this.mapHeight)
          .fill({ color: FOG_OVERLAY_COLOR, alpha: PERIPHERAL_DARKNESS_ALPHA });
        this.drawRevealCutouts(this.peripheralCutouts, vision);
        for (const stamp of buildPeripheralStamps(
          this.currentReveals,
          this.fogConfig.peripheralVisionRadius,
          this.currentCellSize,
        )) {
          this.peripheralCutouts
            .circle(stamp.x, stamp.y, stamp.radius)
            .fill({ color: 0xffffff, alpha: 1 });
        }
      }

      return;
    }

    this.fogContainer.visible = false;
    this.drawDmGuides();
  }

  /** DM-drawn regions, then token vision (LOS polygons where obstructed, circles elsewhere). */
  private drawRevealCutouts(target: Graphics, vision: ActiveVision): void {
    for (const region of this.currentRegions) {
      if (region.vertices.length < 3) continue;
      this.drawPolygon(target, region.vertices, 0xffffff, 1);
    }
    for (const points of vision.polygons) {
      this.drawPolygon(target, points, 0xffffff, 1);
    }
    for (const stamp of vision.stamps) {
      target.circle(stamp.x, stamp.y, stamp.radius).fill({ color: 0xffffff, alpha: 1 });
    }
  }

  /** DM view: no fog, just guide outlines for drawn regions. */
  private drawDmGuides(): void {
    this.fogDebug.visible = true;

    for (const region of this.currentRegions) {
      if (region.vertices.length < 3) continue;
      this.drawPolygon(this.fogDebug, region.vertices, 0x5eff95, 0.08, 0x5eff95, 0.9, 1.5);
    }
  }

  private redrawPm2(): void {
    const maskService = this.maskService;
    const hiddenOverlay = this.hiddenOverlay;
    const shroudOverlay = this.shroudOverlay;
    const activeSprite = this.activeMaskSprite;
    const exploredSprite = this.exploredMaskSprite;

    if (!maskService || !hiddenOverlay || !shroudOverlay || !activeSprite || !exploredSprite) {
      return;
    }

    maskService.resize(this.mapWidth, this.mapHeight);

    const vision = resolveActiveVision(
      this.currentReveals,
      this.visibilityPolygons,
      this.currentCellSize,
    );
    const peripheral = this.fogConfig.peripheralVisionRadius > 0;
    // Peripheral circles join the explored mask: that area drops to the shroud
    // tint while the hidden layer (forced opaque) blacks out everything else.
    const peripheralStamps = peripheral
      ? buildPeripheralStamps(
          this.currentReveals,
          this.fogConfig.peripheralVisionRadius,
          this.currentCellSize,
        )
      : [];
    const exploredStamps = [
      ...resolveExploredStamps(this.fogConfig, vision.stamps, this.explorationStamps),
      ...peripheralStamps,
    ];

    maskService.update({
      activeStamps: vision.stamps,
      exploredStamps,
      regions: this.currentRegions,
      visibilityPolygons: vision.polygons,
    });

    hiddenOverlay
      .clear()
      .rect(0, 0, this.mapWidth, this.mapHeight)
      .fill({
        color: FOG_OVERLAY_COLOR,
        alpha: peripheral ? PERIPHERAL_DARKNESS_ALPHA : this.fogConfig.hiddenAlpha,
      });

    shroudOverlay
      .clear()
      .rect(0, 0, this.mapWidth, this.mapHeight)
      .fill({
        color: FOG_OVERLAY_COLOR,
        alpha: peripheral ? this.fogConfig.peripheralShroudAlpha : this.fogConfig.shroudAlpha,
      });

    // Masks are authored at maskScale; scale the sprites back up to world size so
    // the reveal stays pinned to world coordinates under pan and zoom.
    const scale = maskService.maskScale;
    const inverseScale = scale > 0 ? 1 / scale : 1;

    const exploredTexture = maskService.exploredMaskTexture;
    if (exploredTexture) exploredSprite.texture = exploredTexture;
    exploredSprite.position.set(0, 0);
    exploredSprite.scale.set(inverseScale, inverseScale);

    const activeTexture = maskService.activeMaskTexture;
    if (activeTexture) activeSprite.texture = activeTexture;
    activeSprite.position.set(0, 0);
    activeSprite.scale.set(inverseScale, inverseScale);
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

  /** Hide tile art outside the map rectangle; null removes the clip. */
  setTileClip(bounds: MapClipBounds | null): void {
    applyMapClip(this.tilePlacementsContainer, this.tileClipMask, bounds);
  }

  /** Foreground tile art only (no fog) — snapshot target for editor 5H thumbnails. */
  get tilePlacementsView(): Container {
    return this.tilePlacementsContainer;
  }

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

  /** Releases the PM2 mask textures and display objects before teardown. */
  destroyFogMask(): void {
    if (!this.maskService) return;

    this.maskService.destroy();
    this.maskService = null;

    for (const group of [...this.pm2Container.children]) {
      group.destroy({ children: true });
    }
    this.pm2Container.removeChildren();
    this.pm2Container.visible = false;

    this.hiddenOverlay = null;
    this.shroudOverlay = null;
    this.activeMaskSprite = null;
    this.exploredMaskSprite = null;
  }
}
