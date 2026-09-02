import type { FederatedPointerEvent, Texture } from 'pixi.js';
import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';

import { snapToGrid } from './grid-utils';

const SELECTION_BORDER_COLOR = 0x4fc3f7;
const SELECTION_BORDER_ALPHA = 0.9;
const SELECTION_BORDER_WIDTH = 2;
const DRAG_Z_INDEX = 200;

/** Resize handle size (px) — square corner handle rendered at SE corner when selected. */
const RESIZE_HANDLE_SIZE = 10;
const RESIZE_HANDLE_COLOR = 0x4fc3f7;

/** Minimum tile dimension (px) — prevents collapsing tile to zero. */
const MIN_TILE_SIZE = 16;

export type TilePlacementMoveEndCallback = (placementId: string, x: number, y: number) => void;

/**
 * Fired on a click (not a drag). CanvasManager owns selection state and decides
 * whether the click adds to, removes from, or replaces the current selection.
 * `additive` is true when Shift was held during the click.
 */
export type TilePlacementSelectCallback = (placementId: string, additive: boolean) => void;
export type TilePlacementResizeEndCallback = (
  placementId: string,
  width: number,
  height: number,
) => void;
export type TilePlacementRotateCallback = (placementId: string, rotation: number) => void;
export type TilePlacementDeleteCallback = (placementId: string) => void;
export type TilePlacementContextMenuCallback = (
  placementId: string,
  screenX: number,
  screenY: number,
) => void;

/** Pixel distance a pointer must move before a pointerdown is treated as a drag. */
const DRAG_THRESHOLD = 4;

/**
 * TilePlacementSprite — a single placed tile on the canvas.
 *
 * Interactions (editor-mode only):
 *  - Click        → select (shows border + resize handles)
 *  - Drag         → move with grid-snapping (hold Alt to bypass grid snap)
 *  - Drop         → fires onMoveEnd with final snapped coordinates
 *  - SE-handle drag → resize corner, pixel-accurate (no grid snapping)
 *  - Edge-handle drag → resize single axis; left/top also shift position
 *  - Right-click  → fires onContextMenu with screen coordinates
 */
export class TilePlacementSprite extends Container {
  readonly placementId: string;
  private readonly tileSprite: Sprite;
  private readonly selectionBorder: Graphics;
  private readonly resizeHandle: Graphics; // SE corner
  private readonly topHandle: Graphics;
  private readonly rightHandle: Graphics;
  private readonly bottomHandle: Graphics;
  private readonly leftHandle: Graphics;

  private _selected = false;
  private canInteract = false;
  private _locked = false;

  // Drag state
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private originX = 0;
  private originY = 0;
  private altHeld = false;
  private shiftHeld = false;

  // Resize state (SE corner)
  private isResizing = false;
  private resizeStartMouseX = 0;
  private resizeStartMouseY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;

  // Edge resize state (top / right / bottom / left handles)
  private activeEdge: 'top' | 'right' | 'bottom' | 'left' | null = null;
  private edgeStartMouseX = 0;
  private edgeStartMouseY = 0;
  private edgeStartX = 0;
  private edgeStartY = 0;
  private edgeStartWidth = 0;
  private edgeStartHeight = 0;

  private cellSize: number;

  // Track whether a pointerdown fired on this sprite so pointerup can be guarded
  private pressedDown = false;

  // Callbacks registered by CanvasManager / layer
  onMoveEnd?: TilePlacementMoveEndCallback;
  onSelect?: TilePlacementSelectCallback;
  onResizeEnd?: TilePlacementResizeEndCallback;
  onRotate?: TilePlacementRotateCallback;
  onDelete?: TilePlacementDeleteCallback;
  onContextMenu?: TilePlacementContextMenuCallback;

