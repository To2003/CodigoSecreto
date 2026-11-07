export interface ServerConfig {
  port: number;
  /** Normalized origins (scheme://host[:port], lowercase, no trailing slash). */
  clientOrigins: string[];
  logLevel: string;
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

  return { ok: true, config: { port, clientOrigins, logLevel: env.LOG_LEVEL ?? 'info' } };
}
