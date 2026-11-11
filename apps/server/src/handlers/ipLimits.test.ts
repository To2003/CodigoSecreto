import { describe, expect, it } from 'vitest';
import { clientIp, IpLimiter, limitKey, proxyDiagnosis } from './ipLimits';

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

  it('behind a proxy, an address it cannot trust is unknown (null), never the proxy one', () => {
    expect(clientIp('10.0.0.1', {}, 1)).toBeNull();
    expect(clientIp('10.0.0.1', { 'x-forwarded-for': '203.0.113.7' }, 2)).toBeNull();
    // A private entry where the player's should be: the hop count is wrong for this host.
    expect(clientIp('10.0.0.1', { 'x-forwarded-for': '203.0.113.7, 10.1.2.3' }, 1)).toBeNull();
    expect(clientIp('10.0.0.1', { 'x-forwarded-for': '100.64.0.9' }, 1)).toBeNull();
  });

  it('IPv4-mapped IPv6 is plain IPv4; other IPv6 counts by /64', () => {
    expect(limitKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(limitKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(limitKey('2001:0db8:0001:0002:bbbb:cccc:dddd:eeee')).toBe('2001:db8:1:2::/64');
    expect(limitKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
  });

  it('describes the proxy chain without any address', () => {
    const d = proxyDiagnosis({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }, 1);
    expect(d).toEqual({ forwardedEntries: 2, trustedHops: 1, chosenEntry: 'public' });
    expect(JSON.stringify(d)).not.toContain('203');
    expect(proxyDiagnosis({}, 1).chosenEntry).toBe('none');
    expect(proxyDiagnosis({ 'x-forwarded-for': '10.0.0.2' }, 1).chosenEntry).toBe('private');
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

  it('an unknown IP is never limited nor counted', () => {
    const limits = new IpLimiter(options, () => 0);
    for (let i = 0; i < 5; i++) expect(limits.openSocket(null)).toBe(true);
    limits.count(null, 'rooms');
    expect(limits.allows(null, 'rooms')).toBe(true);
    limits.closeSocket(null);
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
