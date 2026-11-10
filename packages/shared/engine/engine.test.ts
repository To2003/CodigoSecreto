import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../schemas/settings';
import { applyAction } from './engine';
import { mulberry32 } from './rng';
import {
  otherTeam,
  type Action,
  type CardType,
  type EnginePlayer,
  type EngineErrorCode,
  type GameEvent,
  type GameState,
  type Team,
} from './types';

const rng = () => mulberry32(1234);

const player = (id: string, team: EnginePlayer['team'], role: EnginePlayer['role']) => ({
  id,
  team,
  role,
  connected: true,
});

const PLAYERS: EnginePlayer[] = [
  player('rs', 'red', 'spymaster'),
  player('ra', 'red', 'agent'),
  player('ra2', 'red', 'agent'),
  player('bs', 'blue', 'spymaster'),
  player('ba', 'blue', 'agent'),
  player('ba2', 'blue', 'agent'),
  player('spec', 'spectator', 'agent'),
];

function apply(state: GameState | null, action: Action, seed = 1234) {
  return applyAction(state, action, mulberry32(seed));
}

function ok(state: GameState | null, action: Action) {
  const res = apply(state, action);
  if (!res.ok) throw new Error(`expected ok, got ${res.error.code}`);
  return res;
}

function fail(state: GameState | null, action: Action, code: EngineErrorCode) {
  const before = structuredClone(state);
  const res = apply(state, action);
  expect(res.ok).toBe(false);
  if (res.ok) return;
  expect(res.error.code).toBe(code);
  expect(state).toEqual(before);
  return res.error;
}

function start(settings: Partial<Settings> = {}, players = PLAYERS) {
  return ok(null, { type: 'START_GAME', players, settings: { ...DEFAULT_SETTINGS, ...settings } })
    .state;
}

const spy = (team: Team) => (team === 'red' ? 'rs' : 'bs');
const agent = (team: Team) => (team === 'red' ? 'ra' : 'ba');
const agent2 = (team: Team) => (team === 'red' ? 'ra2' : 'ba2');
const activeTeam = (s: GameState) => {
  if (s.phase.name === 'over') throw new Error('game over');
  return s.phase.team;
};
const cardsOf = (s: GameState, type: CardType) =>
  s.cards.filter((c) => c.type === type && !c.revealed);
const firstOf = (s: GameState, type: CardType) => {
  const card = cardsOf(s, type)[0];
  if (!card) throw new Error(`no unrevealed ${type}`);
  return card;
};

const spymasterOf = (s: GameState, team: Team) =>
  s.players.find((p) => p.team === team && p.role === 'spymaster')?.id ?? '';

/** A clue nobody can object to on validity: not on any board. */
function clue(s: GameState, count: number | 'inf' = 2) {
  const playerId = spymasterOf(s, activeTeam(s));
  return ok(s, { type: 'GIVE_CLUE', playerId, word: 'ZZZ', count }).state;
}

const eventTypes = (events: GameEvent[]) => events.map((e) => e.type);

