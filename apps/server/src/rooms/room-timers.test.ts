import { mulberry32, type Profile, type SettingsPatch, type Team } from '@clave/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { OBJECTION_MS, Room } from './room';

const profile = (nickname: string): Profile => ({ nickname, avatar: 0, color: 'oro' });

let clock = 0;
let room: Room;
/** p1 (host) and p3 red, p2 and p4 blue; p1 and p2 spymasters. Clock starts at 0. */
function ready(settings: SettingsPatch = {}) {
  clock = 0;
  room = new Room('KTRX', 0, () => clock);
  for (const [i, n] of ['Ana', 'Beto', 'Caro', 'Dani'].entries()) {
    room.join(profile(n), 0, { id: `p${i + 1}`, token: `token-${i}-${'x'.repeat(20)}` });
  }
  room.setRole('p1', 'spymaster');
  room.setRole('p2', 'spymaster');
  room.updateSettings('p1', settings);
  room.start('p1', mulberry32(1));
}
const spymaster = (team: Team) => (team === 'red' ? 'p1' : 'p2');
const agent = (team: Team) => (team === 'red' ? 'p3' : 'p4');
const other = (team: Team): Team => (team === 'red' ? 'blue' : 'red');
const activeTeam = () => {
  const phase = room.game?.phase;
  if (!phase || phase.name === 'over') throw new Error('no active team');
  return phase.team;
};
const timer = () => room.view('p3').game?.timer;
const giveClue = (team: Team) =>
  room.act(spymaster(team), {
    type: 'GIVE_CLUE',
    playerId: spymaster(team),
    word: 'QXZ',
    count: 'inf',
  });

describe('timers off (default)', () => {
  beforeEach(() => {
    ready();
  });

  it('shows no timer and never expires', () => {
    expect(timer()).toBeNull();
    clock = 10 * 60_000;
    expect(room.tick()).toEqual([]);
  });
});

describe('clue timer', () => {
  it('gives each team +30 s on its first turn, then the plain time', () => {
    ready({ clueTimer: 60 });
    const first = activeTeam();
    expect(timer()).toEqual({ kind: 'clue', remainingMs: 90_000, totalMs: 90_000, running: true });
    clock = 89_999;
    expect(room.tick()).toEqual([]);
    expect(timer()?.remainingMs).toBe(1);
    clock = 90_000;
    expect(room.tick()).toEqual([{ type: 'TURN_CHANGED', team: other(first), reason: 'timeout' }]);
    // The other team's first turn: bonus too.
    expect(timer()?.totalMs).toBe(90_000);
    clock = 180_000;
    room.tick();
    // Back to the first team, second turn: no bonus.
    expect(activeTeam()).toBe(first);
    expect(timer()?.totalMs).toBe(60_000);
  });

  it('no bonus when the host turned it off', () => {
    ready({ clueTimer: 60, firstTurnBonus: false });
    expect(timer()?.totalMs).toBe(60_000);
  });

  it('freezes while the game is paused and resumes where it was', () => {
    ready({ clueTimer: 60 });
    const team = activeTeam();
    clock = 10_000;
    room.setConnected(spymaster(team), false, clock);
    expect(timer()).toMatchObject({ remainingMs: 80_000, running: false });
    clock = 500_000;
    expect(room.tick()).toEqual([]);
    room.setConnected(spymaster(team), true, clock);
    expect(timer()).toMatchObject({ remainingMs: 80_000, running: true });
    clock = 579_999;
    expect(room.tick()).toEqual([]);
    clock = 580_000;
    expect(room.tick()[0]).toMatchObject({ type: 'TURN_CHANGED', reason: 'timeout' });
  });
});

describe('guess timer', () => {
  it('starts when the clue is given and ends the turn when it runs out', () => {
    ready({ guessTimer: 60 });
    const team = activeTeam();
    expect(timer()).toBeNull();
    clock = 5_000;
    giveClue(team);
    expect(timer()).toEqual({ kind: 'guess', remainingMs: 90_000, totalMs: 90_000, running: true });
    clock = 95_000;
    expect(room.tick()).toEqual([{ type: 'TURN_CHANGED', team: other(team), reason: 'timeout' }]);
    expect(timer()).toBeNull();
  });

  it('keeps running across reveals in the same turn', () => {
    ready({ guessTimer: 60 });
    const team = activeTeam();
    giveClue(team);
    clock = 30_000;
    const own = room.game?.cards.find((c) => c.type === team && !c.revealed);
    if (!own) throw new Error('setup');
    room.act(agent(team), { type: 'REVEAL_CARD', playerId: agent(team), cardId: own.id });
    expect(timer()?.remainingMs).toBe(60_000);
  });
});

describe('objection vote', () => {
  it('lasts 15 s and resolves with the votes cast so far', () => {
    ready();
    const team = activeTeam();
    giveClue(team);
    const rival = spymaster(other(team));
    clock = 1_000;
    room.act(rival, { type: 'OBJECT_CLUE', playerId: rival });
    expect(timer()).toEqual({
      kind: 'objection',
      remainingMs: OBJECTION_MS,
      totalMs: OBJECTION_MS,
      running: true,
    });
    clock = 1_000 + OBJECTION_MS;
    expect(room.tick()).toContainEqual({ type: 'OBJECTION_RESOLVED', accepted: false });
    expect(room.game?.phase.name).toBe('guess');
  });

  it('a rejected objection gives the guessers their full time back', () => {
    ready({ guessTimer: 60, firstTurnBonus: false });
    const team = activeTeam();
    giveClue(team);
    clock = 20_000;
    const rival = spymaster(other(team));
    room.act(rival, { type: 'OBJECT_CLUE', playerId: rival });
    clock = 20_000 + OBJECTION_MS;
    room.tick();
    expect(timer()).toMatchObject({ kind: 'guess', remainingMs: 60_000 });
  });
});

describe('duration', () => {
  it('is only known once the game is over', () => {
    ready();
    expect(room.view('p3').game?.durationMs).toBeNull();
    const team = activeTeam();
    giveClue(team);
    clock = 123_000;
    const traitor = room.game?.cards.find((c) => c.type === 'traitor');
    if (!traitor) throw new Error('setup');
    room.act(agent(team), { type: 'REVEAL_CARD', playerId: agent(team), cardId: traitor.id });
    expect(room.view('p3').game?.durationMs).toBe(123_000);
    expect(room.view('p3').game?.timer).toBeNull();
  });
});
