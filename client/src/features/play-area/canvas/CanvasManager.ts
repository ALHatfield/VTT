import type { FederatedPointerEvent } from 'pixi.js';
import { Application, Assets, Container, Graphics } from 'pixi.js';

import type {
  AssetCategory,
  CampaignRole,
  FogMaskConfig,
  FogRegion,
  FogVertex,
  GridConfig,
  MapData,
  TileAsset,
  TilePlacement,
  Token,
  TokenVisionReveal,
  ViewportBounds,
  VisionStamp,
} from '@vtt/shared';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_FACTOR } from '@vtt/shared';

import { BackgroundLayer } from './BackgroundLayer';
import { ForegroundLayer } from './ForegroundLayer';
import { PlaygroundLayer } from './PlaygroundLayer';
import { TilePlacementSprite } from './TilePlacementSprite';
import { snapToGrid } from './grid-utils';
import { rectFromPoints, rectsIntersect } from './selection-utils';
import { getViewportBounds } from './viewport-culling';

export interface CanvasManagerOptions {
  background?: number;
}

// Marquee rectangle appearance
const MARQUEE_FILL_COLOR = 0x4fc3f7;
const MARQUEE_FILL_ALPHA = 0.15;
const MARQUEE_BORDER_COLOR = 0x4fc3f7;
const MARQUEE_BORDER_ALPHA = 0.9;
const MARQUEE_BORDER_WIDTH = 1;

/** Minimum drag distance (px, screen space) before a stage drag is treated as a marquee. */
const MARQUEE_ACTIVATION_THRESHOLD = 4;

export type ToolMode =
  | 'select'
  | 'pan'
  | 'measure'
  | 'fog-reveal'
  | 'fog-hide'
  | 'npc-place'
  | 'draw-freehand'
  | 'draw-shape';

export class CanvasManager {
  private readonly app: Application;
  private readonly worldContainer: Container;
  readonly backgroundLayer: BackgroundLayer;
  readonly playgroundLayer: PlaygroundLayer;
  readonly foregroundLayer: ForegroundLayer;

  private currentMapData: MapData | null = null;
  private currentCellSize = 64;

  // Currently selected tile placements. Set-based to support Shift+click and marquee.
  private readonly selectedTilePlacementIds = new Set<string>();

  // Locked tile placements — interactions are disabled for these even in editor mode.
  private readonly lockedTilePlacementIds = new Set<string>();

  // Editor mode flag — gates marquee behaviour so it only runs in editor mode.
  private editorModeEnabled = false;

  // Token drag state — used by PlayArea to suppress panning during token drag
  private _isDraggingToken = false;

  // Middle-mouse pan state — handled natively on the canvas to avoid interfering with PixiJS
  private panActive = false;
  private panLastX = 0;
  private panLastY = 0;
  private readonly handlePanPointerDown = (e: PointerEvent): void => {
    if (e.button !== 1) return;
    e.preventDefault(); // suppress browser autoscroll cursor
    this.panActive = true;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
    this.app.canvas.setPointerCapture(e.pointerId);
  };
  private readonly handlePanPointerMove = (e: PointerEvent): void => {
    if (!this.panActive) return;
    const dx = e.clientX - this.panLastX;
    const dy = e.clientY - this.panLastY;
    this.panLastX = e.clientX;
    this.panLastY = e.clientY;
    this.pan(dx, dy);
  };
  private readonly handlePanPointerUp = (e: PointerEvent): void => {
    if (e.button !== 1) return;
    this.panActive = false;
  };

  // Right-click pan — global behavior available in all tool modes
  private rightPanActive = false;
  private rightPanLastX = 0;
  private rightPanLastY = 0;
  private readonly handleRightPanPointerDown = (e: PointerEvent): void => {
    if (e.button !== 2) return;
    e.preventDefault();
    this.rightPanActive = true;
    this.rightPanLastX = e.clientX;
    this.rightPanLastY = e.clientY;
    this.app.canvas.setPointerCapture(e.pointerId);
  };
  private readonly handleRightPanPointerMove = (e: PointerEvent): void => {
    if (!this.rightPanActive) return;
    const dx = e.clientX - this.rightPanLastX;
    const dy = e.clientY - this.rightPanLastY;
    this.rightPanLastX = e.clientX;
    this.rightPanLastY = e.clientY;
    this.pan(dx, dy);
  };
  private readonly handleRightPanPointerUp = (e: PointerEvent): void => {
    if (e.button !== 2) return;
    this.rightPanActive = false;
  };

