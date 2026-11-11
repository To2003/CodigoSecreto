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

/** Private, loopback, link-local and carrier-grade NAT ranges: never a player's public address. */
function isPrivate(ip: string): boolean {
  if (ip.includes(':')) return /^(::1$|f[cd]|fe[89ab])/i.test(ip);
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * The key limits are counted under. IPv4-mapped IPv6 becomes plain IPv4; any other IPv6 address
 * counts by its /64, since one home or phone usually gets a whole /64 and could rotate within it.
 */
export function limitKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/**
 * The client's IP, as a limit key. Behind a proxy (Render) the socket address is the proxy's, so
 * the real one is read from X-Forwarded-For, counting `trustedHops` from the right: entries further
 * left were written by the client and can be forged. With 0 hops the header is ignored.
 * Null means "can't tell who this is" (behind a proxy, the chosen entry is missing or private:
 * the hop count is wrong for this host). Limits then don't apply rather than lumping every player
 * under the proxy's address (M8 review).
 */
export function clientIp(
  address: string,
  headers: IncomingHttpHeaders,
  trustedHops: number,
): string | null {
  if (trustedHops <= 0) return limitKey(address);
  const chosen = forwardedFor(headers)[forwardedFor(headers).length - trustedHops];
  if (!chosen || isPrivate(limitKey(chosen))) return null;
  return limitKey(chosen);
}

function forwardedFor(headers: IncomingHttpHeaders): string[] {
  const raw = headers['x-forwarded-for'];
  return (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * What the proxy chain looks like, without any address in it (addresses are personal data): how
 * many X-Forwarded-For entries arrive and whether the trusted one looks like a player's. Logged
 * once at startup traffic so the deploy can confirm TRUST_PROXY_HOPS (docs/DEPLOY.md §4).
 */
export function proxyDiagnosis(headers: IncomingHttpHeaders, trustedHops: number) {
  const list = forwardedFor(headers);
  const chosen = trustedHops > 0 ? list[list.length - trustedHops] : undefined;
  return {
    forwardedEntries: list.length,
    trustedHops,
    chosenEntry: chosen === undefined ? 'none' : isPrivate(limitKey(chosen)) ? 'private' : 'public',
  };
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

  /** Registers a socket; false when that IP already has too many open. Unknown IPs pass. */
  openSocket(ip: string | null): boolean {
    if (ip === null) return true;
    const open = this.sockets.get(ip) ?? 0;
    if (open >= this.options.socketsPerIp) return false;
    this.sockets.set(ip, open + 1);
    return true;
  }

  closeSocket(ip: string | null) {
    if (ip === null) return;
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
  allows(ip: string | null, counter: Counter): boolean {
    if (ip === null) return true;
    return this.window(ip)[counter] < this.max(counter);
  }

  count(ip: string | null, counter: Counter) {
    if (ip === null) return;
    this.window(ip)[counter] += 1;
  }

  prune() {
    const t = this.now();
    for (const [ip, w] of this.windows) {
      if (t - w.start >= this.options.windowMs) this.windows.delete(ip);
    }
  }
}
