import { SERVER_URL } from './socket';

/**
 * Optional accounts on the client (docs/specs/M9-cuentas.md). Guests never load any of this.
 * `supabase`: Google through Supabase Auth (lazy chunk). `memory`: development/E2E sign-in by
 * name against the server's AUTH_MODE=memory. `off`: no accounts at all.
 */
export type AuthMode = 'off' | 'memory' | 'supabase';

const env = import.meta.env;
export const authMode: AuthMode =
  env.VITE_AUTH_MODE === 'memory' || env.VITE_AUTH_MODE === 'off'
    ? env.VITE_AUTH_MODE
    : env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
      ? 'supabase'
      : 'off';
export const accountsEnabled = authMode !== 'off';

/** Set while there's a session, so guests never load the Supabase chunk. */
const SESSION_FLAG = 'clave:session';
const DEV_TOKEN = 'clave:dev-token';

const storage = {
  get: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Storage unavailable: the session just won't survive a reload.
    }
  },
};

/** Coming back from Google: Supabase's PKCE callback carries a `code`. */
const returningFromSignIn = () => new URLSearchParams(window.location.search).has('code');

/** Whether this browser looks signed in, without loading anything (the landing's "Mi cuenta"). */
export function hasSession(): boolean {
  if (authMode === 'memory') return storage.get(DEV_TOKEN) !== null;
  if (authMode === 'supabase') return storage.get(SESSION_FLAG) !== null;
  return false;
}

/** The current session token, or null for guests. Cheap for guests: nothing loads. */
export async function sessionToken(): Promise<string | null> {
  if (authMode === 'memory') return storage.get(DEV_TOKEN);
  if (authMode !== 'supabase') return null;
  if (storage.get(SESSION_FLAG) === null && !returningFromSignIn()) return null;
  try {
    const { accessToken } = await import('./supabaseAuth');
    const token = await accessToken();
    storage.set(SESSION_FLAG, token ? '1' : null);
    return token;
  } catch (err) {
    console.warn('Clave: no se pudo leer la sesión', err);
    return null;
  }
}

/** Starts signing in. Google leaves the page and comes back to `returnTo`. */
export async function signIn(options: { returnTo: string; name?: string }): Promise<boolean> {
  if (authMode === 'memory') {
    const res = await fetch(new URL('/api/dev/login', SERVER_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: options.name ?? '' }),
    });
    if (!res.ok) return false;
    const { token } = (await res.json()) as { token: string };
    storage.set(DEV_TOKEN, token);
    return true;
  }
  if (authMode !== 'supabase') return false;
  storage.set(SESSION_FLAG, '1');
  const { signInWithGoogle } = await import('./supabaseAuth');
  await signInWithGoogle(options.returnTo);
  return true;
}

export async function signOut(): Promise<void> {
  if (authMode === 'memory') storage.set(DEV_TOKEN, null);
  if (authMode === 'supabase' && storage.get(SESSION_FLAG) !== null) {
    const auth = await import('./supabaseAuth');
    await auth.signOut();
  }
  storage.set(SESSION_FLAG, null);
}
