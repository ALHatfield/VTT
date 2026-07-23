import { Container, Graphics } from 'pixi.js';

import type { GridConfig, Token } from '@vtt/shared';

import type { TilePlacementSprite } from './TilePlacementSprite';
import type {
  TokenClickCallback,
  TokenDragStartCallback,
  TokenDragStateCallback,
  TokenHoverCallback,
  TokenMoveEndCallback,
} from './TokenSprite';
import { TokenSprite } from './TokenSprite';

export class PlaygroundLayer extends Container {
  private readonly gridGraphics: Graphics;
  readonly tokenContainer: Container;
  private readonly tilePlacementsContainer: Container;
  private readonly tileSpriteMap = new Map<string, TilePlacementSprite>();

  /** Map of tokenId → TokenSprite for fast lookup */
  private readonly tokenSprites = new Map<string, TokenSprite>();

  constructor() {
    super();
    this.gridGraphics = new Graphics();
    this.gridGraphics.eventMode = 'none';
    this.addChild(this.gridGraphics);

    this.tilePlacementsContainer = new Container();
    this.tilePlacementsContainer.sortableChildren = true;
    this.addChild(this.tilePlacementsContainer);

    this.tokenContainer = new Container();
    this.tokenContainer.sortableChildren = true;
    this.addChild(this.tokenContainer);
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
  }

  /** Remove all token sprites. */
  clearTokens(): void {
    for (const [id] of this.tokenSprites) {
      this.removeToken(id);
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
