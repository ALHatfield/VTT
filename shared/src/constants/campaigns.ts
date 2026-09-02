/**
 * Campaign constants
 */

export const CAMPAIGN_NAME_MAX_LENGTH = 100;
export const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 500;

export const CAMPAIGN_ROLES = {
  DM: 'dm',
  PLAYER: 'player',
  OBSERVER: 'observer',
} as const;

/** 8-color palette cycled in join order for player campaign colors (Phase 4J) */
export const PLAYER_COLOR_PALETTE = [
  '#e03131', // red
  '#2f9e44', // green
  '#1971c2', // blue
  '#f08c00', // orange
  '#7048e8', // violet
  '#0c8599', // cyan
  '#d6336c', // pink
  '#66a80f', // lime
] as const;
