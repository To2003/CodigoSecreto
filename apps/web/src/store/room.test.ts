import { describe, expect, it } from 'vitest';
import { patchAction } from './room';

describe('patchAction', () => {
  it.each([
    [4, 5, 'apply'],
    [4, 4, 'ignore'],
    [4, 2, 'ignore'],
    [4, 7, 'resync'],
    [-1, 3, 'resync'],
  ] as const)('current %i, patch %i → %s', (current, patch, expected) => {
    expect(patchAction(current, patch)).toBe(expected);
  });
});
