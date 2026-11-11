import type { CardType, ClueCount, ClueRecord, Team } from './types';

export interface TeamStats {
  clues: number;
  /** Own agents found by guessing (objection penalties don't count). */
  hits: number;
  /** Civilians, rival agents or the traitor touched by guessing. */
  misses: number;
}

export interface GameStats {
  teams: Record<Team, TeamStats>;
  /** The clue that connected the most own agents; the earliest one wins a tie. */
  bestClue: { team: Team; word: string; count: ClueCount; hits: number } | null;
  /** The traitor if someone revealed it, otherwise the first rival agent revealed by guessing. */
  blunder: { team: Team; clue: string; word: string; type: CardType } | null;
}

/**
 * End-of-game stats (SPEC §9), from the clue history only: every guess carries its card type.
 * Pure, so the client computes it from the final view and the tests pin it down.
 */
export function gameStats(
  clues: readonly ClueRecord[],
  cards: readonly { id: string; word: string }[],
): GameStats {
  const teams: Record<Team, TeamStats> = {
    red: { clues: 0, hits: 0, misses: 0 },
    blue: { clues: 0, hits: 0, misses: 0 },
  };
  let bestClue: GameStats['bestClue'] = null;
  let traitor: GameStats['blunder'] = null;
  let rival: GameStats['blunder'] = null;
  const wordOf = (id: string) => cards.find((c) => c.id === id)?.word ?? '';

  for (const clue of clues) {
    const stats = teams[clue.team];
    stats.clues += 1;
    const hits = clue.guesses.filter((g) => g.type === clue.team).length;
    stats.hits += hits;
    stats.misses += clue.guesses.length - hits;
    if (hits > 0 && hits > (bestClue?.hits ?? 0)) {
      bestClue = { team: clue.team, word: clue.word, count: clue.count, hits };
    }
    for (const guess of clue.guesses) {
      const blunder = {
        team: clue.team,
        clue: clue.word,
        word: wordOf(guess.cardId),
        type: guess.type,
      };
      if (guess.type === 'traitor') traitor ??= blunder;
      else if (guess.type !== 'civilian' && guess.type !== clue.team) rival ??= blunder;
    }
  }
  return { teams, bestClue, blunder: traitor ?? rival };
}