describe('START_GAME', () => {
  it('deals 25 cards: 9 for the starting team, 8, 7 civilians and 1 traitor', () => {
    const s = start();
    expect(s.cards).toHaveLength(25);
    const count = (t: CardType) => s.cards.filter((c) => c.type === t).length;
    expect(count(s.startingTeam)).toBe(9);
    expect(count(otherTeam(s.startingTeam))).toBe(8);
    expect(count('civilian')).toBe(7);
    expect(count('traitor')).toBe(1);
    expect(s.phase).toEqual({ name: 'clue', team: s.startingTeam });
    expect(s.teamTurns[s.startingTeam]).toBe(1);
  });

  it('uses unique words and opaque unique ids', () => {
    const s = start();
    expect(new Set(s.cards.map((c) => c.word)).size).toBe(25);
    const ids = s.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(25);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{10}$/);
  });

  it('is reproducible from the seed and changes with it', () => {
    const action: Action = { type: 'START_GAME', players: PLAYERS, settings: DEFAULT_SETTINGS };
    const a = applyAction(null, action, rng());
    const b = applyAction(null, action, rng());
    expect(a).toEqual(b);
    const c = applyAction(null, action, mulberry32(99));
    expect(c).not.toEqual(a);
  });

  it('can start with either team (seeded coin flip)', () => {
    const starters = new Set<Team>();
    for (let seed = 0; seed < 20; seed++) {
      const res = applyAction(
        null,
        { type: 'START_GAME', players: PLAYERS, settings: DEFAULT_SETTINGS },
        mulberry32(seed),
      );
      if (res.ok) starters.add(res.state.startingTeam);
    }
    expect(starters).toEqual(new Set(['red', 'blue']));
  });

  it('emits GAME_STARTED', () => {
    const res = ok(null, { type: 'START_GAME', players: PLAYERS, settings: DEFAULT_SETTINGS });
    expect(res.events).toEqual([{ type: 'GAME_STARTED', startingTeam: res.state.startingTeam }]);
  });

  it.each([
    ['no blue spymaster', PLAYERS.filter((p) => p.id !== 'bs')],
    ['no red agent', PLAYERS.filter((p) => p.team !== 'red' || p.role === 'spymaster')],
    ['two red spymasters', [...PLAYERS, player('rs2', 'red', 'spymaster')]],
  ])('refuses to start with %s', (_label, players) => {
    fail(null, { type: 'START_GAME', players, settings: DEFAULT_SETTINGS }, 'TEAMS_INCOMPLETE');
  });

  it('starts with the 4-player minimum', () => {
    const four = PLAYERS.filter((p) => !['ra2', 'ba2', 'spec'].includes(p.id));
    expect(start({}, four).cards).toHaveLength(25);
  });

  it('refuses the cooperative mode until M9', () => {
    fail(
      null,
      { type: 'START_GAME', players: PLAYERS, settings: { ...DEFAULT_SETTINGS, mode: 'coop' } },
      'MODE_NOT_AVAILABLE',
    );
  });

  it('refuses while a game is running', () => {
    fail(
      start(),
      { type: 'START_GAME', players: PLAYERS, settings: DEFAULT_SETTINGS },
      'GAME_IN_PROGRESS',
    );
  });

  describe('words', () => {
    const custom = Array.from({ length: 30 }, (_, i) => `PALABRA${String.fromCharCode(65 + i)}`);

    it('uses only custom words when no deck is selected', () => {
      const s = start({ deckIds: [], customWords: custom });
      for (const c of s.cards) expect(custom).toContain(c.word);
    });

    it('needs 25 words', () => {
      fail(
        null,
        {
          type: 'START_GAME',
          players: PLAYERS,
          settings: { ...DEFAULT_SETTINGS, deckIds: [], customWords: custom.slice(0, 24) },
        },
        'NOT_ENOUGH_WORDS',
      );
    });

    it('mixes custom words by customShare', () => {
      const s = start({ customWords: custom, customShare: 40 });
      expect(s.cards.filter((c) => custom.includes(c.word))).toHaveLength(10);
    });

    it('takes every custom word when there are fewer than the share asks for', () => {
      const s = start({ customWords: custom.slice(0, 3), customShare: 100 });
      expect(s.cards.filter((c) => custom.includes(c.word))).toHaveLength(3);
    });

    it('dedupes custom words and never repeats a deck word', () => {
      const clasico = start().cards.map((c) => c.word);
      const words = [...custom.slice(0, 20), 'palabraa', ...clasico.slice(0, 10)];
      const s = start({ customWords: words, customShare: 100 });
      const normalized = s.cards.map((c) => c.word.toLowerCase());
      expect(new Set(normalized).size).toBe(25);
    });

    it('ignores unknown deck ids', () => {
      expect(start({ deckIds: ['clasico', 'nope'] }).cards).toHaveLength(25);
    });

    it('avoids the previous game words when it can', () => {
      const first = start();
      const res = ok(null, {
        type: 'START_GAME',
        players: PLAYERS,
        settings: DEFAULT_SETTINGS,
        excludeWords: first.cards.map((c) => c.word),
      });
      const previous = new Set(first.cards.map((c) => c.word));
      expect(res.state.cards.filter((c) => previous.has(c.word))).toHaveLength(0);
    });

    it('falls back to excluded words when there are not enough others', () => {
      const s = start({ deckIds: [], customWords: custom.slice(0, 26) });
      const res = ok(null, {
        type: 'START_GAME',
        players: PLAYERS,
        settings: { ...DEFAULT_SETTINGS, deckIds: [], customWords: custom.slice(0, 26) },
        excludeWords: s.cards.map((c) => c.word),
      });
      expect(res.state.cards).toHaveLength(25);
    });
  });
});

