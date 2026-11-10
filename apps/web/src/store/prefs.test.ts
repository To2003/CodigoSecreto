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

  it.each([null, 'x', 3, { cardText: 'xl' }])('falls back to defaults for %j', (raw) => {
    expect(parsePrefs(raw)).toEqual(DEFAULT_PREFS);
  });
});
