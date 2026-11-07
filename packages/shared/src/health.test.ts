import { describe, expect, it } from 'vitest';
import { HEALTH_PATH, healthResponseSchema } from './health';

describe('health contract', () => {
  it('exposes the /health path', () => {
    expect(HEALTH_PATH).toBe('/health');
  });

  it('accepts a healthy response', () => {
    expect(healthResponseSchema.parse({ ok: true, uptimeSec: 12.5 })).toEqual({
      ok: true,
      uptimeSec: 12.5,
    });
  });

  it.each([
    ['ok false', { ok: false, uptimeSec: 1 }],
    ['missing uptime', { ok: true }],
    ['negative uptime', { ok: true, uptimeSec: -1 }],
    ['uptime as string', { ok: true, uptimeSec: '3' }],
    ['not an object', 'ok'],
  ])('rejects %s', (_label, payload) => {
    expect(healthResponseSchema.safeParse(payload).success).toBe(false);
  });
});
