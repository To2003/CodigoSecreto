import { createServer } from './app';
import { createLogger } from './log';

const log = createLogger({ level: process.env.LOG_LEVEL ?? 'info' });

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port <= 0) {
  log.error('invalid PORT', { port: process.env.PORT });
  process.exit(1);
}

const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const server = createServer({ clientOrigins, log });

server.httpServer.listen(port, () => {
  log.info('server listening', { port, clientOrigins });
});

const shutdown = (signal: NodeJS.Signals) => {
  log.info('shutting down', { signal });
  void server.close().then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
