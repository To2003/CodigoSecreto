import type { IncomingHttpHeaders } from 'node:http';

/** Per-IP limits (SPEC §2.5, BACKLOG #4). Per-socket limits alone are beaten by opening sockets. */
export interface IpLimitOptions {
  /** Open sockets per IP. A family or a school shares one IP: generous, but finite. */
  socketsPerIp: number;
  /** Rooms one IP may create per window. */
  roomsPerWindow: number;
  /** Joins to codes that don't exist per window: past this, every join is refused until the
   * window ends (23⁴ codes can't be swept from one IP). */
  failedJoinsPerWindow: number;
  windowMs: number;
}

export const DEFAULT_IP_LIMITS: IpLimitOptions = {
  socketsPerIp: 30,
  roomsPerWindow: 10,
  failedJoinsPerWindow: 20,
  windowMs: 60_000,
};

/**
 * The client's IP. Behind a proxy (Render) the socket address is the proxy's, so the real one is
 * read from X-Forwarded-For, counting `trustedHops` from the right: entries further left were
 * written by the client and can be forged. With 0 hops the header is ignored.
 */
export function clientIp(
  address: string,
  headers: IncomingHttpHeaders,
  trustedHops: number,
): string {
  if (trustedHops <= 0) return address;
  const raw = headers['x-forwarded-for'];
  const list = (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list[list.length - trustedHops] ?? address;
}

type Counter = 'rooms' | 'failedJoins';

/** Counts per IP in fixed windows. `prune` drops stale entries so the maps can't grow forever. */
export class IpLimiter {
  private readonly sockets = new Map<string, number>();
  private readonly windows = new Map<
    string,
    { start: number; rooms: number; failedJoins: number }
  >();

  constructor(
    private readonly options: IpLimitOptions,
    private readonly now: () => number,
  ) {}

  /** Registers a socket; false when that IP already has too many open. */
  openSocket(ip: string): boolean {
    const open = this.sockets.get(ip) ?? 0;
    if (open >= this.options.socketsPerIp) return false;
    this.sockets.set(ip, open + 1);
    return true;
  }

  closeSocket(ip: string) {
    const open = (this.sockets.get(ip) ?? 1) - 1;
    if (open <= 0) this.sockets.delete(ip);
    else this.sockets.set(ip, open);
  }

  private window(ip: string) {
    const t = this.now();
    let w = this.windows.get(ip);
    if (!w || t - w.start >= this.options.windowMs) {
      w = { start: t, rooms: 0, failedJoins: 0 };
      this.windows.set(ip, w);
    }
    return w;
  }

  private max(counter: Counter) {
    return counter === 'rooms' ? this.options.roomsPerWindow : this.options.failedJoinsPerWindow;
  }

  /** True while this IP is still under the limit for `counter` in the current window. */
  allows(ip: string, counter: Counter): boolean {
    return this.window(ip)[counter] < this.max(counter);
  }

  count(ip: string, counter: Counter) {
    this.window(ip)[counter] += 1;
  }

  prune() {
    const t = this.now();
    for (const [ip, w] of this.windows) {
      if (t - w.start >= this.options.windowMs) this.windows.delete(ip);
    }
  }
}
