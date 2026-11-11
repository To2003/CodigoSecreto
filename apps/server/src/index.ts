import { createServer } from './app';
import { parseConfig } from './config';
import { createLogger } from './log';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const parsed = parseConfig(process.env);
const log = createLogger({ level: parsed.ok ? parsed.config.logLevel : 'info' });
if (!parsed.ok) {
  log.error('invalid configuration', { error: parsed.error });
  process.exit(1);
}
const { port, clientOrigins, trustProxyHops, roomsPerMinute } = parsed.config;

process.on('uncaughtException', (err) => {
  log.error('uncaught exception', { err });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', { err: reason });
  process.exit(1);
});

const server = createServer({
  clientOrigins,
  log,
  trustProxyHops,
  ipLimits: { roomsPerWindow: roomsPerMinute },
});

server.httpServer.on('error', (err) => {
  log.error('http server error', { err });
  process.exit(1);
});
server.httpServer.listen(port, () => {
  log.info('server listening', { port, clientOrigins });
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('shutting down', { signal });
  // Render sends SIGKILL after a grace period; don't let a slow client hold the process open.
  setTimeout(() => {
    log.warn('shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  void server.close().then(() => process.exit(0));
  server.httpServer.closeAllConnections();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
