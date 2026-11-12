import { describe, expect, it } from 'vitest';
import { coopEmoteBlocked, emoteBlocked } from './emotes';
import type { CoopState } from './coop';
import type { EnginePlayer, GameState, Phase } from './types';

const players: EnginePlayer[] = [
  { id: 'rs', team: 'red', role: 'spymaster', connected: true },
  { id: 'ra', team: 'red', role: 'agent', connected: true },
  { id: 'bs', team: 'blue', role: 'spymaster', connected: true },
  { id: 'sp', team: 'spectator', role: 'agent', connected: true },
];
const game = (phase: Phase) => ({ players, phase }) as unknown as GameState;

describe('emoteBlocked (SPEC §9 as amended, ADR-032)', () => {
  it('blocks a spymaster while their own team is guessing (and during its objection vote)', () => {
    const guessing = game({ name: 'guess', team: 'red', guessesLeft: 2 });
    expect(emoteBlocked(guessing, 'rs')).toBe(true);
    const objection = game({
      name: 'objection',
      team: 'red',
      guessesLeft: 2,
      objector: 'bs',
      voters: ['bs', 'ra'],
      votes: { bs: true },
    });
    expect(emoteBlocked(objection, 'rs')).toBe(true);
  });

  it('lets them emote on the rival turn, while giving the clue, and at the end', () => {
    expect(emoteBlocked(game({ name: 'guess', team: 'blue', guessesLeft: 1 }), 'rs')).toBe(false);
    expect(emoteBlocked(game({ name: 'clue', team: 'red' }), 'rs')).toBe(false);
    expect(emoteBlocked(game({ name: 'over', winner: 'red', reason: 'agents' }), 'rs')).toBe(false);
    expect(emoteBlocked(null, 'rs')).toBe(false);
  });

  it('never blocks agents or spectators by role alone', () => {
    const guessing = game({ name: 'guess', team: 'red', guessesLeft: 2 });
    for (const id of ['ra', 'bs', 'sp', 'unknown']) expect(emoteBlocked(guessing, id)).toBe(false);
  });
});

describe('coopEmoteBlocked', () => {
  const coop = (phase: CoopState['phase']) =>
    ({ players: [players[0], players[2]], phase }) as unknown as CoopState;

  it('blocks the side that gave the clue while the other side guesses with its map', () => {
    expect(coopEmoteBlocked(coop({ name: 'guess', giver: 'red', guessesLeft: null }), 'rs')).toBe(
      true,
    );
    expect(coopEmoteBlocked(coop({ name: 'guess', giver: 'red', guessesLeft: null }), 'bs')).toBe(
      false,
    );
    expect(coopEmoteBlocked(coop({ name: 'clue', giver: 'red' }), 'rs')).toBe(false);
    expect(coopEmoteBlocked(coop({ name: 'over', won: true, reason: 'agents' }), 'rs')).toBe(false);
    expect(coopEmoteBlocked(null, 'rs')).toBe(false);
  });
});
