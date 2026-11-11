import { z } from 'zod';
import { MAX_CUSTOM_WORDS, parseCustomWords } from './settings';

/**
 * Community decks (SPEC §12 M9.4): the host exports the room's own words as a JSON file and
 * anyone can import it in another room. The words go through the same rules as typed ones.
 */
export const DECK_FILE_FORMAT = 'clave-deck';
export const MAX_DECK_FILE_BYTES = 64_000;

export const deckFileSchema = z
  .object({
    format: z.literal(DECK_FILE_FORMAT),
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    words: z.array(z.string().max(60)).min(1).max(MAX_CUSTOM_WORDS),
  })
  .strict();
export type DeckFile = z.infer<typeof deckFileSchema>;

export function deckFile(name: string, words: readonly string[]): DeckFile {
  return { format: DECK_FILE_FORMAT, version: 1, name, words: [...words] };
}

/** Reads an imported file's text: the valid words, the ones that didn't pass, or null. */
export function readDeckFile(
  text: string,
): { name: string; words: string[]; rejected: string[] } | null {
  if (text.length > MAX_DECK_FILE_BYTES) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = deckFileSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { words, rejected } = parseCustomWords(parsed.data.words.join('\n'));
  return { name: parsed.data.name, words, rejected };
}
