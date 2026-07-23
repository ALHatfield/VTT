// Editor validators — Phase 5A
import { describe, expect, it } from 'vitest';

import { assetCategorySchema, assetUploadPayloadSchema } from './editor.js';

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
