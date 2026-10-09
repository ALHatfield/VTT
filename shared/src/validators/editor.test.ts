// Editor validators — Phase 5A
import { describe, expect, it } from 'vitest';

import {
    LIGHT_EMITTER_TYPES,
    LIGHT_PRESETS,
    LIGHT_RADIUS_MAX,
    WALL_COORDINATE_LIMIT,
} from '../constants/editor.js';
import {
    assetCategorySchema,
    assetUploadPayloadSchema,
    lightSourceCreateSchema,
    lightSourceUpdateSchema,
    sceneAtmosphereUpdateSchema,
    wallSegmentCreateSchema,
    wallSegmentUpdateSchema,
} from './editor.js';

describe('assetCategorySchema', () => {
  it('accepts valid categories', () => {
    expect(assetCategorySchema.parse('background')).toBe('background');
    expect(assetCategorySchema.parse('playground')).toBe('playground');
    expect(assetCategorySchema.parse('foreground')).toBe('foreground');
  });

  it('rejects invalid categories', () => {
    expect(() => assetCategorySchema.parse('invalid')).toThrow();
    expect(() => assetCategorySchema.parse('')).toThrow();
    expect(() => assetCategorySchema.parse(null)).toThrow();
  });
});

describe('assetUploadPayloadSchema', () => {
  it('accepts valid payload', () => {
    const result = assetUploadPayloadSchema.parse({ category: 'playground' });
    expect(result.category).toBe('playground');
  });

  it('rejects missing category', () => {
    expect(() => assetUploadPayloadSchema.parse({})).toThrow();
  });

  it('strips unknown fields without throwing', () => {
    const result = assetUploadPayloadSchema.parse({
      category: 'background',
      extra: 'ignored',
    });
    expect(result.category).toBe('background');
  });
});

describe('wallSegmentCreateSchema', () => {
  const base = { x1: 0, y1: 0, x2: 64, y2: 0 };

  it('applies default blocking flags', () => {
    expect(wallSegmentCreateSchema.parse(base)).toEqual({
      ...base,
      blocksLight: true,
      blocksMovement: true,
      isDoor: false,
      isOpen: false,
    });
  });

  it('accepts independent light and movement flags', () => {
    const result = wallSegmentCreateSchema.parse({
      ...base,
      blocksLight: false,
      blocksMovement: true,
    });
    expect(result.blocksLight).toBe(false);
    expect(result.blocksMovement).toBe(true);
  });

  it('accepts an open door', () => {
    const result = wallSegmentCreateSchema.parse({ ...base, isDoor: true, isOpen: true });
    expect(result.isOpen).toBe(true);
  });

  it('rejects zero-length segments', () => {
    expect(wallSegmentCreateSchema.safeParse({ x1: 5, y1: 5, x2: 5, y2: 5 }).success).toBe(false);
  });

  it('rejects open non-door walls', () => {
    expect(wallSegmentCreateSchema.safeParse({ ...base, isOpen: true }).success).toBe(false);
  });

  it('rejects out-of-range and non-finite coordinates', () => {
    expect(
      wallSegmentCreateSchema.safeParse({ ...base, x2: WALL_COORDINATE_LIMIT + 1 }).success,
    ).toBe(false);
    expect(wallSegmentCreateSchema.safeParse({ ...base, y1: Number.NaN }).success).toBe(false);
  });

  it('rejects missing endpoints and unknown fields', () => {
    expect(wallSegmentCreateSchema.safeParse({ x1: 0, y1: 0, x2: 10 }).success).toBe(false);
    expect(wallSegmentCreateSchema.safeParse({ ...base, sceneId: 'x' }).success).toBe(false);
  });
});

describe('wallSegmentUpdateSchema', () => {
  it('accepts a single field', () => {
    expect(wallSegmentUpdateSchema.parse({ isDoor: true })).toEqual({ isDoor: true });
  });

  it('rejects an empty payload', () => {
    expect(wallSegmentUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(wallSegmentUpdateSchema.safeParse({ isOpen: 'yes' }).success).toBe(false);
    expect(wallSegmentUpdateSchema.safeParse({ x1: '10' }).success).toBe(false);
  });
});

describe('LIGHT_PRESETS', () => {
  it('defines a preset for every emitter type', () => {
    expect(Object.keys(LIGHT_PRESETS).sort()).toEqual([...LIGHT_EMITTER_TYPES].sort());
  });

  it.each(LIGHT_EMITTER_TYPES)('%s serializes to a valid full create payload', (emitterType) => {
    const { label: _label, tone: _tone, ...defaults } = LIGHT_PRESETS[emitterType];
    const payload = { emitterType, x: 0, y: 0, ...defaults };
    expect(lightSourceCreateSchema.parse(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('includes both warm and cold presets', () => {
    const tones = new Set(Object.values(LIGHT_PRESETS).map((p) => p.tone));
    expect(tones.has('warm')).toBe(true);
    expect(tones.has('cold')).toBe(true);
  });
});

describe('lightSourceCreateSchema', () => {
  const base = { emitterType: 'torch', x: 10, y: 20 };

  it('accepts a preset-only payload without adding defaults', () => {
    expect(lightSourceCreateSchema.parse(base)).toEqual(base);
  });

  it('rejects unknown emitter types and animation modes', () => {
    expect(lightSourceCreateSchema.safeParse({ ...base, emitterType: 'sun' }).success).toBe(false);
    expect(lightSourceCreateSchema.safeParse({ ...base, animationMode: 'strobe' }).success).toBe(
      false,
    );
  });

  it('rejects out-of-range numeric fields', () => {
    for (const bad of [
      { radius: 0 },
      { radius: LIGHT_RADIUS_MAX + 1 },
      { intensity: -0.1 },
      { intensity: 1.1 },
      { falloff: 2 },
      { x: Number.POSITIVE_INFINITY },
    ]) {
      expect(lightSourceCreateSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });

  it('rejects non-hex colors', () => {
    for (const color of ['red', '#fff', '#12345g', 'ff9a3c']) {
      expect(lightSourceCreateSchema.safeParse({ ...base, color }).success).toBe(false);
    }
  });

  it('rejects client-supplied seeds and ownership fields', () => {
    expect(lightSourceCreateSchema.safeParse({ ...base, animationSeed: 1 }).success).toBe(false);
    expect(lightSourceCreateSchema.safeParse({ ...base, sceneId: 's' }).success).toBe(false);
  });
});

describe('lightSourceUpdateSchema', () => {
  it('accepts a single field', () => {
    expect(lightSourceUpdateSchema.parse({ animationMode: 'pulse' })).toEqual({
      animationMode: 'pulse',
    });
  });

  it('rejects an empty payload', () => {
    expect(lightSourceUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('sceneAtmosphereUpdateSchema', () => {
  it('accepts known presets and rejects others', () => {
    expect(sceneAtmosphereUpdateSchema.parse({ weatherPreset: 'snow' })).toEqual({
      weatherPreset: 'snow',
    });
    expect(sceneAtmosphereUpdateSchema.safeParse({ weatherPreset: 'tornado' }).success).toBe(
      false,
    );
  });
});
