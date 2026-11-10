import {
  applyAction,
  DEFAULT_SETTINGS,
  mulberry32,
  type EnginePlayer,
  type GameState,
} from '@clave/shared';
import { describe, expect, it } from 'vitest';
import { eventsFor, toPublicView } from './gameView';

const players: EnginePlayer[] = [
  { id: 'rs', team: 'red', role: 'spymaster', connected: true },
  { id: 'ra', team: 'red', role: 'agent', connected: true },
  { id: 'bs', team: 'blue', role: 'spymaster', connected: true },
  { id: 'ba', team: 'blue', role: 'agent', connected: true },
  { id: 'sp', team: 'spectator', role: 'agent', connected: true },
];

function game(settings = DEFAULT_SETTINGS): GameState {
  const res = applyAction(null, { type: 'START_GAME', players, settings }, mulberry32(5));
  if (!res.ok) throw new Error(res.error.code);
  return res.state;
}

const typed = (g: GameState, viewer: string) =>
  toPublicView(g, viewer).cards.filter((c) => c.type !== undefined).length;

describe('toPublicView', () => {
  it('shows the full map to spymasters only', () => {
    const g = game();
    expect(typed(g, 'rs')).toBe(25);
    expect(typed(g, 'bs')).toBe(25);
    expect(typed(g, 'ra')).toBe(0);
    expect(typed(g, 'sp')).toBe(0);
    expect(typed(g, 'not-in-game')).toBe(0);
    expect(toPublicView(g, 'rs').seesMap).toBe(true);
    expect(toPublicView(g, 'ra').seesMap).toBe(false);
  });

  it('omits the type key entirely (not just undefined) for hidden cards', () => {
    const card = toPublicView(game(), 'ra').cards[0];
    expect(card && Object.keys(card).sort()).toEqual(['id', 'revealed', 'word']);
  });

  it('lets spectators see the map only when the room allows it', () => {
    expect(typed(game({ ...DEFAULT_SETTINGS, spectatorsSeeMap: true }), 'sp')).toBe(25);
    expect(typed(game({ ...DEFAULT_SETTINGS, spectatorsSeeMap: true }), 'ra')).toBe(0);
  });

  it('shows revealed cards to everyone and counts what is left', () => {
    let g = game();
    const team = g.startingTeam;
    const giver = team === 'red' ? 'rs' : 'bs';
    const guesser = team === 'red' ? 'ra' : 'ba';
    const clue = applyAction(
      g,
      { type: 'GIVE_CLUE', playerId: giver, word: 'QXZ', count: 1 },
      mulberry32(1),
    );
    if (!clue.ok) throw new Error('clue');
    const own = clue.state.cards.find((c) => c.type === team);
    const res = applyAction(
      clue.state,
      { type: 'REVEAL_CARD', playerId: guesser, cardId: own?.id ?? '' },
      mulberry32(1),
    );
    if (!res.ok) throw new Error('reveal');
    g = res.state;
    const view = toPublicView(g, 'sp');
    expect(view.cards.filter((c) => c.type !== undefined)).toEqual([
      { id: own?.id, word: own?.word, revealed: true, type: team },
    ]);
    expect(view.remaining[team]).toBe(8);
  });

  it('reveals the whole map to everyone when the game is over', () => {
    const g = game();
    const over: GameState = { ...g, phase: { name: 'over', winner: 'red', reason: 'agents' } };
    expect(typed(over, 'ra')).toBe(25);
    expect(typed(over, 'sp')).toBe(25);
  });

  it('shows points and pointing events only to the active team while guessing', () => {
    const g = game();
    const team = g.startingTeam;
    const [mine, theirs] = team === 'red' ? ['ra', 'ba'] : ['ba', 'ra'];
    const guessing: GameState = {
      ...g,
      phase: { name: 'guess', team, guessesLeft: 2 },
      points: { [mine]: g.cards[0]?.id ?? '' },
    };
    expect(toPublicView(guessing, mine).points).toEqual(guessing.points);
    expect(toPublicView(guessing, theirs).points).toEqual({});
    expect(toPublicView(guessing, 'sp').points).toEqual({});
    const pointed = [{ type: 'CARD_POINTED' as const, playerId: mine, cardId: 'x' }];
    expect(eventsFor(pointed, guessing, mine)).toEqual(pointed);
    expect(eventsFor(pointed, guessing, theirs)).toEqual([]);
    expect(eventsFor(pointed, null, theirs)).toEqual(pointed);
  });

  it('does not share mutable state with the game', () => {
    const g = game();
    const view = toPublicView(g, 'rs');
    view.clues.push({ team: 'red', word: 'X', count: 1, guesses: [], objection: 'none' });
    expect(g.clues).toEqual([]);
  });
});
