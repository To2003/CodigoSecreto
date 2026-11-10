import { validateClue } from './clue';
import { pick, type Rng } from './rng';
import { createGame, rotateSpymasters } from './setup';
import {
  otherTeam,
  type Action,
  type ActionResult,
  type Card,
  type ClueCount,
  type ClueRecord,
  type EngineError,
  type EngineErrorCode,
  type EnginePlayer,
  type GameEvent,
  type GameState,
  type Phase,
  type Team,
  type TurnEndReason,
} from './types';

type ObjectionPhase = Extract<Phase, { name: 'objection' }>;

const fail = (code: EngineErrorCode, extra: Omit<EngineError, 'code'> = {}): ActionResult => ({
  ok: false,
  error: { code, ...extra },
});

/**
 * The whole rule engine (SPEC §1.8): pure, deterministic given `rng`. Invalid actions return a
 * typed error and leave `state` untouched; valid ones return a new state plus the events to animate.
 */
export function applyAction(state: GameState | null, action: Action, rng: Rng): ActionResult {
  switch (action.type) {
    case 'START_GAME':
      if (state && state.phase.name !== 'over') return fail('GAME_IN_PROGRESS');
      return createGame(action.players, action.settings, rng, action.excludeWords);
    case 'REMATCH':
      if (!state) return fail('NO_GAME');
      if (state.phase.name !== 'over') return fail('GAME_IN_PROGRESS');
      return createGame(
        action.keepSpymasters ? state.players : rotateSpymasters(state.players),
        state.settings,
        rng,
        state.cards.map((c) => c.word),
      );
  }
  if (!state) return fail('NO_GAME');
  const turn = new Turn(structuredClone(state), rng);
  const error = turn.run(action);
  return error ? fail(error.code, error.clue ? { clue: error.clue } : {}) : turn.result();
}

const isValidCount = (count: ClueCount) =>
  count === 'inf' || (Number.isInteger(count) && count >= 0 && count <= 9);

/** Mutable working copy for one action. Created from a clone, so `state` is never touched. */
class Turn {
  private readonly events: GameEvent[] = [];

  constructor(
    private readonly s: GameState,
    private readonly rng: Rng,
  ) {}

  result(): ActionResult {
    return { ok: true, state: this.s, events: this.events };
  }

