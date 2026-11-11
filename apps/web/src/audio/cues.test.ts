import { DEFAULT_SETTINGS, type GameView, type RoomEvent, type RoomView } from '@clave/shared';
import { describe, expect, it } from 'vitest';
import { isMyTurn, soundsFor } from './cues';

const player = (id: string, team: 'red' | 'blue' | 'spectator', role: 'spymaster' | 'agent') => ({
  id,
  nickname: id,
  avatar: 0,
  color: 'oro' as const,
  team,
  role,
  connected: true,
});

function view(youId: string, phase?: GameView['phase']): RoomView {
  return {
    code: 'KTRX',
    youId,
    hostId: 'rs',
    players: [
      player('rs', 'red', 'spymaster'),
      player('ra', 'red', 'agent'),
      player('bs', 'blue', 'spymaster'),
      player('sp', 'spectator', 'agent'),
    ],
    settings: DEFAULT_SETTINGS,
    status: phase ? 'playing' : 'lobby',
    scoreboard: { red: 0, blue: 0 },
    startBlockers: [],
    chatMuted: false,
    emotesMuted: false,
    likes: null,
    coop: null,
    game: phase
      ? {
          phase,
          startingTeam: 'red',
          cards: [],
          clues: [],
          points: {},
          remaining: { red: 9, blue: 8 },
          seesMap: false,
          paused: null,
          timer: null,
          durationMs: null,
        }
      : null,
  };
}

describe('soundsFor', () => {
  it('plays the reveal outcome after the flip, from the revealing team point of view', () => {
    const reveal = (cardType: 'red' | 'blue' | 'civilian' | 'traitor'): RoomEvent => ({
      type: 'CARD_REVEALED',
      cardId: 'c',
      cardType,
      team: 'red',
      penalty: false,
    });
    expect(soundsFor([reveal('red')], view('ra'))).toEqual(['flip', 'reveal_own']);
    expect(soundsFor([reveal('blue')], view('ra'))).toEqual(['flip', 'reveal_enemy']);
    expect(soundsFor([reveal('civilian')], view('ra'))).toEqual(['flip', 'reveal_civil']);
    expect(soundsFor([reveal('traitor')], view('ra'))).toEqual(['flip', 'reveal_traitor']);
  });

  it('tells the agents and the spymaster when it is their turn', () => {
    const clue: RoomEvent = { type: 'CLUE_GIVEN', team: 'red', word: 'X', count: 1 };
    expect(soundsFor([clue], view('ra'))).toEqual(['clue', 'your_turn']);
    expect(soundsFor([clue], view('bs'))).toEqual(['clue']);
    const turn: RoomEvent = { type: 'TURN_CHANGED', team: 'red', reason: 'ended' };
    expect(soundsFor([turn], view('rs'))).toEqual(['turn_change', 'your_turn']);
    expect(soundsFor([turn], view('ra'))).toEqual(['turn_change']);
  });

  it('wins, loses, joins and points', () => {
    const over: RoomEvent = { type: 'GAME_OVER', winner: 'blue', reason: 'agents' };
    expect(soundsFor([over], view('bs'))).toEqual(['win']);
    expect(soundsFor([over], view('ra'))).toEqual(['lose']);
    expect(soundsFor([over], view('sp'))).toEqual(['win']);
    expect(soundsFor([{ type: 'PLAYER_JOINED', playerId: 'x' }], view('ra'))).toEqual(['join']);
    expect(soundsFor([{ type: 'PLAYER_JOINED', playerId: 'ra' }], view('ra'))).toEqual([]);
    expect(
      soundsFor([{ type: 'CARD_POINTED', playerId: 'ra', team: 'red', cardId: null }], view('ra')),
    ).toEqual([]);
    expect(soundsFor([{ type: 'SETTINGS_CHANGED' }], view('ra'))).toEqual([]);
  });
});

describe('isMyTurn', () => {
  it('is the spymaster in the clue phase and the agents while guessing, never while paused', () => {
    expect(isMyTurn(view('rs', { name: 'clue', team: 'red' }))).toBe(true);
    expect(isMyTurn(view('ra', { name: 'clue', team: 'red' }))).toBe(false);
    expect(isMyTurn(view('ra', { name: 'guess', team: 'red', guessesLeft: 2 }))).toBe(true);
    expect(isMyTurn(view('bs', { name: 'guess', team: 'red', guessesLeft: 2 }))).toBe(false);
    expect(isMyTurn(view('ra', { name: 'over', winner: 'red', reason: 'agents' }))).toBe(false);
    expect(isMyTurn(view('ra'))).toBe(false);
    const paused = view('rs', { name: 'clue', team: 'red' });
    if (paused.game) paused.game.paused = { team: 'red', reason: 'spymaster', waitingFor: ['rs'] };
    expect(isMyTurn(paused)).toBe(false);
  });
});
