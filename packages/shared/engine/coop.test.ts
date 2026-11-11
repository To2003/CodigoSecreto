import { describe, expect, it } from 'vitest';
import {
  agentsLeft,
  applyCoopAction,
  COOP_AGENTS,
  COOP_TURNS,
  coopBlocker,
  startCoop,
  totalAgentsLeft,
  type CoopAction,
  type CoopKey,
  type CoopState,
  type Side,
} from './coop';
import { mulberry32 } from './rng';
import type { EnginePlayer } from './types';

const player = (id: string, team: EnginePlayer['team']): EnginePlayer => ({
  id,
  team,
  role: 'agent',
  connected: true,
});
const PLAYERS = [player('a', 'red'), player('b', 'blue')];
const WORDS = Array.from({ length: 25 }, (_, i) => `PALABRA${String.fromCharCode(65 + i)}`);

function start(seed = 1): CoopState {
  const res = startCoop(PLAYERS, WORDS, false, mulberry32(seed));
  if (!res.ok) throw new Error(res.error.code);
  return res.state;
}
function act(state: CoopState, action: CoopAction): CoopState {
  const res = applyCoopAction(state, action);
  if (!res.ok) throw new Error(res.error.code);
  return res.state;
}
const code = (state: CoopState, action: CoopAction) => {
  const res = applyCoopAction(state, action);
  return res.ok ? 'OK' : res.error.code;
};
const by = (side: Side) => (side === 'red' ? 'a' : 'b');
const clue = (s: CoopState, giver: Side) =>
  act(s, { type: 'GIVE_CLUE', playerId: by(giver), word: 'QXZ', count: 'inf' });
const reveal = (s: CoopState, guesser: Side, cardId: string) =>
  act(s, { type: 'REVEAL_CARD', playerId: by(guesser), cardId });
const cardWith = (s: CoopState, red: CoopKey, blue: CoopKey) => {
  const card = s.cards.find((c) => c.key.red === red && c.key.blue === blue && !c.found);
  if (!card) throw new Error(`no ${red}/${blue} card`);
  return card;
};

describe('setup (spec §3)', () => {
  it('builds the double-sided map: 9 agents, 3 traitors, 13 civilians per side; 15 agents', () => {
    const s = start();
    for (const side of ['red', 'blue'] as const) {
      const count = (k: CoopKey) => s.cards.filter((c) => c.key[side] === k).length;
      expect([count('agent'), count('traitor'), count('civilian')]).toEqual([9, 3, 13]);
    }
    expect(COOP_AGENTS).toBe(15);
    expect(totalAgentsLeft(s)).toBe(15);
    expect(s.cards.filter((c) => c.key.red === 'traitor' && c.key.blue === 'traitor')).toHaveLength(
      1,
    );
    expect(new Set(s.cards.map((c) => c.id)).size).toBe(25);
    expect(s.phase).toEqual({ name: 'clue', giver: 'red' });
    expect(s.turnsLeft).toBe(COOP_TURNS);
  });

  it('different seeds shuffle the faces', () => {
    const keys = (s: CoopState) => s.cards.map((c) => `${c.key.red}/${c.key.blue}`).join();
    expect(keys(start(1))).not.toBe(keys(start(2)));
  });

  it('needs 2 or 3 players with both sides covered (spec §2)', () => {
    expect(coopBlocker(PLAYERS)).toBeNull();
    expect(coopBlocker([...PLAYERS, player('c', 'red'), player('s', 'spectator')])).toBeNull();
    expect(coopBlocker([player('a', 'red'), player('c', 'red')])).toBe('TEAMS_INCOMPLETE');
    expect(coopBlocker([player('a', 'red')])).toBe('TEAMS_INCOMPLETE');
    expect(coopBlocker([...PLAYERS, player('c', 'red'), player('d', 'blue')])).toBe(
      'TEAMS_INCOMPLETE',
    );
    expect(startCoop([player('a', 'red')], WORDS, false, mulberry32(1))).toMatchObject({
      ok: false,
      error: { code: 'TEAMS_INCOMPLETE' },
    });
    expect(startCoop(PLAYERS, WORDS.slice(1), false, mulberry32(1))).toMatchObject({
      ok: false,
      error: { code: 'NOT_ENOUGH_WORDS' },
    });
  });
});

