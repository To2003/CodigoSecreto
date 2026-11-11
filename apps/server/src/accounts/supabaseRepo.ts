import {
  EMPTY_STATS,
  type AccountView,
  type GameResult,
  type PlayerStats,
  type RankRow,
} from '@clave/shared';
import type { AccountsRepo } from './repo';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** A Supabase error without the request: the URL and headers carry the key. */
export class SupabaseError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
  ) {
    super(`supabase ${operation} failed with HTTP ${String(status)}`);
  }
}

interface StatsRow {
  user_id: string;
  display_name?: string | null;
  games: number;
  wins: number;
  games_as_spymaster: number;
  wins_as_spymaster: number;
  games_as_agent: number;
  wins_as_agent: number;
  current_streak: number;
  best_streak: number;
  best_clue_word: string | null;
  best_clue_hits: number;
  likes_received: number;
}

const toStats = (r: StatsRow): PlayerStats => ({
  games: r.games,
  wins: r.wins,
  gamesAsSpymaster: r.games_as_spymaster,
  winsAsSpymaster: r.wins_as_spymaster,
  gamesAsAgent: r.games_as_agent,
  winsAsAgent: r.wins_as_agent,
  currentStreak: r.current_streak,
  bestStreak: r.best_streak,
  bestClue:
    r.best_clue_word && r.best_clue_hits > 0
      ? { word: r.best_clue_word, hits: r.best_clue_hits }
      : null,
  likesReceived: r.likes_received,
});

/**
 * Supabase over plain HTTP (PostgREST, RPC and Auth), with the service role key: the server is
 * the only writer (spec §1). The key only ever goes into request headers, never into an error
 * or a log line. `fetch` is injected so tests run without a network.
 */
export class SupabaseAccountsRepo implements AccountsRepo {
  private readonly base: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly fetchFn: Fetch = (u, i) => fetch(u, i),
  ) {
    this.base = url.replace(/\/+$/, '');
  }

  private headers(bearer = this.serviceKey): Record<string, string> {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    };
  }

  private async call(operation: string, path: string, init: RequestInit = {}): Promise<Response> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new SupabaseError(operation, res.status);
    return res;
  }

  async verifyToken(token: string) {
    const res = await this.fetchFn(`${this.base}/auth/v1/user`, {
      headers: this.headers(token),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new SupabaseError('verifyToken', res.status);
    // Only the id is kept; the rest of the user (email included) is dropped right here.
    const { id } = (await res.json()) as { id?: unknown };
    return typeof id === 'string' ? { userId: id } : null;
  }

  async getAccount(userId: string): Promise<AccountView> {
    const id = encodeURIComponent(userId);
    const [profiles, stats] = await Promise.all([
      this.call('getProfile', `/rest/v1/profiles?user_id=eq.${id}&select=display_name`).then(
        (r) => r.json() as Promise<{ display_name: string | null }[]>,
      ),
      this.call('getStats', `/rest/v1/player_stats?user_id=eq.${id}&select=*`).then(
        (r) => r.json() as Promise<StatsRow[]>,
      ),
    ]);
    const row = stats[0];
    return {
      displayName: profiles[0]?.display_name ?? null,
      stats: row ? toStats(row) : structuredClone(EMPTY_STATS),
    };
  }

  async setDisplayName(userId: string, displayName: string) {
    await this.call('setDisplayName', '/rest/v1/profiles?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, display_name: displayName }),
    });
  }

  async recordGame(userId: string, result: GameResult) {
    await this.call('recordGame', '/rest/v1/rpc/record_game_result', {
      method: 'POST',
      body: JSON.stringify({
        p_user: userId,
        p_won: result.won,
        p_spymaster: result.role === 'spymaster',
        p_clue_word: result.bestClue?.word ?? null,
        p_clue_hits: result.bestClue?.hits ?? 0,
      }),
    });
  }

  async addLike(receiverId: string, giverKey: string, day: string, cap: number) {
    const res = await this.call('addLike', '/rest/v1/rpc/add_like', {
      method: 'POST',
      body: JSON.stringify({
        p_receiver: receiverId,
        p_giver_key: giverKey,
        p_day: day,
        p_cap: cap,
      }),
    });
    return (await res.json()) === true;
  }

  async rankingRows(): Promise<RankRow[]> {
    const res = await this.call('rankingRows', '/rest/v1/ranking_candidates?select=*&limit=1000');
    const rows = (await res.json()) as StatsRow[];
    return rows.map((r) => ({
      userId: r.user_id,
      displayName: r.display_name ?? null,
      stats: toStats(r),
    }));
  }

  async deleteAccount(userId: string) {
    // Deleting the auth user cascades to profiles, player_stats and like_events.
    await this.call('deleteAccount', `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  }
}
