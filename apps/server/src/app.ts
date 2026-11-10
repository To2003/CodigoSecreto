import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { HEALTH_PATH, type HealthResponse } from '@clave/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { Server } from 'socket.io';
import { broadcast, registerLobbyHandlers, type IoServer } from './handlers/lobby';
import type { Logger } from './log';
import { RoomStore } from './rooms/store';

/** How often seats and abandoned rooms are swept. */
const SWEEP_INTERVAL_MS = 5_000;
/** Largest message a client may send (custom word lists are the biggest legit payload). */
const MAX_MESSAGE_BYTES = 100_000;

export interface ServerOptions {
  /** Exact origins allowed to call the API and open a socket (SPEC §2.5: CORS restricted). */
  clientOrigins: readonly string[];
  log: Logger;
  /** Injectable clock for tests. */
  now?: () => number;
}

export interface ClaveServer {
  app: Express;
  httpServer: HttpServer;
  io: IoServer;
  store: RoomStore;
  /** Runs one sweep now (the interval calls it too). */
  sweep(): void;
  close(): Promise<void>;
}

export function createServer({ clientOrigins, log, now = Date.now }: ServerOptions): ClaveServer {
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

  const store = new RoomStore();

  io.on('connection', (socket) => {
    log.info('socket connected', { socketId: socket.id });
    registerLobbyHandlers({ io, store, log, now }, socket);
    socket.on('disconnect', (reason) => {
      log.info('socket disconnected', { socketId: socket.id, reason });
    });
  });

  const sweep = () => {
    for (const { room, events } of store.sweep(now())) broadcast(io, room, events);
  };
  const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
  sweeper.unref();

  return {
    app,
    httpServer,
    io,
    store,
    sweep,
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        // io.close() also closes the HTTP server; an error here only means it wasn't listening.
        void io.close(() => {
          resolve();
        });
      }),
  };
}
