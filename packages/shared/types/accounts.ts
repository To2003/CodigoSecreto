import type { LoveEntry, PlayerStats, WinsEntry } from '../engine/accountStats';

/** GET /api/me: the signed-in user's own data. Never an email, never another user's id. */
export interface AccountView {
  displayName: string | null;
  stats: PlayerStats;
}

/** A ranking row as clients see it: no user ids; `me` marks the viewer's own row. */
export type PublicWinsEntry = Omit<WinsEntry, 'userId'> & { me: boolean };
export type PublicLoveEntry = Omit<LoveEntry, 'userId'> & { me: boolean };

/** GET /api/ranking (docs/specs/M9-cuentas.md §4). */
export interface RankingView {
  wins: PublicWinsEntry[];
  loved: PublicLoveEntry[];
}

/** Likes at the end of a game, for this viewer only (spec §5). */
export interface LikesView {
  /** Whether this viewer already gave their like in this game. */
  given: boolean;
  /** Likes this viewer received in this game. Nobody else's count, nobody's names. */
  received: number;
}
