import gsap from 'gsap';
import type { FederatedPointerEvent } from 'pixi.js';
import { Assets, Circle, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

import type { Token } from '@vtt/shared';
import { CONDITION_AURA_COLORS, DEFAULT_AURA_COLOR } from '@vtt/shared';

import { snappedPixelToGridCoords, snapToGrid } from './grid-utils';

const TOKEN_DRAG_Z_INDEX = 100;
/** Pixel distance a pointer must move before a pointerdown is treated as a drag. */
const DRAG_THRESHOLD = 4;

export type TokenMoveEndCallback = (tokenId: string, gridX: number, gridY: number) => void;
export type TokenHoverCallback = (
  tokenId: string,
  entering: boolean,
  canvasX: number,
  canvasY: number,
) => void;
export type TokenDragStateCallback = (dragging: boolean) => void;
export type TokenClickCallback = (tokenId: string) => void;
export type TokenDragStartCallback = () => void;

// HP bar color thresholds — match TokenHoverCard CSS values
const HP_COLOR_HEALTHY = 0x4caf6e; // ≥ 75%
const HP_COLOR_WOUNDED = 0xf0a030; // ≥ 25%
const HP_COLOR_CRITICAL = 0xe05050; // > 0%
const HP_COLOR_DEAD = 0x555555; // 0%
const HP_BAR_HEIGHT = 4;
const HP_BAR_MARGIN = 3; // horizontal inset from token edge
const AURA_FILL_ALPHA = 0.12;
const AURA_STROKE_ALPHA = 0.75;
const AURA_STROKE_WIDTH = 2;

export class TokenSprite extends Container {
  private readonly circle: Graphics;
  private readonly nameLabel: Text;
  private readonly selectionRing: Graphics;
  private readonly activeTurnRing: Graphics;
  private readonly auraLayer: Graphics;
  private readonly ghostIndicator: Graphics;
  private readonly snapHighlight: Graphics;
  private readonly dragLine: Graphics;
  private readonly hpBar: Graphics;
  /** Subtype badge ("A" / "E") shown inside the circle for ally/enemy NPC tokens */
  private readonly npcSubtypeLabel: Text | null;
  /** Optional bitmap portrait rendered on top of the circle when token.iconUrl is set. */
  private iconSprite: Sprite | null = null;
  private iconMask: Graphics | null = null;
  /** True once destroy() has run — guards the async iconUrl loader from touching a dead container. */
  private _isDestroyed = false;
  private _token: Token;
  private readonly cellSize: number;
  readonly canInteract: boolean;

  // Drag state
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private originX = 0;
  private originY = 0;
  private pendingDropX = 0;
  private pendingDropY = 0;

  // Callbacks registered by CanvasManager
  onMoveEnd?: TokenMoveEndCallback;
  onHoverChange?: TokenHoverCallback;
  onDragStateChange?: TokenDragStateCallback;
  onTokenClick?: TokenClickCallback;
  onTokenDragStart?: TokenDragStartCallback;

  constructor(token: Token, cellSize: number, canInteract: boolean) {
    super();
    this._token = token;
    this.cellSize = cellSize;
    this.canInteract = canInteract;

    const tokenSize = token.size * cellSize;
    // 38% of cell radius → token occupies 76% of the cell, leaving a clear gap at all zoom levels
    const radius = Math.round(tokenSize * 0.38);
    const cx = tokenSize / 2;
    const cy = tokenSize / 2;

    // Snap highlight — light-blue grid cell rectangle at drop destination (rendered first, behind token)
    this.snapHighlight = new Graphics();
    this.snapHighlight.visible = false;
    this.snapHighlight.eventMode = 'none';
    this.addChild(this.snapHighlight);

    // Drag line — dashed line from token origin to snap destination
    this.dragLine = new Graphics();
    this.dragLine.visible = false;
    this.dragLine.eventMode = 'none';
    this.addChild(this.dragLine);

    this.auraLayer = new Graphics();
    this.auraLayer.eventMode = 'none';
    this.addChild(this.auraLayer);
    this.drawAura();

    // Selection ring — drawn behind the main circle, hidden by default
    this.selectionRing = new Graphics();
    this.selectionRing.circle(cx, cy, radius + 5);
    this.selectionRing.stroke({ color: 0xffffff, width: 3, alpha: 1 });
    this.selectionRing.visible = false;
    this.selectionRing.eventMode = 'none';
    this.addChild(this.selectionRing);

    this.activeTurnRing = new Graphics();
    this.activeTurnRing.circle(cx, cy, radius + 10);
    this.activeTurnRing.stroke({ color: 0xffd43b, width: 4, alpha: 1 });
    this.activeTurnRing.visible = false;
    this.activeTurnRing.eventMode = 'none';
    this.addChild(this.activeTurnRing);

    // Colored circle for the token — acts as the background/fallback when no iconUrl is set,
    // and as a visible border ring even when an image portrait is loaded on top.
    const colorValue = parseInt(token.color.replace('#', ''), 16);
    this.circle = new Graphics();
    this.circle.circle(cx, cy, radius);
    this.circle.fill({ color: colorValue, alpha: 0.9 });
    this.circle.stroke({ color: 0xffffff, width: 2, alpha: 0.6 });
    this.circle.eventMode = 'none';
    this.addChild(this.circle);

    // Optional portrait image — loaded async from token.iconUrl and clipped to the token circle
    if (token.iconUrl) {
      this.loadIconTexture(token.iconUrl, cx, cy, radius);
    }

    // Ghost snap indicator — blue-tinted ghost circle at snap destination during drag
    this.ghostIndicator = new Graphics();
    this.ghostIndicator.circle(cx, cy, radius);
    this.ghostIndicator.fill({ color: 0x6496ff, alpha: 0.5 });
    this.ghostIndicator.circle(cx, cy, radius + 3);
    this.ghostIndicator.stroke({ color: 0x64c8ff, width: 2, alpha: 0.6 });
    this.ghostIndicator.visible = false;
    this.ghostIndicator.eventMode = 'none';
    this.addChild(this.ghostIndicator);

    // Name label below the token circle
    const labelStyle = new TextStyle({
      fontSize: 11,
      fill: '#ffffff',
      fontFamily: 'Arial',
      stroke: { color: '#000000', width: 3 },
    });
    this.nameLabel = new Text({ text: token.name, style: labelStyle });
    this.nameLabel.anchor.set(0.5, 0);
    this.nameLabel.x = cx;
    this.nameLabel.y = tokenSize + 2;
    this.nameLabel.eventMode = 'none';
    this.addChild(this.nameLabel);

    // NPC subtype badge — "A" (ally, green tint) or "E" (enemy, red tint) inside the token circle
    if (token.type === 'npc' && (token.npcSubtype === 'ally' || token.npcSubtype === 'enemy')) {
      const badgeText = token.npcSubtype === 'ally' ? 'A' : 'E';
      const badgeFill = token.npcSubtype === 'ally' ? '#51cf66' : '#ff6b6b';
      const badgeStyle = new TextStyle({
        fontSize: Math.max(10, Math.floor(radius * 0.75)),
        fill: badgeFill,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        stroke: { color: '#000000', width: 2 },
      });
      const badge = new Text({ text: badgeText, style: badgeStyle });
      badge.anchor.set(0.5, 0.5);
      badge.x = cx;
      badge.y = cy;
      badge.eventMode = 'none';
      this.addChild(badge);
      this.npcSubtypeLabel = badge;
    } else {
      this.npcSubtypeLabel = null;
    }

    // HP bar — overlaid at the bottom edge of the token circle
    this.hpBar = new Graphics();
    this.hpBar.eventMode = 'none';
    this.addChild(this.hpBar);
    this.drawHpBar();

    // Position the sprite at grid coordinates
    this.x = token.x * cellSize;
    this.y = token.y * cellSize;

    // Set explicit hit area so PixiJS v8 hitTestFn recognises this Container as hittable
    this.hitArea = new Circle(cx, cy, radius);

    // Enable pointer events for interaction
    this.eventMode = 'static';
    this.cursor = canInteract ? 'pointer' : 'default';

    this.on('pointerover', this.handlePointerOver, this);
    this.on('pointerout', this.handlePointerOut, this);

    if (canInteract) {
      this.on('pointerdown', this.handlePointerDown, this);
      this.on('globalpointermove', this.handlePointerMove, this);
      this.on('pointerup', this.handlePointerUp, this);
      this.on('pointerupoutside', this.handlePointerUp, this);
    }
  }

  get tokenId(): string {
    return this._token.id;
  }

  get tokenData(): Token {
    return this._token;
  }

  private getAuraColor(): number {
    const conditionColor = this._token.auraCondition
      ? CONDITION_AURA_COLORS[this._token.auraCondition]
      : null;
    const color = conditionColor ?? this._token.auraColor ?? DEFAULT_AURA_COLOR;
    return parseInt(color.replace('#', ''), 16);
  }

  private drawAura(): void {
    this.auraLayer.clear();

    const radiusCells = this._token.auraRadius ?? 0;
    if (!this._token.auraVisible || radiusCells <= 0) return;

    const tokenSize = this._token.size * this.cellSize;
    const cx = tokenSize / 2;
    const cy = tokenSize / 2;
    const auraRadius = radiusCells * this.cellSize;
    const color = this.getAuraColor();

    this.auraLayer.circle(cx, cy, auraRadius);
    this.auraLayer.fill({ color, alpha: AURA_FILL_ALPHA });
    this.auraLayer.circle(cx, cy, auraRadius);
    this.auraLayer.stroke({ color, width: AURA_STROKE_WIDTH, alpha: AURA_STROKE_ALPHA });
  }

  /** Show or hide the selection ring around this token. */
  setSelected(selected: boolean): void {
    this.selectionRing.visible = selected;
  }

  /** Show or hide the active-turn ring around this token. */
  setActiveTurn(active: boolean): void {
    this.activeTurnRing.visible = active;
  }

  /** Returns the axis-aligned bounding box in parent (world) space for rubber-band selection. */
  getTokenBounds(): { x: number; y: number; size: number } {
    return { x: this.x, y: this.y, size: this._token.size * this.cellSize };
  }

  /** Update position on canvas from new token data (e.g. after server confirmation). */
  syncPosition(token: Token): void {
    this._token = token;
    if (!this.isDragging) {
      this.x = token.x * this.cellSize;
      this.y = token.y * this.cellSize;
    }
  }

  /**
   * Update all non-rebuild token state: position, HP bar, and any other live data.
   * Called by PlaygroundLayer.setTokens() when needsRebuild() returns false.
   */
  updateToken(token: Token): void {
    this._token = token;
    if (!this.isDragging) {
      this.x = token.x * this.cellSize;
      this.y = token.y * this.cellSize;
    }
    this.drawHpBar();
    this.drawAura();
  }

  /** Redraw the HP bar based on current token hp/maxHp values. */
  private drawHpBar(): void {
    this.hpBar.clear();

    const { hp, maxHp } = this._token;
    if (hp === null || hp === undefined || maxHp === null || maxHp === undefined || maxHp <= 0) {
      return;
    }

    const tokenSize = this._token.size * this.cellSize;
    const barWidth = tokenSize - HP_BAR_MARGIN * 2;
    const barY = tokenSize - HP_BAR_HEIGHT - 6; // inside the bottom of the circle area

    // Dark background track
    this.hpBar.rect(HP_BAR_MARGIN, barY, barWidth, HP_BAR_HEIGHT);
    this.hpBar.fill({ color: 0x1a1a2e, alpha: 0.75 });

    // Colored fill
    const pct = Math.min(1, Math.max(0, hp / maxHp));
    const fillWidth = pct > 0 ? Math.max(1, Math.floor(barWidth * pct)) : 0;

    let color: number;
    if (pct >= 0.75) color = HP_COLOR_HEALTHY;
    else if (pct >= 0.25) color = HP_COLOR_WOUNDED;
    else if (pct > 0) color = HP_COLOR_CRITICAL;
    else color = HP_COLOR_DEAD;

    if (fillWidth > 0) {
      this.hpBar.rect(HP_BAR_MARGIN, barY, fillWidth, HP_BAR_HEIGHT);
      this.hpBar.fill({ color, alpha: 0.95 });
    }
  }

  /**
   * Returns true if the token's visual properties (name, color, size, iconUrl) or interaction
   * capability have changed — meaning the sprite needs to be destroyed and re-created.
   */
  needsRebuild(token: Token, canInteract: boolean): boolean {
    return (
      token.name !== this._token.name ||
      token.color !== this._token.color ||
      token.size !== this._token.size ||
      token.npcSubtype !== this._token.npcSubtype ||
      token.iconUrl !== this._token.iconUrl ||
      canInteract !== this.canInteract
    );
  }

  /**
   * Asynchronously load the token's portrait image and add it as a circle-masked sprite
   * on top of the colored background circle. Safely no-ops if the sprite has been destroyed
   * before the texture finishes loading.
   */
  private loadIconTexture(url: string, cx: number, cy: number, radius: number): void {
    Assets.load(url)
      .then((texture) => {
        if (this._isDestroyed) return;
        const sprite = new Sprite(texture);
        // Fit the image inside the token circle (square of side 2*radius, centred at cx, cy)
        const diameter = radius * 2;
        sprite.width = diameter;
        sprite.height = diameter;
        sprite.x = cx - radius;
        sprite.y = cy - radius;
        sprite.eventMode = 'none';

        // Circular mask so the image respects the token's circular silhouette
        const mask = new Graphics();
        mask.circle(cx, cy, radius);
        mask.fill({ color: 0xffffff });
        mask.eventMode = 'none';
        sprite.mask = mask;

        this.iconSprite = sprite;
        this.iconMask = mask;
        // Insert image + mask directly above the colored circle, below overlays
        // (ghost, HP bar, NPC badge, name label are added after this in the constructor).
        const circleIdx = this.getChildIndex(this.circle);
        this.addChildAt(mask, circleIdx + 1);
        this.addChildAt(sprite, circleIdx + 2);
      })
      .catch((err: unknown) => {
        console.error(`[TokenSprite] Failed to load icon '${url}':`, err);
      });
  }

  private handlePointerOver(event: FederatedPointerEvent): void {
    this.circle.tint = 0xdddddd;
    this.onHoverChange?.(this._token.id, true, event.global.x, event.global.y);
  }

  private handlePointerOut(): void {
    this.circle.tint = 0xffffff;
    this.onHoverChange?.(this._token.id, false, 0, 0);
  }

  private handlePointerDown(event: FederatedPointerEvent): void {
    if (event.button !== 0) return; // ignore middle/right mouse — MMB is reserved for map panning
    // Stop bubbling so the stage's background-click handler doesn't misfire.
    event.stopPropagation();
    this.isDragging = true;
    this.dragMoved = false;
    this.onDragStateChange?.(true);

    // Record where we started (for drag threshold + revert)
    this.originX = this.x;
    this.originY = this.y;
    this.dragStartX = event.global.x;
    this.dragStartY = event.global.y;

    this.zIndex = TOKEN_DRAG_Z_INDEX;

    // ESC key cancels the drag in progress
    window.addEventListener('keydown', this.handleKeyDown);

    // Calculate drag offset in parent (PlaygroundLayer) local coords
    if (!this.parent) return;
    const localPos = this.parent.toLocal(event.global);
    this.dragOffsetX = localPos.x - this.x;
    this.dragOffsetY = localPos.y - this.y;
  }

  private handlePointerMove(event: FederatedPointerEvent): void {
    if (!this.isDragging || !this.parent) return;

    const dx = event.global.x - this.dragStartX;
    const dy = event.global.y - this.dragStartY;
    if (!this.dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    // First threshold crossing: notify parent to clear the hover/selection card
    if (!this.dragMoved) {
      this.dragMoved = true;
      this.onTokenDragStart?.();
    }

    // Token stays at origin — only the snap preview follows the cursor
    const localPos = this.parent.toLocal(event.global);
    const cursorTargetX = localPos.x - this.dragOffsetX;
    const cursorTargetY = localPos.y - this.dragOffsetY;

    const snapped = snapToGrid(cursorTargetX, cursorTargetY, this.cellSize);
    this.pendingDropX = snapped.x;
    this.pendingDropY = snapped.y;

    // Positions relative to the token's stationary origin
    const relX = snapped.x - this.originX;
    const relY = snapped.y - this.originY;

    // Ghost circle at snap destination
    this.ghostIndicator.x = relX;
    this.ghostIndicator.y = relY;
    this.ghostIndicator.visible = true;

    // Grid-cell highlight at snap destination
    this.drawSnapHighlight(relX, relY);
    this.snapHighlight.visible = true;

    // Dashed line from origin to snap destination
    this.drawDragLine(relX, relY);
    this.dragLine.visible = true;
  }

  private handlePointerUp(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.ghostIndicator.visible = false;
    this.snapHighlight.visible = false;
    this.dragLine.visible = false;
    this.onDragStateChange?.(false);
    this.zIndex = 0;

    // If pointer barely moved, treat as a click (not a drag)
    if (!this.dragMoved) {
      this.onTokenClick?.(this._token.id);
      return;
    }

    // Tween from origin to the snapped drop destination, then fire onMoveEnd
    const gridCoords = snappedPixelToGridCoords(
      this.pendingDropX,
      this.pendingDropY,
      this.cellSize,
    );

    gsap.to(this, {
      x: this.pendingDropX,
      y: this.pendingDropY,
      duration: 0.12,
      ease: 'power2.out',
      onComplete: () => {
        this.onMoveEnd?.(this._token.id, gridCoords.gridX, gridCoords.gridY);
      },
    });
  }

  /** ESC key handler — cancels an in-progress drag without moving the token. */
  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isDragging) {
      e.preventDefault();
      this.cancelDrag();
    }
  };

  /** Cancel the current drag, hiding all preview graphics and resetting state. */
  private cancelDrag(): void {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragMoved = false;
    this.ghostIndicator.visible = false;
    this.snapHighlight.visible = false;
    this.dragLine.visible = false;
    this.zIndex = 0;
    this.onDragStateChange?.(false);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  /** Draw the grid-cell highlight at the snap destination (relative to token origin). */
  private drawSnapHighlight(relX: number, relY: number): void {
    this.snapHighlight.clear();
    const cs = this.cellSize;
    this.snapHighlight.x = relX;
    this.snapHighlight.y = relY;
    this.snapHighlight.rect(0, 0, cs, cs);
    this.snapHighlight.fill({ color: 0x6496ff, alpha: 0.2 });
    this.snapHighlight.rect(0, 0, cs, cs);
    this.snapHighlight.stroke({ color: 0x64c8ff, alpha: 0.8, width: 3 });
  }

  /** Draw a dashed line from the token centre to the snap destination centre. */
  private drawDragLine(relX: number, relY: number): void {
    this.dragLine.clear();
    const half = this.cellSize / 2;
    const startX = half;
    const startY = half;
    const endX = relX + half;
    const endY = relY + half;
    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist < 1) return;
    const DASH = 6;
    const GAP = 6;
    const step = DASH + GAP;
    const nx = (endX - startX) / dist;
    const ny = (endY - startY) / dist;
    let d = 0;
    while (d < dist) {
      const dashEnd = Math.min(d + DASH, dist);
      this.dragLine.moveTo(startX + nx * d, startY + ny * d);
      this.dragLine.lineTo(startX + nx * dashEnd, startY + ny * dashEnd);
      d += step;
    }
    this.dragLine.stroke({ color: 0x6496ff, alpha: 0.5, width: 2 });
  }

  /**
   * Animate the sprite back to the given grid position (used on server rejection).
   */
  revertToPosition(gridX: number, gridY: number): void {
    const targetX = gridX * this.cellSize;
    const targetY = gridY * this.cellSize;
    gsap.to(this, { x: targetX, y: targetY, duration: 0.2, ease: 'power2.out' });
  }

  override destroy(): void {
    this._isDestroyed = true;
    // If destroyed mid-drag, ensure CanvasManager's dragging flag is cleared
    if (this.isDragging) {
      this.isDragging = false;
      this.onDragStateChange?.(false);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    gsap.killTweensOf(this);
    this.off('pointerover', this.handlePointerOver, this);
    this.off('pointerout', this.handlePointerOut, this);
    this.off('pointerdown', this.handlePointerDown, this);
    this.off('globalpointermove', this.handlePointerMove, this);
    this.off('pointerup', this.handlePointerUp, this);
    this.off('pointerupoutside', this.handlePointerUp, this);
    super.destroy({ children: true });
  }
}