  // Current canvas tool mode — controls pointer behavior in play mode
  private currentToolMode: ToolMode = 'select';

  // Native left-click background detection — belt-and-suspenders alongside the PixiJS stage
  // handler. Uses rootBoundary.hitTest so it works even when PixiJS doesn't dispatch stage
  // events for empty-canvas clicks (e.g. when no interactive child bounds cover the point).
  private nativeLeftDownX = 0;
  private nativeLeftDownY = 0;
  private readonly handleNativePointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.nativeLeftDownX = e.clientX;
    this.nativeLeftDownY = e.clientY;
  };
  private readonly handleNativePointerUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (!this.editorModeEnabled) return;
    if (this.selectedTilePlacementIds.size === 0) return;
    if (e.shiftKey) return;

    const dx = e.clientX - this.nativeLeftDownX;
    const dy = e.clientY - this.nativeLeftDownY;
    if (Math.hypot(dx, dy) >= CanvasManager.CLICK_THRESHOLD) return;

    // Ask PixiJS which object is under the cursor. If it isn't a tile sprite, the
    // click landed on empty canvas (or a token/non-tile object) → deselect tiles.
    const rect = this.app.canvas.getBoundingClientRect();
    const hit = this.app.renderer.events.rootBoundary.hitTest(
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
    if (!(hit instanceof TilePlacementSprite)) {
      this.clearTileSelection();
    }
  };

  // Arrow-key nudge — active only in editor mode when tiles are selected.
  // Plain arrow = 1px fine-tune; Shift+arrow = one full grid cell.
  private readonly handleArrowKey = (e: KeyboardEvent): void => {
    if (!this.editorModeEnabled) return;
    if (this.selectedTilePlacementIds.size === 0) return;

    let dx = 0;
    let dy = 0;
    const step = e.shiftKey ? this.currentCellSize : 1;
    switch (e.key) {
      case 'ArrowLeft':
        dx = -step;
        break;
      case 'ArrowRight':
        dx = step;
        break;
      case 'ArrowUp':
        dy = -step;
        break;
      case 'ArrowDown':
        dy = step;
        break;
      default:
        return;
    }

    e.preventDefault(); // prevent the browser from scrolling the page

    for (const id of this.selectedTilePlacementIds) {
      const sprite =
        this.backgroundLayer.getTilePlacementSprite(id) ??
        this.playgroundLayer.getTilePlacementSprite(id) ??
        this.foregroundLayer.getTilePlacementSprite(id);
      if (!sprite) continue;
      sprite.x += dx;
      sprite.y += dy;
      this.onTileMoveEnd?.(id, sprite.x, sprite.y);
    }
  };

  // Background click: fire only when pointer didn't travel more than CLICK_THRESHOLD pixels
  private static readonly CLICK_THRESHOLD = 4;
  private backgroundDownX = 0;
  private backgroundDownY = 0;
  private backgroundDownShift = false;
  private backgroundPointerActive = false;

  // Marquee state — rubber-band selection rectangle drawn on the world container.
  private marqueeGraphic: Graphics | null = null;
  private marqueeActive = false;
  private marqueeStartWorldX = 0;
  private marqueeStartWorldY = 0;
  private marqueeEndWorldX = 0;
  private marqueeEndWorldY = 0;

  private readonly handleStagePointerDown = (e: FederatedPointerEvent): void => {
    // Tile and token sprites call e.stopPropagation() in their own pointerdown
    // handlers, so this handler only fires for genuine empty-canvas clicks.
    this.backgroundDownX = e.global.x;
    this.backgroundDownY = e.global.y;
    this.backgroundDownShift = e.shiftKey;
    this.backgroundPointerActive = true;

    // Start a potential marquee in editor mode OR play-mode select tool.
    const canMarquee = this.editorModeEnabled || this.currentToolMode === 'select';
    if (canMarquee) {
      const start = this.screenToWorld(e.global.x, e.global.y);
      this.marqueeStartWorldX = start.x;
      this.marqueeStartWorldY = start.y;
      this.marqueeEndWorldX = start.x;
      this.marqueeEndWorldY = start.y;
    }
  };

  private readonly handleStagePointerMove = (e: FederatedPointerEvent): void => {
    if (!this.backgroundPointerActive) return;
    const canMarquee = this.editorModeEnabled || this.currentToolMode === 'select';
    if (!canMarquee) return;
    const dx = e.global.x - this.backgroundDownX;
    const dy = e.global.y - this.backgroundDownY;
    if (!this.marqueeActive && Math.hypot(dx, dy) < MARQUEE_ACTIVATION_THRESHOLD) return;

    if (!this.marqueeActive) {
      this.marqueeActive = true;
      this.ensureMarqueeGraphic();
    }

    const world = this.screenToWorld(e.global.x, e.global.y);
    this.marqueeEndWorldX = world.x;
    this.marqueeEndWorldY = world.y;
    this.redrawMarquee();
  };

  private readonly handleStagePointerUp = (e: FederatedPointerEvent): void => {
    // Only fire when the pointerdown originated on the stage itself
    if (!this.backgroundPointerActive) return;
    this.backgroundPointerActive = false;

    if (this.marqueeActive) {
      // Marquee drag completed — apply selection to intersecting sprites.
      if (this.editorModeEnabled) {
        this.commitMarqueeSelection(this.backgroundDownShift);
      } else {
        this.commitTokenMarqueeSelection();
      }
      this.clearMarqueeGraphic();
      this.marqueeActive = false;
      return;
    }

    const dx = e.global.x - this.backgroundDownX;
    const dy = e.global.y - this.backgroundDownY;
    if (Math.hypot(dx, dy) < CanvasManager.CLICK_THRESHOLD) {
      // Background click. In editor mode, clear tile selection (unless Shift held
      // — preserves selection while the user adds via subsequent Shift+click).
      if (
        this.editorModeEnabled &&
        !this.backgroundDownShift &&
        this.selectedTilePlacementIds.size > 0
      ) {
        this.clearTileSelection();
      }
      this.onBackgroundClick?.();
    }
  };

  // Callbacks registered by PlayArea
  onTokenMove?: (tokenId: string, gridX: number, gridY: number) => void;
  onTokenHoverChange?: (
    tokenId: string,
    entering: boolean,
    canvasX: number,
    canvasY: number,
  ) => void;
  onTokenClick?: (tokenId: string) => void;
  onBackgroundClick?: () => void;
  onTokenDragStart?: () => void;
  /** Fired when rubber-band selection in play-mode select tool completes. */
  onTokensSelected?: (tokenIds: string[]) => void;

  // Editor-mode callbacks
  onTilePlaced?: (
    assetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    category: AssetCategory,
  ) => void;
  onTileMoveEnd?: (placementId: string, x: number, y: number) => void;
  /**
   * Fired whenever the tile selection changes (single click, Shift+click,
   * marquee, background click that clears selection, or external calls to
   * `setTileSelection` / `clearTileSelection`).
   */
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  onTileResizeEnd?: (placementId: string, width: number, height: number) => void;
  onTileRotate?: (placementId: string, rotation: number) => void;
  onTileDelete?: (placementId: string) => void;
  onTileContextMenu?: (placementId: string, screenX: number, screenY: number) => void;

  constructor() {
    this.app = new Application();
    this.worldContainer = new Container();
    this.backgroundLayer = new BackgroundLayer();
    this.playgroundLayer = new PlaygroundLayer();
    this.foregroundLayer = new ForegroundLayer();
  }

  /** The PixiJS-created canvas element, available after init(). */
  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /** True while a token drag is in progress. PlayArea uses this to suppress map panning. */
  get isDraggingToken(): boolean {
    return this._isDraggingToken;
  }

  async init(container: HTMLElement, options: CanvasManagerOptions = {}): Promise<void> {
    await this.app.init({
      preference: 'webgl',
      resizeTo: container,
      background: options.background ?? 0x1a1a2e,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio ?? 1,
    });

    // Let PixiJS own the canvas element — append to the React container div
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    container.appendChild(this.app.canvas);

    this.worldContainer.addChild(this.backgroundLayer);
    this.worldContainer.addChild(this.playgroundLayer);
    this.worldContainer.addChild(this.foregroundLayer);
    this.app.stage.addChild(this.worldContainer);

    // PM2 fog masks are composed with the live renderer into RenderTextures.
    this.foregroundLayer.attachRenderer(this.app.renderer);

    // Stage-level background click — fires only when no token sprite stops propagation.
    // Uses pointerup + distance guard so pan gestures don't clear selection.
    this.app.stage.eventMode = 'static';
    this.app.stage.on('pointerdown', this.handleStagePointerDown);
    this.app.stage.on('globalpointermove', this.handleStagePointerMove);
    this.app.stage.on('pointerup', this.handleStagePointerUp);
    this.app.stage.on('pointerupoutside', this.handleStagePointerUp);

    // Middle-mouse canvas pan — native DOM listeners so they don't interfere with
    // PixiJS's federated event system used for token/tile selection.
    this.app.canvas.addEventListener('pointerdown', this.handlePanPointerDown);
    this.app.canvas.addEventListener('pointermove', this.handlePanPointerMove);
    this.app.canvas.addEventListener('pointerup', this.handlePanPointerUp);
    // Right-click pan — global across all tool modes
    this.app.canvas.addEventListener('pointerdown', this.handleRightPanPointerDown);
    this.app.canvas.addEventListener('pointermove', this.handleRightPanPointerMove);
    this.app.canvas.addEventListener('pointerup', this.handleRightPanPointerUp);
    // Native left-click handler for reliable empty-canvas deselection.
    this.app.canvas.addEventListener('pointerdown', this.handleNativePointerDown);
    this.app.canvas.addEventListener('pointerup', this.handleNativePointerUp);
  }

  async loadMap(mapData: MapData): Promise<void> {
    this.currentMapData = mapData;
    this.currentCellSize = mapData.gridConfig.cellSize;
    // Center/zoom synchronously first so tokens added in the same React flush
    // appear at the correct scale before the background image finishes loading.
    this.centerMap(mapData.width, mapData.height);
    this.playgroundLayer.drawGrid(mapData.width, mapData.height, mapData.gridConfig);
    this.foregroundLayer.setMapBounds(mapData.width, mapData.height);
    await this.backgroundLayer.loadMap(mapData);
  }

  private centerMap(mapWidth: number, mapHeight: number): void {
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const zoom = Math.min(screenW / mapWidth, screenH / mapHeight, 1);
    this.worldContainer.scale.set(zoom);
    this.worldContainer.x = (screenW - mapWidth * zoom) / 2;
    this.worldContainer.y = (screenH - mapHeight * zoom) / 2;
  }

  pan(dx: number, dy: number): void {
    this.worldContainer.x += dx;
    this.worldContainer.y += dy;
  }

  zoom(delta: number, centerX: number, centerY: number): void {
    const currentZoom = this.worldContainer.scale.x;
    const factor = delta > 0 ? 1 + ZOOM_FACTOR : 1 - ZOOM_FACTOR;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));

    // Zoom toward the cursor position
    const worldX = (centerX - this.worldContainer.x) / currentZoom;
    const worldY = (centerY - this.worldContainer.y) / currentZoom;
    this.worldContainer.scale.set(newZoom);
    this.worldContainer.x = centerX - worldX * newZoom;
    this.worldContainer.y = centerY - worldY * newZoom;
  }

  setGridConfig(config: GridConfig): void {
    if (!this.currentMapData) return;
    this.currentMapData = { ...this.currentMapData, gridConfig: config };
    this.playgroundLayer.drawGrid(this.currentMapData.width, this.currentMapData.height, config);
  }

  getViewportBounds(): ViewportBounds {
    return getViewportBounds(
      this.app.screen.width,
      this.app.screen.height,
      this.worldContainer.x,
      this.worldContainer.y,
      this.worldContainer.scale.x,
    );
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  /**
   * Render a full token list on the playground layer.
   * `userId` and `userRole` determine which tokens are interactive.
   */
  setTokens(tokens: Token[], userId: string, userRole: CampaignRole): void {
    const cellSize = this.currentCellSize;

    this.playgroundLayer.setTokens(
      tokens,
      cellSize,
      (token) => this.canUserInteractWithToken(token, userId, userRole),
      (tokenId, gridX, gridY) => this.onTokenMove?.(tokenId, gridX, gridY),
      (tokenId, entering, canvasX, canvasY) =>
        this.onTokenHoverChange?.(tokenId, entering, canvasX, canvasY),
      (dragging) => {
        this._isDraggingToken = dragging;
      },
      (tokenId) => this.onTokenClick?.(tokenId),
      () => this.onTokenDragStart?.(),
    );
  }

  /** Show or hide the selection ring on a specific token sprite. */
  setTokenSelected(tokenId: string | null, previousId: string | null): void {
    if (previousId) this.playgroundLayer.setTokenSelected(previousId, false);
    if (tokenId) this.playgroundLayer.setTokenSelected(tokenId, true);
  }

  /** Show the active-turn highlight on the current initiative token. */
  setActiveTokenId(tokenId: string | null): void {
    this.playgroundLayer.setActiveTokenId(tokenId);
  }

  /** Set visual selection state for a set of token IDs (clears previous selection first). */
  setTokensSelected(tokenIds: ReadonlySet<string>, previousIds: ReadonlySet<string>): void {
    for (const id of previousIds) {
      if (!tokenIds.has(id)) this.playgroundLayer.setTokenSelected(id, false);
    }
    for (const id of tokenIds) {
      this.playgroundLayer.setTokenSelected(id, true);
    }
  }

  /** Sync an updated token's position without re-rendering. */
  syncTokenPosition(token: Token): void {
    this.playgroundLayer.syncTokenPosition(token);
  }

  /** Remove all token sprites. */
  clearTokens(): void {
    this.playgroundLayer.clearTokens();
  }

  private canUserInteractWithToken(token: Token, userId: string, userRole: CampaignRole): boolean {
    if (userRole === 'dm') return true;
    if (userRole === 'player' && token.ownerId === userId) return true;
    return false;
  }

  setFogRegions(regions: FogRegion[], obfuscateForPlayer: boolean): void {
    this.foregroundLayer.setViewMode(obfuscateForPlayer ? 'player' : 'dm');
    this.foregroundLayer.setFogRegions(regions);
  }

  /** Render circular vision reveals around token positions on the fog layer. */
  setTokenVisionReveals(reveals: TokenVisionReveal[]): void {
    this.foregroundLayer.setTokenVisionReveals(reveals, this.currentCellSize);
  }

  /** Apply the scene's PM2 fog mask configuration (Phase PM2). */
  setFogMaskConfig(config: FogMaskConfig): void {
    this.foregroundLayer.setFogMaskConfig(config);
  }

  /** Apply persisted explored areas for the scene (Phase PM2). */
  setFogExploration(stamps: VisionStamp[]): void {
    this.foregroundLayer.setExplorationStamps(stamps);
  }

  /** Duration of the most recent PM2 fog mask recomposition, in milliseconds. */
  getFogCompositionMs(): number {
    return this.foregroundLayer.getFogCompositionMs();
  }

  setFogBrushPreview(vertices: FogVertex[] | null): void {
    this.foregroundLayer.setBrushPreview(vertices);
  }

  screenToWorld(screenX: number, screenY: number): FogVertex {
    const zoom = this.worldContainer.scale.x;
    return {
      x: (screenX - this.worldContainer.x) / zoom,
      y: (screenY - this.worldContainer.y) / zoom,
    };
  }

  /**
   * Convert a canvas-relative drop position to world coordinates with optional grid snapping.
   * @param clientX - pointer clientX from the drag event
   * @param clientY - pointer clientY from the drag event
   * @param rect    - bounding rect of the canvas wrapper element
   * @param snapToGridFlag - when true, snap to nearest cell boundary
   */
  screenToWorldForDrop(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    snapToGridFlag = true,
  ): { x: number; y: number } {
    const zoom = this.worldContainer.scale.x;
    const rawX = (clientX - rect.left - this.worldContainer.x) / zoom;
    const rawY = (clientY - rect.top - this.worldContainer.y) / zoom;
    if (snapToGridFlag) {
      const snapped = snapToGrid(rawX, rawY, this.currentCellSize);
      return { x: snapped.x, y: snapped.y };
    }
    return { x: rawX, y: rawY };
  }

  /**
   * Set the active canvas tool mode. Controls pointer behavior in play mode.
   */
  setToolMode(mode: ToolMode): void {
    this.currentToolMode = mode;
    // Cancel any in-progress marquee when switching modes
    if (this.marqueeActive) {
      this.clearMarqueeGraphic();
      this.marqueeActive = false;
    }
    this.backgroundPointerActive = false;
  }

  /**
   * Enable or disable editor interaction mode.
   * In editor mode, tile placements are interactive and tokens are not.
   * When leaving editor mode, any active selection or marquee is cleared.
   */
  setEditorMode(enabled: boolean): void {
    this.editorModeEnabled = enabled;
    this.setAllTilePlacementsInteractive(enabled);
    if (enabled) {
      window.addEventListener('keydown', this.handleArrowKey);
    } else {
      window.removeEventListener('keydown', this.handleArrowKey);
      if (this.marqueeActive) {
        this.clearMarqueeGraphic();
        this.marqueeActive = false;
      }
      this.backgroundPointerActive = false;
      if (this.selectedTilePlacementIds.size > 0) this.clearTileSelection();
    }
  }

  private setAllTilePlacementsInteractive(interactive: boolean): void {
    this.backgroundLayer.iterateTilePlacements((s) => s.setInteractive(interactive));
    this.playgroundLayer.iterateTilePlacements((s) => s.setInteractive(interactive));
    this.foregroundLayer.iterateTilePlacements((s) => s.setInteractive(interactive));
  }

  /**
   * Sync all tile placements from server data onto the canvas.
   * Removes sprites for placements no longer present, adds new ones.
   */
  async setTilePlacements(
    placements: TilePlacement[],
    assets: Map<string, TileAsset>,
    editorMode: boolean,
  ): Promise<void> {
    const incomingIds = new Set(placements.map((p) => p.id));

    // Clear placements that no longer exist from all layers
    this.removeStalePlacements(incomingIds);

    for (const placement of placements) {
      const asset = assets.get(placement.assetId);
      if (!asset) continue;

      const layer = this.getLayerForCategory(placement.category);
      if (!layer) continue;

      // Update position/transform if sprite already exists
      const existing = layer.getTilePlacementSprite(placement.id);
      if (existing) {
        existing.x = placement.x;
        existing.y = placement.y;
        existing.zIndex = placement.zIndex;
        existing.rotation = (placement.rotation * Math.PI) / 180;
        existing.resize(placement.width, placement.height);
        continue;
      }

      // Create new sprite
      const texture = await Assets.load(asset.url);
      const sprite = new TilePlacementSprite(
        placement.id,
        texture,
        placement.width,
        placement.height,
        this.currentCellSize,
      );
      sprite.x = placement.x;
      sprite.y = placement.y;
      sprite.zIndex = placement.zIndex;
      sprite.rotation = (placement.rotation * Math.PI) / 180;
      sprite.onMoveEnd = (id, x, y) => this.onTileMoveEnd?.(id, x, y);
      sprite.onSelect = (id, additive) => this.handleSpriteSelect(id, additive);
      sprite.onResizeEnd = (id, w, h) => this.onTileResizeEnd?.(id, w, h);
      sprite.onRotate = (id, r) => this.onTileRotate?.(id, r);
      sprite.onDelete = (id) => this.onTileDelete?.(id);
      sprite.onContextMenu = (id, sx, sy) => this.onTileContextMenu?.(id, sx, sy);
      sprite.setInteractive(editorMode);
      sprite.setLocked(this.lockedTilePlacementIds.has(placement.id));
      // Reapply selection visual for sprites that get recreated after a re-sync.
      if (this.selectedTilePlacementIds.has(placement.id)) {
        sprite.setSelected(true);
      }

      layer.addTilePlacement(sprite);
    }
  }

  private removeStalePlacements(keepIds: Set<string>): void {
    const removeFrom = (layer: BackgroundLayer | PlaygroundLayer | ForegroundLayer): void => {
      const toRemove: string[] = [];
      layer.iterateTilePlacementIds((id) => {
        if (!keepIds.has(id)) toRemove.push(id);
      });
      for (const id of toRemove) layer.removeTilePlacement(id);
    };
    removeFrom(this.backgroundLayer);
    removeFrom(this.playgroundLayer);
    removeFrom(this.foregroundLayer);
  }

  private findTilePlacementSprite(id: string): TilePlacementSprite | undefined {
    return (
      this.backgroundLayer.getTilePlacementSprite(id) ??
      this.playgroundLayer.getTilePlacementSprite(id) ??
      this.foregroundLayer.getTilePlacementSprite(id)
    );
  }

  // ---------------------------------------------------------------------------
  // Tile selection (multi-select via Shift+click and marquee drag)
  // ---------------------------------------------------------------------------

  /** Snapshot of the current tile-placement selection. */
  getSelectedTilePlacementIds(): ReadonlySet<string> {
    return new Set(this.selectedTilePlacementIds);
  }

  /**
   * Replace the current selection with the provided ids. Sprite visuals are
   * synced to match. Fires `onSelectionChange` when the selection actually
   * differs from the previous state.
   */
  setTileSelection(ids: ReadonlySet<string>): void {
    const next = new Set(ids);
    // No-op when selection is unchanged
    if (next.size === this.selectedTilePlacementIds.size) {
      let same = true;
      for (const id of next) {
        if (!this.selectedTilePlacementIds.has(id)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    // Deselect sprites that are leaving the selection
    for (const id of this.selectedTilePlacementIds) {
      if (!next.has(id)) this.findTilePlacementSprite(id)?.setSelected(false);
    }
    // Select sprites that are joining the selection
    for (const id of next) {
      if (!this.selectedTilePlacementIds.has(id)) {
        this.findTilePlacementSprite(id)?.setSelected(true);
      }
    }
    this.selectedTilePlacementIds.clear();
    for (const id of next) this.selectedTilePlacementIds.add(id);
    this.emitSelectionChange();
  }

  /** Clear the current tile selection and notify subscribers. */
  clearTileSelection(): void {
    if (this.selectedTilePlacementIds.size === 0) return;
    for (const id of this.selectedTilePlacementIds) {
      this.findTilePlacementSprite(id)?.setSelected(false);
    }
    this.selectedTilePlacementIds.clear();
    this.emitSelectionChange();
  }

  /**
   * Sprite click handler. Additive (Shift held) toggles the sprite in-place;
   * non-additive replaces the selection with just that sprite (or clears when
   * the sprite was already the sole selection — matching the previous toggle
   * behaviour for single-select users).
   */
  private handleSpriteSelect(id: string, additive: boolean): void {
    if (additive) {
      if (this.selectedTilePlacementIds.has(id)) {
        this.selectedTilePlacementIds.delete(id);
        this.findTilePlacementSprite(id)?.setSelected(false);
      } else {
        this.selectedTilePlacementIds.add(id);
        this.findTilePlacementSprite(id)?.setSelected(true);
      }
      this.emitSelectionChange();
      return;
    }

    const wasSoleSelected =
      this.selectedTilePlacementIds.size === 1 && this.selectedTilePlacementIds.has(id);
    // Deselect the current selection visually
    for (const prev of this.selectedTilePlacementIds) {
      this.findTilePlacementSprite(prev)?.setSelected(false);
    }
    this.selectedTilePlacementIds.clear();
    if (!wasSoleSelected) {
      this.selectedTilePlacementIds.add(id);
      this.findTilePlacementSprite(id)?.setSelected(true);
    }
    this.emitSelectionChange();
  }

  private emitSelectionChange(): void {
    this.onSelectionChange?.(new Set(this.selectedTilePlacementIds));
  }

  // ---------------------------------------------------------------------------
  // Marquee (rubber-band) selection
  // ---------------------------------------------------------------------------

  private ensureMarqueeGraphic(): void {
    if (this.marqueeGraphic) return;
    const g = new Graphics();
    g.eventMode = 'none';
    g.zIndex = 1_000_000;
    this.marqueeGraphic = g;
    this.worldContainer.addChild(g);
  }

  private redrawMarquee(): void {
    if (!this.marqueeGraphic) return;
    const rect = rectFromPoints(
      this.marqueeStartWorldX,
      this.marqueeStartWorldY,
      this.marqueeEndWorldX,
      this.marqueeEndWorldY,
    );
    this.marqueeGraphic.clear();
    this.marqueeGraphic.rect(rect.x, rect.y, rect.width, rect.height);
    this.marqueeGraphic.fill({ color: MARQUEE_FILL_COLOR, alpha: MARQUEE_FILL_ALPHA });
    this.marqueeGraphic.stroke({
      color: MARQUEE_BORDER_COLOR,
      alpha: MARQUEE_BORDER_ALPHA,
      width: MARQUEE_BORDER_WIDTH,
    });
  }

  private clearMarqueeGraphic(): void {
    if (!this.marqueeGraphic) return;
    this.worldContainer.removeChild(this.marqueeGraphic);
    this.marqueeGraphic.destroy();
    this.marqueeGraphic = null;
  }

  /**
   * Compute the set of tile sprites whose axis-aligned bounds intersect the
   * marquee rectangle and apply them as the new selection. When `additive` is
   * true, marquee hits are unioned with the current selection.
   */
  private commitMarqueeSelection(additive: boolean): void {
    const marquee = rectFromPoints(
      this.marqueeStartWorldX,
      this.marqueeStartWorldY,
      this.marqueeEndWorldX,
      this.marqueeEndWorldY,
    );

    const hits = new Set<string>();
    const collect = (sprite: TilePlacementSprite): void => {
      if (rectsIntersect(marquee, sprite.getWorldBounds())) hits.add(sprite.placementId);
    };
    this.backgroundLayer.iterateTilePlacements(collect);
    this.playgroundLayer.iterateTilePlacements(collect);
    this.foregroundLayer.iterateTilePlacements(collect);

    const next = additive ? new Set(this.selectedTilePlacementIds) : new Set<string>();
    for (const id of hits) next.add(id);
    this.setTileSelection(next);
  }

  /** Select all interactive token sprites whose bounding box intersects the marquee rect. */
  private commitTokenMarqueeSelection(): void {
    const marquee = rectFromPoints(
      this.marqueeStartWorldX,
      this.marqueeStartWorldY,
      this.marqueeEndWorldX,
      this.marqueeEndWorldY,
    );

    const hits: string[] = [];
    this.playgroundLayer.iterateTokens((tokenId, sprite) => {
      if (!sprite.canInteract) return;
      const { x, y, size } = sprite.getTokenBounds();
      if (rectsIntersect(marquee, { x, y, width: size, height: size })) {
        hits.push(tokenId);
      }
    });

    this.onTokensSelected?.(hits);
  }

  /**
   * Handle an asset drop onto the canvas.
   * Converts screen coordinates to world coordinates and fires onTilePlaced.
   */
  handleAssetDrop(
    assetId: string,
    width: number,
    height: number,
    category: AssetCategory,
    clientX: number,
    clientY: number,
    rect: DOMRect,
    altHeld = false,
  ): void {
    const { x, y } = this.screenToWorldForDrop(clientX, clientY, rect, !altHeld);
    this.onTilePlaced?.(assetId, x, y, width, height, category);
  }

  /** Returns the number of tile placements in the background layer. */
  getBackgroundLayerTilePlacementCount(): number {
    return this.backgroundLayer.tilePlacementCount;
  }

  /**
   * Update which tile placements are locked. Locked sprites cannot be selected
   * or moved in editor mode. Sprites not in `ids` are unlocked.
   */
  setLockedTilePlacements(ids: ReadonlySet<string>): void {
    this.lockedTilePlacementIds.clear();
    for (const id of ids) this.lockedTilePlacementIds.add(id);

    const apply = (sprite: TilePlacementSprite): void => {
      sprite.setLocked(ids.has(sprite.placementId));
    };
    this.backgroundLayer.iterateTilePlacements(apply);
    this.playgroundLayer.iterateTilePlacements(apply);
    this.foregroundLayer.iterateTilePlacements(apply);
  }

  private getLayerForCategory(
    category: AssetCategory,
  ): BackgroundLayer | PlaygroundLayer | ForegroundLayer | null {
    switch (category) {
      case 'background':
        return this.backgroundLayer;
      case 'playground':
        return this.playgroundLayer;
      case 'foreground':
        return this.foregroundLayer;
      default:
        return null;
    }
  }

  /**
   * Force PixiJS to re-measure its container and resize the renderer.
   * Call this after layout changes (e.g. sidebar panels appearing/disappearing)
   * so the canvas fills the updated container dimensions.
   */
  resize(): void {
    this.app.resize();
  }

  destroy(): void {
    // Remove stage listeners before destroying the app
    this.app.stage.off('pointerdown', this.handleStagePointerDown);
    this.app.stage.off('globalpointermove', this.handleStagePointerMove);
    this.app.stage.off('pointerup', this.handleStagePointerUp);
    this.app.stage.off('pointerupoutside', this.handleStagePointerUp);
    // Remove native pan listeners
    this.app.canvas.removeEventListener('pointerdown', this.handlePanPointerDown);
    this.app.canvas.removeEventListener('pointermove', this.handlePanPointerMove);
    this.app.canvas.removeEventListener('pointerup', this.handlePanPointerUp);
    this.app.canvas.removeEventListener('pointerdown', this.handleRightPanPointerDown);
    this.app.canvas.removeEventListener('pointermove', this.handleRightPanPointerMove);
    this.app.canvas.removeEventListener('pointerup', this.handleRightPanPointerUp);
    this.app.canvas.removeEventListener('pointerdown', this.handleNativePointerDown);
    this.app.canvas.removeEventListener('pointerup', this.handleNativePointerUp);
    window.removeEventListener('keydown', this.handleArrowKey);
    // Ensure marquee graphic is cleaned up if destroy() runs mid-drag
    this.clearMarqueeGraphic();
    this.foregroundLayer.destroyFogMask();
    // In PixiJS v8, removeView is not a valid option — manually remove the canvas first
    this.app.canvas.remove();
    this.app.destroy();
  }
}
