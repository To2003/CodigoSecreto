-- Clave: optional accounts, stats, rankings and likes (docs/specs/M9-cuentas.md).
-- Run once in the Supabase SQL editor (or `supabase db push`). Idempotent where Postgres allows.
--
-- Rules: RLS on every table. Clients (anon / authenticated) may only read their own profile and
-- stats, and the public ranking views (no user ids). Every write goes through the game server,
-- which uses the service role key (it bypasses RLS) and the functions below, which only the
-- service role may execute. Emails live in auth.users only; nothing here copies them.

-- ── tables ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the user picks one: they don't show in rankings meanwhile (spec §2).
  display_name text check (display_name is null or char_length(display_name) between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  games integer not null default 0,
  wins integer not null default 0,
  games_as_spymaster integer not null default 0,
  wins_as_spymaster integer not null default 0,
  games_as_agent integer not null default 0,
  wins_as_agent integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  best_clue_word text,
  best_clue_hits integer not null default 0,
  likes_received integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Only for the per-pair daily cap; rows older than 2 days are deleted (spec §5).
create table if not exists public.like_events (
  id bigint generated always as identity primary key,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  -- The giver's user id, or 'guest' for every guest together.
  giver_key text not null,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists like_events_pair_day on public.like_events (receiver_id, giver_key, day);

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.like_events enable row level security;

-- ── read policies: own rows only; like_events has none (nobody reads it from a client) ─────

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "read own stats" on public.player_stats;
create policy "read own stats" on public.player_stats
  for select to authenticated using (user_id = (select auth.uid()));

-- No insert / update / delete policies: clients can't write. The server's service role bypasses RLS.

-- ── public rankings, without ids (spec §4) ───────────────────────────────
-- Views run with their owner's rights (security_invoker = false) on purpose: they expose only
-- names and numbers of users with a public name and 10+ games, never ids or emails.

create or replace view public.ranking_wins with (security_invoker = false) as
  select p.display_name, s.games, s.wins
  from public.player_stats s join public.profiles p using (user_id)
  where p.display_name is not null and s.games >= 10
  order by s.wins desc, (s.wins::numeric / s.games) desc, s.games asc, p.display_name asc
  limit 50;

create or replace view public.ranking_loved with (security_invoker = false) as
  select p.display_name, s.games, s.likes_received as likes,
         round(s.likes_received::numeric / s.games, 2) as per_game
  from public.player_stats s join public.profiles p using (user_id)
  where p.display_name is not null and s.games >= 10
  order by (s.likes_received::numeric / s.games) desc, s.likes_received desc, p.display_name asc
  limit 50;

-- For the server only (it marks the viewer's own row): ids included, so no grant to clients.
create or replace view public.ranking_candidates with (security_invoker = false) as
  select s.user_id, p.display_name, s.games, s.wins, s.games_as_spymaster, s.wins_as_spymaster,
         s.games_as_agent, s.wins_as_agent, s.current_streak, s.best_streak, s.best_clue_word,
         s.best_clue_hits, s.likes_received
  from public.player_stats s join public.profiles p using (user_id)
  where p.display_name is not null and s.games >= 10;

revoke all on public.ranking_candidates from anon, authenticated;
grant select on public.ranking_wins, public.ranking_loved to anon, authenticated;

-- ── writes: functions only the service role may run ─────────────────────

-- Mirrors applyResult in packages/shared/engine/accountStats.ts.
create or replace function public.record_game_result(
  p_user uuid, p_won boolean, p_spymaster boolean, p_clue_word text, p_clue_hits integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.player_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.player_stats set
    games = games + 1,
    wins = wins + (case when p_won then 1 else 0 end),
    games_as_spymaster = games_as_spymaster + (case when p_spymaster then 1 else 0 end),
    wins_as_spymaster = wins_as_spymaster + (case when p_spymaster and p_won then 1 else 0 end),
    games_as_agent = games_as_agent + (case when p_spymaster then 0 else 1 end),
    wins_as_agent = wins_as_agent + (case when not p_spymaster and p_won then 1 else 0 end),
    current_streak = case when p_won then current_streak + 1 else 0 end,
    best_streak = greatest(best_streak, case when p_won then current_streak + 1 else 0 end),
    best_clue_word = case when coalesce(p_clue_hits, 0) > best_clue_hits then p_clue_word else best_clue_word end,
    best_clue_hits = greatest(best_clue_hits, coalesce(p_clue_hits, 0)),
    updated_at = now()
  where user_id = p_user;
end;
$$;

-- Returns whether the like was kept (false: the pair hit its daily cap).
create or replace function public.add_like(
  p_receiver uuid, p_giver_key text, p_day date, p_cap integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  given integer;
begin
  delete from public.like_events where day < p_day - 1;
  select count(*) into given from public.like_events
    where receiver_id = p_receiver and giver_key = p_giver_key and day = p_day;
  if given >= p_cap then
    return false;
  end if;
  insert into public.like_events (receiver_id, giver_key, day) values (p_receiver, p_giver_key, p_day);
  insert into public.player_stats (user_id) values (p_receiver) on conflict (user_id) do nothing;
  update public.player_stats set likes_received = likes_received + 1, updated_at = now()
    where user_id = p_receiver;
  return true;
end;
$$;

revoke all on function public.record_game_result(uuid, boolean, boolean, text, integer) from public, anon, authenticated;
revoke all on function public.add_like(uuid, text, date, integer) from public, anon, authenticated;
grant execute on function public.record_game_result(uuid, boolean, boolean, text, integer) to service_role;
grant execute on function public.add_like(uuid, text, date, integer) to service_role;
