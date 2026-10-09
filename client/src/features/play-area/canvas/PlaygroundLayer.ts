import { Container, Graphics, Text } from 'pixi.js';

import type { DrawPoint, DrawShapeType, GridConfig, Token } from '@vtt/shared';
import { MEASURE_LINE_ALPHA, MEASURE_LINE_WIDTH } from '@vtt/shared';

import { applyMapClip, type MapClipBounds } from './map-clip';
import type { TilePlacementSprite } from './TilePlacementSprite';
import type {
    TokenClickCallback,
    TokenDragStartCallback,
    TokenDragStateCallback,
    TokenHoverCallback,
    TokenMoveEndCallback,
} from './TokenSprite';
import { TokenSprite } from './TokenSprite';

interface DrawStrokeState {
  graphics: Graphics;
  points: DrawPoint[];
  color: string;
  width: number;
  shapeType: DrawShapeType;
}

interface MeasureVisual {
  container: Container;
  graphics: Graphics;
  label: Text;
}

const MEASURE_DOT_RADIUS = 5;
const MEASURE_LABEL_FONT_SIZE = 20;
const MEASURE_LABEL_PADDING_X = 10;
const MEASURE_LABEL_PADDING_Y = 5;
const MEASURE_LABEL_CORNER_RADIUS = 6;
const MEASURE_LABEL_BORDER_WIDTH = 2;
const MEASURE_LABEL_BG_COLOR = 0x111111;
const MEASURE_LABEL_BG_ALPHA = 0.9;

export class PlaygroundLayer extends Container {
  private readonly gridGraphics: Graphics;
  readonly tokenContainer: Container;
  private readonly tilePlacementsContainer: Container;
  private readonly tileClipMask: Graphics;
  private readonly tileSpriteMap = new Map<string, TilePlacementSprite>();

  /** Map of tokenId → TokenSprite for fast lookup */
  private readonly tokenSprites = new Map<string, TokenSprite>();
  private activeTokenId: string | null = null;

  /** Draw + measure overlay; CanvasManager mounts it above fog/doors so annotations are never obscured. */
  readonly overlayContainer: Container;

  /** Map key: `${userId}:${strokeId}` */
  private readonly drawContainer: Container;
  private readonly tokenDragPreviewContainer: Container;
  private readonly drawStrokes = new Map<string, DrawStrokeState>();

  /** Map of userId → remote measure line overlays */
  private readonly remoteMeasures = new Map<string, MeasureVisual>();

  /** Local measure line overlay (owned by this client) */
  private readonly localMeasure: MeasureVisual;

  constructor() {
    super();
    this.gridGraphics = new Graphics();
    this.gridGraphics.eventMode = 'none';
    this.addChild(this.gridGraphics);

    this.tilePlacementsContainer = new Container();
    this.tilePlacementsContainer.sortableChildren = true;
    this.addChild(this.tilePlacementsContainer);

    this.tileClipMask = new Graphics();
    this.addChild(this.tileClipMask);

    this.tokenContainer = new Container();
    this.tokenContainer.sortableChildren = true;
    this.addChild(this.tokenContainer);

    this.overlayContainer = new Container();
    this.overlayContainer.eventMode = 'none';

    this.drawContainer = new Container();
    this.drawContainer.eventMode = 'none';
    this.overlayContainer.addChild(this.drawContainer);

    this.tokenDragPreviewContainer = new Container();
    this.tokenDragPreviewContainer.eventMode = 'none';
    this.overlayContainer.addChild(this.tokenDragPreviewContainer);

    this.localMeasure = this.createMeasureVisual();
  }

  drawGrid(mapWidth: number, mapHeight: number, config: GridConfig): void {
    this.gridGraphics.clear();

    if (!config.visible) return;

    const { cellSize, color, alpha } = config;
    const cols = Math.ceil(mapWidth / cellSize);
    const rows = Math.ceil(mapHeight / cellSize);

    for (let col = 0; col <= cols; col++) {
      const x = col * cellSize;
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, mapHeight);
    }

    for (let row = 0; row <= rows; row++) {
      const y = row * cellSize;
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(mapWidth, y);
    }

