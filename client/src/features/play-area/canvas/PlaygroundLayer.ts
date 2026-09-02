import { Container, Graphics } from 'pixi.js';

import type { DrawPoint, DrawShapeType, GridConfig, Token } from '@vtt/shared';
import { MEASURE_LINE_ALPHA, MEASURE_LINE_WIDTH } from '@vtt/shared';

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

export class PlaygroundLayer extends Container {
  private readonly gridGraphics: Graphics;
  readonly tokenContainer: Container;
  private readonly tilePlacementsContainer: Container;
  private readonly tileSpriteMap = new Map<string, TilePlacementSprite>();

  /** Map of tokenId → TokenSprite for fast lookup */
  private readonly tokenSprites = new Map<string, TokenSprite>();
  private activeTokenId: string | null = null;

  /** Drawing container — above tile placements, below tokens. Map key: `${userId}:${strokeId}` */
  private readonly drawContainer: Container;
  private readonly drawStrokes = new Map<string, DrawStrokeState>();

  /** Map of userId → Graphics for remote measure line overlays */
  private readonly measureGraphics = new Map<string, Graphics>();

  /** Local measure line overlay (owned by this client) */
  private readonly localMeasureGraphics: Graphics;

  constructor() {
    super();
    this.gridGraphics = new Graphics();
    this.gridGraphics.eventMode = 'none';
    this.addChild(this.gridGraphics);

    this.tilePlacementsContainer = new Container();
    this.tilePlacementsContainer.sortableChildren = true;
    this.addChild(this.tilePlacementsContainer);

    this.drawContainer = new Container();
    this.drawContainer.eventMode = 'none';
    this.addChild(this.drawContainer);

    this.tokenContainer = new Container();
    this.tokenContainer.sortableChildren = true;
    this.addChild(this.tokenContainer);

    this.localMeasureGraphics = new Graphics();
    this.localMeasureGraphics.eventMode = 'none';
    this.addChild(this.localMeasureGraphics);
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
    this.drawMeasureLineOnGraphics(
      this.localMeasureGraphics,
      startX,
      startY,
      endX,
      endY,
      color,
      distanceLabel,
    );
  }

  /** Clear this client's local measurement line. */
  clearLocalMeasureLine(): void {
    this.localMeasureGraphics.clear();
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
    let g = this.measureGraphics.get(userId);
    if (!g) {
      g = new Graphics();
      g.eventMode = 'none';
      this.addChild(g);
      this.measureGraphics.set(userId, g);
    }
    this.drawMeasureLineOnGraphics(g, startX, startY, endX, endY, color, distanceLabel);
  }

  /** Clear and destroy a remote user's measurement Graphics. */
  clearRemoteMeasureLine(userId: string): void {
    const g = this.measureGraphics.get(userId);
    if (!g) return;
    this.removeChild(g);
    g.destroy();
    this.measureGraphics.delete(userId);
  }

  /** Clear and destroy all remote measurement Graphics. */
  clearAllRemoteMeasureLines(): void {
    for (const [userId] of this.measureGraphics) {
      this.clearRemoteMeasureLine(userId);
    }
  }

  private drawMeasureLineOnGraphics(
    g: Graphics,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: string,
    distanceLabel: string,
  ): void {
    g.clear();

    const colorNum = parseInt(color.replace('#', ''), 16);

    // Draw the line
    g.moveTo(startX, startY);
    g.lineTo(endX, endY);
    g.stroke({ width: MEASURE_LINE_WIDTH, color: colorNum, alpha: MEASURE_LINE_ALPHA });

    // Draw endpoint circles
    const DOT_RADIUS = 4;
    g.circle(startX, startY, DOT_RADIUS);
    g.circle(endX, endY, DOT_RADIUS);
    g.fill({ color: colorNum, alpha: MEASURE_LINE_ALPHA });

    // Draw label background at midpoint
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const LABEL_PADDING = 4;
    const LABEL_HEIGHT = 18;
    const charWidth = 7;
    const labelWidth = distanceLabel.length * charWidth + LABEL_PADDING * 2;

    g.roundRect(midX - labelWidth / 2, midY - LABEL_HEIGHT / 2, labelWidth, LABEL_HEIGHT, 4);
    g.fill({ color: 0x000000, alpha: 0.65 });

    // Store label metadata for external Text rendering if needed
    const labelled = g as Graphics & {
      measureLabel?: string;
      measureLabelX?: number;
      measureLabelY?: number;
    };
    labelled.measureLabel = distanceLabel;
    labelled.measureLabelX = midX;
    labelled.measureLabelY = midY;
  }
}
