import { createHash, randomBytes } from 'node:crypto';
import {
  applyResult,
  EMPTY_STATS,
  RANKING_MIN_GAMES,
  type AccountView,
  type GameResult,
  type PlayerStats,
  type RankRow,
} from '@clave/shared';
import type { AccountsRepo } from './repo';

/**
 * In-memory accounts for tests, local development and E2E (`AUTH_MODE=memory`). `devLogin` hands
 * out a token for a name, standing in for Google; the server refuses this mode in production.
 */
export class MemoryAccountsRepo implements AccountsRepo {
  private readonly tokens = new Map<string, string>();
  private readonly names = new Map<string, string | null>();
  private readonly stats = new Map<string, PlayerStats>();
  /** `${receiver}|${giver}|${day}` → likes kept. */
  private readonly likes = new Map<string, number>();

  /** Test sign-in: the same name is always the same user. */
  devLogin(name: string): { token: string; userId: string } {
    const userId = createHash('sha256').update(`dev:${name}`).digest('hex').slice(0, 32);
    const token = `dev.${randomBytes(18).toString('base64url')}`;
    this.tokens.set(token, userId);
    if (!this.names.has(userId)) this.names.set(userId, null);
    return { token, userId };
  }

  verifyToken(token: string) {
    const userId = this.tokens.get(token);
    return Promise.resolve(userId === undefined ? null : { userId });
  }

  getAccount(userId: string): Promise<AccountView> {
    return Promise.resolve({
      displayName: this.names.get(userId) ?? null,
      stats: structuredClone(this.stats.get(userId) ?? EMPTY_STATS),
    });
  }

  setDisplayName(userId: string, displayName: string) {
    this.names.set(userId, displayName);
    return Promise.resolve();
  }

  recordGame(userId: string, result: GameResult) {
    this.stats.set(userId, applyResult(this.stats.get(userId) ?? EMPTY_STATS, result));
    return Promise.resolve();
  }

  addLike(receiverId: string, giverKey: string, day: string, cap: number) {
    const key = `${receiverId}|${giverKey}|${day}`;
    const given = this.likes.get(key) ?? 0;
    if (given >= cap) return Promise.resolve(false);
    this.likes.set(key, given + 1);
    const stats = this.stats.get(receiverId) ?? EMPTY_STATS;
    this.stats.set(receiverId, { ...stats, likesReceived: stats.likesReceived + 1 });
    return Promise.resolve(true);
  }

  rankingRows(): Promise<RankRow[]> {
    const rows: RankRow[] = [];
    for (const [userId, stats] of this.stats) {
      const displayName = this.names.get(userId) ?? null;
      if (displayName !== null && stats.games >= RANKING_MIN_GAMES) {
        rows.push({ userId, displayName, stats: structuredClone(stats) });
      }
    }
    return Promise.resolve(rows);
  }

  deleteAccount(userId: string) {
    this.names.delete(userId);
    this.stats.delete(userId);
    for (const [token, id] of this.tokens) if (id === userId) this.tokens.delete(token);
    for (const key of this.likes.keys()) if (key.startsWith(`${userId}|`)) this.likes.delete(key);
    return Promise.resolve();
  }
}
