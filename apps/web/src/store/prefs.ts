import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { audio, type Volumes } from '../audio/engine';

/** Personal settings (SPEC §3.1 "Ajustes"). Persisted per browser; volumes join in M6. */
export interface Prefs {
  colorBlind: boolean;
  reduceMotion: boolean;
  cardText: 'sm' | 'md' | 'lg';
  vibration: boolean;
  /** First-time tips (SPEC §8.3), can be turned off. */
  tips: boolean;
  /** 0–1 per channel (SPEC §6.4). */
  volumes: Volumes;
}

export const DEFAULT_PREFS: Prefs = {
  colorBlind: false,
  reduceMotion: false,
  cardText: 'md',
  vibration: true,
  tips: true,
  volumes: { master: 0.8, music: 0.4, effects: 0.8 },
};

/** Music starts off on phones, effects on (SPEC §6.3). */
const defaultPrefs = (): Prefs => {
  const phone = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return phone
    ? { ...DEFAULT_PREFS, volumes: { ...DEFAULT_PREFS.volumes, music: 0 } }
    : DEFAULT_PREFS;
};

const volume = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

const KEY = 'clave:prefs';

/** Reads stored prefs, keeping only known keys with the right types. */
export function parsePrefs(raw: unknown, defaults: Prefs = DEFAULT_PREFS): Prefs {
  const prefs = { ...defaults, volumes: { ...defaults.volumes } };
  if (typeof raw !== 'object' || raw === null) return prefs;
  const r = raw as Record<string, unknown>;
  if (typeof r.colorBlind === 'boolean') prefs.colorBlind = r.colorBlind;
  if (typeof r.reduceMotion === 'boolean') prefs.reduceMotion = r.reduceMotion;
  if (typeof r.vibration === 'boolean') prefs.vibration = r.vibration;
  if (typeof r.tips === 'boolean') prefs.tips = r.tips;
  if (r.cardText === 'sm' || r.cardText === 'md' || r.cardText === 'lg')
    prefs.cardText = r.cardText;
  if (typeof r.volumes === 'object' && r.volumes !== null) {
    const v = r.volumes as Record<string, unknown>;
    prefs.volumes = {
      master: volume(v.master, prefs.volumes.master),
      music: volume(v.music, prefs.volumes.music),
      effects: volume(v.effects, prefs.volumes.effects),
    };
  }
  return prefs;
}

function load(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    return parsePrefs(raw === null ? null : JSON.parse(raw), defaultPrefs());
  } catch {
    return defaultPrefs();
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
  audio.setVolumes(prefs.volumes);
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

// Module-level, so every component shares one stable subscription function.
function subscribeSystemMotion(onChange: () => void) {
  const query = reducedMotionQuery();
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}
const systemReducesMotion = () => reducedMotionQuery().matches;

/** True when animations must be reduced: system setting or the "Ajustes" toggle. */
export function useReducedMotion(): boolean {
  const system = useSyncExternalStore(subscribeSystemMotion, systemReducesMotion);
  return usePrefs((p) => p.reduceMotion) || system;
}
