import { validateClue, type ClueRejection } from './clue';
import { randomId, shuffle, type Rng } from './rng';
import { isValidCount } from './engine';
import { otherTeam, type ClueCount, type EnginePlayer, type Team } from './types';

/**
 * Cooperative mode (M9.1, docs/specs/M9-cooperativo.md): two sides against the board, each with
 * its own key map of the same 25 words. Pure, like the classic engine: no I/O, rng injected.
 * Sides reuse the room's teams: red = side A, blue = side B.
 */
export type Side = Team;
export type CoopKey = 'agent' | 'civilian' | 'traitor';

export const COOP_TURNS = 9;
export const COOP_MIN_PLAYERS = 2;
export const COOP_MAX_PLAYERS = 3;

/** How the two faces combine (spec §3): [side A, side B, how many cards]. */
export const COOP_LAYOUT: readonly [CoopKey, CoopKey, number][] = [
  ['agent', 'agent', 3],
  ['agent', 'traitor', 1],
  ['agent', 'civilian', 5],
  ['traitor', 'agent', 1],
  ['traitor', 'traitor', 1],
  ['traitor', 'civilian', 1],
  ['civilian', 'agent', 5],
  ['civilian', 'traitor', 1],
  ['civilian', 'civilian', 7],
];
/** Distinct agents to find: every card that is an agent on at least one side. */
export const COOP_AGENTS = COOP_LAYOUT.filter(([a, b]) => a === 'agent' || b === 'agent').reduce(
  (n, [, , count]) => n + count,
  0,
);

export interface CoopCard {
  id: string;
  word: string;
  key: Record<Side, CoopKey>;
  /** Found as an agent: done for both sides. */
  found: boolean;
  /** Sides whose clue turned this card up as a civilian. It may still be the other side's agent. */
  civilianFor: Side[];
}

export interface CoopClue {
  giver: Side;
  word: string;
  count: ClueCount;
  guesses: { cardId: string; result: CoopKey }[];
}

export type CoopPhase =
  | { name: 'clue'; giver: Side }
  | { name: 'guess'; giver: Side }
  | { name: 'over'; won: boolean; reason: 'agents' | 'traitor' | 'turns' };

export interface CoopState {
  players: EnginePlayer[];
  cards: CoopCard[];
  phase: CoopPhase;
  /** Turns not yet spent; each clue spends one (spec §4). */
  turnsLeft: number;
  clues: CoopClue[];
  compoundWords: boolean;
}

export type CoopAction =
  | { type: 'GIVE_CLUE'; playerId: string; word: string; count: ClueCount }
  | { type: 'REVEAL_CARD'; playerId: string; cardId: string }
  | { type: 'END_GUESSING'; playerId: string };

export type CoopEvent =
  | { type: 'COOP_STARTED' }
  | { type: 'COOP_CLUE'; giver: Side; word: string; count: ClueCount }
  | { type: 'COOP_GUESS'; giver: Side; cardId: string; result: CoopKey }
  | { type: 'COOP_TURN'; giver: Side; turnsLeft: number }
  | { type: 'COOP_OVER'; won: boolean; reason: 'agents' | 'traitor' | 'turns' };

export type CoopErrorCode =
  | 'TEAMS_INCOMPLETE'
  | 'NOT_ENOUGH_WORDS'
  | 'WRONG_PHASE'
  | 'NOT_A_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'INVALID_CLUE'
  | 'INVALID_COUNT'
  | 'CARD_NOT_FOUND'
  | 'CARD_ALREADY_REVEALED'
  | 'MUST_GUESS_FIRST';

export interface CoopError {
  code: CoopErrorCode;
  clue?: { reason: ClueRejection; conflict?: string };
}

export type CoopResult =
  { ok: true; state: CoopState; events: CoopEvent[] } | { ok: false; error: CoopError };

/** Why a cooperative game can't start with these players, or null when it can (spec §2). */
export function coopBlocker(players: readonly EnginePlayer[]): 'TEAMS_INCOMPLETE' | null {
  const playing = players.filter((p) => p.team !== 'spectator');
  const sides = new Set(playing.map((p) => p.team));
  if (playing.length < COOP_MIN_PLAYERS || playing.length > COOP_MAX_PLAYERS) {
    return 'TEAMS_INCOMPLETE';
  }
  return sides.has('red') && sides.has('blue') ? null : 'TEAMS_INCOMPLETE';
}

export function startCoop(
  players: EnginePlayer[],
  words: readonly string[],
  compoundWords: boolean,
  rng: Rng,
): CoopResult {
  if (coopBlocker(players)) return { ok: false, error: { code: 'TEAMS_INCOMPLETE' } };
  const faces = COOP_LAYOUT.flatMap(([a, b, n]) =>
    Array.from({ length: n }, () => ({ red: a, blue: b })),
  );
  if (words.length !== faces.length) return { ok: false, error: { code: 'NOT_ENOUGH_WORDS' } };
  const keys = shuffle(faces, rng);
  const ids = new Set<string>();
  const cards: CoopCard[] = words.map((word, i) => {
    let id = randomId(rng);
    while (ids.has(id)) id = randomId(rng);
    ids.add(id);
    return { id, word, key: keys[i] as Record<Side, CoopKey>, found: false, civilianFor: [] };
  });
  return {
    ok: true,
    state: {
      players: structuredClone(players),
      cards,
      phase: { name: 'clue', giver: 'red' },
      turnsLeft: COOP_TURNS,
      clues: [],
      compoundWords,
    },
    events: [{ type: 'COOP_STARTED' }],
  };
}