describe('GIVE_CLUE', () => {
  it('moves to the guess phase with count + 1 guesses', () => {
    const s0 = start();
    const team = activeTeam(s0);
    const res = ok(s0, { type: 'GIVE_CLUE', playerId: spy(team), word: 'zzz', count: 2 });
    expect(res.state.phase).toEqual({ name: 'guess', team, guessesLeft: 3 });
    expect(res.state.clues.at(-1)).toMatchObject({ team, word: 'ZZZ', count: 2, guesses: [] });
    expect(res.events).toEqual([{ type: 'CLUE_GIVEN', team, word: 'ZZZ', count: 2 }]);
  });

  it.each([0, 'inf'] as const)('gives unlimited guesses for %s', (count) => {
    const s = clue(start(), count);
    expect(s.phase).toMatchObject({ name: 'guess', guessesLeft: null });
  });

  it('only accepts the active spymaster', () => {
    const s = start();
    const team = activeTeam(s);
    const base = { type: 'GIVE_CLUE', word: 'ZZZ', count: 1 } as const;
    fail(s, { ...base, playerId: spy(otherTeam(team)) }, 'NOT_YOUR_TURN');
    fail(s, { ...base, playerId: agent(team) }, 'WRONG_ROLE');
    fail(s, { ...base, playerId: 'ghost' }, 'NOT_A_PLAYER');
    fail(s, { ...base, playerId: 'spec' }, 'NOT_YOUR_TURN');
  });

  it.each([-1, 10, 1.5])('rejects count %s', (count) => {
    const s = start();
    fail(
      s,
      { type: 'GIVE_CLUE', playerId: spy(activeTeam(s)), word: 'ZZZ', count },
      'INVALID_COUNT',
    );
  });

  it('rejects an invalid clue with the reason', () => {
    const s = start();
    const word = s.cards[0]?.word ?? '';
    const error = fail(
      s,
      { type: 'GIVE_CLUE', playerId: spy(activeTeam(s)), word, count: 1 },
      'INVALID_CLUE',
    );
    expect(error?.clue).toEqual({ reason: 'ON_BOARD', conflict: word });
  });

  it('rejects a malformed clue without a board conflict', () => {
    const s = start();
    const error = fail(
      s,
      { type: 'GIVE_CLUE', playerId: spy(activeTeam(s)), word: 'DOS PALABRAS', count: 1 },
      'INVALID_CLUE',
    );
    expect(error?.clue).toEqual({ reason: 'MULTIPLE_WORDS' });
  });

  it('allows a revealed board word as a clue', () => {
    let s = clue(start(), 'inf');
    const team = activeTeam(s);
    const own = firstOf(s, team);
    s = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: own.id }).state;
    s = ok(s, { type: 'END_GUESSING', playerId: agent(team) }).state;
    s = ok(s, { type: 'TIMER_EXPIRED' }).state; // other team passes
    expect(apply(s, { type: 'GIVE_CLUE', playerId: spy(team), word: own.word, count: 1 }).ok).toBe(
      true,
    );
  });

  it('respects the compound words setting', () => {
    const s = start({ compoundWords: true });
    expect(
      apply(s, { type: 'GIVE_CLUE', playerId: spy(activeTeam(s)), word: 'ZZ-QQ', count: 1 }).ok,
    ).toBe(true);
  });

  it('is only valid in the clue phase', () => {
    const s = clue(start());
    fail(
      s,
      { type: 'GIVE_CLUE', playerId: spy(activeTeam(s)), word: 'ZZZ', count: 1 },
      'WRONG_PHASE',
    );
  });
});