  run(action: Exclude<Action, { type: 'START_GAME' | 'REMATCH' }>): EngineError | undefined {
    switch (action.type) {
      case 'SET_CONNECTED': {
        const p = this.player(action.playerId);
        if (!p) return { code: 'NOT_A_PLAYER' };
        p.connected = action.connected;
        return;
      }
      case 'TIMER_EXPIRED':
        return this.timerExpired();
      case 'GIVE_CLUE':
        return this.giveClue(action.playerId, action.word, action.count);
      case 'POINT_CARD':
        return this.point(action.playerId, action.cardId);
      case 'REVEAL_CARD':
        return this.revealByAgent(action.playerId, action.cardId);
      case 'END_GUESSING':
        return this.endGuessing(action.playerId);
      case 'OBJECT_CLUE':
        return this.object(action.playerId);
      case 'VOTE_OBJECTION':
        return this.vote(action.playerId, action.accept);
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private player(id: string): EnginePlayer | undefined {
    return this.s.players.find((p) => p.id === id);
  }

  /** Checks the actor belongs to `team` with `role`; errors in the order the UI cares about. */
  private actor(id: string, team: Team, role: EnginePlayer['role']): EngineError | undefined {
    const p = this.player(id);
    if (!p) return { code: 'NOT_A_PLAYER' };
    if (p.team !== team) return { code: 'NOT_YOUR_TURN' };
    if (p.role !== role) return { code: 'WRONG_ROLE' };
    return;
  }

  private card(id: string): Card | EngineError {
    const card = this.s.cards.find((c) => c.id === id);
    if (!card) return { code: 'CARD_NOT_FOUND' };
    if (card.revealed) return { code: 'CARD_ALREADY_REVEALED' };
    return card;
  }

  /** The guess and objection phases always follow GIVE_CLUE, so the last clue is the current one. */
  private get currentClue(): ClueRecord {
    return this.s.clues[this.s.clues.length - 1] as ClueRecord;
  }

  private endTurn(reason: TurnEndReason) {
    if (this.s.phase.name === 'over') return;
    const next = otherTeam(this.s.phase.team);
    this.s.phase = { name: 'clue', team: next };
    this.s.points = {};
    this.s.teamTurns[next] += 1;
    this.events.push({ type: 'TURN_CHANGED', team: next, reason });
  }

  private gameOver(winner: Team, reason: 'agents' | 'traitor') {
    this.s.phase = { name: 'over', winner, reason };
    this.s.points = {};
    this.events.push({ type: 'GAME_OVER', winner, reason });
  }

  /**
   * Flips a card and applies its consequence (SPEC §1.4–1.5). Win checks run in the SPEC order:
   * traitor first, then complete teams. `penalty` = revealed by an accepted objection.
   */
  private reveal(card: Card, team: Team, penalty: boolean) {
    card.revealed = true;
    this.s.points = Object.fromEntries(
      Object.entries(this.s.points).filter(([, cardId]) => cardId !== card.id),
    );
    if (!penalty) this.currentClue.guesses.push({ cardId: card.id, type: card.type });
    this.events.push({
      type: 'CARD_REVEALED',
      cardId: card.id,
      cardType: card.type,
      team,
      penalty,
    });

    if (card.type === 'traitor') {
      this.gameOver(otherTeam(team), 'traitor');
      return;
    }
    const owner = card.type;
    if (owner !== 'civilian' && this.s.cards.every((c) => c.type !== owner || c.revealed)) {
      this.gameOver(owner, 'agents');
      return;
    }
    if (penalty || this.s.phase.name !== 'guess') return;

    if (card.type === 'civilian') this.endTurn('civilian');
    else if (card.type !== team) this.endTurn('rival');
    else if (this.s.phase.guessesLeft !== null) {
      this.s.phase.guessesLeft -= 1;
      if (this.s.phase.guessesLeft === 0) this.endTurn('guesses_used');
    }
  }

  // ── actions ──────────────────────────────────────────────────────────────

  private timerExpired(): EngineError | undefined {
    switch (this.s.phase.name) {
      case 'clue':
      case 'guess':
        this.endTurn('timeout');
        return;
      case 'objection':
        this.resolveObjection(this.s.phase);
        return;
      case 'over':
        return { code: 'WRONG_PHASE' };
    }
  }

  private giveClue(playerId: string, word: string, count: ClueCount): EngineError | undefined {
    const phase = this.s.phase;
    if (phase.name !== 'clue') return { code: 'WRONG_PHASE' };
    const bad = this.actor(playerId, phase.team, 'spymaster');
    if (bad) return bad;
    if (!isValidCount(count)) return { code: 'INVALID_COUNT' };
    const unrevealed = this.s.cards.filter((c) => !c.revealed).map((c) => c.word);
    const check = validateClue(word, unrevealed, { allowCompound: this.s.settings.compoundWords });
    if (!check.ok) {
      return {
        code: 'INVALID_CLUE',
        clue: check.conflict
          ? { reason: check.reason, conflict: check.conflict }
          : { reason: check.reason },
      };
    }
    const clueWord = word.trim().toLocaleUpperCase('es-AR');
    this.s.clues.push({ team: phase.team, word: clueWord, count, guesses: [], objection: 'none' });
    this.s.phase = {
      name: 'guess',
      team: phase.team,
      guessesLeft: count === 'inf' || count === 0 ? null : count + 1,
    };
    this.events.push({ type: 'CLUE_GIVEN', team: phase.team, word: clueWord, count });
    return;
  }

  private point(playerId: string, cardId: string | null): EngineError | undefined {
    const phase = this.s.phase;
    if (phase.name !== 'guess') return { code: 'WRONG_PHASE' };
    const bad = this.actor(playerId, phase.team, 'agent');
    if (bad) return bad;
    if (cardId === null) {
      this.s.points = Object.fromEntries(
        Object.entries(this.s.points).filter(([agentId]) => agentId !== playerId),
      );
      this.events.push({ type: 'CARD_POINTED', playerId, cardId: null });
      return;
    }
    const card = this.card(cardId);
    if (!('word' in card)) return card;
    this.s.points[playerId] = card.id;
    this.events.push({ type: 'CARD_POINTED', playerId, cardId: card.id });

    if (this.s.settings.revealMode === 'majority') {
      const agents = this.s.players.filter(
        (p) => p.team === phase.team && p.role === 'agent' && p.connected,
      );
      const pointing = agents.filter((p) => this.s.points[p.id] === card.id).length;
      if (pointing * 2 > agents.length) this.reveal(card, phase.team, false);
    }
    return;
  }

  private revealByAgent(playerId: string, cardId: string): EngineError | undefined {
    const phase = this.s.phase;
    if (phase.name !== 'guess') return { code: 'WRONG_PHASE' };
    const bad = this.actor(playerId, phase.team, 'agent');
    if (bad) return bad;
    if (this.s.settings.revealMode === 'majority') return { code: 'REVEAL_BY_MAJORITY' };
    const card = this.card(cardId);
    if (!('word' in card)) return card;
    this.reveal(card, phase.team, false);
    return;
  }

  private endGuessing(playerId: string): EngineError | undefined {
    const phase = this.s.phase;
    if (phase.name !== 'guess') return { code: 'WRONG_PHASE' };
    const bad = this.actor(playerId, phase.team, 'agent');
    if (bad) return bad;
    if (this.currentClue.guesses.length === 0) return { code: 'MUST_GUESS_FIRST' };
    this.endTurn('ended');
    return;
  }

  private object(playerId: string): EngineError | undefined {
    const phase = this.s.phase;
    if (phase.name !== 'guess') return { code: 'WRONG_PHASE' };
    if (!this.s.settings.objections) return { code: 'OBJECTIONS_DISABLED' };
    const bad = this.actor(playerId, otherTeam(phase.team), 'spymaster');
    if (bad) return bad;
    const clue = this.currentClue;
    if (clue.objection !== 'none') return { code: 'ALREADY_OBJECTED' };
    if (clue.guesses.length > 0) return { code: 'OBJECTION_TOO_LATE' };

    const clueGiver = this.s.players.find((p) => p.team === phase.team && p.role === 'spymaster');
    const voters = this.s.players
      .filter((p) => p.team !== 'spectator' && p.id !== clueGiver?.id)
      .filter((p) => p.connected || p.id === playerId)
      .map((p) => p.id);
    const objection: ObjectionPhase = {
      name: 'objection',
      team: phase.team,
      guessesLeft: phase.guessesLeft,
      objector: playerId,
      voters,
      votes: { [playerId]: true },
    };
    this.s.phase = objection;
    this.events.push({ type: 'OBJECTION_OPENED', objector: playerId });
    this.resolveIfDecided(objection);
    return;
  }

  private vote(playerId: string, accept: boolean): EngineError | undefined {
    const phase = this.s.phase;
    if (phase.name !== 'objection') return { code: 'WRONG_PHASE' };
    if (!phase.voters.includes(playerId)) return { code: 'NOT_A_VOTER' };
    if (playerId in phase.votes) return { code: 'ALREADY_VOTED' };
    phase.votes[playerId] = accept;
    this.events.push({ type: 'OBJECTION_VOTED', playerId, accept });
    this.resolveIfDecided(phase);
    return;
  }

  /** Resolves as soon as the outcome can't change: a yes majority, or not enough votes left for one. */
  private resolveIfDecided(phase: ObjectionPhase) {
    const yes = Object.values(phase.votes).filter(Boolean).length;
    const pending = phase.voters.filter((id) => !(id in phase.votes)).length;
    if (yes * 2 > phase.voters.length || (yes + pending) * 2 <= phase.voters.length) {
      this.resolveObjection(phase);
    }
  }

  /** Accepted only with more than half of the eligible voters saying yes (ADR-018 §1–3). */
  private resolveObjection(phase: ObjectionPhase) {
    const yes = Object.values(phase.votes).filter(Boolean).length;
    const accepted = yes * 2 > phase.voters.length;
    const clue = this.currentClue;
    this.events.push({ type: 'OBJECTION_RESOLVED', accepted });

    if (!accepted) {
      clue.objection = 'rejected';
      this.s.phase = { name: 'guess', team: phase.team, guessesLeft: phase.guessesLeft };
      return;
    }
    clue.objection = 'accepted';
    const objecting = otherTeam(phase.team);
    const penalty = pick(
      this.s.cards.filter((c) => c.type === objecting && !c.revealed),
      this.rng,
    );
    clue.penaltyCardId = penalty.id;
    this.s.phase = { name: 'guess', team: phase.team, guessesLeft: phase.guessesLeft };
    this.reveal(penalty, objecting, true);
    this.endTurn('objection');
  }
}
