import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs } from './prefs';

describe('parsePrefs', () => {
  it('keeps valid stored values and drops the rest', () => {
    expect(parsePrefs({ colorBlind: true, cardText: 'lg', vibration: 'no', extra: 1 })).toEqual({
      ...DEFAULT_PREFS,
      colorBlind: true,
      cardText: 'lg',
    });
  });

  it('clamps stored volumes and keeps defaults for missing channels', () => {
    expect(parsePrefs({ volumes: { master: 2, music: -1, effects: 'loud' } }).volumes).toEqual({
      master: 1,
      music: 0,
      effects: DEFAULT_PREFS.volumes.effects,
    });
  });

  it.each([null, 'x', 3, { cardText: 'xl' }])('falls back to defaults for %j', (raw) => {
    expect(parsePrefs(raw)).toEqual(DEFAULT_PREFS);
  });
});
