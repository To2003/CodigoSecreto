import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { HEALTH_PATH, type HealthResponse } from '@clave/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import { clientIp, DEFAULT_IP_LIMITS, IpLimiter, type IpLimitOptions } from './handlers/ipLimits';
import { broadcast, registerLobbyHandlers, type IoServer } from './handlers/lobby';
import type { Logger } from './log';
import { RoomStore } from './rooms/store';

/** How often seats and abandoned rooms are swept. */
const SWEEP_INTERVAL_MS = 5_000;
/** How often game timers are checked: a timer ends at most this late. */
const TICK_INTERVAL_MS = 250;
/** Largest message a client may send (custom word lists are the biggest legit payload). */
const MAX_MESSAGE_BYTES = 100_000;

export interface ServerOptions {
  /** Exact origins allowed to call the API and open a socket (SPEC §2.5: CORS restricted). */
  clientOrigins: readonly string[];
  log: Logger;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Proxies in front of the server whose X-Forwarded-For entry is trusted (Render: 1). */
  trustProxyHops?: number;
  /** Per-IP limits; tests lower them. */
  ipLimits?: Partial<IpLimitOptions>;
}

export interface ClaveServer {
  app: Express;
  httpServer: HttpServer;
  io: IoServer;
  store: RoomStore;
  /** Runs one sweep now (the interval calls it too). */
  sweep(): void;
  /** Runs out due game timers now (an interval calls it every 250 ms). */
  tick(): void;
  close(): Promise<void>;
}

/**
 * Epoch milliseconds that never jump: a wall clock adjusted by NTP would stretch or shorten the
 * game timers (M7 review). Tests inject their own clock.
 */
const steadyNow = () => performance.timeOrigin + performance.now();

export function createServer({
  clientOrigins,
  log,
  now = steadyNow,
  trustProxyHops = 0,
  ipLimits = {},
}: ServerOptions): ClaveServer {
  const isAllowed = (origin: string | undefined) =>
    origin !== undefined && clientOrigins.includes(origin);

  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, isAllowed(origin));
      },
    }),
  );

  app.get(HEALTH_PATH, (_req, res) => {
    const body: HealthResponse = { ok: true, uptimeSec: Math.round(process.uptime()) };
    res.json(body);
  });

  const httpServer = createHttpServer(app);
  const io: IoServer = new Server(httpServer, {
    cors: { origin: [...clientOrigins] },
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    // CORS headers alone don't stop a WebSocket handshake; check the Origin explicitly.
    allowRequest: (req, callback) => {
      const allowed = isAllowed(req.headers.origin);
      if (!allowed) {
        // The Origin header is attacker-controlled: cap what reaches the logs.
        log.warn('socket rejected: origin not allowed', {
          origin: req.headers.origin?.slice(0, 200),
        });
      }
      callback(null, allowed);
    },
  });

  const store = new RoomStore(undefined, now);
  const limiter = new IpLimiter({ ...DEFAULT_IP_LIMITS, ...ipLimits }, now);

  // Too many sockets from one IP: refused before any handler runs (BACKLOG #4).
  io.use((socket, next) => {
    const ip = clientIp(socket.handshake.address, socket.handshake.headers, trustProxyHops);
    if (!limiter.openSocket(ip)) {
      log.warn('socket rejected: too many connections from one address');
      next(new Error('TOO_MANY_CONNECTIONS'));
      return;
    }
    socket.once('disconnect', () => {
      limiter.closeSocket(ip);
    });
    next();
  });

  io.on('connection', (socket) => {
    log.info('socket connected', { socketId: socket.id });
    const ip = clientIp(socket.handshake.address, socket.handshake.headers, trustProxyHops);
    registerLobbyHandlers({ io, store, log, now, limiter, ip }, socket);
    socket.on('disconnect', (reason) => {
      log.info('socket disconnected', { socketId: socket.id, reason });
    });
  });

  const sweep = () => {
    limiter.prune();
    for (const { room, events } of store.sweep(now())) broadcast(io, room, events);
  };
  const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweeper.unref();
  const tick = () => {
    const due = store.tick((room, err) => {
      log.error('timer tick failed', { roomCode: room.code, err });
    });
    for (const { room, events } of due) broadcast(io, room, events);
  };
  const ticker = setInterval(tick, TICK_INTERVAL_MS);
  ticker.unref();

  return {
    app,
    httpServer,
    io,
    store,
    sweep,
    tick,
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        clearInterval(ticker);
        // io.close() also closes the HTTP server; an error here only means it wasn't listening.
        void io.close(() => {
          resolve();
        });
      }),
  };
}
