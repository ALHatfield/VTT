import type { FederatedPointerEvent } from 'pixi.js';
import { Application, Assets, Container } from 'pixi.js';

import type {
  AssetCategory,
  CampaignRole,
  FogRegion,
  FogVertex,
  GridConfig,
  MapData,
  TileAsset,
  TilePlacement,
  Token,
  TokenVisionReveal,
  ViewportBounds,
} from '@vtt/shared';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_FACTOR } from '@vtt/shared';

import { BackgroundLayer } from './BackgroundLayer';
import { ForegroundLayer } from './ForegroundLayer';
import { PlaygroundLayer } from './PlaygroundLayer';
import { TilePlacementSprite } from './TilePlacementSprite';
import { snapToGrid } from './grid-utils';
import { getViewportBounds } from './viewport-culling';

export interface CanvasManagerOptions {
  background?: number;
}

export class CanvasManager {
  private readonly app: Application;
  private readonly worldContainer: Container;
  readonly backgroundLayer: BackgroundLayer;
  readonly playgroundLayer: PlaygroundLayer;
  readonly foregroundLayer: ForegroundLayer;

  private currentMapData: MapData | null = null;
  private currentCellSize = 64;

  // Currently selected tile placement — used to deselect the previous tile on new selection
  private selectedTilePlacementId: string | null = null;

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

  // Background click: fire only when pointer didn't travel more than CLICK_THRESHOLD pixels
  private static readonly CLICK_THRESHOLD = 4;
  private backgroundDownX = 0;
  private backgroundDownY = 0;
  private readonly handleStagePointerDown = (e: FederatedPointerEvent): void => {
    // Only record position when clicking the stage itself — not a child sprite
    if (e.target !== this.app.stage) return;
    this.backgroundDownX = e.global.x;
    this.backgroundDownY = e.global.y;
  };
  private readonly handleStagePointerUp = (e: FederatedPointerEvent): void => {
    // Only fire background click when no interactive child was under the cursor
    if (e.target !== this.app.stage) return;
    const dx = e.global.x - this.backgroundDownX;
    const dy = e.global.y - this.backgroundDownY;
    if (Math.hypot(dx, dy) < CanvasManager.CLICK_THRESHOLD) this.onBackgroundClick?.();
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
  onTileSelect?: (placementId: string | null) => void;
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

    // Stage-level background click — fires only when no token sprite stops propagation.
    // Uses pointerup + distance guard so pan gestures don't clear selection.
    this.app.stage.eventMode = 'static';
    this.app.stage.on('pointerdown', this.handleStagePointerDown);
    this.app.stage.on('pointerup', this.handleStagePointerUp);

    // Middle-mouse canvas pan — native DOM listeners so they don't interfere with
    // PixiJS's federated event system used for token/tile selection.
    this.app.canvas.addEventListener('pointerdown', this.handlePanPointerDown);
    this.app.canvas.addEventListener('pointermove', this.handlePanPointerMove);
    this.app.canvas.addEventListener('pointerup', this.handlePanPointerUp);
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
    this.foregroundLayer.setObfuscationEnabled(obfuscateForPlayer);
    this.foregroundLayer.setFogRegions(regions);
  }

  /** Render circular vision reveals around token positions on the fog layer. */
  setTokenVisionReveals(reveals: TokenVisionReveal[]): void {
    this.foregroundLayer.setTokenVisionReveals(reveals, this.currentCellSize);
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
   * Enable or disable editor interaction mode.
   * In editor mode, tile placements are interactive and tokens are not.
   */
  setEditorMode(enabled: boolean): void {
    this.setAllTilePlacementsInteractive(enabled);
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
      sprite.onSelect = (id) => {
        // Deselect the previously selected tile sprite
        if (this.selectedTilePlacementId && this.selectedTilePlacementId !== id) {
          const prev = this.findTilePlacementSprite(this.selectedTilePlacementId);
          prev?.setSelected(false);
        }
        this.selectedTilePlacementId = id;
        this.onTileSelect?.(id);
      };
      sprite.onResizeEnd = (id, w, h) => this.onTileResizeEnd?.(id, w, h);
      sprite.onRotate = (id, r) => this.onTileRotate?.(id, r);
      sprite.onDelete = (id) => this.onTileDelete?.(id);
      sprite.onContextMenu = (id, sx, sy) => this.onTileContextMenu?.(id, sx, sy);
      sprite.setInteractive(editorMode);

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
    this.app.stage.off('pointerup', this.handleStagePointerUp);
    // Remove native pan listeners
    this.app.canvas.removeEventListener('pointerdown', this.handlePanPointerDown);
    this.app.canvas.removeEventListener('pointermove', this.handlePanPointerMove);
    this.app.canvas.removeEventListener('pointerup', this.handlePanPointerUp);
    // In PixiJS v8, removeView is not a valid option — manually remove the canvas first
    this.app.canvas.remove();
    this.app.destroy();
  }
}
