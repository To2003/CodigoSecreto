import { DEFAULT_SETTINGS, type Settings } from '../schemas/settings';
import { applyAction } from './engine';
import { mulberry32, pick } from './rng';
import type { Action, EnginePlayer, GameEvent, GameState } from './types';

const BOTS: EnginePlayer[] = [
  { id: 'rojo-jefe', team: 'red', role: 'spymaster', connected: true },
  { id: 'rojo-1', team: 'red', role: 'agent', connected: true },
  { id: 'rojo-2', team: 'red', role: 'agent', connected: true },
  { id: 'azul-jefe', team: 'blue', role: 'spymaster', connected: true },
  { id: 'azul-1', team: 'blue', role: 'agent', connected: true },
  { id: 'azul-2', team: 'blue', role: 'agent', connected: true },
];

export interface Simulation {
  state: GameState;
  actions: number;
  events: GameEvent[];
}

/**
 * Plays a full game with random bots: clues, points, reveals, passing, objections and timeouts.
 * Used by the console script and as a fuzz test: every action the bots take must be accepted.
 */
export function simulateGame(
  seed: number,
  settings: Partial<Settings> = {},
  maxActions = 2000,
): Simulation {
  const rng = mulberry32(seed);
  const events: GameEvent[] = [];
  let actions = 0;

  const run = (current: GameState | null, action: Action): GameState => {
    const res = applyAction(current, action, rng);
    if (!res.ok) throw new Error(`seed ${seed}: ${action.type} failed with ${res.error.code}`);
    events.push(...res.events);
    actions += 1;
    return res.state;
  };

  let state = run(null, {
    type: 'START_GAME',
    players: BOTS,
    settings: { ...DEFAULT_SETTINGS, ...settings },
  });

  for (let turn = 0; state.phase.name !== 'over'; turn++) {
    if (actions >= maxActions) throw new Error(`seed ${seed}: game did not end`);
    const phase = state.phase;
    const members = state.players.filter((p) => p.team === phase.team);
    const spymaster = members.find((p) => p.role === 'spymaster')?.id ?? '';
    const agent = pick(
      members.filter((p) => p.role === 'agent'),
      rng,
    ).id;

    if (phase.name === 'clue') {
      // "QX…" never shows up inside a Spanish word, so the clue is always valid.
      const word = `QX${String.fromCharCode(65 + (turn % 26))}`;
      const count = rng() < 0.1 ? 'inf' : Math.floor(rng() * 4);
      state = run(
        state,
        rng() < 0.05
          ? { type: 'TIMER_EXPIRED' }
          : { type: 'GIVE_CLUE', playerId: spymaster, word, count },
      );
      continue;
    }

    if (phase.name === 'objection') {
      const voter = phase.voters.find((id) => !(id in phase.votes));
      state = run(
        state,
        voter && rng() < 0.8
          ? { type: 'VOTE_OBJECTION', playerId: voter, accept: rng() < 0.5 }
          : { type: 'TIMER_EXPIRED' },
      );
      continue;
    }

    const clue = state.clues[state.clues.length - 1];
    const rival = state.players.find((p) => p.team !== phase.team && p.role === 'spymaster');
    const unrevealed = state.cards.filter((c) => !c.revealed);
    const roll = rng();
    const canObject = state.settings.objections && clue?.objection === 'none';
    if (canObject && clue.guesses.length === 0 && rival && roll < 0.08) {
      state = run(state, { type: 'OBJECT_CLUE', playerId: rival.id });
    } else if (clue && clue.guesses.length > 0 && roll < 0.3) {
      state = run(state, { type: 'END_GUESSING', playerId: agent });
    } else if (roll < 0.32) {
      state = run(state, { type: 'TIMER_EXPIRED' });
    } else if (state.settings.revealMode === 'majority') {
      // Every agent points at the same card; the majority reveals it.
      const target = pick(unrevealed, rng).id;
      for (const p of members.filter((m) => m.role === 'agent')) {
        if (state.phase.name !== 'guess') break;
        state = run(state, { type: 'POINT_CARD', playerId: p.id, cardId: target });
      }
    } else {
      state = run(state, { type: 'POINT_CARD', playerId: agent, cardId: pick(unrevealed, rng).id });
      if (state.phase.name === 'guess') {
        const target = pick(
          state.cards.filter((c) => !c.revealed),
          rng,
        ).id;
        state = run(state, { type: 'REVEAL_CARD', playerId: agent, cardId: target });
      }
    }
  }
  return { state, actions, events };
}
