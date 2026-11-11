import { GoTrueClient } from '@supabase/auth-js';

/**
 * Google sign-in through Supabase Auth (PKCE). This module is its own chunk: it only loads for
 * someone who signs in or already has a session (docs/specs/M9-cuentas.md §2). Only the Auth part
 * of Supabase: the game reads and writes through its own server.
 */
let client: GoTrueClient | null = null;

function auth(): GoTrueClient {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  client ??= new GoTrueClient({
    url: `${url}/auth/v1`,
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  });
  return client;
}

export async function accessToken(): Promise<string | null> {
  const { data } = await auth().getSession();
  return data.session?.access_token ?? null;
}

export async function signInWithGoogle(returnTo: string): Promise<void> {
  await auth().signInWithOAuth({ provider: 'google', options: { redirectTo: returnTo } });
}

export async function signOut(): Promise<void> {
  await auth().signOut();
}
