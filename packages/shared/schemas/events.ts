import { z } from 'zod';
import { settingsPatchSchema } from './settings';

export const MAX_NICKNAME_LENGTH = 20;
export const MAX_PLAYERS = 16;
export const AVATAR_COUNT = 12;
/** Accessory colors for avatars (SPEC §3.1). Names are ids; the UI maps them to tokens. */
export const AVATAR_COLORS = ['oro', 'turquesa', 'violeta', 'coral', 'lima', 'pizarra'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** No O, I or L: they read like 0, 1 or each other (SPEC §2.3). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));

/**
 * SPEC §2.5: no HTML, no control characters, single spaces, at most 20 characters.
 * React escapes output anyway; this keeps names readable in logs and other clients.
 */
export function sanitizeNickname(raw: string): string {
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}<>]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_NICKNAME_LENGTH).join('').trim();
}

const id = z.string().min(1).max(64);

const profile = z
  .object({
    nickname: z.string().max(100),
    avatar: z
      .number()
      .int()
      .min(0)
      .max(AVATAR_COUNT - 1),
    color: z.enum(AVATAR_COLORS),
  })
  .strict();
export type Profile = z.infer<typeof profile>;

/** Every client → server event, validated before anything else runs (SPEC §2.2). */
export const clientEvents = {
  'room:create': profile,
  'room:join': profile
    .extend({
      roomCode: roomCodeSchema,
      playerId: id.optional(),
      token: z.string().min(16).max(128).optional(),
    })
    .strict(),
  'room:leave': z.object({}).strict(),
  'lobby:setTeam': z.object({ team: z.enum(['red', 'blue', 'spectator']) }).strict(),
  'lobby:setRole': z.object({ role: z.enum(['spymaster', 'agent']) }).strict(),
  'lobby:randomize': z.object({}).strict(),
  'lobby:updateSettings': z.object({ settings: settingsPatchSchema }).strict(),
  'lobby:kick': z.object({ playerId: id }).strict(),
  'game:start': z.object({}).strict(),
  'game:clue': z
    .object({
      word: z.string().max(60),
      count: z.union([z.number().int().min(0).max(9), z.literal('inf')]),
    })
    .strict(),
  'game:point': z.object({ cardId: id.nullable() }).strict(),
  'game:reveal': z.object({ cardId: id }).strict(),
  'game:endGuessing': z.object({}).strict(),
  'game:rematch': z.object({ keepSpymasters: z.boolean().default(false) }).strict(),
  'game:backToLobby': z.object({}).strict(),
  'game:setSpymaster': z.object({ playerId: id }).strict(),
} as const;

export type ClientEventName = keyof typeof clientEvents;
export type ClientPayload<E extends ClientEventName> = z.input<(typeof clientEvents)[E]>;
