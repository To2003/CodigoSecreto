import type { CardType, ClueRecord, Phase, Team } from '../engine/types';

/**
 * A card as a given player sees it. `type` is present only when the card is revealed or the
 * player may see the key map (spymaster, game over, or spectators when the room allows it).
 * SPEC §2.1: the key map never reaches agents or spectators otherwise.
 */
export interface PublicCard {
  id: string;
  word: string;
  revealed: boolean;
  type?: CardType;
}

/** The game part of a room view, already filtered for one player. */
export interface GameView {
  phase: Phase;
  startingTeam: Team;
  cards: PublicCard[];
  /** Clue history. Guesses and penalties only reference revealed cards. */
  clues: ClueRecord[];
  /** Agent id → pointed card. Only the active team sees them. */
  points: Record<string, string>;
  /** Unrevealed agents per team (public: totals are known, revealed cards are visible). */
  remaining: Record<Team, number>;
  /** Whether this player's cards carry types. */
  seesMap: boolean;
  /** Set while the active team's spymaster is disconnected (SPEC §2.4). */
  paused: { team: Team; spymasterId: string } | null;
}
