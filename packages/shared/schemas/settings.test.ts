import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseCustomWords, settingsSchema } from './settings';

describe('settingsSchema', () => {
  it('fills SPEC §1.7 defaults from an empty object', () => {
    expect(settingsSchema.parse({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      mode: 'classic',
      deckIds: ['clasico'],
      clueTimer: 0,
      guessTimer: 0,
      firstTurnBonus: true,
      revealMode: 'any',
      objections: true,
      spectatorsSeeMap: false,
      compoundWords: false,
      chat: true,
    });
  });

  it.each([
    ['a clue timer outside the options', { clueTimer: 45 }],
    ['a guess timer outside the options', { guessTimer: 180 }],
    ['an unknown reveal mode', { revealMode: 'vote' }],
    ['customShare above 100', { customShare: 101 }],
    ['an over-long team name', { teamNames: { red: 'x'.repeat(21), blue: '' } }],
    ['unknown keys', { cheat: true }],
  ])('rejects %s', (_label, input) => {
    expect(settingsSchema.safeParse(input).success).toBe(false);
  });
});

describe('parseCustomWords', () => {
  it('splits on commas and newlines, uppercases and dedupes', () => {
    expect(parseCustomWords('mate, bondi\nMate\n  subte ,,')).toEqual({
      words: ['MATE', 'BONDI', 'SUBTE'],
      rejected: [],
    });
  });

  it('rejects entries that are not a single word of 2–14 letters', () => {
    expect(parseCustomWords('dos palabras, x, ok, r2d2, ' + 'a'.repeat(15))).toEqual({
      words: ['OK'],
      rejected: ['dos palabras', 'x', 'r2d2', 'a'.repeat(15)],
    });
  });
});
