import { create } from 'zustand';

/**
 * Render's free server sleeps after ~15 min idle and takes 30–60 s to wake (SPEC §0.4).
 * `checking`: the first GET /health is on its way; `waking`: it's taking long, show the screen;
 * `awake`: answered; `failed`: 90 s without an answer, offer to retry.
 */
export type WakeStatus = 'checking' | 'waking' | 'awake' | 'failed';

export const useWake = create<{ status: WakeStatus }>()(() => ({ status: 'checking' }));

/** After this long without an answer, the "Despertando a los agentes…" screen shows up. */
export const WAKE_SLOW_MS = 1_500;
/** Give up (with a retry button) after this long. */
export const WAKE_TIMEOUT_MS = 90_000;
/** Pause between attempts when the server answers with an error (Render returns 5xx while booting). */
export const WAKE_RETRY_MS = 3_000;

export interface WakeDeps {
  url: string;
  fetch: (url: string, init: RequestInit) => Promise<{ ok: boolean }>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

let generation = 0;

/** AbortSignal.timeout, or the same by hand where it's missing (Safari < 16). */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
  }, ms);
  return controller.signal;
}

/** Pings /health until it answers or 90 s pass. Calling it again (Reintentar) starts over. */
export async function wake(deps: WakeDeps): Promise<WakeStatus> {
  generation += 1;
  const mine = generation;
  const current = () => mine === generation;
  const start = deps.now();
  // A retry after a failure keeps the screen up ("waking"): no flicker, focus stays on it.
  useWake.setState({ status: useWake.getState().status === 'failed' ? 'waking' : 'checking' });
  const slow = setTimeout(() => {
    if (current() && useWake.getState().status === 'checking')
      useWake.setState({ status: 'waking' });
  }, WAKE_SLOW_MS);
  try {
    while (deps.now() - start < WAKE_TIMEOUT_MS) {
      const left = WAKE_TIMEOUT_MS - (deps.now() - start);
      try {
        const res = await deps.fetch(deps.url, {
          cache: 'no-store',
          signal: timeoutSignal(Math.max(1_000, left)),
        });
        if (!current()) return useWake.getState().status;
        if (res.ok) {
          useWake.setState({ status: 'awake' });
          return 'awake';
        }
      } catch {
        // Network error or timeout: the server isn't up yet. Try again below.
      }
      if (!current()) return useWake.getState().status;
      await deps.sleep(WAKE_RETRY_MS);
    }
    if (current()) useWake.setState({ status: 'failed' });
    return 'failed';
  } finally {
    clearTimeout(slow);
  }
}
