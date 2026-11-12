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

/** Marks history entries reached by navigating inside the app (not typed, not from Google). */
const IN_APP = { clave: true } as const;

export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState(IN_APP, '', path);
  notify();
}

/**
 * "← Volver" (ADR-035): back to the previous screen when we came from one of ours; to the home
 * page when this page was opened directly (a shared link, a bookmark, coming back from Google).
 */
export function goBack() {
  const state: unknown = window.history.state;
  if (typeof state === 'object' && state !== null && 'clave' in state) window.history.back();
  else navigate('/');
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
