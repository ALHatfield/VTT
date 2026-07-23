import { randomInt } from 'node:crypto';

import type { DiceFormula, RollResult } from '@vtt/shared';
import { DICE_MAX_COUNT, DICE_MAX_SIDES } from '@vtt/shared';

/**
 * Parses a dice formula string into a structured `DiceFormula`.
 *
 * Supported formats:
 *   "d20"           → 1d20, no modifier
 *   "3d6"           → 3d6, no modifier
 *   "2d8+3"         → 2d8, modifier +3
 *   "d6-1"          → 1d6, modifier -1
 *   "d20 advantage" → 1d20 with advantage
 *   "d20 disadvantage" → 1d20 with disadvantage
 *
 * Returns `null` for any input that cannot be parsed or violates bounds.
 */
export function parseDiceFormula(raw: string): DiceFormula | null {
  const trimmed = raw.trim().toLowerCase();

  const advantage = /\badvantage\b/.test(trimmed);
  const disadvantage = /\bdisadvantage\b/.test(trimmed);

  // Strip advantage/disadvantage keywords and any trailing whitespace
  const expr = trimmed
    .replace(/\b(advantage|disadvantage)\b/g, '')
    .trim();

  // Match: optional count, 'd', sides, optional signed modifier
  const match = /^(\d+)?d(\d+)\s*([+-]\s*\d+)?$/.exec(expr);
  if (!match) return null;

  const count = match[1] !== undefined ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifierRaw = match[3] !== undefined ? match[3].replace(/\s/g, '') : '';
  const modifier = modifierRaw !== '' ? parseInt(modifierRaw, 10) : 0;

  // Both flags at once is a logical contradiction — reject the formula
  if (advantage && disadvantage) return null;

  if (!Number.isFinite(count) || count < 1 || count > DICE_MAX_COUNT) return null;
  if (!Number.isFinite(sides) || sides < 2 || sides > DICE_MAX_SIDES) return null;
  if (!Number.isFinite(modifier) || Math.abs(modifier) > 10_000) return null;

  return { raw, count, sides, modifier, advantage, disadvantage };
}

/**
 * Executes a parsed dice formula using cryptographic RNG.
 *
 * Advantage / disadvantage mechanics (D&D rules, count === 1 only):
 *   - advantage:    roll 2 dice, keep the higher; both values are stored in `rolls`
 *   - disadvantage: roll 2 dice, keep the lower;  both values are stored in `rolls`
 *   - When count > 1 the adv/dis flags are ignored (no standard rule exists).
 *
 * `keptRolls` always contains the values that contribute to `total`.
 * `total` = sum(keptRolls) + modifier.
 */
export function rollDiceFormula(formula: DiceFormula): RollResult {
  const { count, sides, modifier, advantage, disadvantage } = formula;
  const applyAdvDis = (advantage || disadvantage) && count === 1;

  let rolls: number[];
  let keptRolls: number[];

  if (applyAdvDis) {
    // Roll exactly two dice and keep the appropriate one
    const r1 = randomInt(1, sides + 1);
    const r2 = randomInt(1, sides + 1);
    rolls = [r1, r2];
    keptRolls = advantage ? [Math.max(r1, r2)] : [Math.min(r1, r2)];
  } else {
    rolls = Array.from<number>({ length: count }).map(() => randomInt(1, sides + 1));
    keptRolls = [...rolls];
  }

  const diceSum = keptRolls.reduce((acc, v) => acc + v, 0);
  const total = diceSum + modifier;

  return {
    formula: formula.raw,
    count: formula.count,
    sides: formula.sides,
    rolls,
    keptRolls,
    modifier,
    advantage,
    disadvantage,
    total,
  };
}