describe('REVEAL_CARD', () => {
  it('own agent: keeps guessing and spends a guess', () => {
    const s0 = clue(start(), 1);
    const team = activeTeam(s0);
    const card = firstOf(s0, team);
    const res = ok(s0, { type: 'REVEAL_CARD', playerId: agent(team), cardId: card.id });
    expect(res.state.phase).toEqual({ name: 'guess', team, guessesLeft: 1 });
    expect(res.state.cards.find((c) => c.id === card.id)?.revealed).toBe(true);
    expect(res.state.clues.at(-1)?.guesses).toEqual([{ cardId: card.id, type: team }]);
    expect(res.events).toEqual([
      { type: 'CARD_REVEALED', cardId: card.id, cardType: team, team, penalty: false },
    ]);
  });

  it('ends the turn when the guesses (count + 1) run out', () => {
    let s = clue(start(), 0 + 1);
    const team = activeTeam(s);
    s = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: firstOf(s, team).id }).state;
    const res = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: firstOf(s, team).id });
    expect(res.state.phase).toEqual({ name: 'clue', team: otherTeam(team) });
    expect(res.events.at(-1)).toEqual({
      type: 'TURN_CHANGED',
      team: otherTeam(team),
      reason: 'guesses_used',
    });
  });

  it('civilian ends the turn', () => {
    const s0 = clue(start());
    const team = activeTeam(s0);
    const res = ok(s0, {
      type: 'REVEAL_CARD',
      playerId: agent(team),
      cardId: firstOf(s0, 'civilian').id,
    });
    expect(res.state.phase).toEqual({ name: 'clue', team: otherTeam(team) });
    expect(eventTypes(res.events)).toEqual(['CARD_REVEALED', 'TURN_CHANGED']);
    expect(res.state.teamTurns[otherTeam(team)]).toBe(1);
  });

  it('rival agent ends the turn and counts for the rival', () => {
    const s0 = clue(start());
    const team = activeTeam(s0);
    const rival = otherTeam(team);
    const res = ok(s0, {
      type: 'REVEAL_CARD',
      playerId: agent(team),
      cardId: firstOf(s0, rival).id,
    });
    expect(res.events.at(-1)).toEqual({ type: 'TURN_CHANGED', team: rival, reason: 'rival' });
    expect(cardsOf(res.state, rival)).toHaveLength(cardsOf(s0, rival).length - 1);
  });

  it('traitor on the first guess loses the game at once', () => {
    const s0 = clue(start());
    const team = activeTeam(s0);
    const res = ok(s0, {
      type: 'REVEAL_CARD',
      playerId: agent(team),
      cardId: firstOf(s0, 'traitor').id,
    });
    expect(res.state.phase).toEqual({ name: 'over', winner: otherTeam(team), reason: 'traitor' });
    expect(res.events.at(-1)).toEqual({
      type: 'GAME_OVER',
      winner: otherTeam(team),
      reason: 'traitor',
    });
  });

  it('revealing all your agents wins', () => {
    let s = clue(start(), 'inf');
    const team = activeTeam(s);
    let last: GameEvent[] = [];
    while (cardsOf(s, team).length > 0) {
      const res = ok(s, {
        type: 'REVEAL_CARD',
        playerId: agent(team),
        cardId: firstOf(s, team).id,
      });
      s = res.state;
      last = res.events;
    }
    expect(s.phase).toEqual({ name: 'over', winner: team, reason: 'agents' });
    expect(last.at(-1)).toEqual({ type: 'GAME_OVER', winner: team, reason: 'agents' });
  });

  it("revealing the rival's last agent makes the rival win", () => {
    let s = start();
    const rival = otherTeam(activeTeam(s));
    // Leave the rival with one agent left by revealing the rest directly in the state.
    s = {
      ...s,
      cards: s.cards.map((c, i, all) =>
        c.type === rival && all.findIndex((x) => x.type === rival) !== i
          ? { ...c, revealed: true }
          : c,
      ),
    };
    s = clue(s);
    const team = activeTeam(s);
    const res = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: firstOf(s, rival).id });
    expect(res.state.phase).toEqual({ name: 'over', winner: rival, reason: 'agents' });
  });

  it('checks actor, card and phase', () => {
    const s = clue(start());
    const team = activeTeam(s);
    const card = firstOf(s, 'civilian');
    fail(
      s,
      { type: 'REVEAL_CARD', playerId: agent(otherTeam(team)), cardId: card.id },
      'NOT_YOUR_TURN',
    );
    fail(s, { type: 'REVEAL_CARD', playerId: spy(team), cardId: card.id }, 'WRONG_ROLE');
    fail(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: 'nope' }, 'CARD_NOT_FOUND');
    fail(start(), { type: 'REVEAL_CARD', playerId: agent(team), cardId: card.id }, 'WRONG_PHASE');
  });

  it('refuses an already revealed card', () => {
    let s = clue(start(), 'inf');
    const team = activeTeam(s);
    const card = firstOf(s, team);
    s = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: card.id }).state;
    fail(
      s,
      { type: 'REVEAL_CARD', playerId: agent(team), cardId: card.id },
      'CARD_ALREADY_REVEALED',
    );
  });

  it('is not allowed directly in majority mode', () => {
    const s = clue(start({ revealMode: 'majority' }));
    const team = activeTeam(s);
    fail(
      s,
      { type: 'REVEAL_CARD', playerId: agent(team), cardId: firstOf(s, team).id },
      'REVEAL_BY_MAJORITY',
    );
  });

  it('refuses anything after the game is over', () => {
    const s0 = clue(start());
    const team = activeTeam(s0);
    const over = ok(s0, {
      type: 'REVEAL_CARD',
      playerId: agent(team),
      cardId: firstOf(s0, 'traitor').id,
    }).state;
    fail(over, { type: 'END_GUESSING', playerId: agent(team) }, 'WRONG_PHASE');
    fail(over, { type: 'TIMER_EXPIRED' }, 'WRONG_PHASE');
  });
});

