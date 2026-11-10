import type { Settings } from '../schemas/settings';
import { getDeck } from '../words';
import { normalizeWord } from './clue';
import { randomId, shuffle, type Rng } from './rng';
import {
  otherTeam,
  TEAMS,
  type ActionResult,
  type Card,
  type CardType,
  type EnginePlayer,
  type GameState,
  type Team,
} from './types';

export const BOARD_SIZE = 25;
const CIVILIANS = 7;

/** Unique by normalized form, keeping the first spelling. */
function unique(words: readonly string[]): string[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = normalizeWord(word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Shuffled, words outside `exclude` first: the previous game's words are a last resort (SPEC §7). */
function preferFresh(words: readonly string[], exclude: Set<string>, rng: Rng): string[] {
  const shuffled = shuffle(words, rng);
  const fresh = shuffled.filter((w) => !exclude.has(normalizeWord(w)));
  const stale = shuffled.filter((w) => exclude.has(normalizeWord(w)));
  return [...fresh, ...stale];
}

/** The 25 board words, or null when the decks and custom words don't add up to 25 (ADR-018 §12). */
export function chooseWords(
  settings: Settings,
  rng: Rng,
  excludeWords: readonly string[] = [],
): string[] | null {
  const exclude = new Set(excludeWords.map(normalizeWord));
  const custom = unique(settings.customWords.map((w) => w.trim().toLocaleUpperCase('es-AR')));
  const deckWords = unique(settings.deckIds.flatMap((id) => getDeck(id)?.words ?? []));

  const wantCustom =
    deckWords.length === 0
      ? BOARD_SIZE
      : Math.min(custom.length, Math.round((BOARD_SIZE * settings.customShare) / 100));

  const chosen = preferFresh(custom, exclude, rng).slice(0, wantCustom);
  const taken = new Set(chosen.map(normalizeWord));
  const fromDecks = deckWords.filter((word) => !taken.has(normalizeWord(word)));
  chosen.push(...preferFresh(fromDecks, exclude, rng).slice(0, BOARD_SIZE - chosen.length));
  return chosen.length === BOARD_SIZE ? chosen : null;
}

/** Classic mode needs exactly one spymaster and at least one agent per team (ADR-018 §13). */
function teamsReady(players: readonly EnginePlayer[]): boolean {
  return TEAMS.every((team) => {
    const members = players.filter((p) => p.team === team);
    const spymasters = members.filter((p) => p.role === 'spymaster').length;
    return spymasters === 1 && members.length - spymasters >= 1;
  });
}

export function createGame(
  players: readonly EnginePlayer[],
  settings: Settings,
  rng: Rng,
  excludeWords: readonly string[] = [],
): ActionResult {
  if (settings.mode !== 'classic') return { ok: false, error: { code: 'MODE_NOT_AVAILABLE' } };
  if (!teamsReady(players)) return { ok: false, error: { code: 'TEAMS_INCOMPLETE' } };

  const words = chooseWords(settings, rng, excludeWords);
  if (!words) return { ok: false, error: { code: 'NOT_ENOUGH_WORDS' } };

  const startingTeam: Team = rng() < 0.5 ? 'red' : 'blue';
  const types: CardType[] = shuffle(
    [
      ...Array<CardType>(9).fill(startingTeam),
      ...Array<CardType>(8).fill(otherTeam(startingTeam)),
      ...Array<CardType>(CIVILIANS).fill('civilian'),
      'traitor',
    ],
    rng,
  );

  const ids = new Set<string>();
  const cards: Card[] = shuffle(words, rng).map((word, i) => {
    let id = randomId(rng);
    while (ids.has(id)) id = randomId(rng);
    ids.add(id);
    // `types` and `words` both hold BOARD_SIZE entries.
    return { id, word, type: types[i] as CardType, revealed: false };
  });

  const state: GameState = {
    settings,
    // Spectators never act; their role is irrelevant, so normalize it.
    players: players.map((p) => ({ ...p, role: p.team === 'spectator' ? 'agent' : p.role })),
    cards,
    startingTeam,
    phase: { name: 'clue', team: startingTeam },
    clues: [],
    points: {},
    teamTurns: { red: 0, blue: 0, [startingTeam]: 1 },
  };
  return { ok: true, state, events: [{ type: 'GAME_STARTED', startingTeam }] };
}

/** Next player of each team (in join order) becomes spymaster (SPEC §9, ADR-018 §11). */
export function rotateSpymasters(players: readonly EnginePlayer[]): EnginePlayer[] {
  return players.map((p) => {
    if (p.team === 'spectator') return p;
    const members = players.filter((m) => m.team === p.team);
    const current = members.findIndex((m) => m.role === 'spymaster');
    const successor = (current + 1) % members.length;
    return { ...p, role: members.indexOf(p) === successor ? 'spymaster' : 'agent' };
  });
}
