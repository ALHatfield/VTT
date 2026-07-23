import { Assets, Container, Sprite } from 'pixi.js';

import type { MapData } from '@vtt/shared';

import type { TilePlacementSprite } from './TilePlacementSprite';

export class BackgroundLayer extends Container {
  private mapSprite: Sprite | null = null;
  private readonly tilePlacementsContainer: Container;
  private readonly tileSpriteMap = new Map<string, TilePlacementSprite>();

  constructor() {
    super();
    this.tilePlacementsContainer = new Container();
    this.tilePlacementsContainer.sortableChildren = true;
    this.addChild(this.tilePlacementsContainer);
  }

  async loadMap(mapData: MapData): Promise<void> {
    this.clearMap();

    if (!mapData.imageUrl) return;

    const texture = await Assets.load(mapData.imageUrl);
    this.mapSprite = new Sprite(texture);
    this.mapSprite.width = mapData.width;
    this.mapSprite.height = mapData.height;
    this.mapSprite.eventMode = 'none';
    // Insert behind tile placements container
    this.addChildAt(this.mapSprite, 0);
  }

  clearMap(): void {
    if (this.mapSprite) {
      this.mapSprite.destroy();
      this.mapSprite = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Tile placement management
  // ---------------------------------------------------------------------------

  get tilePlacementCount(): number {
    return this.tileSpriteMap.size;
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

  override destroy(): void {
    this.clearMap();
    this.clearTilePlacements();
    super.destroy();
  }
}
