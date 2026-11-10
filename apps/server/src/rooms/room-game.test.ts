import { mulberry32, otherTeam, type Profile, type Team } from '@clave/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { Room, RoomError } from './room';

const profile = (nickname: string): Profile => ({ nickname, avatar: 0, color: 'oro' });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof RoomError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

let room: Room;
/** p1 (host) and p3 red, p2 and p4 blue; p1 and p2 spymasters. */
function ready() {
  room = new Room('KTRX', 0);
  for (const [i, n] of ['Ana', 'Beto', 'Caro', 'Dani'].entries()) {
    room.join(profile(n), 0, { id: `p${i + 1}`, token: `token-${i}-${'x'.repeat(20)}` });
  }
  room.setRole('p1', 'spymaster');
  room.setRole('p2', 'spymaster');
}
const spymaster = (team: Team) => (team === 'red' ? 'p1' : 'p2');
const agent = (team: Team) => (team === 'red' ? 'p3' : 'p4');
const activeTeam = () => {
  const phase = room.game?.phase;
  if (!phase || phase.name === 'over') throw new Error('no active team');
  return phase.team;
};

beforeEach(ready);

describe('start', () => {
  it('host starts when nothing blocks; status and view follow', () => {
    expect(code(() => room.start('p2', mulberry32(1)))).toBe('NOT_HOST');
    const events = room.start('p1', mulberry32(1));
    expect(events[0]?.type).toBe('GAME_STARTED');
    expect(room.status).toBe('playing');
    expect(room.view('p3').game?.cards).toHaveLength(25);
    expect(code(() => room.start('p1', mulberry32(1)))).toBe('LOBBY_ONLY');
  });

  it('refuses with blockers', () => {
    room.setRole('p2', 'agent');
    expect(code(() => room.start('p1', mulberry32(1)))).toBe('CANNOT_START');
  });
});

describe('act', () => {
  beforeEach(() => {
    room.start('p1', mulberry32(1));
  });

  it('runs engine actions for the acting player only', () => {
    const team = activeTeam();
    expect(
      code(() =>
        room.act(agent(team), {
          type: 'GIVE_CLUE',
          playerId: spymaster(team),
          word: 'QXZ',
          count: 1,
        }),
      ),
    ).toBe('BAD_REQUEST');
    room.act(spymaster(team), {
      type: 'GIVE_CLUE',
      playerId: spymaster(team),
      word: 'QXZ',
      count: 1,
    });
    expect(room.game?.phase.name).toBe('guess');
  });

  it('surfaces engine errors with the clue detail', () => {
    const team = activeTeam();
    const word = room.game?.cards[0]?.word ?? '';
    try {
      room.act(spymaster(team), { type: 'GIVE_CLUE', playerId: spymaster(team), word, count: 1 });
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(RoomError);
      expect(e).toMatchObject({
        code: 'INVALID_CLUE',
        clue: { reason: 'ON_BOARD', conflict: word },
      });
    }
  });

  it('counts the win on the scoreboard', () => {
    const team = activeTeam();
    room.act(spymaster(team), {
      type: 'GIVE_CLUE',
      playerId: spymaster(team),
      word: 'QXZ',
      count: 1,
    });
    const traitor = room.game?.cards.find((c) => c.type === 'traitor')?.id ?? '';
    room.act(agent(team), { type: 'REVEAL_CARD', playerId: agent(team), cardId: traitor });
    expect(room.status).toBe('over');
    expect(room.scoreboard[otherTeam(team)]).toBe(1);
  });

  it('needs a game', () => {
    ready();
    expect(code(() => room.act('p3', { type: 'END_GUESSING', playerId: 'p3' }))).toBe(
      'NOT_PLAYING',
    );
  });
});

