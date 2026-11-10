import { describe, expect, it } from 'vitest';
import { clientIp, IpLimiter } from './ipLimits';

describe('clientIp', () => {
  it('ignores X-Forwarded-For unless hops are trusted', () => {
    expect(clientIp('10.0.0.1', { 'x-forwarded-for': '1.2.3.4' }, 0)).toBe('10.0.0.1');
  });

  it('takes the entry the trusted proxy wrote, not what the client claims', () => {
    // The client forged "6.6.6.6"; Render's proxy appended the real address.
    const headers = { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' };
    expect(clientIp('10.0.0.1', headers, 1)).toBe('203.0.113.7');
    expect(clientIp('10.0.0.1', headers, 2)).toBe('6.6.6.6');
  });

  it('falls back to the socket address without the header or with too few entries', () => {
    expect(clientIp('10.0.0.1', {}, 1)).toBe('10.0.0.1');
    expect(clientIp('10.0.0.1', { 'x-forwarded-for': '203.0.113.7' }, 2)).toBe('10.0.0.1');
  });
});

describe('IpLimiter', () => {
  const options = { socketsPerIp: 2, roomsPerWindow: 2, failedJoinsPerWindow: 3, windowMs: 1_000 };

  it('caps open sockets per IP and frees them on close', () => {
    const limits = new IpLimiter(options, () => 0);
    expect(limits.openSocket('a')).toBe(true);
    expect(limits.openSocket('a')).toBe(true);
    expect(limits.openSocket('a')).toBe(false);
    expect(limits.openSocket('b')).toBe(true);
    limits.closeSocket('a');
    expect(limits.openSocket('a')).toBe(true);
  });

  it('counts per window and resets when it ends', () => {
    let t = 0;
    const limits = new IpLimiter(options, () => t);
    for (let i = 0; i < 2; i++) {
      expect(limits.allows('a', 'rooms')).toBe(true);
      limits.count('a', 'rooms');
    }
    expect(limits.allows('a', 'rooms')).toBe(false);
    expect(limits.allows('b', 'rooms')).toBe(true);
    expect(limits.allows('a', 'failedJoins')).toBe(true);
    t = 1_000;
    expect(limits.allows('a', 'rooms')).toBe(true);
  });

  it('prunes finished windows', () => {
    let t = 0;
    const limits = new IpLimiter(options, () => t);
    limits.count('a', 'failedJoins');
    t = 5_000;
    limits.prune();
    // A fresh window: the old count is gone.
    for (let i = 0; i < 3; i++) limits.count('a', 'failedJoins');
    expect(limits.allows('a', 'failedJoins')).toBe(false);
  });
});
