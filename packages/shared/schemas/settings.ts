import { z } from 'zod';

/** SPEC §1.7 options. 0 = timer off. */
export const CLUE_TIMER_OPTIONS = [0, 60, 90, 120, 180] as const;
export const GUESS_TIMER_OPTIONS = [0, 60, 90, 120] as const;
export const MAX_CUSTOM_WORDS = 400;
export const MAX_TEAM_NAME_LENGTH = 20;

const teamName = z.string().trim().max(MAX_TEAM_NAME_LENGTH);

/** Room configuration (SPEC §1.7). Every field has a default, so `{}` is a valid classic room. */
export const settingsSchema = z
  .object({
    mode: z.enum(['classic', 'coop']).default('classic'),
    deckIds: z.array(z.string().min(1).max(40)).max(10).default(['clasico']),
    customWords: z.array(z.string().min(1).max(14)).max(MAX_CUSTOM_WORDS).default([]),
    /** % of the 25 words taken from customWords when decks are also selected (ADR-018 §12). */
    customShare: z.number().int().min(0).max(100).default(50),
    clueTimer: z.literal(CLUE_TIMER_OPTIONS).default(0),
    guessTimer: z.literal(GUESS_TIMER_OPTIONS).default(0),
    /** +30 s on each team's first turn; only matters when a timer is on. */
    firstTurnBonus: z.boolean().default(true),
    revealMode: z.enum(['any', 'majority']).default('any'),
    objections: z.boolean().default(true),
    spectatorsSeeMap: z.boolean().default(false),
    compoundWords: z.boolean().default(false),
    chat: z.boolean().default(true),
    /** Empty = the UI's default name ("Equipo Rojo" / "Equipo Azul"). */
    teamNames: z
      .object({ red: teamName.default(''), blue: teamName.default('') })
      .strict()
      .default({ red: '', blue: '' }),
  })
  .strict();

export type Settings = z.infer<typeof settingsSchema>;

type Shape = typeof settingsSchema.shape;
type PatchShape = { [K in keyof Shape]: z.ZodOptional<ReturnType<Shape[K]['unwrap']>> };

/**
 * A partial update from the host's settings panel. Unlike `settingsSchema.partial()`, missing keys
 * stay missing instead of being filled with defaults, so a patch never resets other options.
 */
export const settingsPatchSchema = z
  .object(
    Object.fromEntries(
      Object.entries(settingsSchema.shape).map(([key, field]) => [key, field.unwrap().optional()]),
    ) as PatchShape,
  )
  .strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

const CUSTOM_WORD = /^\p{L}{2,14}$/u;

/** An account's public name (docs/specs/M9-cuentas.md §2): same rules as a nickname. */
export const displayNameSchema = z.object({ displayName: z.string().max(100) }).strict();

/**
 * Host-pasted words (SPEC §7): separated by commas or newlines. Kept: one word of 2–14 letters,
 * uppercased, without duplicates. Everything else comes back in `rejected` so the UI can say why.
 */
export function parseCustomWords(text: string): { words: string[]; rejected: string[] } {
  const words: string[] = [];
  const rejected: string[] = [];
  for (const raw of text.split(/[,\n]/u)) {
    const entry = raw.trim();
    if (entry === '') continue;
    if (!CUSTOM_WORD.test(entry)) {
      rejected.push(entry);
      continue;
    }
    const word = entry.toLocaleUpperCase('es-AR');
    if (!words.includes(word)) words.push(word);
  }
  return { words, rejected };
}
