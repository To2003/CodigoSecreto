import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { HEALTH_PATH, type HealthResponse } from '@clave/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import { Server as IoServer } from 'socket.io';
import type { Logger } from './log';

export interface ServerOptions {
  /** Exact origins allowed to call the API and open a socket (SPEC §2.5: CORS restricted). */
  clientOrigins: readonly string[];
  log: Logger;
}

export interface ClaveServer {
  app: Express;
  httpServer: HttpServer;
  io: IoServer;
  close(): Promise<void>;
}

export function createServer({ clientOrigins, log }: ServerOptions): ClaveServer {
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
  const io = new IoServer(httpServer, {
    cors: { origin: [...clientOrigins] },
    // CORS headers alone don't stop a WebSocket handshake; check the Origin explicitly.
    allowRequest: (req, callback) => {
      const allowed = isAllowed(req.headers.origin);
      if (!allowed) log.warn('socket rejected: origin not allowed', { origin: req.headers.origin });
      callback(null, allowed);
    },
  });

  io.on('connection', (socket) => {
    log.info('socket connected', { socketId: socket.id });
    socket.on('disconnect', (reason) => {
      log.info('socket disconnected', { socketId: socket.id, reason });
    });
  });

  return {
    app,
    httpServer,
    io,
    close: () =>
      new Promise((resolve) => {
        // io.close() also closes the HTTP server; an error here only means it wasn't listening.
        void io.close(() => {
          resolve();
        });
      }),
  };
}
