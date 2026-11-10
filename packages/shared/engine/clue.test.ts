import { describe, expect, it } from 'vitest';
import { MAX_CLUE_LENGTH, normalizeWord, validateClue, wordForms } from './clue';

describe('normalizeWord', () => {
  it.each([
    ['Árbol', 'arbol'],
    ['PINGÜINO', 'pinguino'],
    ['Camión', 'camion'],
    ['ÑANDÚ', 'ñandu'],
    ['  Mate ', 'mate'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeWord(input)).toBe(expected);
  });

  it('keeps ñ distinct from n', () => {
    expect(normalizeWord('AÑO')).not.toBe(normalizeWord('ANO'));
  });
});

describe('wordForms (basic singular/plural)', () => {
  it.each([
    ['SOLES', ['soles', 'sole', 'sol']],
    ['GATOS', ['gatos', 'gato']],
    ['MES', ['mes']],
    ['PIES', ['pies', 'pie']],
    ['SOL', ['sol']],
  ])('%s', (word, forms) => {
    expect([...wordForms(word)].sort()).toEqual([...forms].sort());
  });
});

describe('validateClue', () => {
  const board = ['SOL', 'BANCO', 'GATO', 'ÁRBOL', 'AÑO', 'MES'];
  const ok = (word: string, opts = { allowCompound: false }) => validateClue(word, board, opts);

  it('accepts a valid single word', () => {
    expect(ok('PLAYA')).toEqual({ ok: true });
    expect(ok('Pingüino')).toEqual({ ok: true });
  });

  it.each([
    ['', 'EMPTY'],
    ['   ', 'EMPTY'],
    ['DOS PALABRAS', 'MULTIPLE_WORDS'],
    ['R2D2', 'NOT_LETTERS'],
    ['HOLA!', 'NOT_LETTERS'],
    ['A'.repeat(MAX_CLUE_LENGTH + 1), 'TOO_LONG'],
    ['MEDIA-LUNA', 'HYPHEN_NOT_ALLOWED'],
  ])('rejects %j with %s', (word, reason) => {
    expect(ok(word)).toMatchObject({ ok: false, reason });
  });

  it('accepts exactly the max length', () => {
    expect(ok('Z'.repeat(MAX_CLUE_LENGTH))).toEqual({ ok: true });
  });

  it('rejects a word on the board, ignoring case and accents', () => {
    expect(ok('arbol')).toEqual({ ok: false, reason: 'ON_BOARD', conflict: 'ÁRBOL' });
    expect(ok('Banco')).toMatchObject({ ok: false, reason: 'ON_BOARD' });
  });

  it('compares singular and plural', () => {
    expect(ok('GATOS')).toMatchObject({ ok: false, reason: 'ON_BOARD', conflict: 'GATO' });
    expect(ok('SOLES')).toMatchObject({ ok: false, conflict: 'SOL' });
    expect(ok('MESES')).toMatchObject({ ok: false, conflict: 'MES' });
  });

  it('rejects a clue that contains a board word (SPEC example: SOL / GIRASOL)', () => {
    expect(ok('GIRASOL')).toEqual({ ok: false, reason: 'CONTAINS_BOARD_WORD', conflict: 'SOL' });
    expect(ok('girasoles')).toMatchObject({ ok: false, reason: 'CONTAINS_BOARD_WORD' });
  });

  it('rejects a clue contained in a board word', () => {
    expect(ok('BAN')).toEqual({ ok: false, reason: 'CONTAINED_IN_BOARD_WORD', conflict: 'BANCO' });
  });

  it('keeps ñ distinct from n when comparing', () => {
    expect(validateClue('ANO', ['AÑO'], { allowCompound: false })).toEqual({ ok: true });
  });

  it('only checks the words it is given (callers pass unrevealed words)', () => {
    expect(validateClue('GATO', [], { allowCompound: false })).toEqual({ ok: true });
  });

  describe('with compound words allowed', () => {
    const compound = { allowCompound: true };
    it('accepts a hyphenated compound', () => {
      expect(ok('MEDIA-LUNA', compound)).toEqual({ ok: true });
    });

    it.each(['-LUNA', 'MEDIA-', 'MEDIA--LUNA'])('rejects malformed %s', (word) => {
      expect(ok(word, compound)).toMatchObject({ ok: false, reason: 'NOT_LETTERS' });
    });

    it('checks each part against the board', () => {
      expect(ok('GATO-MONTÉS', compound)).toMatchObject({ ok: false, conflict: 'GATO' });
    });
  });
});
