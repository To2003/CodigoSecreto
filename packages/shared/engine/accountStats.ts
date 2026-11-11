import type { ClueRecord, Role, Team } from './types';

/**
 * Accounts (docs/specs/M9-cuentas.md): what a finished game adds to each player's stats, which
 * games count, and the rankings. Pure; the server applies it (and a SQL function mirrors it).
 */
export const STATS_MIN_PLAYERS = 4;
export const RANKING_MIN_GAMES = 10;
export const RANKING_SIZE = 50;
/** Likes kept per giver→receiver pair per day (spec §5). */
export const LIKES_PER_PAIR_PER_DAY = 3;

export interface BestClue {
  word: string;
  hits: number;
}

export interface PlayerStats {
  games: number;
  wins: number;
  gamesAsSpymaster: number;
  winsAsSpymaster: number;
  gamesAsAgent: number;
  winsAsAgent: number;
  currentStreak: number;
  bestStreak: number;
  bestClue: BestClue | null;
  likesReceived: number;
}

export const EMPTY_STATS: PlayerStats = Object.freeze({
  games: 0,
  wins: 0,
  gamesAsSpymaster: 0,
  winsAsSpymaster: 0,
  gamesAsAgent: 0,
  winsAsAgent: 0,
  currentStreak: 0,
  bestStreak: 0,
  bestClue: null,
  likesReceived: 0,
});

export interface GameResult {
  won: boolean;
  /** The role the player had when the game started. */
  role: Role;
  /** Their clue that connected the most own agents, if they were a spymaster and one did. */
  bestClue: BestClue | null;
}

export function applyResult(stats: PlayerStats, result: GameResult): PlayerStats {
  const spy = result.role === 'spymaster';
  const currentStreak = result.won ? stats.currentStreak + 1 : 0;
  const clue = result.bestClue;
  const bestClue = clue && clue.hits > (stats.bestClue?.hits ?? 0) ? { ...clue } : stats.bestClue;
  return {
    ...stats,
    games: stats.games + 1,
    wins: stats.wins + (result.won ? 1 : 0),
    gamesAsSpymaster: stats.gamesAsSpymaster + (spy ? 1 : 0),
    winsAsSpymaster: stats.winsAsSpymaster + (spy && result.won ? 1 : 0),
    gamesAsAgent: stats.gamesAsAgent + (spy ? 0 : 1),
    winsAsAgent: stats.winsAsAgent + (!spy && result.won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    bestClue,
  };
}

/** Spec §3: classic, 4+ players when it started, and at least the minimum duration. */
export function gameCountsForStats(game: {
  mode: 'classic' | 'coop';
  players: number;
  durationMs: number;
  minDurationMs: number;
}): boolean {
  return (
    game.mode === 'classic' &&
    game.players >= STATS_MIN_PLAYERS &&
    game.durationMs >= game.minDurationMs
  );
}

export interface RosterEntry {
  playerId: string;
  team: Team;
  role: Role;
}

/**
 * Each starter's result. `givers[i]` is who was spymaster of that team when clue `i` was given.
 * A clue's hits are the guesses that found its own team's agents.
 */
export function resultsFor(
  roster: readonly RosterEntry[],
  clues: readonly ClueRecord[],
  givers: readonly string[],
  winner: Team,
): Map<string, GameResult> {
  const results = new Map<string, GameResult>();
  for (const p of roster) {
    let bestClue: BestClue | null = null;
    clues.forEach((clue, i) => {
      if (givers[i] !== p.playerId) return;
      const hits = clue.guesses.filter((g) => g.type === clue.team).length;
      if (hits > 0 && hits > (bestClue?.hits ?? 0)) bestClue = { word: clue.word, hits };
    });
    results.set(p.playerId, { won: p.team === winner, role: p.role, bestClue });
  }
  return results;
}

export interface RankRow {
  userId: string;
  /** Null until the user picks one: they don't show in rankings (spec §2). */
  displayName: string | null;
  stats: PlayerStats;
}
export interface WinsEntry {
  userId: string;
  displayName: string;
  games: number;
  wins: number;
}
export interface LoveEntry {
  userId: string;
  displayName: string;
  games: number;
  likes: number;
  perGame: number;
}

const eligible = (rows: readonly RankRow[]) =>
  rows.filter(
    (r): r is RankRow & { displayName: string } =>
      r.displayName !== null && r.stats.games >= RANKING_MIN_GAMES,
  );

export function rankByWins(rows: readonly RankRow[], limit = RANKING_SIZE): WinsEntry[] {
  return eligible(rows)
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      games: r.stats.games,
      wins: r.stats.wins,
    }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.wins / b.games - a.wins / a.games ||
        a.games - b.games ||
        a.displayName.localeCompare(b.displayName, 'es'),
    )
    .slice(0, limit);
}

export function rankByLove(rows: readonly RankRow[], limit = RANKING_SIZE): LoveEntry[] {
  return eligible(rows)
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      games: r.stats.games,
      likes: r.stats.likesReceived,
      perGame: Math.round((r.stats.likesReceived / r.stats.games) * 100) / 100,
    }))
    .sort(
      (a, b) =>
        b.likes / b.games - a.likes / a.games ||
        b.likes - a.likes ||
        a.displayName.localeCompare(b.displayName, 'es'),
    )
    .slice(0, limit);
}

/** The day a like counts for in the per-pair cap: the UTC date. */
export const likeDay = (nowMs: number) => new Date(nowMs).toISOString().slice(0, 10);