  constructor(
    placementId: string,
    texture: Texture,
    width: number,
    height: number,
    cellSize: number,
  ) {
    super();
    this.placementId = placementId;
    this.cellSize = cellSize;

    // Tile image
    this.tileSprite = new Sprite(texture);
    this.tileSprite.width = width;
    this.tileSprite.height = height;
    this.tileSprite.eventMode = 'none';
    this.addChild(this.tileSprite);

    // Selection border — rendered on top
    this.selectionBorder = new Graphics();
    this.selectionBorder.visible = false;
    this.selectionBorder.eventMode = 'none';
    this.drawSelectionBorder(width, height);
    this.addChild(this.selectionBorder);

    // SE resize handle — visible only when selected
    this.resizeHandle = new Graphics();
    this.resizeHandle.visible = false;
    this.resizeHandle.cursor = 'se-resize';
    this.drawResizeHandle(width, height);
    this.resizeHandle.on('pointerdown', this.onResizePointerDown, this);
    this.addChild(this.resizeHandle);

    // Edge handles (top / right / bottom / left) — single-axis resize
    this.topHandle = new Graphics();
    this.topHandle.visible = false;
    this.topHandle.cursor = 'ns-resize';
    this.topHandle.on('pointerdown', this.onTopEdgeDown, this);
    this.addChild(this.topHandle);

    this.rightHandle = new Graphics();
    this.rightHandle.visible = false;
    this.rightHandle.cursor = 'ew-resize';
    this.rightHandle.on('pointerdown', this.onRightEdgeDown, this);
    this.addChild(this.rightHandle);

    this.bottomHandle = new Graphics();
    this.bottomHandle.visible = false;
    this.bottomHandle.cursor = 'ns-resize';
    this.bottomHandle.on('pointerdown', this.onBottomEdgeDown, this);
    this.addChild(this.bottomHandle);

    this.leftHandle = new Graphics();
    this.leftHandle.visible = false;
    this.leftHandle.cursor = 'ew-resize';
    this.leftHandle.on('pointerdown', this.onLeftEdgeDown, this);
    this.addChild(this.leftHandle);

    this.drawEdgeHandles(width, height);

    this.eventMode = 'none';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get selected(): boolean {
    return this._selected;
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this.selectionBorder.visible = selected;
    const showHandles = selected && this.canInteract && !this._locked;
    this.resizeHandle.visible = showHandles;
    this.topHandle.visible = showHandles;
    this.rightHandle.visible = showHandles;
    this.bottomHandle.visible = showHandles;
    this.leftHandle.visible = showHandles;
  }

  /**
   * Lock or unlock this sprite. A locked sprite cannot be selected or moved,
   * even when editor mode is active. Idempotent.
   * Event listeners remain registered; `eventMode = 'none'` is enough to
   * suppress them, so there is no need to detach/reattach on each toggle.
   */
  setLocked(locked: boolean): void {
    if (this._locked === locked) return;
    this._locked = locked;
    if (this.canInteract) {
      if (locked) {
        this.eventMode = 'none';
        this.cursor = 'default';
        this.setAllHandlesEventMode('none');
        this.setAllHandlesVisible(false);
      } else {
        this.eventMode = 'static';
        this.cursor = 'grab';
        this.setAllHandlesEventMode('static');
        this.setAllHandlesVisible(this._selected);
      }
    }
  }

  /**
   * Axis-aligned world-space bounds of the tile. Used by marquee selection to
   * test which sprites fall inside the drag rectangle. Rotation is ignored —
   * the reported bounds match the un-rotated sprite footprint.
   */
  getWorldBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.x,
      y: this.y,
      width: this.tileSprite.width,
      height: this.tileSprite.height,
    };
  }

  /**
   * Resize the sprite visuals (does not persist — caller must fire the API).
   */
  resize(width: number, height: number): void {
    this.tileSprite.width = width;
    this.tileSprite.height = height;
    this.selectionBorder.clear();
    this.drawSelectionBorder(width, height);
    this.resizeHandle.clear();
    this.drawResizeHandle(width, height);
    this.drawEdgeHandles(width, height);
    if (this.canInteract && !this.isResizing && !this.activeEdge) this.updateHitArea();
  }

  /**
   * Enable or disable pointer interaction.
   * In play mode all interactions are disabled; in editor mode they are enabled.
   * When locked, event listeners are still registered but `eventMode = 'none'`
   * prevents them from firing — this lets `setLocked(false)` restore interaction
   * by simply flipping `eventMode` back to `'static'` without needing to
   * re-register listeners.
   * Idempotent — calling with the same value twice has no effect.
   */
  setInteractive(interactive: boolean): void {
    if (this.canInteract === interactive) return;
    this.canInteract = interactive;
    if (interactive) {
      // Respect lock state for eventMode but always register listeners.
      this.eventMode = this._locked ? 'none' : 'static';
      this.cursor = this._locked ? 'default' : 'grab';
      this.setAllHandlesEventMode(this._locked ? 'none' : 'static');
      // Explicit hit area — required in PixiJS v8 for a Container with no
      // interactive visible children to receive pointer events. Without this,
      // the tile renders but clicks pass through it.
      this.updateHitArea();
      this.on('pointerdown', this.onPointerDown, this);
      this.on('globalpointermove', this.onPointerMove, this);
      this.on('pointerup', this.onPointerUp, this);
      this.on('pointerupoutside', this.onPointerUp, this);
      this.on('rightclick', this.onRightClick, this);
    } else {
      this.eventMode = 'none';
      this.cursor = 'default';
      this.setAllHandlesEventMode('none');
      this.hitArea = null;
      this.off('pointerdown', this.onPointerDown, this);
      this.off('globalpointermove', this.onPointerMove, this);
      this.off('pointerup', this.onPointerUp, this);
      this.off('pointerupoutside', this.onPointerUp, this);
      this.off('rightclick', this.onRightClick, this);
      this.stopDrag();
      this.stopResize();
      this.stopEdgeDrag();
      // Hide all handles when leaving editor mode
      this.setAllHandlesVisible(false);
    }
  }

  /** Set the container hit area to match the tile bounds. */
  private updateHitArea(): void {
    this.hitArea = new Rectangle(0, 0, this.tileSprite.width, this.tileSprite.height);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private drawSelectionBorder(width: number, height: number): void {
    this.selectionBorder.rect(0, 0, width, height);
    this.selectionBorder.stroke({
      color: SELECTION_BORDER_COLOR,
      alpha: SELECTION_BORDER_ALPHA,
      width: SELECTION_BORDER_WIDTH,
    });
  }

  private drawResizeHandle(width: number, height: number): void {
    const half = RESIZE_HANDLE_SIZE / 2;
    // Centre the handle at the SE corner
    this.resizeHandle.rect(-half, -half, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
    this.resizeHandle.fill({ color: RESIZE_HANDLE_COLOR, alpha: 1 });
    this.resizeHandle.x = width;
    this.resizeHandle.y = height;
    // Explicit hit area so PixiJS registers pointer events on the small square
    this.resizeHandle.hitArea = new Rectangle(-half, -half, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
  }

  private drawEdgeHandles(width: number, height: number): void {
    this.drawSideHandle(this.topHandle, width / 2, 0);
    this.drawSideHandle(this.rightHandle, width, height / 2);
    this.drawSideHandle(this.bottomHandle, width / 2, height);
    this.drawSideHandle(this.leftHandle, 0, height / 2);
  }

  private drawSideHandle(handle: Graphics, x: number, y: number): void {
    const half = RESIZE_HANDLE_SIZE / 2;
    handle.clear();
    handle.rect(-half, -half, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
    handle.fill({ color: RESIZE_HANDLE_COLOR, alpha: 1 });
    handle.x = x;
    handle.y = y;
    handle.hitArea = new Rectangle(-half, -half, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
  }

  /** Apply the same eventMode to all 5 resize handles at once. */
  private setAllHandlesEventMode(mode: 'static' | 'none'): void {
    this.resizeHandle.eventMode = mode;
    this.topHandle.eventMode = mode;
    this.rightHandle.eventMode = mode;
    this.bottomHandle.eventMode = mode;
    this.leftHandle.eventMode = mode;
  }

  /** Show or hide all 5 resize handles at once. */
  private setAllHandlesVisible(visible: boolean): void {
    this.resizeHandle.visible = visible;
    this.topHandle.visible = visible;
    this.rightHandle.visible = visible;
    this.bottomHandle.visible = visible;
    this.leftHandle.visible = visible;
  }

  private onRightClick(e: FederatedPointerEvent): void {
    if (!this.canInteract) return;
    e.stopPropagation();
    // Use clientX/clientY (viewport coords) so TileContextMenu's `position: fixed` renders at the cursor
    this.onContextMenu?.(this.placementId, e.clientX, e.clientY);
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (!this.canInteract) return;
    if (e.button !== 0) return; // ignore middle/right mouse — MMB is reserved for map panning
    // Stop bubbling so the stage's background-click handler only fires for genuine
    // empty-canvas clicks (not tile clicks that happen to reach the stage root).
    e.stopPropagation();

    this.pressedDown = true;
    this.altHeld = e.altKey;
    this.shiftHeld = e.shiftKey;
    this.isDragging = false;
    this.dragMoved = false;
    this.dragStartX = e.globalX;
    this.dragStartY = e.globalY;
    this.originX = this.x;
    this.originY = this.y;

    if (!this.parent) return;
    const parentScale = this.parent.worldTransform.a;
    const invScale = parentScale !== 0 ? 1 / parentScale : 1;
    this.dragOffsetX = (e.globalX - this.parent.x) * invScale - this.x;
    this.dragOffsetY = (e.globalY - this.parent.y) * invScale - this.y;

    // Expand hit area so globalpointermove keeps firing even on fast out-of-bounds drags
    this.hitArea = new Rectangle(-10000, -10000, 20000, 20000);
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.canInteract) return;
    // globalpointermove fires on every pointer move over the stage. Only track
    // movement while the user is actively pressing this sprite — otherwise a
    // stale dragStartX/Y would cause the tile to follow the cursor without a
    // mouse-down (the "stuck to the mouse" bug).
    if (!this.pressedDown) return;
    // Only drag when already selected — pressing on an unselected tile is a
    // click-to-select (handled in onPointerUp), not a drag.
    if (!this._selected) return;

    const dx = e.globalX - this.dragStartX;
    const dy = e.globalY - this.dragStartY;

    if (!this.dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    if (!this.isDragging) {
      this.isDragging = true;
      this.zIndex = DRAG_Z_INDEX;
      this.cursor = 'grabbing';
    }

    this.altHeld = e.altKey;

    if (!this.parent) return;
    const scale = this.parent.worldTransform.a;
    const rawX = (e.globalX - this.parent.x) / scale - this.dragOffsetX;
    const rawY = (e.globalY - this.parent.y) / scale - this.dragOffsetY;

    if (this.altHeld) {
      // Free (sub-grid) placement — bypass snapping
      this.x = rawX;
      this.y = rawY;
    } else {
      const snapped = snapToGrid(rawX, rawY, this.cellSize);
      this.x = snapped.x;
      this.y = snapped.y;
    }
    this.dragMoved = true;
  }

  private onPointerUp(_e: FederatedPointerEvent): void {
    if (!this.pressedDown) return;
    this.pressedDown = false;

    const wasDragging = this.isDragging;
    const wasDragMoved = this.dragMoved;
    const wasShiftHeld = this.shiftHeld;
    this.stopDrag();

    if (wasDragging && wasDragMoved) {
      this.onMoveEnd?.(this.placementId, this.x, this.y);
    } else {
      // Click — CanvasManager owns selection state and will decide whether
      // this click adds/removes/replaces the current selection.
      this.onSelect?.(this.placementId, wasShiftHeld);
    }
  }

  private stopDrag(): void {
    this.isDragging = false;
    this.dragMoved = false;
    this.zIndex = 0;
    // Restore the tile-bounds hit area so future clicks still land on the tile.
    // Setting hitArea = null in editor mode would make the container un-hittable.
    if (this.canInteract) {
      this.updateHitArea();
      this.cursor = 'grab';
    } else {
      this.hitArea = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Resize handle (SE corner)
  // ---------------------------------------------------------------------------

  private readonly onResizePointerDown = (e: FederatedPointerEvent): void => {
    if (!this.canInteract) return;
    e.stopPropagation();

    this.isResizing = true;
    this.resizeStartMouseX = e.globalX;
    this.resizeStartMouseY = e.globalY;
    this.resizeStartWidth = this.tileSprite.width;
    this.resizeStartHeight = this.tileSprite.height;

    // Expand hit area to the whole container so pointermove fires during fast drags
    this.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

    this.on('pointermove', this.onResizePointerMove, this);
    this.on('pointerup', this.onResizePointerUp, this);
    this.on('pointerupoutside', this.onResizePointerUp, this);
  };

  private readonly onResizePointerMove = (e: FederatedPointerEvent): void => {
    if (!this.isResizing || !this.parent) return;

    const scale = this.parent.worldTransform.a !== 0 ? this.parent.worldTransform.a : 1;
    const dx = (e.globalX - this.resizeStartMouseX) / scale;
    const dy = (e.globalY - this.resizeStartMouseY) / scale;

    const rawWidth = this.resizeStartWidth + dx;
    const rawHeight = this.resizeStartHeight + dy;

    // No grid snapping on resize — pixel-accurate for fine-tuning
    this.resize(
      Math.max(MIN_TILE_SIZE, Math.round(rawWidth)),
      Math.max(MIN_TILE_SIZE, Math.round(rawHeight)),
    );
  };

  private readonly onResizePointerUp = (_e: FederatedPointerEvent): void => {
    if (!this.isResizing) return;
    this.stopResize();
    this.onResizeEnd?.(this.placementId, this.tileSprite.width, this.tileSprite.height);
  };

  private stopResize(): void {
    this.isResizing = false;
    // Restore the tile-bounds hit area (same reasoning as stopDrag).
    if (this.canInteract) {
      this.updateHitArea();
    } else {
      this.hitArea = null;
    }
    this.off('pointermove', this.onResizePointerMove, this);
    this.off('pointerup', this.onResizePointerUp, this);
    this.off('pointerupoutside', this.onResizePointerUp, this);
  }

  // ---------------------------------------------------------------------------
  // Edge handle drag (top / right / bottom / left)
  // ---------------------------------------------------------------------------

  private readonly onTopEdgeDown = (e: FederatedPointerEvent): void => this.startEdgeDrag('top', e);
  private readonly onRightEdgeDown = (e: FederatedPointerEvent): void =>
    this.startEdgeDrag('right', e);
  private readonly onBottomEdgeDown = (e: FederatedPointerEvent): void =>
    this.startEdgeDrag('bottom', e);
  private readonly onLeftEdgeDown = (e: FederatedPointerEvent): void =>
    this.startEdgeDrag('left', e);

  private startEdgeDrag(edge: 'top' | 'right' | 'bottom' | 'left', e: FederatedPointerEvent): void {
    if (!this.canInteract) return;
    e.stopPropagation();
    this.activeEdge = edge;
    this.edgeStartMouseX = e.globalX;
    this.edgeStartMouseY = e.globalY;
    this.edgeStartX = this.x;
    this.edgeStartY = this.y;
    this.edgeStartWidth = this.tileSprite.width;
    this.edgeStartHeight = this.tileSprite.height;
    this.hitArea = new Rectangle(-10000, -10000, 20000, 20000);
    this.on('pointermove', this.onEdgeResizeMove, this);
    this.on('pointerup', this.onEdgeResizeUp, this);
    this.on('pointerupoutside', this.onEdgeResizeUp, this);
  }

  private readonly onEdgeResizeMove = (e: FederatedPointerEvent): void => {
    if (!this.activeEdge || !this.parent) return;
    const scale = this.parent.worldTransform.a !== 0 ? this.parent.worldTransform.a : 1;
    const dx = (e.globalX - this.edgeStartMouseX) / scale;
    const dy = (e.globalY - this.edgeStartMouseY) / scale;

    switch (this.activeEdge) {
      case 'right':
        this.resize(
          Math.max(MIN_TILE_SIZE, Math.round(this.edgeStartWidth + dx)),
          this.tileSprite.height,
        );
        break;
      case 'bottom':
        this.resize(
          this.tileSprite.width,
          Math.max(MIN_TILE_SIZE, Math.round(this.edgeStartHeight + dy)),
        );
        break;
      case 'left': {
        const newW = Math.max(MIN_TILE_SIZE, Math.round(this.edgeStartWidth - dx));
        this.x = this.edgeStartX + this.edgeStartWidth - newW;
        this.resize(newW, this.tileSprite.height);
        break;
      }
      case 'top': {
        const newH = Math.max(MIN_TILE_SIZE, Math.round(this.edgeStartHeight - dy));
        this.y = this.edgeStartY + this.edgeStartHeight - newH;
        this.resize(this.tileSprite.width, newH);
        break;
      }
    }
  };

  private readonly onEdgeResizeUp = (_e: FederatedPointerEvent): void => {
    if (!this.activeEdge) return;
    const edge = this.activeEdge;
    this.stopEdgeDrag();
    this.onResizeEnd?.(this.placementId, this.tileSprite.width, this.tileSprite.height);
    // Left/top handles also shift the tile's position
    if (edge === 'left' || edge === 'top') {
      this.onMoveEnd?.(this.placementId, this.x, this.y);
    }
  };

  private stopEdgeDrag(): void {
    this.activeEdge = null;
    if (this.canInteract) this.updateHitArea();
    else this.hitArea = null;
    this.off('pointermove', this.onEdgeResizeMove, this);
    this.off('pointerup', this.onEdgeResizeUp, this);
    this.off('pointerupoutside', this.onEdgeResizeUp, this);
  }

  override destroy(): void {
    this.off('pointerdown', this.onPointerDown, this);
    this.off('pointermove', this.onPointerMove, this);
    this.off('pointerup', this.onPointerUp, this);
    this.off('pointerupoutside', this.onPointerUp, this);
    this.off('rightclick', this.onRightClick, this);
    this.resizeHandle.off('pointerdown', this.onResizePointerDown, this);
    this.topHandle.off('pointerdown', this.onTopEdgeDown, this);
    this.rightHandle.off('pointerdown', this.onRightEdgeDown, this);
    this.bottomHandle.off('pointerdown', this.onBottomEdgeDown, this);
    this.leftHandle.off('pointerdown', this.onLeftEdgeDown, this);
    this.stopEdgeDrag();
    this.tileSprite.destroy();
    this.selectionBorder.destroy();
    this.resizeHandle.destroy();
    this.topHandle.destroy();
    this.rightHandle.destroy();
    this.bottomHandle.destroy();
    this.leftHandle.destroy();
    super.destroy();
  }
}
