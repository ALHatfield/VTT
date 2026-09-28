/**
 * Core dice model shared by the renderer and consuming applications.
 * This package renders dice — it never generates roll results. Result
 * values are supplied by the consumer (in VTT, the server is authoritative).
 */

export interface DiceDefinition {
  id: string;
  name: string;
  sides: number;
  /** One label per face, index-aligned with the rendered geometry faces. */
  faces: string[];
}

/**
 * Validate and return a dice definition.
 * @throws Error when the config is structurally invalid
 */
export function createDiceDefinition(config: DiceDefinition): DiceDefinition {
  const { id, name, sides, faces } = config;
  if (!id) {
    throw new Error('DiceDefinition: id is required');
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('DiceDefinition: name must be a non-empty string');
  }
  if (!Number.isInteger(sides) || sides < 2) {
    throw new Error('DiceDefinition: sides must be an integer >= 2');
  }
  if (!Array.isArray(faces) || faces.length !== sides) {
    throw new Error(`DiceDefinition: faces must be an array of length ${sides.toString()}`);
  }
  if (faces.some((f) => typeof f !== 'string' || f.trim() === '')) {
    throw new Error('DiceDefinition: all face labels must be non-empty strings');
  }
  return { id, name, sides, faces };
}

/** Random id fallback for environments without the WebCrypto global (older Node). */
function randomId(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `die-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Create a standard numeric die (faces "1".."N") with uniform geometry labels. */
export function createStandardDie(sides: number, id?: string): DiceDefinition {
  return createDiceDefinition({
    id: id ?? randomId(),
    name: `d${sides.toString()}`,
    sides,
    faces: Array.from({ length: sides }, (_, i) => String(i + 1)),
  });
}
