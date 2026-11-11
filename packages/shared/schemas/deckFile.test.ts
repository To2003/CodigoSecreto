import { describe, expect, it } from 'vitest';
import { deckFile, MAX_DECK_FILE_BYTES, readDeckFile } from './deckFile';

describe('community deck files (M9.4)', () => {
  it('round-trips a deck', () => {
    const text = JSON.stringify(deckFile('Asado', ['CHORI', 'VACÍO', 'MOLLEJA']));
    expect(readDeckFile(text)).toEqual({
      name: 'Asado',
      words: ['CHORI', 'VACÍO', 'MOLLEJA'],
      rejected: [],
    });
  });

  it('applies the same word rules as typing them', () => {
    const text = JSON.stringify(deckFile('Mezcla', ['mate', 'dos palabras', 'X', 'MATE', 'r2d2']));
    expect(readDeckFile(text)).toEqual({
      name: 'Mezcla',
      words: ['MATE'],
      rejected: ['dos palabras', 'X', 'r2d2'],
    });
  });

  it('refuses anything that is not a Clave deck', () => {
    expect(readDeckFile('no es json')).toBeNull();
    expect(readDeckFile(JSON.stringify({ words: ['A'] }))).toBeNull();
    expect(readDeckFile(JSON.stringify({ ...deckFile('X', ['MATE']), extra: 1 }))).toBeNull();
    expect(readDeckFile(JSON.stringify({ ...deckFile('X', ['MATE']), version: 2 }))).toBeNull();
    expect(readDeckFile(JSON.stringify(deckFile('X', [])))).toBeNull();
    expect(readDeckFile(' '.repeat(MAX_DECK_FILE_BYTES + 1))).toBeNull();
  });
});
