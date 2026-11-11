import { mulberry32, type Profile } from '@clave/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHAT_HISTORY, Room, RoomError } from './room';

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

let clock = 0;
let room: Room;
/** p1 (host) and p3 red, p2 and p4 blue; p1 and p2 spymasters; p5 spectator. */
beforeEach(() => {
  clock = 0;
  room = new Room('KTRX', 0, () => clock);
  for (const [i, n] of ['Ana', 'Beto', 'Caro', 'Dani', 'Eli'].entries()) {
    room.join(profile(n), 0, { id: `p${i + 1}`, token: `token-${i}-${'x'.repeat(20)}` });
  }
  room.setRole('p1', 'spymaster');
  room.setRole('p2', 'spymaster');
  room.setTeam('p5', 'spectator');
});
const later = () => {
  clock += 5_000;
};

describe('chat', () => {
  it('a line to everyone reaches everyone, sanitized', () => {
    const { message, recipients } = room.sendChat('p3', '  hola\u0000   che ​ ', 'all');
    expect(message).toMatchObject({ playerId: 'p3', scope: 'all', text: 'hola che', at: 0 });
    expect(message.team).toBeUndefined();
    expect(recipients.sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('a team line reaches only that team, spymaster included', () => {
    const { message, recipients } = room.sendChat('p3', 'vamos', 'team');
    expect(message.team).toBe('red');
    expect(recipients.sort()).toEqual(['p1', 'p3']);
    later();
    expect(room.sendChat('p5', 'mirando', 'team').recipients).toEqual(['p5']);
  });

  it('caps the text and refuses empty lines', () => {
    expect(room.sendChat('p3', 'a'.repeat(500), 'all').message.text).toHaveLength(200);
    later();
    expect(code(() => room.sendChat('p3', ' ​ ', 'all'))).toBe('BAD_REQUEST');
  });

  it('one line per second per player', () => {
    room.sendChat('p3', 'uno', 'all');
    clock = 999;
    expect(code(() => room.sendChat('p3', 'dos', 'all'))).toBe('RATE_LIMITED');
    expect(code(() => room.sendChat('p4', 'otro', 'all'))).toBe('NO_ERROR');
    clock = 1_000;
    expect(code(() => room.sendChat('p3', 'dos', 'all'))).toBe('NO_ERROR');
  });

  it('the host can turn it off', () => {
    room.updateSettings('p1', { chat: false });
    expect(code(() => room.sendChat('p3', 'hola', 'all'))).toBe('CHAT_DISABLED');
  });

  it('spymasters write in the lobby and after the game, not during it (SPEC §9)', () => {
    expect(code(() => room.sendChat('p1', 'hola', 'all'))).toBe('NO_ERROR');
    room.start('p1', mulberry32(1));
    later();
    expect(code(() => room.sendChat('p1', 'una pista', 'all'))).toBe('CHAT_NOT_ALLOWED');
    expect(code(() => room.sendChat('p1', 'una pista', 'team'))).toBe('CHAT_NOT_ALLOWED');
    expect(code(() => room.sendChat('p3', 'agente sí', 'team'))).toBe('NO_ERROR');
  });

  it('spectators who see the map are muted during the game like spymasters', () => {
    room.updateSettings('p1', { spectatorsSeeMap: true });
    room.start('p1', mulberry32(1));
    expect(code(() => room.sendChat('p5', 'jaja', 'all'))).toBe('CHAT_NOT_ALLOWED');
  });

  it('a spymaster replaced during a pause stays muted: they saw the map (M7 review)', () => {
    // One more agent per team, so either team can lose its spymaster and keep an agent.
    room.join(profile('Fede'), 0, { id: 'p6', token: `token-6-${'x'.repeat(20)}` });
    room.join(profile('Gabi'), 0, { id: 'p7', token: `token-7-${'x'.repeat(20)}` });
    room.setTeam('p6', 'red');
    room.setTeam('p7', 'blue');
    room.start('p1', mulberry32(1));
    const phase = room.game?.phase;
    if (!phase || phase.name === 'over') throw new Error('setup');
    const [sm, agent] = phase.team === 'red' ? ['p1', 'p6'] : ['p2', 'p7'];
    room.setConnected(sm, false, 0);
    room.setSpymaster('p1', agent); // p1 is the host
    room.setConnected(sm, true, 0);
    // The old spymaster is a spectator now, in a room where spectators don't see the map.
    expect(room.view(sm).players.find((p) => p.id === sm)?.team).toBe('spectator');
    expect(code(() => room.sendChat(sm, 'TIBURON es el traidor', 'all'))).toBe('CHAT_NOT_ALLOWED');
    expect(room.view(sm).chatMuted).toBe(true);
    // The new spymaster is muted too; a plain agent isn't.
    expect(code(() => room.sendChat(agent, 'ahora soy jefe', 'all'))).toBe('CHAT_NOT_ALLOWED');
    expect(room.view('p3').chatMuted).toBe(false);
    // Benched but knows the map: no emotes either while that team guesses (ADR-032).
    expect(code(() => room.emote(sm, 'fire'))).toBe('NO_ERROR');
    clock += 5_000;
    room.act(agent, { type: 'GIVE_CLUE', playerId: agent, word: 'QXZ', count: 'inf' });
    expect(code(() => room.emote(sm, 'fire'))).toBe('EMOTE_NOT_NOW');
  });

  it('history only has what each player could read, at most the last 50', () => {
    for (let i = 0; i < CHAT_HISTORY + 5; i++) {
      room.sendChat(i % 2 === 0 ? 'p3' : 'p4', `msg ${String(i)}`, i % 3 === 0 ? 'team' : 'all');
      later();
    }
    const red = room.chatHistory('p1');
    const blue = room.chatHistory('p2');
    expect(red.every((m) => m.scope === 'all' || m.team === 'red')).toBe(true);
    expect(blue.every((m) => m.scope === 'all' || m.team === 'blue')).toBe(true);
    expect(red.length).toBeLessThanOrEqual(CHAT_HISTORY);
    expect(red.at(-1)?.text).toBe(`msg ${String(CHAT_HISTORY + 4)}`);
  });

  it('a team line stays with who could read it, even after changing teams', () => {
    room.sendChat('p3', 'secreto rojo', 'team');
    room.setTeam('p4', 'red');
    expect(room.chatHistory('p4').map((m) => m.text)).not.toContain('secreto rojo');
  });
});

describe('emotes', () => {
  it('anyone, spymasters included, at most one every 2 s', () => {
    room.start('p1', mulberry32(1));
    expect(room.emote('p1', 'fire')).toEqual({ playerId: 'p1', emoteId: 'fire' });
    clock = 1_999;
    expect(code(() => room.emote('p1', 'clap'))).toBe('RATE_LIMITED');
    clock = 2_000;
    expect(code(() => room.emote('p1', 'clap'))).toBe('NO_ERROR');
  });

  /** ADR-032: a spymaster's emote while their team guesses would be a yes/no signal. */
  describe('spymasters while their team is guessing (ADR-032)', () => {
    const guessing = () => {
      room.start('p1', mulberry32(1));
      const phase = room.game?.phase;
      if (!phase || phase.name === 'over') throw new Error('setup');
      const [sm, rival, agent] = phase.team === 'red' ? ['p1', 'p2', 'p3'] : ['p2', 'p1', 'p4'];
      room.act(sm, { type: 'GIVE_CLUE', playerId: sm, word: 'QXZ', count: 'inf' });
      return { sm, rival, agent };
    };

    it('the server refuses the guessing team’s spymaster; everyone else may', () => {
      const { sm, rival, agent } = guessing();
      expect(code(() => room.emote(sm, 'fire'))).toBe('EMOTE_NOT_NOW');
      expect(room.view(sm).emotesMuted).toBe(true);
      expect(code(() => room.emote(rival, 'fire'))).toBe('NO_ERROR');
      expect(code(() => room.emote(agent, 'fire'))).toBe('NO_ERROR');
      expect(code(() => room.emote('p5', 'fire'))).toBe('NO_ERROR');
      expect(room.view(rival).emotesMuted).toBe(false);
    });

    it('a refused emote does not use up the rate limit; the turn change frees it', () => {
      const { sm, agent } = guessing();
      room.emote(agent, 'clap'); // someone else's emote doesn't matter either
      expect(code(() => room.emote(sm, 'fire'))).toBe('EMOTE_NOT_NOW');
      room.act(agent, { type: 'REVEAL_CARD', playerId: agent, cardId: civilian() });
      // A civilian ended the turn: now it's the rival's, and the spymaster may emote at once.
      expect(code(() => room.emote(sm, 'fire'))).toBe('NO_ERROR');
    });

    it('allowed again at the end of the game and back in the lobby', () => {
      const { sm, agent } = guessing();
      const traitor = room.game?.cards.find((c) => c.type === 'traitor');
      room.act(agent, { type: 'REVEAL_CARD', playerId: agent, cardId: traitor?.id ?? '' });
      expect(room.status).toBe('over');
      expect(code(() => room.emote(sm, 'clap'))).toBe('NO_ERROR');
      clock += 5_000;
      room.backToLobby('p1');
      expect(code(() => room.emote(sm, 'fire'))).toBe('NO_ERROR');
    });
  });
});

const civilian = () => room.game?.cards.find((c) => c.type === 'civilian' && !c.revealed)?.id ?? '';