describe('turn (spec §4)', () => {
  it('the giver clues with their map; the other side guesses; a clue spends a turn', () => {
    let s = start();
    expect(code(s, { type: 'GIVE_CLUE', playerId: 'b', word: 'QXZ', count: 1 })).toBe(
      'NOT_YOUR_TURN',
    );
    s = clue(s, 'red');
    expect(s.turnsLeft).toBe(COOP_TURNS - 1);
    expect(s.phase).toEqual({ name: 'guess', giver: 'red' });
    const agent = cardWith(s, 'agent', 'civilian');
    expect(code(s, { type: 'REVEAL_CARD', playerId: 'a', cardId: agent.id })).toBe('NOT_YOUR_TURN');
    s = reveal(s, 'blue', agent.id);
    expect(s.cards.find((c) => c.id === agent.id)?.found).toBe(true);
    expect(s.phase.name).toBe('guess');
    expect(totalAgentsLeft(s)).toBe(14);
  });

  it('a civilian for the giver ends the turn but may still be the other side’s agent', () => {
    let s = clue(start(), 'red');
    const card = cardWith(s, 'civilian', 'agent');
    s = reveal(s, 'blue', card.id);
    expect(s.cards.find((c) => c.id === card.id)).toMatchObject({
      found: false,
      civilianFor: ['red'],
    });
    expect(s.phase).toEqual({ name: 'clue', giver: 'blue' });
    // Now blue clues and red guesses on blue's map: the same card is blue's agent.
    s = clue(s, 'blue');
    s = reveal(s, 'red', card.id);
    expect(s.cards.find((c) => c.id === card.id)?.found).toBe(true);
    // A civilian for blue (blue's clue turned it up); red's clue can still try it...
    const both = cardWith(s, 'civilian', 'civilian');
    s = reveal(s, 'red', both.id);
    s = clue(s, 'red');
    s = reveal(s, 'blue', both.id);
    expect(s.cards.find((c) => c.id === both.id)?.civilianFor).toEqual(['blue', 'red']);
    // ...but once it's a civilian for both, nobody can turn it again.
    s = clue(s, 'blue');
    expect(code(s, { type: 'REVEAL_CARD', playerId: 'a', cardId: both.id })).toBe(
      'CARD_ALREADY_REVEALED',
    );
  });

  it('a traitor of the giver’s map loses at once', () => {
    let s = clue(start(), 'red');
    const res = applyCoopAction(s, {
      type: 'REVEAL_CARD',
      playerId: 'b',
      cardId: cardWith(s, 'traitor', 'civilian').id,
    });
    expect(res.ok && res.state.phase).toEqual({ name: 'over', won: false, reason: 'traitor' });
    expect(res.ok && res.events.at(-1)).toEqual({
      type: 'COOP_OVER',
      won: false,
      reason: 'traitor',
    });
    s = res.ok ? res.state : s;
    expect(code(s, { type: 'END_GUESSING', playerId: 'b' })).toBe('WRONG_PHASE');
  });

  it('a traitor only on the other map is just a card for this giver', () => {
    let s = clue(start(), 'red');
    s = reveal(s, 'blue', cardWith(s, 'agent', 'traitor').id);
    expect(s.phase.name).toBe('guess');
  });

  it('ending the turn needs a guess first; then the other side clues', () => {
    let s = clue(start(), 'red');
    expect(code(s, { type: 'END_GUESSING', playerId: 'b' })).toBe('MUST_GUESS_FIRST');
    expect(code(s, { type: 'END_GUESSING', playerId: 'a' })).toBe('NOT_YOUR_TURN');
    s = reveal(s, 'blue', cardWith(s, 'agent', 'agent').id);
    s = act(s, { type: 'END_GUESSING', playerId: 'b' });
    expect(s.phase).toEqual({ name: 'clue', giver: 'blue' });
  });

  it('rejects bad input without changing the state', () => {
    const s = start();
    expect(code(s, { type: 'REVEAL_CARD', playerId: 'b', cardId: 'x' })).toBe('WRONG_PHASE');
    expect(code(s, { type: 'GIVE_CLUE', playerId: 'z', word: 'QXZ', count: 1 })).toBe(
      'NOT_A_PLAYER',
    );
    expect(code(s, { type: 'GIVE_CLUE', playerId: 'a', word: 'QXZ', count: 12 })).toBe(
      'INVALID_COUNT',
    );
    const res = applyCoopAction(s, {
      type: 'GIVE_CLUE',
      playerId: 'a',
      word: s.cards[0]?.word ?? '',
      count: 1,
    });
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'INVALID_CLUE', clue: { reason: 'ON_BOARD' } },
    });
    const guessing = clue(s, 'red');
    expect(code(guessing, { type: 'REVEAL_CARD', playerId: 'b', cardId: 'nope' })).toBe(
      'CARD_NOT_FOUND',
    );
    expect(code(guessing, { type: 'GIVE_CLUE', playerId: 'a', word: 'QXZ', count: 1 })).toBe(
      'WRONG_PHASE',
    );
    expect(s.turnsLeft).toBe(COOP_TURNS);
  });
});

describe('end (spec §5)', () => {
  it('finding all 15 agents wins', () => {
    let s = start();
    let giver: Side = 'red';
    for (let turn = 0; turn < COOP_TURNS && s.phase.name !== 'over'; turn++) {
      if (s.phase.name !== 'clue') break;
      giver = s.phase.giver;
      s = clue(s, giver);
      const guesser: Side = giver === 'red' ? 'blue' : 'red';
      for (const card of s.cards.filter((c) => c.key[giver] === 'agent' && !c.found)) {
        if (s.phase.name !== 'guess') break;
        s = reveal(s, guesser, card.id);
      }
    }
    expect(s.phase).toEqual({ name: 'over', won: true, reason: 'agents' });
    expect(agentsLeft(s, 'red') + agentsLeft(s, 'blue')).toBe(0);
  });

  it('when one map is done, the other side gives every clue', () => {
    let s = clue(start(), 'red');
    for (const card of s.cards.filter((c) => c.key.red === 'agent')) s = reveal(s, 'blue', card.id);
    expect(agentsLeft(s, 'red')).toBe(0);
    expect(s.phase).toEqual({ name: 'clue', giver: 'blue' });
    s = clue(s, 'blue');
    s = reveal(s, 'red', cardWith(s, 'civilian', 'civilian').id);
    // Red has nothing left to point at: blue clues again.
    expect(s.phase).toEqual({ name: 'clue', giver: 'blue' });
  });

  it('running out of the 9 turns loses', () => {
    let s = start();
    for (let turn = 0; turn < COOP_TURNS; turn++) {
      if (s.phase.name !== 'clue') break;
      const giver = s.phase.giver;
      s = clue(s, giver);
      const guesser: Side = giver === 'red' ? 'blue' : 'red';
      const miss = s.cards.find(
        (c) => c.key[giver] === 'civilian' && !c.civilianFor.includes(giver) && !c.found,
      );
      if (!miss) throw new Error('setup');
      s = reveal(s, guesser, miss.id);
    }
    expect(s.turnsLeft).toBe(0);
    expect(s.phase).toEqual({ name: 'over', won: false, reason: 'turns' });
  });
});