describe('POINT_CARD', () => {
  it('marks, moves and clears an agent point', () => {
    let s = clue(start());
    const team = activeTeam(s);
    const [a, b] = cardsOf(s, 'civilian');
    if (!a || !b) throw new Error('setup');
    let res = ok(s, { type: 'POINT_CARD', playerId: agent(team), cardId: a.id });
    expect(res.state.points).toEqual({ [agent(team)]: a.id });
    expect(res.events).toEqual([{ type: 'CARD_POINTED', playerId: agent(team), cardId: a.id }]);
    s = ok(res.state, { type: 'POINT_CARD', playerId: agent2(team), cardId: a.id }).state;
    s = ok(s, { type: 'POINT_CARD', playerId: agent(team), cardId: b.id }).state;
    expect(s.points).toEqual({ [agent(team)]: b.id, [agent2(team)]: a.id });
    res = ok(s, { type: 'POINT_CARD', playerId: agent(team), cardId: null });
    expect(res.state.points).toEqual({ [agent2(team)]: a.id });
  });

  it('clears points of a revealed card and on turn change', () => {
    let s = clue(start(), 'inf');
    const team = activeTeam(s);
    const own = firstOf(s, team);
    s = ok(s, { type: 'POINT_CARD', playerId: agent2(team), cardId: own.id }).state;
    s = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: own.id }).state;
    expect(s.points).toEqual({});
    s = ok(s, { type: 'POINT_CARD', playerId: agent2(team), cardId: firstOf(s, team).id }).state;
    s = ok(s, { type: 'END_GUESSING', playerId: agent(team) }).state;
    expect(s.points).toEqual({});
  });

  it('checks actor, card and phase', () => {
    const s = clue(start());
    const team = activeTeam(s);
    const card = firstOf(s, 'civilian');
    fail(s, { type: 'POINT_CARD', playerId: spy(team), cardId: card.id }, 'WRONG_ROLE');
    fail(
      s,
      { type: 'POINT_CARD', playerId: agent(otherTeam(team)), cardId: card.id },
      'NOT_YOUR_TURN',
    );
    fail(s, { type: 'POINT_CARD', playerId: agent(team), cardId: 'nope' }, 'CARD_NOT_FOUND');
    fail(start(), { type: 'POINT_CARD', playerId: agent(team), cardId: null }, 'WRONG_PHASE');
  });

  describe('majority mode', () => {
    it('reveals when more than half of the connected agents point at a card', () => {
      let s = clue(start({ revealMode: 'majority' }));
      const team = activeTeam(s);
      const card = firstOf(s, team);
      let res = ok(s, { type: 'POINT_CARD', playerId: agent(team), cardId: card.id });
      expect(eventTypes(res.events)).toEqual(['CARD_POINTED']); // 1 of 2: not a majority
      s = res.state;
      res = ok(s, { type: 'POINT_CARD', playerId: agent2(team), cardId: card.id });
      expect(eventTypes(res.events)).toEqual(['CARD_POINTED', 'CARD_REVEALED']);
    });

    it('counts only connected agents', () => {
      let s = clue(start({ revealMode: 'majority' }));
      const team = activeTeam(s);
      s = ok(s, { type: 'SET_CONNECTED', playerId: agent2(team), connected: false }).state;
      const res = ok(s, { type: 'POINT_CARD', playerId: agent(team), cardId: firstOf(s, team).id });
      expect(eventTypes(res.events)).toContain('CARD_REVEALED');
    });
  });
});

