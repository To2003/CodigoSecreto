/** A source of uniform numbers in [0, 1). The engine never calls Math.random(): games replay from a seed. */
export type Rng = () => number;

/** mulberry32: small, fast, seedable PRNG (public domain). Not for secrets. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, max). */
export const randomInt = (rng: Rng, max: number): number => Math.floor(rng() * max);

/** Fisher–Yates on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new RangeError('pick() needs a non-empty list');
  return items[randomInt(rng, items.length)] as T;
}

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Opaque id, so card ids carry no information about board position or type (SPEC §2.1). */
export function randomId(rng: Rng, length = 10): string {
  let id = '';
  for (let i = 0; i < length; i++) id += ID_ALPHABET.charAt(randomInt(rng, ID_ALPHABET.length));
  return id;
}
