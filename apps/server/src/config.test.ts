import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

describe('parseConfig', () => {
  it('uses development defaults', () => {
    expect(parseConfig({})).toEqual({
      ok: true,
      config: { port: 3001, clientOrigins: ['http://localhost:5173'], logLevel: 'info' },
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
  ])('rejects %s', (_label, env) => {
    expect(parseConfig(env)).toMatchObject({ ok: false });
  });
});