describe('END_GUESSING', () => {
  it('needs at least one guess first', () => {
    const s = clue(start());
    fail(s, { type: 'END_GUESSING', playerId: agent(activeTeam(s)) }, 'MUST_GUESS_FIRST');
  });

  it('passes the turn after a guess', () => {
    let s = clue(start(), 'inf');
    const team = activeTeam(s);
    s = ok(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: firstOf(s, team).id }).state;
    const res = ok(s, { type: 'END_GUESSING', playerId: agent2(team) });
    expect(res.state.phase).toEqual({ name: 'clue', team: otherTeam(team) });
    expect(res.events).toEqual([{ type: 'TURN_CHANGED', team: otherTeam(team), reason: 'ended' }]);
  });

  it('checks actor and phase', () => {
    const s = clue(start());
    const team = activeTeam(s);
    fail(s, { type: 'END_GUESSING', playerId: spy(team) }, 'WRONG_ROLE');
    fail(s, { type: 'END_GUESSING', playerId: agent(otherTeam(team)) }, 'NOT_YOUR_TURN');
    fail(start(), { type: 'END_GUESSING', playerId: agent(team) }, 'WRONG_PHASE');
  });
});

describe('TIMER_EXPIRED', () => {
  it('in the clue phase passes the turn without a clue', () => {
    const s = start();
    const team = activeTeam(s);
    const res = ok(s, { type: 'TIMER_EXPIRED' });
    expect(res.state.phase).toEqual({ name: 'clue', team: otherTeam(team) });
    expect(res.state.clues).toEqual([]);
    expect(res.events).toEqual([
      { type: 'TURN_CHANGED', team: otherTeam(team), reason: 'timeout' },
    ]);
  });

  it('in the guess phase ends the turn even with no guesses', () => {
    const s = clue(start());
    const res = ok(s, { type: 'TIMER_EXPIRED' });
    expect(res.state.phase).toEqual({ name: 'clue', team: otherTeam(activeTeam(s)) });
  });

  it('needs a game', () => {
    fail(null, { type: 'TIMER_EXPIRED' }, 'NO_GAME');
  });
});

