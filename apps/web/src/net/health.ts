import { HEALTH_PATH } from '@clave/shared';
import { wake } from '../store/wake';
import { SERVER_URL } from './socket';

/** GET /health right away, so a sleeping server starts waking while the user reads (SPEC §0.4). */
export function wakeServer() {
  void wake({
    url: new URL(HEALTH_PATH, SERVER_URL).toString(),
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
  });
}
