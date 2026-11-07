import type { AddressInfo } from 'node:net';
import { healthResponseSchema, HEALTH_PATH } from '@clave/shared';
import { io as connectClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type ClaveServer } from './app';

const ALLOWED = 'http://localhost:5173';
const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };

let server: ClaveServer | undefined;
let client: Socket | undefined;

afterEach(async () => {
  client?.disconnect();
  client = undefined;
  if (server) await server.close();
  server = undefined;
});

const make = () => {
  server = createServer({ clientOrigins: [ALLOWED], log: silent });
  return server;
};

const listen = async (s: ClaveServer) => {
  await new Promise<void>((resolve) => s.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = s.httpServer.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
};

const connect = (url: string, origin: string) =>
  new Promise<'connected' | 'rejected'>((resolve) => {
    client = connectClient(url, {
      transports: ['websocket'],
      extraHeaders: { origin },
      reconnection: false,
      timeout: 2000,
    });
    client.on('connect', () => {
      resolve('connected');
    });
    client.on('connect_error', () => {
      resolve('rejected');
    });
  });

describe('GET /health', () => {
  it('responds 200 with a body that matches the shared contract', async () => {
    const res = await request(make().app).get(HEALTH_PATH);
    expect(res.status).toBe(200);
    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('allows CORS only for the configured client origin', async () => {
    const { app } = make();
    const allowed = await request(app).get(HEALTH_PATH).set('Origin', ALLOWED);
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED);

    const other = await request(app).get(HEALTH_PATH).set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Socket.IO', () => {
  it('accepts a connection from the client origin', async () => {
    const url = await listen(make());
    expect(await connect(url, ALLOWED)).toBe('connected');
  });

  it('rejects a connection from any other origin', async () => {
    const url = await listen(make());
    expect(await connect(url, 'https://evil.example')).toBe('rejected');
  });
});

describe('Socket.IO handshake over HTTP polling (how browsers start)', () => {
  const handshake = (target: ClaveServer['httpServer'], origin?: string) => {
    const req = request(target).get('/socket.io/?EIO=4&transport=polling');
    return origin === undefined ? req : req.set('Origin', origin);
  };

  it('accepts the client origin', async () => {
    const { httpServer } = make();
    const res = await handshake(httpServer, ALLOWED);
    expect(res.status).toBe(200);
  });

  it.each([
    ['another origin', 'https://evil.example'],
    ['the null origin', 'null'],
    ['no Origin header', undefined],
  ])('rejects %s', async (_label, origin) => {
    const { httpServer } = make();
    const res = await handshake(httpServer, origin);
    expect(res.status).toBe(403);
  });
});
