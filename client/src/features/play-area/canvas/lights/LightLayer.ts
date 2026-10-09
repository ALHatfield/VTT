// LightLayer — Phase PM4
// Tinted additive glow layer for authored (editor 5G) and temporary (DM) lights.
// Sits above the map and below tokens; the fog layer still composites on top, so
// lighting never reveals hidden areas. Glows are clipped to their wall-aware LOS polygon.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';

import type { LightEmitterType, LightSource, VisibilityPolygon } from '@vtt/shared';
import { DEFAULT_GRID_CELL_SIZE } from '@vtt/shared';

import { hash01, hexColorToNumber, lightAnimationFactor } from './light-animation';

/** Fields shared by `LightSource` and `TemporaryLight` that rendering needs. */
export type RenderableLight = Pick<
  LightSource,
  | 'id'
  | 'x'
  | 'y'
  | 'radius'
  | 'color'
  | 'intensity'
  | 'falloff'
  | 'emitterType'
  | 'animationMode'
  | 'animationSeed'
>;

/** Lights past this count still render, but hold a static brightness. */
export const MAX_ANIMATED_LIGHTS = 100;
/** Ember particles are decorative — capped so dense scenes stay in budget. */
export const MAX_EMBER_EMITTERS = 16;
export const EMBERS_PER_EMITTER = 10;

const EMBER_EMITTER_TYPES: ReadonlySet<LightEmitterType> = new Set(['fireplace']);
const GLOW_TEXTURE_SIZE = 256;
/** Falloff is quantized so lights share a small set of gradient textures. */
const FALLOFF_STEPS = 8;
/** Hard-edge lights still get a one-pixel-ish fade to avoid aliasing. */
const MAX_INNER_STOP = 0.97;
const FALLOFF_MID_ALPHA = 0.35;
/** Fraction of radius that breathes with the animation factor. */
const SCALE_WOBBLE = 0.04;

const EMBER_LIFETIME_MS = 2400;
const EMBER_RISE_CELLS = 1.2;
const EMBER_SPREAD_CELLS = 0.35;
const EMBER_SWAY_CELLS = 0.08;
const EMBER_RADIUS = 2;
const EMBER_COLOR = 0xffa040;
const EMBER_MAX_ALPHA = 0.9;
/** Distinct prime stride so each ember's hash inputs don't overlap its neighbour's. */
const EMBER_HASH_STRIDE = 7919;
const TWO_PI = Math.PI * 2;
/** A polygon computed for a different light position is stale — fall back to the full circle. */
const OCCLUSION_ORIGIN_EPSILON = 0.5;
const MIN_POLYGON_POINTS = 3;

interface GlowEntry {
  light: RenderableLight;
  sprite: Sprite;
  baseScale: number;
  mask: Graphics | null;
  maskPolygon: VisibilityPolygon | null;
}

export interface LightLayerStats {
  rendered: number;
  animated: number;
  emberEmitters: number;
}

function falloffStep(falloff: number): number {
  return Math.round(Math.max(0, Math.min(1, falloff)) * FALLOFF_STEPS);
}