    this.gridGraphics.stroke({ width: 1, color, alpha });
  }

  setGridVisible(visible: boolean): void {
    this.gridGraphics.visible = visible;
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  /** Show or hide the selection ring on a specific token sprite. */
  setTokenSelected(tokenId: string, selected: boolean): void {
    this.tokenSprites.get(tokenId)?.setSelected(selected);
  }

  /** Show the active-turn ring on one token and clear it from the previous token. */
  setActiveTokenId(tokenId: string | null): void {
    if (this.activeTokenId && this.activeTokenId !== tokenId) {
      this.tokenSprites.get(this.activeTokenId)?.setActiveTurn(false);
    }
    this.activeTokenId = tokenId;
    if (tokenId) this.tokenSprites.get(tokenId)?.setActiveTurn(true);
  }

  /** Iterate all live token sprites (for rubber-band selection hit-testing). */
  iterateTokens(cb: (tokenId: string, sprite: TokenSprite) => void): void {
    for (const [id, sprite] of this.tokenSprites) cb(id, sprite);
  }

  /** Add or replace a single token sprite. */
  addToken(
    token: Token,
    cellSize: number,
    canInteract: boolean,
    onMoveEnd: TokenMoveEndCallback,
    onHoverChange: TokenHoverCallback,
    onDragStateChange: TokenDragStateCallback,
    onTokenClick: TokenClickCallback,
    onTokenDragStart: TokenDragStartCallback,
  ): void {
    // Remove existing sprite for this token if present
    this.removeToken(token.id);

    const sprite = new TokenSprite(token, cellSize, canInteract);
    sprite.onMoveEnd = onMoveEnd;
    sprite.onHoverChange = onHoverChange;
    sprite.onDragStateChange = onDragStateChange;
    sprite.onTokenClick = onTokenClick;
    sprite.onTokenDragStart = onTokenDragStart;

    this.tokenSprites.set(token.id, sprite);
    this.tokenContainer.addChild(sprite);
    this.tokenDragPreviewContainer.addChild(sprite.dragPreview);
    sprite.setActiveTurn(this.activeTokenId === token.id);
  }

  /** Remove a token sprite by ID. */
  removeToken(tokenId: string): void {
    const sprite = this.tokenSprites.get(tokenId);
    if (!sprite) return;
    sprite.destroy();
    this.tokenSprites.delete(tokenId);
  }

  /** Sync position from updated token data (without re-creating the sprite). */
  syncTokenPosition(token: Token): void {
    const sprite = this.tokenSprites.get(token.id);
    sprite?.syncPosition(token);
  }

  /** Update all live token state (position + HP bar) without re-creating the sprite. */
  syncTokenData(token: Token): void {
    const sprite = this.tokenSprites.get(token.id);
    sprite?.updateToken(token);
  }

  /** Replace all tokens with a new set. Destroys sprites not in the new list. */
  setTokens(
    tokens: Token[],
    cellSize: number,
    canInteractFn: (token: Token) => boolean,
    onMoveEnd: TokenMoveEndCallback,
    onHoverChange: TokenHoverCallback,
    onDragStateChange: TokenDragStateCallback,
    onTokenClick: TokenClickCallback,
    onTokenDragStart: TokenDragStartCallback,
  ): void {
    const incomingIds = new Set(tokens.map((t) => t.id));

    // Remove sprites that are no longer in the token list
    for (const [id] of this.tokenSprites) {
      if (!incomingIds.has(id)) this.removeToken(id);
    }

    // Add or update sprites
    for (const token of tokens) {
      if (this.tokenSprites.has(token.id)) {
        const sprite = this.tokenSprites.get(token.id)!;
        // If appearance or interaction changed, force a full re-render
        if (sprite.needsRebuild(token, canInteractFn(token))) {
          this.removeToken(token.id);
          this.addToken(
            token,
            cellSize,
            canInteractFn(token),
            onMoveEnd,
            onHoverChange,
            onDragStateChange,
            onTokenClick,
            onTokenDragStart,
          );
        } else {
          sprite.updateToken(token);
        }
      } else {
        this.addToken(
          token,
          cellSize,
          canInteractFn(token),
          onMoveEnd,
          onHoverChange,
          onDragStateChange,
          onTokenClick,
          onTokenDragStart,
        );
      }
    }

    this.setActiveTokenId(this.activeTokenId);
  }

  /** Remove all token sprites. */
  clearTokens(): void {
    for (const [id] of this.tokenSprites) {
      this.removeToken(id);
    }
    this.activeTokenId = null;
  }

  // ---------------------------------------------------------------------------
  // Tile placement management
  // ---------------------------------------------------------------------------

  /** Hide tile art outside the map rectangle; null removes the clip. */
  setTileClip(bounds: MapClipBounds | null): void {
    applyMapClip(this.tilePlacementsContainer, this.tileClipMask, bounds);
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

  // ---------------------------------------------------------------------------
  // Drawing tool (Phase 4K)
  // ---------------------------------------------------------------------------

  /**
   * Add or update a drawing stroke. For freehand, new points are appended to the
   * existing stroke. For shapes, points are replaced (preview updates on each move).
   */
  addOrUpdateDrawStroke(
    userId: string,
    strokeId: string,
    points: DrawPoint[],
    color: string,
    width: number,
    shapeType: DrawShapeType,
  ): void {
    const key = `${userId}:${strokeId}`;
    let state = this.drawStrokes.get(key);

    if (!state) {
      const g = new Graphics();
      g.eventMode = 'none';
      this.drawContainer.addChild(g);
      state = { graphics: g, points: [], color, width, shapeType };
      this.drawStrokes.set(key, state);
    }

    if (shapeType === 'freehand') {
      state.points.push(...points);
    } else {
      state.points = [...points];
    }
    state.color = color;
    state.width = width;

    this.renderDrawStroke(state);
  }

  private renderDrawStroke(state: DrawStrokeState): void {
    const { graphics, points, color, width, shapeType } = state;
    graphics.clear();

    if (points.length < 1) return;

    const colorNum = parseInt(color.replace('#', ''), 16);

    if (shapeType === 'freehand') {
      if (points.length < 2) return;
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }
      graphics.stroke({ width, color: colorNum, alpha: 1, cap: 'round', join: 'round' });
    } else if (shapeType === 'rect') {
      if (points.length < 2) return;
      const x = Math.min(points[0].x, points[1].x);
      const y = Math.min(points[0].y, points[1].y);
      const w = Math.abs(points[1].x - points[0].x);
      const h = Math.abs(points[1].y - points[0].y);
      graphics.rect(x, y, w, h);
      graphics.stroke({ width, color: colorNum, alpha: 1 });
    } else if (shapeType === 'circle') {
      if (points.length < 2) return;
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      graphics.circle(points[0].x, points[0].y, radius);
      graphics.stroke({ width, color: colorNum, alpha: 1 });
    }
  }

  /**
   * Clear drawing strokes.
   * - scope 'all': removes all strokes regardless of owner
   * - scope 'own': removes only strokes belonging to userId
   */
  clearDrawings(scope: 'all' | 'own', userId: string): void {
    const toRemove: string[] = [];

    for (const [key, state] of this.drawStrokes) {
      if (scope === 'all' || key.startsWith(`${userId}:`)) {
        this.drawContainer.removeChild(state.graphics);
        state.graphics.destroy();
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.drawStrokes.delete(key);
    }
  }

  // ---------------------------------------------------------------------------
  // Measure tool overlay (Phase 4J)
  // ---------------------------------------------------------------------------

  /**
   * Draw or update this client's local measurement line.
   * startX/Y and endX/Y are world-pixel coordinates.
   */
  drawLocalMeasureLine(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    distanceLabel: string,
  ): void {
    this.renderMeasure(this.localMeasure, startX, startY, endX, endY, color, distanceLabel);
  }

  /** Clear this client's local measurement line. */
  clearLocalMeasureLine(): void {
    this.localMeasure.graphics.clear();
    this.localMeasure.label.visible = false;
  }

  /** Draw or update a remote user's measurement line relay. */
  drawRemoteMeasureLine(
    userId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    distanceLabel: string,
  ): void {
    let visual = this.remoteMeasures.get(userId);
    if (!visual) {
      visual = this.createMeasureVisual();
      this.remoteMeasures.set(userId, visual);
    }
    this.renderMeasure(visual, startX, startY, endX, endY, color, distanceLabel);
  }

  /** Clear and destroy a remote user's measurement overlay. */
  clearRemoteMeasureLine(userId: string): void {
    const visual = this.remoteMeasures.get(userId);
    if (!visual) return;
    this.overlayContainer.removeChild(visual.container);
    visual.container.destroy({ children: true });
    this.remoteMeasures.delete(userId);
  }

  /** Clear and destroy all remote measurement overlays. */
  clearAllRemoteMeasureLines(): void {
    for (const [userId] of this.remoteMeasures) {
      this.clearRemoteMeasureLine(userId);
    }
  }

  private createMeasureVisual(): MeasureVisual {
    const container = new Container();
    container.eventMode = 'none';
    const graphics = new Graphics();
    const label = new Text({
      text: '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: MEASURE_LABEL_FONT_SIZE,
        fontWeight: 'bold',
        fill: 0xffffff,
      },
    });
    label.anchor.set(0.5);
    label.visible = false;
    container.addChild(graphics);
    container.addChild(label);
    this.overlayContainer.addChild(container);
    return { container, graphics, label };
  }

  private renderMeasure(
    visual: MeasureVisual,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    distanceLabel: string,
  ): void {
    const { graphics: g, label } = visual;
    g.clear();

    const colorNum = parseInt(color.replace('#', ''), 16);

    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.stroke({ width: MEASURE_LINE_WIDTH, color: colorNum, alpha: MEASURE_LINE_ALPHA });

    g.circle(startX, startY, MEASURE_DOT_RADIUS);
    g.circle(endX, endY, MEASURE_DOT_RADIUS);
    g.fill({ color: colorNum, alpha: MEASURE_LINE_ALPHA });

    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    label.text = distanceLabel;
    label.position.set(midX, midY);
    label.visible = true;

    const bgWidth = label.width + MEASURE_LABEL_PADDING_X * 2;
    const bgHeight = label.height + MEASURE_LABEL_PADDING_Y * 2;
    g.roundRect(
      midX - bgWidth / 2,
      midY - bgHeight / 2,
      bgWidth,
      bgHeight,
      MEASURE_LABEL_CORNER_RADIUS,
    );
    g.fill({ color: MEASURE_LABEL_BG_COLOR, alpha: MEASURE_LABEL_BG_ALPHA });
    g.stroke({ width: MEASURE_LABEL_BORDER_WIDTH, color: colorNum, alpha: 1 });
  }
}