/** Agents still hidden in one side's map. */
export const agentsLeft = (state: CoopState, side: Side) =>
  state.cards.filter((c) => c.key[side] === 'agent' && !c.found).length;

/** Agents still hidden in total (cards that are agents on either side). */
export const totalAgentsLeft = (state: CoopState) =>
  state.cards.filter((c) => !c.found && (c.key.red === 'agent' || c.key.blue === 'agent')).length;

export function applyCoopAction(state: CoopState, action: CoopAction): CoopResult {
  const s = structuredClone(state);
  const events: CoopEvent[] = [];
  const fail = (code: CoopErrorCode, clue?: CoopError['clue']): CoopResult => ({
    ok: false,
    error: clue ? { code, clue } : { code },
  });
  const player = s.players.find((p) => p.id === action.playerId);
  if (!player || player.team === 'spectator') return fail('NOT_A_PLAYER');
  const phase = s.phase;
  if (phase.name === 'over') return fail('WRONG_PHASE');

  /** The giver for the next turn: alternate, unless that side has no agents left to point at. */
  const nextTurn = (giver: Side) => {
    if (totalAgentsLeft(s) === 0) {
      s.phase = { name: 'over', won: true, reason: 'agents' };
      events.push({ type: 'COOP_OVER', won: true, reason: 'agents' });
      return;
    }
    if (s.turnsLeft === 0) {
      s.phase = { name: 'over', won: false, reason: 'turns' };
      events.push({ type: 'COOP_OVER', won: false, reason: 'turns' });
      return;
    }
    const other = otherTeam(giver);
    const next = agentsLeft(s, other) > 0 ? other : giver;
    s.phase = { name: 'clue', giver: next };
    events.push({ type: 'COOP_TURN', giver: next, turnsLeft: s.turnsLeft });
  };

  switch (action.type) {
    case 'GIVE_CLUE': {
      if (phase.name !== 'clue') return fail('WRONG_PHASE');
      if (player.team !== phase.giver) return fail('NOT_YOUR_TURN');
      if (!isValidCount(action.count)) return fail('INVALID_COUNT');
      // Only cards nobody has found yet are off-limits as clues (same rules as classic, §1.6).
      const hidden = s.cards.filter((c) => !c.found).map((c) => c.word);
      const check = validateClue(action.word, hidden, { allowCompound: s.compoundWords });
      if (!check.ok) {
        return fail(
          'INVALID_CLUE',
          check.conflict
            ? { reason: check.reason, conflict: check.conflict }
            : { reason: check.reason },
        );
      }
      const word = action.word.trim().toLocaleUpperCase('es-AR');
      s.clues.push({ giver: phase.giver, word, count: action.count, guesses: [] });
      s.turnsLeft -= 1;
      s.phase = { name: 'guess', giver: phase.giver };
      events.push({ type: 'COOP_CLUE', giver: phase.giver, word, count: action.count });
      break;
    }
    case 'REVEAL_CARD': {
      if (phase.name !== 'guess') return fail('WRONG_PHASE');
      if (player.team === phase.giver) return fail('NOT_YOUR_TURN');
      const card = s.cards.find((c) => c.id === action.cardId);
      if (!card) return fail('CARD_NOT_FOUND');
      // Found, or already a civilian for this giver: nothing new to learn from this side's map.
      if (card.found || card.civilianFor.includes(phase.giver))
        return fail('CARD_ALREADY_REVEALED');
      const result = card.key[phase.giver];
      const clue = s.clues[s.clues.length - 1];
      clue?.guesses.push({ cardId: card.id, result });
      events.push({ type: 'COOP_GUESS', giver: phase.giver, cardId: card.id, result });
      if (result === 'traitor') {
        s.phase = { name: 'over', won: false, reason: 'traitor' };
        events.push({ type: 'COOP_OVER', won: false, reason: 'traitor' });
      } else if (result === 'agent') {
        card.found = true;
        if (totalAgentsLeft(s) === 0) nextTurn(phase.giver);
        // While the giver's own map still has agents, guessing goes on.
        else if (agentsLeft(s, phase.giver) === 0) nextTurn(phase.giver);
      } else {
        card.civilianFor.push(phase.giver);
        nextTurn(phase.giver);
      }
      break;
    }
    case 'END_GUESSING': {
      if (phase.name !== 'guess') return fail('WRONG_PHASE');
      if (player.team === phase.giver) return fail('NOT_YOUR_TURN');
      if ((s.clues[s.clues.length - 1]?.guesses.length ?? 0) === 0) return fail('MUST_GUESS_FIRST');
      nextTurn(phase.giver);
      break;
    }
  }
  return { ok: true, state: s, events };
}
