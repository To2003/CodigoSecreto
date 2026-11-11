import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { HEALTH_PATH, type HealthResponse } from '@clave/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import {
  clientIp,
  DEFAULT_IP_LIMITS,
  IpLimiter,
  proxyDiagnosis,
  type IpLimitOptions,
} from './handlers/ipLimits';
import { broadcast, registerLobbyHandlers, type IoServer } from './handlers/lobby';
import { accountsRouter } from './accounts/http';
import { MemoryAccountsRepo } from './accounts/memoryRepo';
import type { AccountsRepo } from './accounts/repo';
import { Accounts } from './accounts/service';
import type { Room } from './rooms/room';
import type { RoomEvent } from '@clave/shared';
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
  /** Accounts storage (docs/specs/M9-cuentas.md); null or absent: accounts off, all guests. */
  accountsRepo?: AccountsRepo | null;
  /** Stats count games at least this long (default 5 minutes). */
  statsMinGameMs?: number;
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
  accountsRepo = null,
  statsMinGameMs,
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

  const accounts = new Accounts(accountsRepo, log, now);
  app.use(
    '/api',
    accountsRouter({
      accounts,
      memory: accountsRepo instanceof MemoryAccountsRepo ? accountsRepo : null,
      log,
      now,
      addressOf: (req) => clientIp(req.socket.remoteAddress ?? '', req.headers, trustProxyHops),
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

  const store = new RoomStore(undefined, now, statsMinGameMs);
  /** Every room change goes out through here; a game that just ended gets its results saved. */
  const publish = (room: Room, events: RoomEvent[]) => {
    broadcast(io, room, events);
    const finished = room.takeFinishedGame();
    if (finished) accounts.saveFinished(finished);
  };
  const limiter = new IpLimiter({ ...DEFAULT_IP_LIMITS, ...ipLimits }, now);

  // Too many sockets from one IP: refused before any handler runs (BACKLOG #4).
  let diagnosed = false;
  io.use((socket, next) => {
    if (!diagnosed) {
      // Once per process: lets the deploy confirm TRUST_PROXY_HOPS without logging any address.
      diagnosed = true;
      log.info('proxy check', proxyDiagnosis(socket.handshake.headers, trustProxyHops));
    }
    const ip = clientIp(socket.handshake.address, socket.handshake.headers, trustProxyHops);
    if (!limiter.openSocket(ip)) {
      log.warn('socket rejected: too many connections from one address');
      next(new Error('TOO_MANY_CONNECTIONS'));
      return;
    }
    // The transport's close, not the socket's disconnect: a transport that drops between this
    // middleware and the connection never emits `disconnect` (M8 review).
    socket.conn.once('close', () => {
      limiter.closeSocket(ip);
    });
    next();
  });

  // Signed in? The session token is checked once, here; a bad one just means "guest".
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    void accounts.identify(token).then((userId) => {
      if (userId) socket.data.userId = userId;
      next();
    });
  });

  io.on('connection', (socket) => {
    log.info('socket connected', { socketId: socket.id });
    const ip = clientIp(socket.handshake.address, socket.handshake.headers, trustProxyHops);
    registerLobbyHandlers({ io, store, log, now, limiter, ip, accounts, publish }, socket);
    socket.on('disconnect', (reason) => {
      log.info('socket disconnected', { socketId: socket.id, reason });
    });
  });

  const sweep = () => {
    limiter.prune();
    for (const { room, events } of store.sweep(now())) publish(room, events);
  };
  const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweeper.unref();
  const tick = () => {
    const due = store.tick((room, err) => {
      log.error('timer tick failed', { roomCode: room.code, err });
    });
    for (const { room, events } of due) publish(room, events);
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
