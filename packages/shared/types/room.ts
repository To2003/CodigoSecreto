import type { ClueRejection } from '../engine/clue';
import type { EngineErrorCode, GameEvent, PlayerTeam, Role, Team } from '../engine/types';
import type { GameView } from './game';
import type { AvatarColor, ClientEventName, ClientPayload } from '../schemas/events';
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
  | { code: 'MODE_NOT_AVAILABLE' };

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
  /** Present from the start of a game until the room goes back to the lobby. */
  game: GameView | null;
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
  | GameEvent;

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

export interface ServerToClientEvents {
  'room:state': (state: { seq: number; view: RoomView }) => void;
  'room:patch': (patch: RoomPatch) => void;
  'room:kicked': () => void;
}
