import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'room'; code: string }
  /** Modo mesa (SPEC §12 M9.2): the room on a big screen. */
  | { name: 'table'; code: string }
  | { name: 'rules' }
  | { name: 'tutorial' }
  /** Optional accounts (docs/specs/M9-cuentas.md). */
  | { name: 'account' }
  | { name: 'ranking' }
  | { name: 'privacy' }
  | { name: 'notFound' };

/** "/", "/sala/:code" (SPEC §2.3), "/reglas" and "/tutorial" (SPEC §8). The History API is enough. */
export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'home' };
  if (/^\/reglas\/?$/u.test(pathname)) return { name: 'rules' };
  if (/^\/tutorial\/?$/u.test(pathname)) return { name: 'tutorial' };
  if (/^\/cuenta\/?$/u.test(pathname)) return { name: 'account' };
  if (/^\/ranking\/?$/u.test(pathname)) return { name: 'ranking' };
  if (/^\/privacidad\/?$/u.test(pathname)) return { name: 'privacy' };
  const table = /^\/sala\/([A-Za-z]{4})\/mesa\/?$/u.exec(pathname);
  if (table?.[1]) return { name: 'table', code: table[1].toUpperCase() };
  const room = /^\/sala\/([A-Za-z]{4})\/?$/u.exec(pathname);
  if (room?.[1]) return { name: 'room', code: room[1].toUpperCase() };
  return { name: 'notFound' };
}

const listeners = new Set<() => void>();
const notify = () => {
  for (const l of listeners) l();
};

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  notify();
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      window.addEventListener('popstate', listener);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('popstate', listener);
      };
    },
    () => window.location.pathname,
  );
  return parseRoute(pathname);
}

export const roomPath = (code: string) => `/sala/${code}`;
export const tablePath = (code: string) => `/sala/${code}/mesa`;
