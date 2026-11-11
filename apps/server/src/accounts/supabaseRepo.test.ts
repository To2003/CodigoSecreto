import { describe, expect, it } from 'vitest';
import { SupabaseAccountsRepo } from './supabaseRepo';

const KEY = 'service-role-secret-value';
const URL_ = 'https://abcd.supabase.co/';

/** A fake fetch: records each call and answers from a queue. No network in tests. */
function fake(answers: { status?: number; body?: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? {};
    return Promise.resolve(
      new Response(a.status === 204 ? null : JSON.stringify(a.body ?? null), {
        status: a.status ?? 200,
      }),
    );
  };
  return { calls, fetchFn };
}
const header = (init: RequestInit, name: string) => (init.headers as Record<string, string>)[name];

describe('SupabaseAccountsRepo (no network: fake fetch)', () => {
  it('verifies a token against /auth/v1/user and keeps only the id, never the email', async () => {
    const { calls, fetchFn } = fake([{ body: { id: 'u-1', email: 'ana@example.com' } }]);
    const repo = new SupabaseAccountsRepo(URL_, KEY, fetchFn);
    const user = await repo.verifyToken('user-jwt');
    expect(user).toEqual({ userId: 'u-1' });
    expect(JSON.stringify(user)).not.toContain('@');
    expect(calls[0]?.url).toBe('https://abcd.supabase.co/auth/v1/user');
    expect(header(calls[0]?.init ?? {}, 'Authorization')).toBe('Bearer user-jwt');
    expect(header(calls[0]?.init ?? {}, 'apikey')).toBe(KEY);
  });

  it('an invalid token is null; a server error throws without the key in the message', async () => {
    const { fetchFn } = fake([{ status: 401 }, { status: 500 }]);
    const repo = new SupabaseAccountsRepo(URL_, KEY, fetchFn);
    expect(await repo.verifyToken('bad')).toBeNull();
    const err = await repo.verifyToken('x').catch((e: unknown) => e);
    expect(String(err)).toContain('HTTP 500');
    expect(String(err)).not.toContain(KEY);
  });

  it('records a game through the RPC with the service role', async () => {
    const { calls, fetchFn } = fake([{ status: 204 }]);
    const repo = new SupabaseAccountsRepo(URL_, KEY, fetchFn);
    await repo.recordGame('u-1', {
      won: true,
      role: 'spymaster',
      bestClue: { word: 'MAR', hits: 3 },
    });
    expect(calls[0]?.url).toBe('https://abcd.supabase.co/rest/v1/rpc/record_game_result');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      p_user: 'u-1',
      p_won: true,
      p_spymaster: true,
      p_clue_word: 'MAR',
      p_clue_hits: 3,
    });
    expect(header(calls[0]?.init ?? {}, 'Authorization')).toBe(`Bearer ${KEY}`);
  });

  it('adds likes, reads accounts and ranking rows, sets names and deletes users', async () => {
    const statsRow = {
      user_id: 'u-1',
      display_name: 'Ana',
      games: 12,
      wins: 7,
      games_as_spymaster: 4,
      wins_as_spymaster: 3,
      games_as_agent: 8,
      wins_as_agent: 4,
      current_streak: 2,
      best_streak: 4,
      best_clue_word: 'MAR',
      best_clue_hits: 3,
      likes_received: 5,
    };
    const { calls, fetchFn } = fake([
      { body: true },
      { body: [{ display_name: 'Ana' }] },
      { body: [statsRow] },
      { body: [statsRow] },
      { status: 201 },
      { status: 200 },
    ]);
    const repo = new SupabaseAccountsRepo(URL_, KEY, fetchFn);
    expect(await repo.addLike('u-2', 'guest', '2026-11-11', 3)).toBe(true);
    const account = await repo.getAccount('u-1');
    expect(account).toMatchObject({
      displayName: 'Ana',
      stats: { games: 12, bestClue: { word: 'MAR', hits: 3 } },
    });
    expect((await repo.rankingRows())[0]).toMatchObject({ userId: 'u-1', displayName: 'Ana' });
    await repo.setDisplayName('u-1', 'Anita');
    await repo.deleteAccount('u-1');
    expect(
      calls.map(
        (c) => `${c.init.method ?? 'GET'} ${c.url.replace('https://abcd.supabase.co', '')}`,
      ),
    ).toEqual([
      'POST /rest/v1/rpc/add_like',
      'GET /rest/v1/profiles?user_id=eq.u-1&select=display_name',
      'GET /rest/v1/player_stats?user_id=eq.u-1&select=*',
      'GET /rest/v1/ranking_candidates?select=*&limit=1000',
      'POST /rest/v1/profiles?on_conflict=user_id',
      'DELETE /auth/v1/admin/users/u-1',
    ]);
  });

  it('an account without stats yet gets empty stats', async () => {
    const { fetchFn } = fake([{ body: [] }, { body: [] }]);
    const repo = new SupabaseAccountsRepo(URL_, KEY, fetchFn);
    expect(await repo.getAccount('u-9')).toMatchObject({ displayName: null, stats: { games: 0 } });
  });
});
