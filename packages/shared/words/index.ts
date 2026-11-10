import argento from './argento.json' with { type: 'json' };
import clasico from './clasico.json' with { type: 'json' };

export interface Deck {
  id: string;
  name: string;
  description: string;
  words: string[];
}

/** Built-in decks (SPEC §7). All words are original to this project. */
export const DECKS: readonly Deck[] = [clasico, argento];

export const getDeck = (id: string): Deck | undefined => DECKS.find((deck) => deck.id === id);
