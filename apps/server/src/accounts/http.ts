import {
  displayNameSchema,
  rankByLove,
  rankByWins,
  sanitizeNickname,
  type RankingView,
} from '@clave/shared';
import express, { type Request, type Response, type Router } from 'express';
import { TokenBucket } from '../handlers/rateLimit';
import type { Logger } from '../log';
import type { MemoryAccountsRepo } from './memoryRepo';
import type { Accounts } from './service';

/** Per-address limit for the accounts API: 20 at once, then one every 2 s. */
const API_BURST = 20;
const API_PER_SECOND = 0.5;
const MAX_BUCKETS = 10_000;

/**
 * The accounts HTTP API (docs/specs/M9-cuentas.md). The client reads its own account and the
 * rankings through here; every write is the server's, with the service role. Responses never
 * carry a user id or an email.
 */
export function accountsRouter(options: {
  accounts: Accounts;
  /** Only in AUTH_MODE=memory: the test sign-in. */
  memory: MemoryAccountsRepo | null;
  log: Logger;
  now: () => number;
  /** The client's address for rate limiting (see clientIp); null when it can't be told. */
  addressOf: (req: Request) => string | null;
}): Router {
  const { accounts, memory, log, now, addressOf } = options;
  const router = express.Router();
  const buckets = new Map<string, TokenBucket>();

  router.use(express.json({ limit: '2kb' }));
  router.use((req, res, next) => {
    if (!accounts.repo) {
      res.status(404).json({ error: 'ACCOUNTS_OFF' });
      return;
    }
    const address = addressOf(req);
    if (address !== null) {
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
      let bucket = buckets.get(address);
      if (!bucket) {
        bucket = new TokenBucket(API_BURST, API_PER_SECOND, now);
        buckets.set(address, bucket);
      }
      if (!bucket.take()) {
        res.status(429).json({ error: 'RATE_LIMITED' });
        return;
      }
    }
    next();
  });

  const bearer = (req: Request) => {
    const header = req.headers.authorization ?? '';
    return header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  };
  const unavailable = (res: Response, operation: string, err: unknown) => {
    log.error('accounts: request failed', {
      operation,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    res.status(503).json({ error: 'ACCOUNTS_UNAVAILABLE' });
  };
  /** The signed-in user, or a 401 already sent. */
  const user = async (req: Request, res: Response) => {
    const userId = await accounts.identify(bearer(req));
    if (!userId) res.status(401).json({ error: 'UNAUTHORIZED' });
    return userId;
  };

  router.get('/me', async (req, res) => {
    const userId = await user(req, res);
    if (!userId || !accounts.repo) return;
    try {
      res.json(await accounts.repo.getAccount(userId));
    } catch (err) {
      unavailable(res, 'getAccount', err);
    }
  });

  router.put('/me', async (req, res) => {
    const userId = await user(req, res);
    if (!userId || !accounts.repo) return;
    const parsed = displayNameSchema.safeParse(req.body);
    const name = parsed.success ? sanitizeNickname(parsed.data.displayName) : '';
    if (name === '') {
      res.status(400).json({ error: 'INVALID_NAME' });
      return;
    }
    try {
      await accounts.repo.setDisplayName(userId, name);
      res.json({ displayName: name });
    } catch (err) {
      unavailable(res, 'setDisplayName', err);
    }
  });

  router.delete('/me', async (req, res) => {
    const userId = await user(req, res);
    if (!userId || !accounts.repo) return;
    try {
      await accounts.repo.deleteAccount(userId);
      accounts.forget(userId);
      res.json({ deleted: true });
    } catch (err) {
      unavailable(res, 'deleteAccount', err);
    }
  });

  router.get('/ranking', async (req, res) => {
    if (!accounts.repo) return;
    try {
      const me = await accounts.identify(bearer(req));
      const rows = await accounts.repo.rankingRows();
      const view: RankingView = {
        wins: rankByWins(rows).map(({ userId, ...entry }) => ({ ...entry, me: userId === me })),
        loved: rankByLove(rows).map(({ userId, ...entry }) => ({ ...entry, me: userId === me })),
      };
      res.json(view);
    } catch (err) {
      unavailable(res, 'ranking', err);
    }
  });

  if (memory) {
    // Development and E2E only (AUTH_MODE=memory, refused in production): sign in by name.
    router.post('/dev/login', (req, res) => {
      const raw: unknown = (req.body as { name?: unknown } | undefined)?.name;
      const name = typeof raw === 'string' ? sanitizeNickname(raw) : '';
      if (name === '') {
        res.status(400).json({ error: 'INVALID_NAME' });
        return;
      }
      res.json({ token: memory.devLogin(name).token });
    });
  }

  return router;
}
