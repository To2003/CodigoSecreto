import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cryptoRng } from './rng';

describe('cryptoRng', () => {
  it('returns numbers in [0, 1) without a repeatable sequence', () => {
    const a = Array.from({ length: 50 }, () => cryptoRng());
    const b = Array.from({ length: 50 }, () => cryptoRng());
    for (const x of [...a, ...b]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(a).not.toEqual(b);
  });
});

/** Regression guard for the M3 review finding C1: no seeded PRNG in server code paths. */
describe('server randomness', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
    );

  it('never uses mulberry32 outside tests', () => {
    const src = join(import.meta.dirname, '..');
    const offenders = files(src)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .filter((f) => readFileSync(f, 'utf8').includes('mulberry32'));
    expect(offenders).toEqual([]);
  });
});
