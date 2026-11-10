import { describe, expect, it } from 'vitest';
import { gameStats } from './stats';
import type { ClueRecord, Guess } from './types';

const g = (cardId: string, type: Guess['type']): Guess => ({ cardId, type });
const clue = (
  team: ClueRecord['team'],
  word: string,
  guesses: Guess[],
  extra: Partial<ClueRecord> = {},
): ClueRecord => ({ team, word, count: 2, guesses, objection: 'none', ...extra });
const words = (ids: string[]) => ids.map((id) => ({ id, word: id.toUpperCase() }));

describe('gameStats (SPEC §9)', () => {
  it('counts clues, hits and misses per team', () => {
    const stats = gameStats(
      [
        clue('red', 'MAR', [g('a', 'red'), g('b', 'red'), g('c', 'civilian')]),
        clue('blue', 'FRIO', [g('d', 'blue'), g('e', 'red')]),
        clue('red', 'LUZ', []),
      ],
      words(['a', 'b', 'c', 'd', 'e']),
    );
    expect(stats.teams).toEqual({
      red: { clues: 2, hits: 2, misses: 1 },
      blue: { clues: 1, hits: 1, misses: 1 },
    });
  });

  it('best clue: the one that connected the most own agents; the earliest wins a tie', () => {
    const stats = gameStats(
      [
        clue('red', 'MAR', [g('a', 'red'), g('b', 'red')]),
        clue('blue', 'FRIO', [g('d', 'blue'), g('e', 'blue')]),
        clue('blue', 'NIEVE', [g('f', 'blue'), g('h', 'blue'), g('i', 'blue')], { count: 3 }),
      ],
      words(['a', 'b', 'd', 'e', 'f', 'h', 'i']),
    );
    expect(stats.bestClue).toEqual({ team: 'blue', word: 'NIEVE', count: 3, hits: 3 });
    const tie = gameStats(
      [clue('red', 'MAR', [g('a', 'red')]), clue('blue', 'FRIO', [g('d', 'blue')])],
      words(['a', 'd']),
    );
    expect(tie.bestClue?.word).toBe('MAR');
  });

  it('no best clue when nobody hit anything', () => {
    expect(gameStats([clue('red', 'MAR', [g('c', 'civilian')])], words(['c'])).bestClue).toBeNull();
    expect(gameStats([], []).bestClue).toBeNull();
  });

  it('blunder: the traitor if someone touched it, otherwise the first rival agent', () => {
    const rival = gameStats(
      [clue('red', 'MAR', [g('a', 'red'), g('e', 'blue')]), clue('blue', 'FRIO', [g('f', 'red')])],
      words(['a', 'e', 'f']),
    );
    expect(rival.blunder).toEqual({ team: 'red', clue: 'MAR', word: 'E', type: 'blue' });
    const traitor = gameStats(
      [clue('red', 'MAR', [g('e', 'blue')]), clue('blue', 'FRIO', [g('t', 'traitor')])],
      words(['e', 't']),
    );
    expect(traitor.blunder).toEqual({ team: 'blue', clue: 'FRIO', word: 'T', type: 'traitor' });
  });

  it('civilians are not a blunder, and objection penalties count for nobody', () => {
    const stats = gameStats(
      [clue('red', 'MAR', [g('c', 'civilian')], { objection: 'accepted', penaltyCardId: 'p' })],
      words(['c', 'p']),
    );
    expect(stats.blunder).toBeNull();
    expect(stats.teams.red).toEqual({ clues: 1, hits: 0, misses: 1 });
    expect(stats.teams.blue).toEqual({ clues: 0, hits: 0, misses: 0 });
  });
});