function createGlowTexture(step: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = GLOW_TEXTURE_SIZE;
  canvas.height = GLOW_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Texture.WHITE;

  const r = GLOW_TEXTURE_SIZE / 2;
  const inner = Math.min(1 - step / FALLOFF_STEPS, MAX_INNER_STOP);
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(inner, 'rgba(255,255,255,1)');
  gradient.addColorStop(inner + (1 - inner) / 2, `rgba(255,255,255,${FALLOFF_MID_ALPHA})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, TWO_PI);
  ctx.fill();
  return Texture.from(canvas);
}

export class LightLayer extends Container {
  private readonly glowContainer: Container;
  private readonly maskContainer: Container;
  private readonly emberGraphics: Graphics;
  private readonly entries = new Map<string, GlowEntry>();
  private readonly textures = new Map<number, Texture>();
  private occlusion = new Map<string, VisibilityPolygon>();
  private animated: GlowEntry[] = [];
  private emberEmitters: GlowEntry[] = [];
  private cellSize = DEFAULT_GRID_CELL_SIZE;
  private reducedMotion = false;
  /** Duration of the most recent `update()` call — for render-budget checks. */
  lastUpdateMs = 0;

  constructor() {
    super();
    this.label = 'light-layer';
    this.eventMode = 'none';
    this.glowContainer = new Container();
    this.glowContainer.eventMode = 'none';
    this.maskContainer = new Container();
    this.maskContainer.eventMode = 'none';
    this.emberGraphics = new Graphics();
    this.emberGraphics.eventMode = 'none';
    this.emberGraphics.blendMode = 'add';
    this.addChild(this.maskContainer);
    this.addChild(this.glowContainer);
    this.addChild(this.emberGraphics);
  }

  /** Server LOS polygons; `light` polygons clip the matching glow so walls block it. */
  setOcclusionPolygons(polygons: readonly VisibilityPolygon[]): void {
    this.occlusion = new Map(
      polygons.filter((p) => p.source === 'light').map((p) => [p.emitterId, p]),
    );
    for (const entry of this.entries.values()) this.applyOcclusion(entry);
  }

  setCellSize(cellSize: number): void {
    if (cellSize === this.cellSize) return;
    this.cellSize = cellSize;
    for (const entry of this.entries.values()) this.applyStatic(entry);
  }

  /** Reduced motion freezes flicker at full intensity and hides embers. */
  setReducedMotion(reduced: boolean): void {
    if (reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    if (!reduced) return;
    for (const entry of this.animated) this.applyStatic(entry);
    this.emberGraphics.clear();
  }

  setLights(lights: readonly RenderableLight[]): void {
    const nextIds = new Set(lights.map((l) => l.id));
    for (const [id, entry] of this.entries) {
      if (nextIds.has(id)) continue;
      this.removeMask(entry);
      this.glowContainer.removeChild(entry.sprite);
      entry.sprite.destroy();
      this.entries.delete(id);
    }

    for (const light of lights) {
      let entry = this.entries.get(light.id);
      if (!entry) {
        const sprite = new Sprite(this.getTexture(light.falloff));
        sprite.anchor.set(0.5);
        sprite.blendMode = 'add';
        sprite.eventMode = 'none';
        this.glowContainer.addChild(sprite);
        entry = { light, sprite, baseScale: 1, mask: null, maskPolygon: null };
        this.entries.set(light.id, entry);
      } else {
        entry.sprite.texture = this.getTexture(light.falloff);
        entry.light = light;
      }
      this.applyStatic(entry);
      this.applyOcclusion(entry);
    }

    const all = [...this.entries.values()];
    this.animated = all.filter((e) => e.light.animationMode !== 'none').slice(0, MAX_ANIMATED_LIGHTS);
    this.emberEmitters = all
      .filter((e) => EMBER_EMITTER_TYPES.has(e.light.emitterType) && e.light.intensity > 0)
      .slice(0, MAX_EMBER_EMITTERS);
    if (this.emberEmitters.length === 0) this.emberGraphics.clear();
  }

  /** Advance animation to `timeMs`. Called from the PixiJS ticker. */
  update(timeMs: number): void {
    if (this.reducedMotion) return;
    const start = performance.now();

    for (const entry of this.animated) {
      const { animationMode, animationSeed, intensity } = entry.light;
      const factor = lightAnimationFactor(animationMode, animationSeed, timeMs);
      entry.sprite.alpha = intensity * factor;
      entry.sprite.scale.set(entry.baseScale * (1 - SCALE_WOBBLE + SCALE_WOBBLE * factor));
    }
    this.drawEmbers(timeMs);

    this.lastUpdateMs = performance.now() - start;
  }

  getStats(): LightLayerStats {
    return {
      rendered: this.entries.size,
      animated: this.animated.length,
      emberEmitters: this.emberEmitters.length,
    };
  }

  override destroy(): void {
    for (const texture of this.textures.values()) {
      if (texture !== Texture.WHITE) texture.destroy(true);
    }
    this.textures.clear();
    this.entries.clear();
    super.destroy({ children: true });
  }

  private getTexture(falloff: number): Texture {
    const step = falloffStep(falloff);
    let texture = this.textures.get(step);
    if (!texture) {
      texture = createGlowTexture(step);
      this.textures.set(step, texture);
    }
    return texture;
  }

  private applyStatic(entry: GlowEntry): void {
    const { light, sprite } = entry;
    entry.baseScale = (light.radius * this.cellSize * 2) / GLOW_TEXTURE_SIZE;
    sprite.x = light.x;
    sprite.y = light.y;
    sprite.tint = hexColorToNumber(light.color);
    sprite.alpha = light.intensity;
    sprite.scale.set(entry.baseScale);
  }

  private applyOcclusion(entry: GlowEntry): void {
    const polygon = this.occlusion.get(entry.light.id);
    const usable =
      polygon !== undefined &&
      polygon.points.length >= MIN_POLYGON_POINTS &&
      Math.abs(polygon.origin.x - entry.light.x) < OCCLUSION_ORIGIN_EPSILON &&
      Math.abs(polygon.origin.y - entry.light.y) < OCCLUSION_ORIGIN_EPSILON;
    if (!usable) {
      this.removeMask(entry);
      return;
    }
    if (entry.maskPolygon === polygon) return;

    if (!entry.mask) {
      entry.mask = new Graphics();
      entry.mask.eventMode = 'none';
      this.maskContainer.addChild(entry.mask);
      entry.sprite.mask = entry.mask;
    }
    entry.mask.clear().poly(polygon.points).fill({ color: 0xffffff });
    entry.maskPolygon = polygon;
  }

  private removeMask(entry: GlowEntry): void {
    if (!entry.mask) return;
    entry.sprite.mask = null;
    this.maskContainer.removeChild(entry.mask);
    entry.mask.destroy();
    entry.mask = null;
    entry.maskPolygon = null;
  }

  private drawEmbers(timeMs: number): void {
    if (this.emberEmitters.length === 0) return;
    const g = this.emberGraphics;
    g.clear();
    const cell = this.cellSize;
    for (const { light } of this.emberEmitters) {
      for (let i = 0; i < EMBERS_PER_EMITTER; i++) {
        const key = light.animationSeed + i * EMBER_HASH_STRIDE;
        const offset = hash01(key);
        const spread = hash01(key + 1) - 0.5;
        const life = ((timeMs + offset * EMBER_LIFETIME_MS) % EMBER_LIFETIME_MS) / EMBER_LIFETIME_MS;
        const x =
          light.x +
          spread * 2 * EMBER_SPREAD_CELLS * cell +
          Math.sin(life * TWO_PI + offset * TWO_PI) * EMBER_SWAY_CELLS * cell;
        const y = light.y - life * EMBER_RISE_CELLS * cell;
        g.circle(x, y, EMBER_RADIUS).fill({
          color: EMBER_COLOR,
          alpha: (1 - life) * EMBER_MAX_ALPHA * light.intensity,
        });
      }
    }
  }
}
