import type { ClueRejection } from '../engine/clue';
import type { CoopEvent } from '../engine/coop';
import type { EngineErrorCode, GameEvent, PlayerTeam, Role, Team } from '../engine/types';
import type { LikesView } from './accounts';
import type { CoopView, GameView } from './game';
import type { AvatarColor, ClientEventName, ClientPayload, EmoteId } from '../schemas/events';
import type { Settings } from '../schemas/settings';

/** What every client sees about a player. Tokens never leave the server. */
export interface PublicPlayer {
  id: string;
  nickname: string;
  avatar: number;
  color: AvatarColor;
  team: PlayerTeam;
  role: Role;
  connected: boolean;
}

/** Why "Empezar" is disabled (SPEC §3.1: the button explains what's missing). */
export type StartBlocker =
  | { code: 'NO_SPYMASTER'; team: Team }
  | { code: 'TOO_MANY_SPYMASTERS'; team: Team }
  | { code: 'NO_AGENT'; team: Team }
  | { code: 'SPYMASTER_AWAY'; team: Team }
  | { code: 'NOT_ENOUGH_WORDS' }
  | { code: 'MODE_NOT_AVAILABLE' }
  /** Cooperative: 2–3 players with both sides covered (docs/specs/M9-cooperativo.md §2). */
  | { code: 'COOP_PLAYERS' };

export type RoomStatus = 'lobby' | 'playing' | 'over';

/** The filtered room a player receives in room:state / room:patch. */
export interface RoomView {
  code: string;
  youId: string;
  hostId: string;
  players: PublicPlayer[];
  settings: Settings;
  status: RoomStatus;
  scoreboard: Record<Team, number>;
  startBlockers: StartBlocker[];
  /** True while this player may not write in the chat: they saw the key map (SPEC §9). */
  chatMuted: boolean;
  /** True while this player may not send emotes: a spymaster whose team is guessing (ADR-032). */
  emotesMuted: boolean;
  /** End of a classic game, for players who were in it: this viewer's likes (spec §5). */
  likes: LikesView | null;
  /** Present from the start of a game until the room goes back to the lobby. */
  game: GameView | null;
  /** The cooperative game (M9.1), when the room plays that mode; `game` is null then. */
  coop: CoopView | null;
}

export type RoomEvent =
  | { type: 'PLAYER_JOINED'; playerId: string }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'PLAYER_KICKED'; playerId: string }
  | { type: 'PLAYER_CONNECTION'; playerId: string; connected: boolean }
  | { type: 'TEAM_CHANGED'; playerId: string; team: PlayerTeam; role: Role }
  | { type: 'TEAMS_RANDOMIZED' }
  | { type: 'SETTINGS_CHANGED' }
  | { type: 'HOST_CHANGED'; playerId: string }
  | { type: 'BACK_TO_LOBBY' }
  | GameEvent
  | CoopEvent;

/** room:patch: a full filtered view (ADR-019) plus the events to animate, in order. */
export interface RoomPatch {
  seq: number;
  view: RoomView;
  events: RoomEvent[];
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_IN_ROOM'
  | 'NOT_HOST'
  | 'INVALID_NICKNAME'
  | 'SPYMASTER_TAKEN'
  | 'PLAYER_NOT_FOUND'
  | 'CANNOT_KICK_SELF'
  | 'LOBBY_ONLY'
  | 'INTERNAL'
  | 'NOT_PLAYING'
  | 'GAME_PAUSED'
  | 'CANNOT_START'
  | 'NOT_PAUSED'
  | 'PLAYER_UNAVAILABLE'
  | 'NO_AGENT_LEFT'
  | 'CHAT_DISABLED'
  | 'CHAT_NOT_ALLOWED'
  | 'JOIN_LIMITED'
  | 'EMOTE_NOT_NOW'
  | 'LIKES_NOT_NOW'
  | 'LIKE_NOT_ALLOWED'
  | 'ALREADY_LIKED'
  | EngineErrorCode;

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  /** For INVALID_CLUE: why the clue was refused and which board word it clashed with. */
  clue?: { reason: ClueRejection; conflict?: string };
}

export type Ack<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: ErrorPayload };

/** What each client event's ack carries on success. */
export interface AckData {
  'room:create': { roomCode: string; playerId: string; token: string };
  'room:join': { roomCode: string; playerId: string; token: string };
}
type AckFor<E extends ClientEventName> = E extends keyof AckData ? Ack<AckData[E]> : Ack;

/** Socket.IO typing for both ends (SPEC §2.2). */
export type ClientToServerEvents = {
  [E in ClientEventName]: (payload: ClientPayload<E>, ack: (res: AckFor<E>) => void) => void;
};

/** A chat line (SPEC §9). Team lines reach only the members of that team (or the spectators). */
export interface ChatMessage {
  id: number;
  playerId: string;
  scope: 'all' | 'team';
  /** For team lines: whose channel it is. */
  team?: PlayerTeam;
  text: string;
  /** Server time, ms epoch. */
  at: number;
}

export interface EmoteEvent {
  playerId: string;
  emoteId: EmoteId;
}

export interface ServerToClientEvents {
  'room:state': (state: { seq: number; view: RoomView }) => void;
  'room:patch': (patch: RoomPatch) => void;
  'room:kicked': () => void;
  'chat:message': (message: ChatMessage) => void;
  /** The recent lines this player may read, sent on (re)joining. */
  'chat:history': (messages: ChatMessage[]) => void;
  emote: (emote: EmoteEvent) => void;
  /** Only to the receiver: how many likes they got in this game. Nothing about who. */
  'likes:received': (likes: { count: number }) => void;
}
