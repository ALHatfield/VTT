import { DICE_3D_MAX_DICE, DICE_3D_SUPPORTED_SIDES } from '@vtt/shared';

/** One die for the 3D animator: shape + the authoritative rolled value. */
export interface Mapped3dDie {
  sides: number;
  /** The server-rolled value this die must land on (1-based). */
  value: number;
}

/**
 * Map a server roll result to renderable 3D dice.
 * Accepts unknown because rollData is persisted JSON — structure is verified
 * here. Returns null when the roll can't be animated (malformed data,
 * unsupported die size, or too many dice) — callers fall back to instant
 * chat reveal.
 */
export function mapRollToDice(rollData: unknown): Mapped3dDie[] | null {
  if (typeof rollData !== 'object' || rollData === null) return null;
  const { sides, rolls } = rollData as { sides?: unknown; rolls?: unknown };

  if (typeof sides !== 'number') return null;
  if (!(DICE_3D_SUPPORTED_SIDES as readonly number[]).includes(sides)) return null;
  if (!Array.isArray(rolls)) return null;
  if (rolls.length === 0 || rolls.length > DICE_3D_MAX_DICE) return null;
  if (rolls.some((v) => typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > sides)) {
    return null;
  }
  return (rolls as number[]).map((value) => ({ sides, value }));
}
