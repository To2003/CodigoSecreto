import type { Settings } from '../schemas/settings';
import type { ClueRejection } from './clue';

export type Team = 'red' | 'blue';
export type CardType = Team | 'civilian' | 'traitor';
export type PlayerTeam = Team | 'spectator';
export type Role = 'spymaster' | 'agent';

export const TEAMS: readonly Team[] = ['red', 'blue'];
export const otherTeam = (team: Team): Team => (team === 'red' ? 'blue' : 'red');

/** The engine's view of a player. Nicknames, avatars and tokens live in the server's room. */
export interface EnginePlayer {
  id: string;
  team: PlayerTeam;
  role: Role;
  connected: boolean;
}

/** 0–9, or "inf" for ∞ (SPEC §1.4). */
export type ClueCount = number | 'inf';

/** Full card, type included. Only the server holds this; clients get a filtered view (SPEC §2.1). */
export interface Card {
  id: string;
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface Guess {
  cardId: string;
  type: CardType;
}

export interface ClueRecord {
  team: Team;
  word: string;
  count: ClueCount;
  guesses: Guess[];
  objection: 'none' | 'rejected' | 'accepted';
  /** Rival agent revealed as the penalty of an accepted objection. */
  penaltyCardId?: string;
}

export type GameOverReason = 'agents' | 'traitor';

export type Phase =
  | { name: 'clue'; team: Team }
  /** guessesLeft: null = unlimited (count 0 or ∞). */
  | { name: 'guess'; team: Team; guessesLeft: number | null }
  | {
      name: 'objection';
      team: Team;
      guessesLeft: number | null;
      objector: string;
      /** Fixed when the vote opens (ADR-018 §2). */
      voters: string[];
      votes: Record<string, boolean>;
    }
  | { name: 'over'; winner: Team; reason: GameOverReason };

export interface GameState {
  settings: Settings;
  players: EnginePlayer[];
  cards: Card[];
  startingTeam: Team;
  phase: Phase;
  clues: ClueRecord[];
  /** Agent id → the card they point at (SPEC §3.4). Cleared on every turn change. */
  points: Record<string, string>;
  /** Turns started so far by each team; the server uses it for the first-turn timer bonus. */
  teamTurns: Record<Team, number>;
}

export type Action =
  | { type: 'START_GAME'; players: EnginePlayer[]; settings: Settings; excludeWords?: string[] }
  | { type: 'GIVE_CLUE'; playerId: string; word: string; count: ClueCount }
  | { type: 'POINT_CARD'; playerId: string; cardId: string | null }
  | { type: 'REVEAL_CARD'; playerId: string; cardId: string }
  | { type: 'END_GUESSING'; playerId: string }
  | { type: 'OBJECT_CLUE'; playerId: string }
  | { type: 'VOTE_OBJECTION'; playerId: string; accept: boolean }
  /** System action: only the server's timers create it. */
  | { type: 'TIMER_EXPIRED' }
  /** System action: only the server's presence tracking creates it. */
  | { type: 'SET_CONNECTED'; playerId: string; connected: boolean }
  | { type: 'REMATCH'; keepSpymasters: boolean }
  /** Host action (server checks it): a new spymaster for a team, e.g. when theirs dropped. */
  | { type: 'SET_SPYMASTER'; team: Team; playerId: string };

export type TurnEndReason =
  'civilian' | 'rival' | 'guesses_used' | 'ended' | 'timeout' | 'objection';

export type GameEvent =
  | { type: 'GAME_STARTED'; startingTeam: Team }
  | { type: 'CLUE_GIVEN'; team: Team; word: string; count: ClueCount }
  /** `team` is the pointer's team: the server shows these only to that team. */
  | { type: 'CARD_POINTED'; playerId: string; team: Team; cardId: string | null }
  | { type: 'CARD_REVEALED'; cardId: string; cardType: CardType; team: Team; penalty: boolean }
  | { type: 'TURN_CHANGED'; team: Team; reason: TurnEndReason }
  | { type: 'OBJECTION_OPENED'; objector: string }
  | { type: 'OBJECTION_VOTED'; playerId: string; accept: boolean }
  | { type: 'OBJECTION_RESOLVED'; accepted: boolean }
  | { type: 'GAME_OVER'; winner: Team; reason: GameOverReason }
  | { type: 'SPYMASTER_CHANGED'; team: Team; playerId: string };

export type EngineErrorCode =
  | 'GAME_IN_PROGRESS'
  | 'NO_GAME'
  | 'MODE_NOT_AVAILABLE'
  | 'TEAMS_INCOMPLETE'
  | 'NOT_ENOUGH_WORDS'
  | 'WRONG_PHASE'
  | 'NOT_A_PLAYER'
  | 'WRONG_TEAM'
  | 'NOT_YOUR_TURN'
  | 'WRONG_ROLE'
  | 'INVALID_CLUE'
  | 'INVALID_COUNT'
  | 'CARD_NOT_FOUND'
  | 'CARD_ALREADY_REVEALED'
  | 'MUST_GUESS_FIRST'
  | 'REVEAL_BY_MAJORITY'
  | 'OBJECTIONS_DISABLED'
  | 'OBJECTION_TOO_LATE'
  | 'ALREADY_OBJECTED'
  | 'NOT_A_VOTER'
  | 'ALREADY_VOTED';

export interface EngineError {
  code: EngineErrorCode;
  /** For INVALID_CLUE: why, and which board word it clashed with. */
  clue?: { reason: ClueRejection; conflict?: string };
}

export type ActionResult =
  { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: EngineError };
