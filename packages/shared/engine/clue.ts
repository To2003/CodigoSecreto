/** SPEC §1.6: one word, letters only, at most 24 characters. */
export const MAX_CLUE_LENGTH = 24;

export type ClueRejection =
  | 'EMPTY'
  | 'MULTIPLE_WORDS'
  | 'TOO_LONG'
  | 'HYPHEN_NOT_ALLOWED'
  | 'NOT_LETTERS'
  | 'ON_BOARD'
  | 'CONTAINS_BOARD_WORD'
  | 'CONTAINED_IN_BOARD_WORD';

export type ClueValidation = { ok: true } | { ok: false; reason: ClueRejection; conflict?: string };

const ENYE = '';

/** Lowercase, no accents or diaeresis; ñ stays distinct from n (SPEC §1.6). */
export function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replaceAll('ñ', ENYE)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll(ENYE, 'ñ');
}

/**
 * The normalized word plus its basic singular forms: without a final "s" or "es", only when at
 * least 3 letters remain (so "MES" never shrinks to "ME"). ADR-018 §5.
 */
export function wordForms(word: string): Set<string> {
  const base = normalizeWord(word);
  const forms = new Set([base]);
  if (base.endsWith('s') && base.length - 1 >= 3) forms.add(base.slice(0, -1));
  if (base.endsWith('es') && base.length - 2 >= 3) forms.add(base.slice(0, -2));
  return forms;
}

const LETTERS = /^\p{L}+$/u;
const COMPOUND = /^\p{L}+(-\p{L}+)+$/u;

/**
 * Automatic clue checks (SPEC §1.6). `boardWords` must be the unrevealed words only.
 * The UI runs this live; the server runs it again before accepting a clue.
 */
export function validateClue(
  word: string,
  boardWords: readonly string[],
  { allowCompound }: { allowCompound: boolean },
): ClueValidation {
  const clue = word.trim();
  if (clue === '') return { ok: false, reason: 'EMPTY' };
  if (/\s/u.test(clue)) return { ok: false, reason: 'MULTIPLE_WORDS' };
  // NFC so an accented letter typed as two code points counts once.
  if (clue.normalize('NFC').length > MAX_CLUE_LENGTH) return { ok: false, reason: 'TOO_LONG' };
  if (clue.includes('-')) {
    if (!allowCompound) return { ok: false, reason: 'HYPHEN_NOT_ALLOWED' };
    if (!COMPOUND.test(clue)) return { ok: false, reason: 'NOT_LETTERS' };
  } else if (!LETTERS.test(clue)) {
    return { ok: false, reason: 'NOT_LETTERS' };
  }

  // The whole clue (hyphens dropped) and, for compounds, each part.
  const parts = clue.includes('-') ? [clue.replaceAll('-', ''), ...clue.split('-')] : [clue];
  const clueForms = parts.flatMap((part) => [...wordForms(part)]);
  const board = boardWords.map((boardWord) => ({ boardWord, forms: [...wordForms(boardWord)] }));

  const find = (test: (clueForm: string, boardForm: string) => boolean) =>
    board.find(({ forms }) => forms.some((b) => clueForms.some((c) => test(c, b))))?.boardWord;

  const equal = find((c, b) => c === b);
  if (equal !== undefined) return { ok: false, reason: 'ON_BOARD', conflict: equal };
  const contains = find((c, b) => c.includes(b));
  if (contains !== undefined)
    return { ok: false, reason: 'CONTAINS_BOARD_WORD', conflict: contains };
  const contained = find((c, b) => b.includes(c));
  if (contained !== undefined) {
    return { ok: false, reason: 'CONTAINED_IN_BOARD_WORD', conflict: contained };
  }
  return { ok: true };
}
