import { describe, expect, it } from 'vitest';
import { mulberry32, pick, randomId, shuffle } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(seqA);
  });

  it('differs across seeds and stays in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, mulberry32(3));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('is reproducible with the same seed', () => {
    const input = Array.from({ length: 25 }, (_, i) => i);
    expect(shuffle(input, mulberry32(9))).toEqual(shuffle(input, mulberry32(9)));
  });
});

describe('pick', () => {
  it('returns an element of the list', () => {
    const list = ['a', 'b', 'c'];
    expect(list).toContain(pick(list, mulberry32(5)));
  });

  it('throws on an empty list', () => {
    expect(() => pick([], mulberry32(5))).toThrow(RangeError);
  });
});

describe('randomId', () => {
  it('builds ids of the requested length from the rng', () => {
    const id = randomId(mulberry32(11), 8);
    expect(id).toMatch(/^[a-z0-9]{8}$/);
    expect(randomId(mulberry32(11), 8)).toBe(id);
  });
});