describe('objections', () => {
  const object = (s: GameState) => {
    const rival = otherTeam(activeTeam(s));
    return ok(s, { type: 'OBJECT_CLUE', playerId: spy(rival) });
  };

  it('opens a vote for team players except the clue giver, with the objector voting yes', () => {
    const s = clue(start());
    const team = activeTeam(s);
    const res = object(s);
    expect(res.state.phase).toMatchObject({
      name: 'objection',
      team,
      objector: spy(otherTeam(team)),
      votes: { [spy(otherTeam(team))]: true },
    });
    if (res.state.phase.name !== 'objection') throw new Error('phase');
    expect([...res.state.phase.voters].sort()).toEqual(
      ['ra', 'ra2', 'rs', 'bs', 'ba', 'ba2'].filter((id) => id !== spy(team)).sort(),
    );
    expect(res.events).toEqual([{ type: 'OBJECTION_OPENED', objector: spy(otherTeam(team)) }]);
  });

  it('accepted: ends the turn and reveals an agent of the objecting team', () => {
    let s = object(clue(start())).state;
    if (s.phase.name !== 'objection') throw new Error('phase');
    const team = s.phase.team;
    const rival = otherTeam(team);
    const before = cardsOf(s, rival).length;
    let res = ok(s, { type: 'VOTE_OBJECTION', playerId: agent(rival), accept: true });
    s = res.state;
    res = ok(s, { type: 'VOTE_OBJECTION', playerId: agent2(rival), accept: true });
    expect(eventTypes(res.events)).toEqual([
      'OBJECTION_VOTED',
      'OBJECTION_RESOLVED',
      'CARD_REVEALED',
      'TURN_CHANGED',
    ]);
    expect(res.events[2]).toMatchObject({ cardType: rival, team: rival, penalty: true });
    expect(res.events.at(-1)).toEqual({ type: 'TURN_CHANGED', team: rival, reason: 'objection' });
    expect(cardsOf(res.state, rival)).toHaveLength(before - 1);
    expect(res.state.clues.at(-1)).toMatchObject({ objection: 'accepted', guesses: [] });
    expect(res.state.clues.at(-1)?.penaltyCardId).toBeDefined();
  });

  it('rejected (tie or not enough yes votes): guessing goes on', () => {
    let s = object(clue(start())).state;
    if (s.phase.name !== 'objection') throw new Error('phase');
    const team = s.phase.team;
    s = ok(s, { type: 'VOTE_OBJECTION', playerId: agent(otherTeam(team)), accept: true }).state;
    // 2 yes of 5 voters, then the timer runs out.
    const res = ok(s, { type: 'TIMER_EXPIRED' });
    expect(res.events).toEqual([{ type: 'OBJECTION_RESOLVED', accepted: false }]);
    expect(res.state.phase).toEqual({ name: 'guess', team, guessesLeft: 3 });
    expect(res.state.clues.at(-1)?.objection).toBe('rejected');
  });

  it('resolves early once enough "no" votes make a majority impossible', () => {
    let s = object(clue(start())).state;
    if (s.phase.name !== 'objection') throw new Error('phase');
    const { voters, votes } = s.phase;
    const pending = voters.filter((id) => !(id in votes));
    const resolved: GameEvent[] = [];
    for (const id of pending) {
      const res = ok(s, { type: 'VOTE_OBJECTION', playerId: id, accept: false });
      s = res.state;
      resolved.push(...res.events.filter((e) => e.type === 'OBJECTION_RESOLVED'));
      if (resolved.length > 0) break;
    }
    expect(resolved).toEqual([{ type: 'OBJECTION_RESOLVED', accepted: false }]);
    expect(s.phase.name).toBe('guess');
  });

  it('an accepted objection can make the objecting team win', () => {
    let s = start();
    const rival = otherTeam(activeTeam(s));
    s = {
      ...s,
      cards: s.cards.map((c, i, all) =>
        c.type === rival && all.findIndex((x) => x.type === rival) !== i
          ? { ...c, revealed: true }
          : c,
      ),
    };
    s = object(clue(s)).state;
    for (const id of [agent(rival), agent2(rival)]) {
      s = ok(s, { type: 'VOTE_OBJECTION', playerId: id, accept: true }).state;
    }
    expect(s.phase).toEqual({ name: 'over', winner: rival, reason: 'agents' });
  });

  it('only the rival spymaster, once, before the first reveal', () => {
    const s = clue(start(), 'inf');
    const team = activeTeam(s);
    fail(s, { type: 'OBJECT_CLUE', playerId: agent(otherTeam(team)) }, 'WRONG_ROLE');
    fail(s, { type: 'OBJECT_CLUE', playerId: spy(team) }, 'NOT_YOUR_TURN');
    const revealed = ok(s, {
      type: 'REVEAL_CARD',
      playerId: agent(team),
      cardId: firstOf(s, team).id,
    }).state;
    fail(revealed, { type: 'OBJECT_CLUE', playerId: spy(otherTeam(team)) }, 'OBJECTION_TOO_LATE');
    const rejected = ok(object(s).state, { type: 'TIMER_EXPIRED' }).state;
    fail(rejected, { type: 'OBJECT_CLUE', playerId: spy(otherTeam(team)) }, 'ALREADY_OBJECTED');
    fail(start(), { type: 'OBJECT_CLUE', playerId: spy(otherTeam(team)) }, 'WRONG_PHASE');
  });

  it('can be disabled by the host', () => {
    const s = clue(start({ objections: false }));
    fail(
      s,
      { type: 'OBJECT_CLUE', playerId: spy(otherTeam(activeTeam(s))) },
      'OBJECTIONS_DISABLED',
    );
  });

  it('checks voters', () => {
    const s = object(clue(start())).state;
    if (s.phase.name !== 'objection') throw new Error('phase');
    const team = s.phase.team;
    fail(s, { type: 'VOTE_OBJECTION', playerId: spy(team), accept: false }, 'NOT_A_VOTER');
    fail(s, { type: 'VOTE_OBJECTION', playerId: 'spec', accept: false }, 'NOT_A_VOTER');
    fail(
      s,
      { type: 'VOTE_OBJECTION', playerId: spy(otherTeam(team)), accept: false },
      'ALREADY_VOTED',
    );
    fail(clue(start()), { type: 'VOTE_OBJECTION', playerId: 'ra', accept: true }, 'WRONG_PHASE');
  });

  it('leaves disconnected players out of the vote', () => {
    let s = clue(start());
    const team = activeTeam(s);
    s = ok(s, { type: 'SET_CONNECTED', playerId: agent2(team), connected: false }).state;
    s = object(s).state;
    if (s.phase.name !== 'objection') throw new Error('phase');
    expect(s.phase.voters).not.toContain(agent2(team));
  });

  it('resolves at once when the objector is the only voter', () => {
    const two = [
      player('rs', 'red', 'spymaster'),
      player('ra', 'red', 'agent'),
      player('bs', 'blue', 'spymaster'),
      player('ba', 'blue', 'agent'),
    ];
    let s = start({}, two);
    const team = activeTeam(s);
    for (const id of [agent(team), agent(otherTeam(team))]) {
      s = ok(s, { type: 'SET_CONNECTED', playerId: id, connected: false }).state;
    }
    s = clue(s);
    const res = ok(s, { type: 'OBJECT_CLUE', playerId: spy(otherTeam(team)) });
    expect(eventTypes(res.events)).toContain('OBJECTION_RESOLVED');
    expect(res.events).toContainEqual({ type: 'OBJECTION_RESOLVED', accepted: true });
  });
});

