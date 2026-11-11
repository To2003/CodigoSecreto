/**
 * Deck names and sizes without the words, for the settings panel. The web app imports only this,
 * so the full word lists stay out of its bundle. words.test.ts checks it matches the decks.
 */
export interface DeckInfo {
  id: string;
  name: string;
  count: number;
}

export const DECK_INFO: readonly DeckInfo[] = [
  { id: 'clasico', name: 'Clásico', count: 814 },
  { id: 'argento', name: 'Argento', count: 255 },
];