describe('pause and spymaster reassignment (SPEC §2.4)', () => {
  beforeEach(() => {
    room.start('p1', mulberry32(1));
  });

  it('pauses while the active spymaster is away and resumes when they return', () => {
    const team = activeTeam();
    room.setConnected(spymaster(otherTeam(team)), false, 0);
    expect(room.paused()).toBeNull();
    room.setConnected(spymaster(team), false, 0);
    const expected = { team, reason: 'spymaster', waitingFor: [spymaster(team)] };
    expect(room.paused()).toEqual(expected);
    expect(room.view('p3').game?.paused).toEqual(expected);
    expect(
      code(() =>
        room.act(spymaster(team), {
          type: 'GIVE_CLUE',
          playerId: spymaster(team),
          word: 'QXZ',
          count: 1,
        }),
      ),
    ).toBe('GAME_PAUSED');
    room.setConnected(spymaster(team), true, 0);
    expect(room.paused()).toBeNull();
  });

  it('pauses while the guessing team has no agent connected', () => {
    const team = activeTeam();
    room.act(spymaster(team), {
      type: 'GIVE_CLUE',
      playerId: spymaster(team),
      word: 'QXZ',
      count: 1,
    });
    room.setConnected(agent(team), false, 0);
    expect(room.paused()).toEqual({ team, reason: 'agents', waitingFor: [agent(team)] });
  });

  it('refuses to reassign when not paused, or for the other team (M3 review C2)', () => {
    const team = activeTeam();
    expect(code(() => room.setSpymaster('p1', agent(team)))).toBe('NOT_PAUSED');
    expect(code(() => room.setSpymaster('p1', 'p1'))).toBe('NOT_PAUSED');
    room.setConnected(spymaster(team), false, 0);
    room.expireDisconnected(60_000); // in case the host was the one who dropped
    expect(code(() => room.setSpymaster(room.hostId, agent(otherTeam(team))))).toBe(
      'PLAYER_UNAVAILABLE',
    );
  });

  it('refuses a swap that would leave the team without agents (M3 review I1)', () => {
    const team = activeTeam();
    room.setConnected(spymaster(team), false, 0);
    room.expireDisconnected(60_000);
    expect(code(() => room.setSpymaster(room.hostId, agent(team)))).toBe('NO_AGENT_LEFT');
  });

  it('keeps disconnected seats during a game', () => {
    room.setConnected('p4', false, 0);
    expect(room.expireDisconnected(10 * 60_000)).toEqual([]);
    expect(room.players).toHaveLength(4);
  });

  it('hands the host role over only after 60 s away, never on a quick F5', () => {
    room.setConnected('p1', false, 0);
    expect(room.expireDisconnected(59_999)).toEqual([]);
    room.setConnected('p1', true, 30_000);
    expect(room.expireDisconnected(120_000)).toEqual([]);
    room.setConnected('p1', false, 200_000);
    expect(room.expireDisconnected(260_000)).toEqual([{ type: 'HOST_CHANGED', playerId: 'p2' }]);
    expect(room.hostId).toBe('p2');
  });
});

describe('reassignment with three per team', () => {
  /** p1/p3/p5 red, p2/p4/p6 blue; p1 and p2 spymasters; p1 is host. */
  beforeEach(() => {
    room = new Room('KTRX', 0);
    for (const [i, n] of ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fede'].entries()) {
      room.join(profile(n), 0, { id: `p${i + 1}`, token: `token-${i}-${'x'.repeat(20)}` });
    }
    room.setRole('p1', 'spymaster');
    room.setRole('p2', 'spymaster');
    room.start('p1', mulberry32(2));
    if (activeTeam() === 'red') {
      // Make blue the active team so the host (red) isn't the missing spymaster.
      room.act('p1', { type: 'GIVE_CLUE', playerId: 'p1', word: 'QXZ', count: 1 });
      room.act('p3', {
        type: 'REVEAL_CARD',
        playerId: 'p3',
        cardId: room.game?.cards.find((c) => c.type === 'civilian')?.id ?? '',
      });
    }
  });

  it('promotes a connected agent and benches the old spymaster as a spectator', () => {
    expect(activeTeam()).toBe('blue');
    room.setConnected('p2', false, 0);
    expect(code(() => room.setSpymaster('p3', 'p4'))).toBe('NOT_HOST');
    room.setSpymaster('p1', 'p4');
    expect(room.paused()).toBeNull();
    expect(room.players.find((p) => p.id === 'p4')).toMatchObject({
      team: 'blue',
      role: 'spymaster',
    });
    // Back again, the old spymaster watches without the map and can't act.
    room.setConnected('p2', true, 0);
    expect(room.players.find((p) => p.id === 'p2')).toMatchObject({ team: 'spectator' });
    expect(room.view('p2').game?.seesMap).toBe(false);
    expect(room.view('p2').game?.cards.some((c) => !c.revealed && c.type)).toBe(false);
    expect(code(() => room.act('p2', { type: 'END_GUESSING', playerId: 'p2' }))).not.toBe(
      'NO_ERROR',
    );
  });
});

