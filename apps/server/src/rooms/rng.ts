import { randomInt } from 'node:crypto';
import type { Rng } from '@clave/shared';

// crypto.randomInt takes at most 2^48 - 1; 47 bits are plenty to shuffle 25 cards.
const SCALE = 2 ** 47;

/**
 * The randomness behind every real game (deal, key map, card ids, starting team, penalties).
 * It must be unpredictable: with a seeded 32-bit PRNG the public card ids
 * are enough to brute-force the seed and rebuild the key map in seconds (M3 review, ADR-022).
 * The engine still takes any `Rng`, so tests and the simulator keep using seeded ones.
 */
export const cryptoRng: Rng = () => randomInt(SCALE) / SCALE;
