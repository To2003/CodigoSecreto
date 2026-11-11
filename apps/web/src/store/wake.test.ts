import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWake, wake, WAKE_RETRY_MS, WAKE_SLOW_MS, WAKE_TIMEOUT_MS, type WakeDeps } from './wake';

beforeEach(() => {
  vi.useFakeTimers();
  useWake.setState({ status: 'checking' });
});
afterEach(() => {
  vi.useRealTimers();
});

const deps = (fetch: WakeDeps['fetch']): WakeDeps => ({
  url: 'http://server/health',
  fetch,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
});

describe('wake (SPEC §0.4)', () => {
  it('a server that answers fast never shows the screen', async () => {
    const done = wake(deps(() => Promise.resolve({ ok: true })));
    await expect(done).resolves.toBe('awake');
    await vi.advanceTimersByTimeAsync(WAKE_SLOW_MS * 2);
    expect(useWake.getState().status).toBe('awake');
  });

  it('a slow answer shows "waking" after 1.5 s, then awake', async () => {
    let answer: (v: { ok: boolean }) => void = () => undefined;
    const done = wake(deps(() => new Promise((r) => (answer = r))));
    await vi.advanceTimersByTimeAsync(WAKE_SLOW_MS - 1);
    expect(useWake.getState().status).toBe('checking');
    await vi.advanceTimersByTimeAsync(1);
    expect(useWake.getState().status).toBe('waking');
    answer({ ok: true });
    await expect(done).resolves.toBe('awake');
  });

  it('retries on errors (Render answers 5xx while booting) and gives up after 90 s', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: false }));
    const done = wake(deps(fetch));
    await vi.advanceTimersByTimeAsync(WAKE_TIMEOUT_MS + WAKE_RETRY_MS);
    await expect(done).resolves.toBe('failed');
    expect(useWake.getState().status).toBe('failed');
    expect(fetch.mock.calls.length).toBeGreaterThan(20);
  });

  it('network errors count as "not up yet"', async () => {
    let calls = 0;
    const done = wake(
      deps(() => {
        calls += 1;
        return calls < 3 ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true });
      }),
    );
    await vi.advanceTimersByTimeAsync(WAKE_RETRY_MS * 3);
    await expect(done).resolves.toBe('awake');
    expect(calls).toBe(3);
  });

  it('a retry supersedes the previous attempt', async () => {
    const first = wake(deps(() => Promise.resolve({ ok: false })));
    const second = wake(deps(() => Promise.resolve({ ok: true })));
    await expect(second).resolves.toBe('awake');
    await vi.advanceTimersByTimeAsync(WAKE_TIMEOUT_MS + WAKE_RETRY_MS);
    await first;
    expect(useWake.getState().status).toBe('awake');
  });

  it('a retry after a failure keeps the screen up instead of flickering away', () => {
    useWake.setState({ status: 'failed' });
    const done = wake(deps(() => new Promise(() => undefined)));
    expect(useWake.getState().status).toBe('waking');
    void done;
  });
});
