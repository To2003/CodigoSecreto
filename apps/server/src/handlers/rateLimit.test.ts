import { describe, expect, it } from 'vitest';
import { TokenBucket } from './rateLimit';

describe('TokenBucket', () => {
  it('allows a burst up to capacity, then refills over time', () => {
    let now = 0;
    const bucket = new TokenBucket(3, 2, () => now);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    now = 499;
    expect(bucket.take()).toBe(false);
    now = 500;
    expect(bucket.take()).toBe(true);
    now = 100_000;
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});
