export interface ServerConfig {
  port: number;
  /** Normalized origins (scheme://host[:port], lowercase, no trailing slash). */
  clientOrigins: string[];
  logLevel: string;
  /** Proxies whose X-Forwarded-For entry is trusted for the client's IP (Render: 1). */
  trustProxyHops: number;
  /** Rooms one IP may create per minute (BACKLOG #4). */
  roomsPerMinute: number;
  /** Accounts (docs/specs/M9-cuentas.md §7): off, in memory (dev/E2E) or Supabase. */
  auth:
    { mode: 'off' } | { mode: 'memory' } | { mode: 'supabase'; url: string; serviceKey: string };
  /** Stats count games at least this long. */
  statsMinGameMs: number;
}

export type ConfigResult = { ok: true; config: ServerConfig } | { ok: false; error: string };

const DEFAULT_ORIGIN = 'http://localhost:5173';

/**
 * Reads the server's environment. Origins go through `new URL().origin` so that
 * "https://Clave.example/" and "https://clave.example" are the same entry: a mismatch here would
 * reject every browser connection with no hint in the UI.
 */
export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const portRaw = env.PORT ?? '3001';
  const port = Number(portRaw);
  if (!/^\d+$/.test(portRaw) || port < 1 || port > 65535) {
    return { ok: false, error: `PORT must be an integer between 1 and 65535, got "${portRaw}"` };
  }

  const entries = (env.CLIENT_ORIGIN ?? DEFAULT_ORIGIN)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return { ok: false, error: 'CLIENT_ORIGIN has no origins' };

  const clientOrigins: string[] = [];
  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return { ok: false, error: `CLIENT_ORIGIN entry is not a URL: "${entry}"` };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: `CLIENT_ORIGIN entry must be http(s): "${entry}"` };
    }
    if (!clientOrigins.includes(url.origin)) clientOrigins.push(url.origin);
  }

  const hopsRaw = env.TRUST_PROXY_HOPS ?? '0';
  const trustProxyHops = Number(hopsRaw);
  if (!/^\d$/.test(hopsRaw) || trustProxyHops > 5) {
    return { ok: false, error: `TRUST_PROXY_HOPS must be 0 to 5, got "${hopsRaw}"` };
  }

  const roomsRaw = env.ROOMS_PER_MINUTE ?? '10';
  const roomsPerMinute = Number(roomsRaw);
  if (!/^\d+$/.test(roomsRaw) || roomsPerMinute < 1) {
    return { ok: false, error: `ROOMS_PER_MINUTE must be a positive integer, got "${roomsRaw}"` };
  }

  const minRaw = env.STATS_MIN_GAME_SECONDS ?? '300';
  if (!/^\d+$/.test(minRaw)) {
    return { ok: false, error: `STATS_MIN_GAME_SECONDS must be a whole number, got "${minRaw}"` };
  }

  // Never echo SUPABASE_SERVICE_ROLE_KEY back in an error: only say whether it's there.
  const mode = env.AUTH_MODE ?? 'off';
  let auth: ServerConfig['auth'];
  if (mode === 'off') auth = { mode: 'off' };
  else if (mode === 'memory') {
    if (env.NODE_ENV === 'production') {
      return {
        ok: false,
        error: 'AUTH_MODE=memory is for development only, not with NODE_ENV=production',
      };
    }
    auth = { mode: 'memory' };
  } else if (mode === 'supabase') {
    const url = env.SUPABASE_URL?.trim() ?? '';
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
    if (!/^https:\/\/[^/]+$/.test(url.replace(/\/+$/, ''))) {
      return {
        ok: false,
        error: 'AUTH_MODE=supabase needs SUPABASE_URL (https://<project>.supabase.co)',
      };
    }
    if (serviceKey === '') {
      return { ok: false, error: 'AUTH_MODE=supabase needs SUPABASE_SERVICE_ROLE_KEY (not set)' };
    }
    auth = { mode: 'supabase', url, serviceKey };
  } else {
    return { ok: false, error: `AUTH_MODE must be off, memory or supabase, got "${mode}"` };
  }

  return {
    ok: true,
    config: {
      port,
      clientOrigins,
      logLevel: env.LOG_LEVEL ?? 'info',
      trustProxyHops,
      roomsPerMinute,
      auth,
      statsMinGameMs: Number(minRaw) * 1000,
    },
  };
}
