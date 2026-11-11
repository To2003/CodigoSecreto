import type { CoopClue, CoopKey, CoopPhase, Side } from '../engine/coop';
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

/**
 * The running timer of the current phase (SPEC §1.6–1.7). `remainingMs` is measured when the view
 * is sent, so clients don't depend on their clock matching the server's.
 */
export interface TimerView {
  kind: 'clue' | 'guess' | 'objection';
  remainingMs: number;
  totalMs: number;
  /** False while the game is paused: the timer is frozen. */
  running: boolean;
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
  /**
   * Set while the active team can't move (SPEC §2.4): its spymaster is away, or it is guessing
   * with no agent connected. `waitingFor` lists who could unblock it by coming back.
   */
  paused: { team: Team; reason: 'spymaster' | 'agents'; waitingFor: string[] } | null;
  timer: TimerView | null;
  /** How long the game lasted; set once it's over (end-of-game stats, SPEC §9). */
  durationMs: number | null;
}

/** A cooperative card as one player sees it (docs/specs/M9-cooperativo.md §6). */
export interface CoopPublicCard {
  id: string;
  word: string;
  found: boolean;
  /** Sides whose clue turned this card up as a civilian: public once it happened. */
  civilianFor: Side[];
  /** What it is on the viewer's own map; absent for spectators until the end. */
  key?: CoopKey;
  /** Both maps, once the game is over. */
  keys?: Record<Side, CoopKey>;
}

/** The cooperative game, already filtered for one player. */
export interface CoopView {
  /** The viewer's side, or null for spectators. */
  side: Side | null;
  cards: CoopPublicCard[];
  phase: CoopPhase;
  turnsLeft: number;
  agentsLeft: number;
  clues: CoopClue[];
}