describe('SET_CONNECTED', () => {
  it('updates presence without events', () => {
    const s = start();
    const res = ok(s, { type: 'SET_CONNECTED', playerId: 'ra', connected: false });
    expect(res.state.players.find((p) => p.id === 'ra')?.connected).toBe(false);
    expect(res.events).toEqual([]);
    fail(s, { type: 'SET_CONNECTED', playerId: 'ghost', connected: false }, 'NOT_A_PLAYER');
  });
});

describe('REMATCH', () => {
  const finish = () => {
    const s0 = clue(start());
    return ok(s0, {
      type: 'REVEAL_CARD',
      playerId: agent(activeTeam(s0)),
      cardId: firstOf(s0, 'traitor').id,
    }).state;
  };

  it('starts a new game rotating spymasters and avoiding the previous words', () => {
    const over = finish();
    const res = ok(over, { type: 'REMATCH', keepSpymasters: false });
    const roles = Object.fromEntries(res.state.players.map((p) => [p.id, p.role]));
    expect(roles).toMatchObject({ rs: 'agent', ra: 'spymaster', ra2: 'agent' });
    expect(roles).toMatchObject({ bs: 'agent', ba: 'spymaster', ba2: 'agent' });
    const previous = new Set(over.cards.map((c) => c.word));
    expect(res.state.cards.some((c) => previous.has(c.word))).toBe(false);
    expect(res.events[0]?.type).toBe('GAME_STARTED');
  });

  it('wraps the rotation and can keep spymasters', () => {
    let s = finish();
    for (let i = 0; i < 3; i++) {
      s = ok(s, { type: 'REMATCH', keepSpymasters: false }).state;
      s = ok(clue(s), {
        type: 'REVEAL_CARD',
        playerId: s.players.find((p) => p.team === activeTeam(s) && p.role === 'agent')?.id ?? '',
        cardId: firstOf(s, 'traitor').id,
      }).state;
    }
    expect(s.players.find((p) => p.id === 'rs')?.role).toBe('spymaster');
    const kept = ok(s, { type: 'REMATCH', keepSpymasters: true }).state;
    expect(kept.players.find((p) => p.id === 'rs')?.role).toBe('spymaster');
  });

  it('only after the game is over', () => {
    fail(null, { type: 'REMATCH', keepSpymasters: false }, 'NO_GAME');
    fail(start(), { type: 'REMATCH', keepSpymasters: false }, 'GAME_IN_PROGRESS');
  });
});

describe('purity', () => {
  it('never mutates the input state', () => {
    const s = clue(start(), 'inf');
    const frozen = structuredClone(s);
    const team = activeTeam(s);
    apply(s, { type: 'POINT_CARD', playerId: agent(team), cardId: firstOf(s, team).id });
    apply(s, { type: 'REVEAL_CARD', playerId: agent(team), cardId: firstOf(s, team).id });
    apply(s, { type: 'OBJECT_CLUE', playerId: spy(otherTeam(team)) });
    apply(s, { type: 'TIMER_EXPIRED' });
    expect(s).toEqual(frozen);
  });
});
