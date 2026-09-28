import { describe, expect, it } from 'vitest';

import { createDiceDefinition, createStandardDie } from './dice.js';

describe('createDiceDefinition', () => {
  const valid = {
    id: 'test-die',
    name: 'd6',
    sides: 6,
    faces: ['1', '2', '3', '4', '5', '6'],
  };

  it('returns a valid definition unchanged', () => {
    const die = createDiceDefinition(valid);
    expect(die.id).toBe('test-die');
    expect(die.name).toBe('d6');
    expect(die.sides).toBe(6);
    expect(die.faces).toHaveLength(6);
  });

  it('throws when id is missing', () => {
    expect(() => createDiceDefinition({ ...valid, id: '' })).toThrow('id is required');
  });

  it('throws when name is empty', () => {
    expect(() => createDiceDefinition({ ...valid, name: '  ' })).toThrow('non-empty string');
  });

  it('throws when sides is not an integer', () => {
    expect(() => createDiceDefinition({ ...valid, sides: 5.5 })).toThrow('integer >= 2');
  });

  it('throws when sides is less than 2', () => {
    expect(() => createDiceDefinition({ ...valid, sides: 1 })).toThrow('integer >= 2');
  });

  it('throws when faces length does not match sides', () => {
    expect(() => createDiceDefinition({ ...valid, faces: ['1', '2'] })).toThrow(
      'array of length 6',
    );
  });

  it('throws when a face label is empty', () => {
    expect(() =>
      createDiceDefinition({ ...valid, faces: ['1', '2', '3', '4', '5', ' '] }),
    ).toThrow('non-empty strings');
  });
});

describe('createStandardDie', () => {
  it.each([4, 6, 8, 10, 12, 20, 100])('creates a d%i with numeric faces', (sides) => {
    const die = createStandardDie(sides);
    expect(die.sides).toBe(sides);
    expect(die.name).toBe(`d${sides.toString()}`);
    expect(die.faces).toHaveLength(sides);
    expect(die.faces[0]).toBe('1');
    expect(die.faces[sides - 1]).toBe(String(sides));
  });

  it('uses the provided id when given', () => {
    const die = createStandardDie(6, 'fixed-id');
    expect(die.id).toBe('fixed-id');
  });

  it('generates unique ids when none provided', () => {
    const a = createStandardDie(6);
    const b = createStandardDie(6);
    expect(a.id).not.toBe(b.id);
  });
});
