import { describe, expect, it } from 'vitest';
import {
  applyResult,
  EMPTY_STATS,
  gameCountsForStats,
  likeDay,
  rankByLove,
  rankByWins,
  resultsFor,
  type RankRow,
} from './accountStats';
import type { ClueRecord } from './types';

describe('applyResult (spec §3)', () => {
  it('counts games, wins and the role, and keeps streaks', () => {
    let s = applyResult(EMPTY_STATS, { won: true, role: 'agent', bestClue: null });
    s = applyResult(s, { won: true, role: 'spymaster', bestClue: { word: 'MAR', hits: 2 } });
    expect(s).toMatchObject({
      games: 2,
      wins: 2,
      gamesAsAgent: 1,
      winsAsAgent: 1,
      gamesAsSpymaster: 1,
      winsAsSpymaster: 1,
      currentStreak: 2,
      bestStreak: 2,
      bestClue: { word: 'MAR', hits: 2 },
    });
    s = applyResult(s, { won: false, role: 'agent', bestClue: null });
    expect(s).toMatchObject({ games: 3, wins: 2, currentStreak: 0, bestStreak: 2 });
    s = applyResult(s, { won: true, role: 'agent', bestClue: null });
    expect(s).toMatchObject({ currentStreak: 1, bestStreak: 2 });
  });

  it('keeps the best clue; a tie does not replace it', () => {
    let s = applyResult(EMPTY_STATS, {
      won: false,
      role: 'spymaster',
      bestClue: { word: 'SOL', hits: 3 },
    });
    s = applyResult(s, { won: false, role: 'spymaster', bestClue: { word: 'LUNA', hits: 3 } });
    expect(s.bestClue).toEqual({ word: 'SOL', hits: 3 });
    s = applyResult(s, { won: false, role: 'spymaster', bestClue: { word: 'MAR', hits: 4 } });
    expect(s.bestClue).toEqual({ word: 'MAR', hits: 4 });
    expect(EMPTY_STATS.games).toBe(0);
  });
});

describe('gameCountsForStats (spec §3)', () => {
  const base = {
    mode: 'classic' as const,
    players: 4,
    durationMs: 300_000,
    minDurationMs: 300_000,
  };
  it('needs a classic game, 4+ players and the minimum duration', () => {
    expect(gameCountsForStats(base)).toBe(true);
    expect(gameCountsForStats({ ...base, players: 3 })).toBe(false);
    expect(gameCountsForStats({ ...base, durationMs: 299_999 })).toBe(false);
    expect(gameCountsForStats({ ...base, mode: 'coop' })).toBe(false);
  });
});

const clue = (team: 'red' | 'blue', word: string, types: string[]): ClueRecord => ({
  team,
  word,
  count: 2,
  objection: 'none',
  guesses: types.map((type, i) => ({ cardId: `${word}${String(i)}`, type: type as 'red' })),
});

describe('resultsFor', () => {
  it('gives each starter their result, role at start and best clue as spymaster', () => {
    const roster = [
      { playerId: 'rs', team: 'red' as const, role: 'spymaster' as const },
      { playerId: 'ra', team: 'red' as const, role: 'agent' as const },
      { playerId: 'bs', team: 'blue' as const, role: 'spymaster' as const },
      { playerId: 'ba', team: 'blue' as const, role: 'agent' as const },
    ];
    const clues = [
      clue('red', 'MAR', ['red', 'red']),
      clue('blue', 'FRIO', ['blue', 'civilian']),
      clue('red', 'SOL', ['red', 'red', 'red']),
    ];
    const givers = ['rs', 'bs', 'rs'];
    const results = resultsFor(roster, clues, givers, 'red');
    expect(results.get('rs')).toEqual({
      won: true,
      role: 'spymaster',
      bestClue: { word: 'SOL', hits: 3 },
    });
    expect(results.get('ra')).toEqual({ won: true, role: 'agent', bestClue: null });
    expect(results.get('bs')).toEqual({
      won: false,
      role: 'spymaster',
      bestClue: { word: 'FRIO', hits: 1 },
    });
    expect(results.get('ba')?.won).toBe(false);
  });

  it('a spymaster whose clues found nothing has no best clue', () => {
    const roster = [{ playerId: 'rs', team: 'red' as const, role: 'spymaster' as const }];
    const results = resultsFor(roster, [clue('red', 'MAR', ['civilian'])], ['rs'], 'blue');
    expect(results.get('rs')?.bestClue).toBeNull();
  });
});

describe('rankings (spec §4)', () => {
  const row = (name: string, games: number, wins: number, likes = 0): RankRow => ({
    userId: name,
    displayName: name,
    stats: { ...EMPTY_STATS, games, wins, likesReceived: likes },
  });

  it('by wins: 10+ games, ties by win rate, then fewer games, then name', () => {
    const rows = [
      row('Ana', 20, 10),
      row('Beto', 10, 10),
      row('Caro', 9, 9),
      row('Dani', 20, 12),
      row('Eli', 20, 10),
      { ...row('Sin', 30, 30), displayName: null },
    ];
    expect(rankByWins(rows).map((r) => r.displayName)).toEqual(['Dani', 'Beto', 'Ana', 'Eli']);
    expect(rankByWins(rows)[0]).toEqual({
      userId: 'Dani',
      displayName: 'Dani',
      games: 20,
      wins: 12,
    });
  });

  it('most loved: likes per game, ties by likes, then name; capped at the limit', () => {
    const rows = [
      row('Ana', 10, 0, 5),
      row('Beto', 20, 0, 10),
      row('Caro', 10, 0, 9),
      row('Dani', 5, 0, 50),
    ];
    const ranked = rankByLove(rows);
    expect(ranked.map((r) => r.displayName)).toEqual(['Caro', 'Beto', 'Ana']);
    expect(ranked[0]).toMatchObject({ likes: 9, games: 10, perGame: 0.9 });
    expect(rankByLove(rows, 1)).toHaveLength(1);
  });
});

describe('likeDay', () => {
  it('is the UTC date', () => {
    expect(likeDay(Date.UTC(2026, 10, 11, 23, 59))).toBe('2026-11-11');
  });
});
