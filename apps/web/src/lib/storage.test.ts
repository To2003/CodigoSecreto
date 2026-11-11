import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetSeat, loadProfile, loadSeat, saveProfile, saveSeat } from './storage';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
    data,
  };
}

describe('storage', () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips the profile and validates it on read', () => {
    saveProfile({ nickname: 'Tomi', avatar: 4, color: 'lima' });
    expect(loadProfile()).toEqual({ nickname: 'Tomi', avatar: 4, color: 'lima' });
    storage.data.set('clave:profile', JSON.stringify({ nickname: 'x', avatar: 99, color: 'lima' }));
    expect(loadProfile()).toBeNull();
    storage.data.set(
      'clave:profile',
      JSON.stringify({ nickname: 'x', avatar: 1, color: 'fucsia' }),
    );
    expect(loadProfile()).toBeNull();
    storage.data.set('clave:profile', '{not json');
    expect(loadProfile()).toBeNull();
  });

  it('keeps one seat per room and forgets it', () => {
    saveSeat('KTRX', { playerId: 'p1', token: 't1' });
    expect(loadSeat('KTRX')).toEqual({ playerId: 'p1', token: 't1' });
    expect(loadSeat('ABCD')).toBeNull();
    forgetSeat('KTRX');
    expect(loadSeat('KTRX')).toBeNull();
  });

  it('works without storage at all', () => {
    vi.stubGlobal('window', {});
    expect(loadProfile()).toBeNull();
    expect(() => {
      saveSeat('KTRX', { playerId: 'p', token: 't' });
      forgetSeat('KTRX');
    }).not.toThrow();
  });
});
