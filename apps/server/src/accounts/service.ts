import { LIKES_PER_PAIR_PER_DAY, likeDay } from '@clave/shared';
import type { Logger } from '../log';
import type { FinishedGame, LikeOutcome } from '../rooms/room';
import type { AccountsRepo } from './repo';

/** A verified token is trusted this long before asking Supabase again. */
const TOKEN_CACHE_MS = 5 * 60_000;
const TOKEN_CACHE_MAX = 2_000;
const MAX_TOKEN_LENGTH = 4_096;

/**
 * The server's side of accounts (docs/specs/M9-cuentas.md). Saving never gets in the way of a
 * game: every failure is logged (operation and reason only, never a token, key or email) and
 * swallowed. With no repo, accounts are off and everyone plays as a guest.
 */
export class Accounts {
  private readonly cache = new Map<string, { userId: string; until: number }>();

  constructor(
    readonly repo: AccountsRepo | null,
    private readonly log: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  get enabled() {
    return this.repo !== null;
  }

  private fail(operation: string, err: unknown) {
    this.log.error('accounts: operation failed', {
      operation,
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }

  /** The account behind a session token; undefined for guests, bad tokens or a Supabase hiccup. */
  async identify(token: unknown): Promise<string | undefined> {
    if (!this.repo || typeof token !== 'string') return undefined;
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return undefined;
    const hit = this.cache.get(token);
    if (hit && hit.until > this.now()) return hit.userId;
    try {
      const user = await this.repo.verifyToken(token);
      if (!user) return undefined;
      if (this.cache.size >= TOKEN_CACHE_MAX) this.cache.clear();
      this.cache.set(token, { userId: user.userId, until: this.now() + TOKEN_CACHE_MS });
      return user.userId;
    } catch (err) {
      this.fail('verifyToken', err);
      return undefined;
    }
  }

  /** Forgets every cached token of a user (after deleting the account). */
  forget(userId: string) {
    for (const [token, entry] of this.cache) if (entry.userId === userId) this.cache.delete(token);
  }

  /** Saves a finished game's results in the background. */
  saveFinished(finished: FinishedGame) {
    const repo = this.repo;
    if (!repo) return;
    for (const { userId, result } of finished.results) {
      repo.recordGame(userId, result).catch((err: unknown) => {
        this.fail('recordGame', err);
      });
    }
  }

  /** Keeps a like in the background, under the per-pair daily cap. */
  keepLike(keep: NonNullable<LikeOutcome['keep']>) {
    const repo = this.repo;
    if (!repo) return;
    repo
      .addLike(keep.receiverUserId, keep.giverKey, likeDay(this.now()), LIKES_PER_PAIR_PER_DAY)
      .catch((err: unknown) => {
        this.fail('addLike', err);
      });
  }
}
