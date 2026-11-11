import type { AccountView, RankingView } from '@clave/shared';
import { sessionToken } from './auth';
import { SERVER_URL } from './socket';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

/** The server's accounts API (docs/specs/M9-cuentas.md): reads, and the user's own changes. */
async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const token = await sessionToken();
    const res = await fetch(new URL(`/api${path}`, SERVER_URL), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export const getAccount = () => api<AccountView>('/me');
export const setDisplayName = (displayName: string) =>
  api<{ displayName: string }>('/me', { method: 'PUT', body: JSON.stringify({ displayName }) });
export const deleteAccount = () => api<{ deleted: boolean }>('/me', { method: 'DELETE' });
export const getRanking = () => api<RankingView>('/ranking');
