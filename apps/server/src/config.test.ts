import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

describe('parseConfig', () => {
  it('uses development defaults', () => {
    expect(parseConfig({})).toEqual({
      ok: true,
      config: {
        port: 3001,
        clientOrigins: ['http://localhost:5173'],
        logLevel: 'info',
        trustProxyHops: 0,
        roomsPerMinute: 10,
        auth: { mode: 'off' },
        statsMinGameMs: 300_000,
      },
    });
  });

  it('normalizes origins: trailing slash, case, spaces, duplicates', () => {
    const res = parseConfig({
      CLIENT_ORIGIN: ' https://Clave.example/ , http://192.168.0.10:5173,https://clave.example ',
    });
    expect(res).toMatchObject({
      ok: true,
      config: { clientOrigins: ['https://clave.example', 'http://192.168.0.10:5173'] },
    });
  });

  it.each([
    ['empty list', { CLIENT_ORIGIN: ' , ' }],
    ['not a URL', { CLIENT_ORIGIN: 'clave.example' }],
    ['not http(s)', { CLIENT_ORIGIN: 'ftp://clave.example' }],
    ['port out of range', { PORT: '70000' }],
    ['port not a number', { PORT: 'abc' }],
    ['port zero', { PORT: '0' }],
    ['proxy hops not a number', { TRUST_PROXY_HOPS: 'yes' }],
    ['too many proxy hops', { TRUST_PROXY_HOPS: '9' }],
    ['rooms per minute zero', { ROOMS_PER_MINUTE: '0' }],
    ['unknown auth mode', { AUTH_MODE: 'google' }],
    ['memory auth in production', { AUTH_MODE: 'memory', NODE_ENV: 'production' }],
    ['supabase without url', { AUTH_MODE: 'supabase', SUPABASE_SERVICE_ROLE_KEY: 'k' }],
    ['supabase without key', { AUTH_MODE: 'supabase', SUPABASE_URL: 'https://x.supabase.co' }],
    ['bad stats minimum', { STATS_MIN_GAME_SECONDS: '5m' }],
  ])('rejects %s', (_label, env) => {
    expect(parseConfig(env)).toMatchObject({ ok: false });
  });

  it('reads the accounts settings and never puts the service key in an error', () => {
    expect(
      parseConfig({
        AUTH_MODE: 'supabase',
        SUPABASE_URL: 'https://abcd.supabase.co/',
        SUPABASE_SERVICE_ROLE_KEY: 'secret-key',
        STATS_MIN_GAME_SECONDS: '0',
      }),
    ).toMatchObject({
      ok: true,
      config: {
        auth: { mode: 'supabase', url: 'https://abcd.supabase.co/', serviceKey: 'secret-key' },
        statsMinGameMs: 0,
      },
    });
    expect(parseConfig({ AUTH_MODE: 'memory' })).toMatchObject({
      ok: true,
      config: { auth: { mode: 'memory' } },
    });
    const bad = parseConfig({
      AUTH_MODE: 'supabase',
      SUPABASE_URL: 'http://x',
      SUPABASE_SERVICE_ROLE_KEY: 'secret-key',
    });
    expect(JSON.stringify(bad)).not.toContain('secret-key');
  });
});
