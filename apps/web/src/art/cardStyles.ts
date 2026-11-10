import type { CardType } from '@clave/shared';

/** A revealed card's background per type: color plus a pattern for color-blind play (SPEC §5.6). */
export const REVEALED_BG: Record<CardType, string> = {
  red: 'bg-red pattern-red',
  blue: 'bg-blue pattern-blue',
  civilian: 'bg-civil',
  traitor: 'bg-traitor',
};
