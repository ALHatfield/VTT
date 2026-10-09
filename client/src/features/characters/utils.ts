/**
 * Returns the 3-letter uppercase abbreviation for an ability name
 */
export function abilityAbbreviation(name: string): string {
  return name.slice(0, 3).toUpperCase();
}

/**
 * Formats a modifier with an explicit sign, e.g. 3 → "+3", -1 → "-1"
 */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