describe('kick during a game (M3 review I3)', () => {
  it('tells the engine the player is gone, so majority reveal still works', () => {
    room = new Room('KTRX', 0);
    for (const [i, n] of ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].entries()) {
      room.join(profile(n), 0, { id: `p${i + 1}`, token: `token-${i}-${'x'.repeat(20)}` });
    }
    room.setRole('p1', 'spymaster');
    room.setRole('p2', 'spymaster');
    room.updateSettings('p1', { revealMode: 'majority' });
    room.start('p1', mulberry32(3));
    room.kick('p1', 'p5'); // a red agent
    expect(room.game?.players.find((p) => p.id === 'p5')?.connected).toBe(false);
  });
});

describe('after the game', () => {
  const finish = () => {
    const team = activeTeam();
    room.act(spymaster(team), {
      type: 'GIVE_CLUE',
      playerId: spymaster(team),
      word: 'QXZ',
      count: 1,
    });
    const traitor = room.game?.cards.find((c) => c.type === 'traitor')?.id ?? '';
    room.act(agent(team), { type: 'REVEAL_CARD', playerId: agent(team), cardId: traitor });
  };

  it('rematch rotates spymasters in the room too', () => {
    room.start('p1', mulberry32(1));
    finish();
    room.rematch('p1', false);
    expect(room.status).toBe('playing');
    expect(room.players.find((p) => p.id === 'p3')?.role).toBe('spymaster');
    expect(room.players.find((p) => p.id === 'p1')?.role).toBe('agent');
  });

  it('rematch uses who is in the room now (M3 review I4)', () => {
    room.start('p1', mulberry32(1));
    room.join(profile('Eli'), 0, { id: 'p5', token: 'z'.repeat(32) }); // joins mid-game: watches
    finish();
    room.rematch('p1', false);
    expect(room.game?.players.map((p) => p.id).sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(room.game?.players.find((p) => p.id === 'p5')?.team).toBe('spectator');
  });

  it('rematch refuses when a team has no connected spymaster or agent', () => {
    room.start('p1', mulberry32(1));
    finish();
    room.setConnected('p4', false, 0); // blue's next spymaster after rotation
    expect(code(() => room.rematch('p1', false))).toBe('CANNOT_START');
  });

  it('rematch is only for a finished game', () => {
    room.start('p1', mulberry32(1));
    expect(code(() => room.rematch('p1', false))).toBe('GAME_IN_PROGRESS');
  });

  it('back to lobby drops the game and avoids its words next time', () => {
    room.start('p1', mulberry32(1));
    const words = new Set(room.game?.cards.map((c) => c.word));
    finish();
    expect(code(() => room.backToLobby('p2'))).toBe('NOT_HOST');
    expect(room.backToLobby('p1')).toEqual([{ type: 'BACK_TO_LOBBY' }]);
    expect(room.status).toBe('lobby');
    expect(room.view('p1').game).toBeNull();
    room.start('p1', mulberry32(1));
    expect(room.game?.cards.some((c) => words.has(c.word))).toBe(false);
  });

  it('a player who joins mid-game watches', () => {
    room.start('p1', mulberry32(1));
    const { player } = room.join(profile('Eli'), 0, { id: 'p5', token: 'y'.repeat(32) });
    expect(player.team).toBe('spectator');
    expect(room.view('p5').game?.seesMap).toBe(false);
  });
});
