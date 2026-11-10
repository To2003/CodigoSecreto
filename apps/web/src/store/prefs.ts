import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/** Personal settings (SPEC §3.1 "Ajustes"). Persisted per browser; volumes join in M6. */
export interface Prefs {
  colorBlind: boolean;
  reduceMotion: boolean;
  cardText: 'sm' | 'md' | 'lg';
  vibration: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  colorBlind: false,
  reduceMotion: false,
  cardText: 'md',
  vibration: true,
};

const KEY = 'clave:prefs';

/** Reads stored prefs, keeping only known keys with the right types. */
export function parsePrefs(raw: unknown): Prefs {
  const prefs = { ...DEFAULT_PREFS };
  if (typeof raw !== 'object' || raw === null) return prefs;
  const r = raw as Record<string, unknown>;
  if (typeof r.colorBlind === 'boolean') prefs.colorBlind = r.colorBlind;
  if (typeof r.reduceMotion === 'boolean') prefs.reduceMotion = r.reduceMotion;
  if (typeof r.vibration === 'boolean') prefs.vibration = r.vibration;
  if (r.cardText === 'sm' || r.cardText === 'md' || r.cardText === 'lg')
    prefs.cardText = r.cardText;
  return prefs;
}

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return parsePrefs(raw === null ? null : JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

const reducedMotionQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');

/** Mirrors prefs onto <html> data attributes, which the CSS tokens and animations read. */
function apply(prefs: Prefs) {
  const root = document.documentElement;
  root.dataset.colorblind = String(prefs.colorBlind);
  root.dataset.reduceMotion = String(prefs.reduceMotion);
  // Reduced motion = the system setting OR the "Ajustes" toggle (SPEC §4).
  root.dataset.motion = prefs.reduceMotion || reducedMotionQuery().matches ? 'reduce' : 'full';
  root.dataset.cardText = prefs.cardText;
}

export const usePrefs = create<Prefs>()(() => load());

export function setPrefs(patch: Partial<Prefs>) {
  usePrefs.setState(patch);
  const prefs = usePrefs.getState();
  apply(prefs);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: the change still applies to this tab.
  }
}

export function initPrefs() {
  apply(usePrefs.getState());
  reducedMotionQuery().addEventListener('change', () => {
    apply(usePrefs.getState());
  });
}

/** True when animations must be reduced: system setting or the "Ajustes" toggle. */
export function useReducedMotion(): boolean {
  const system = useSyncExternalStore(
    (onChange) => {
      const query = reducedMotionQuery();
      query.addEventListener('change', onChange);
      return () => {
        query.removeEventListener('change', onChange);
      };
    },
    () => reducedMotionQuery().matches,
  );
  return usePrefs((p) => p.reduceMotion) || system;
}
