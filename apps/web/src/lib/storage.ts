import { AVATAR_COLORS, AVATAR_COUNT, type Profile } from '@clave/shared';

/**
 * localStorage can be missing or throw (private mode, blocked storage). Every access is guarded;
 * the app keeps working without it, it just won't remember things.
 */
function read<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: nothing to persist to.
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable.
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const PROFILE_KEY = 'clave:profile';

export function loadProfile(): Profile | null {
  return read(PROFILE_KEY, (raw) => {
    if (!isRecord(raw)) return null;
    const { nickname, avatar, color } = raw;
    if (typeof nickname !== 'string' || typeof avatar !== 'number' || typeof color !== 'string')
      return null;
    if (!Number.isInteger(avatar) || avatar < 0 || avatar >= AVATAR_COUNT) return null;
    const known = AVATAR_COLORS.find((c) => c === color);
    return known ? { nickname, avatar, color: known } : null;
  });
}

export const saveProfile = (profile: Profile) => {
  write(PROFILE_KEY, profile);
};

/** Seat credentials per room (SPEC §2.4): what lets F5 put you back in your place. */
export interface Seat {
  playerId: string;
  token: string;
}

const seatKey = (code: string) => `clave:seat:${code}`;

export function loadSeat(code: string): Seat | null {
  return read(seatKey(code), (raw) =>
    isRecord(raw) && typeof raw.playerId === 'string' && typeof raw.token === 'string'
      ? { playerId: raw.playerId, token: raw.token }
      : null,
  );
}

export const saveSeat = (code: string, seat: Seat) => {
  write(seatKey(code), seat);
};
export const forgetSeat = (code: string) => {
  remove(seatKey(code));
};
