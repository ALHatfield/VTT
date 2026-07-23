/**
 * Returns the 3-letter uppercase abbreviation for an ability name
 */
export function abilityAbbreviation(name: string): string {
  return name.slice(0, 3).toUpperCase();
}
