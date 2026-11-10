import { useSyncExternalStore } from 'react';

export type Route = { name: 'home' } | { name: 'room'; code: string } | { name: 'notFound' };

/** Two routes only (SPEC §2.3): "/" and "/sala/:code". The History API is enough. */
export function parseRoute(pathname: string): Route {
  if (pathname === '/' || pathname === '') return { name: 'home' };
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
