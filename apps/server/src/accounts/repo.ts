import type { AccountView, GameResult, RankRow } from '@clave/shared';

/**
 * Where accounts live (docs/specs/M9-cuentas.md §7). Two implementations: in memory (tests,
 * development, E2E) and Supabase (production). Only the server talks to it, with the service
 * role: clients never write stats.
 */
export interface AccountsRepo {
  /** The user behind a session token, or null when it's not valid. Never their email. */
  verifyToken(token: string): Promise<{ userId: string } | null>;
  getAccount(userId: string): Promise<AccountView>;
  setDisplayName(userId: string, displayName: string): Promise<void>;
  recordGame(userId: string, result: GameResult): Promise<void>;
  /** Keeps a like unless the giver→receiver pair already has `cap` today. Returns whether it did. */
  addLike(receiverId: string, giverKey: string, day: string, cap: number): Promise<boolean>;
  /** Users with a public name and enough games to be ranked (the server sorts them). */
  rankingRows(): Promise<RankRow[]>;
  /** Deletes the user and, in cascade, their profile, stats and likes. */
  deleteAccount(userId: string): Promise<void>;
}
