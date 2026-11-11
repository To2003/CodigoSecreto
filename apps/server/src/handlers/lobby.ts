import { randomBytes, randomUUID } from 'node:crypto';
import {
  clientEvents,
  type Ack,
  type ClientEventName,
  type ClientToServerEvents,
  type ErrorCode,
  type ErrorPayload,
  type RoomEvent,
  type ServerToClientEvents,
} from '@clave/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Logger } from '../log';
import { ERROR_MESSAGES } from '../messages';
import { RoomError, type PlayerAction, type Room } from '../rooms/room';
import type { RoomStore } from '../rooms/store';
import { eventsFor } from '../views/gameView';
import { cryptoRng } from '../rooms/rng';
import type { IpLimiter } from './ipLimits';
import { TokenBucket } from './rateLimit';
import type { Accounts } from '../accounts/service';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  /** The verified account behind this socket, set once at connection (never sent anywhere). */
  userId?: string;
}
export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface LobbyContext {
  io: IoServer;
  store: RoomStore;
  log: Logger;
  now: () => number;
  limiter: IpLimiter;
  accounts: Accounts;
  /** Sends a room's patch to everyone in it, and saves a game's results once it's over. */
  publish: (room: Room, events: RoomEvent[]) => void;
  /** This socket's limit key (see clientIp), null when unknown. Never logged: personal data. */
  ip: string | null;
}

const channel = (code: string, playerId: string) => `player:${code}:${playerId}`;
const errorAck = (code: ErrorCode, clue?: ErrorPayload['clue']): Ack => ({
  ok: false,
  error: { code, message: ERROR_MESSAGES[code], ...(clue ? { clue } : {}) },
});

/** Sends every player in the room their own filtered view with the next seq (SPEC §2.2). */
export function broadcast(io: IoServer, room: Room, events: RoomEvent[]) {
  room.seq += 1;
  for (const p of room.players) {
    io.to(channel(room.code, p.id)).emit('room:patch', {
      seq: room.seq,
      view: room.view(p.id),
      events: eventsFor(events, room.game, p.id),
    });
  }
}

/** Counts open sockets per seat, so a second tab (or F5 overlap) doesn't flip presence. */
const openSockets = new Map<string, Set<string>>();

export function registerLobbyHandlers(ctx: LobbyContext, socket: IoSocket) {
  const { io, store, log, now, limiter, ip, accounts, publish } = ctx;
  // Read once: attach() replaces socket.data with the seat it binds to.
  const userId = socket.data.userId;
  const bucket = new TokenBucket(20, 20, now);

  const on = <E extends ClientEventName>(
    event: E,
    handler: (data: z.output<(typeof clientEvents)[E]>) => object | undefined,
  ) => {
    // Socket.IO's typed `on` can't express our generic handler; the payload is validated below.
    (socket.on as (ev: string, fn: (raw: unknown, ack: unknown) => void) => void)(
      event,
      (raw, ack) => {
        const reply = typeof ack === 'function' ? (ack as (res: Ack) => void) : () => undefined;
        if (!bucket.take()) {
          reply(errorAck('RATE_LIMITED'));
          return;
        }
        const schema: z.ZodType = clientEvents[event];
        const parsed = schema.safeParse(raw ?? {});
        if (!parsed.success) {
          reply(errorAck('BAD_REQUEST'));
          return;
        }
        try {
          // `schema` is clientEvents[event], so the parsed data has that event's payload type.
          reply({ ok: true, ...handler(parsed.data as z.output<(typeof clientEvents)[E]>) });
        } catch (err) {
          if (err instanceof RoomError) {
            reply(errorAck(err.code, err.clue));
            return;
          }
          log.error('handler failed', { event, err });
          reply(errorAck('INTERNAL'));
        }
      },
    );
  };

  const current = () => {
    const { roomCode, playerId } = socket.data;
    const room = roomCode ? store.get(roomCode) : undefined;
    if (!room || !playerId || !room.players.some((p) => p.id === playerId)) {
      throw new RoomError('NOT_IN_ROOM');
    }
    return { room, playerId };
  };

  /** Binds this socket to a seat and sends the full state. */
  const attach = (room: Room, playerId: string) => {
    const key = channel(room.code, playerId);
    // A set of socket ids, not a counter: the same socket re-joining its own seat (a resync)
    // must not count twice, or the seat would never show as disconnected (M3 review).
    const sockets = openSockets.get(key) ?? new Set<string>();
    sockets.add(socket.id);
    openSockets.set(key, sockets);
    socket.data = { roomCode: room.code, playerId };
    void socket.join(key);
    socket.emit('room:state', { seq: room.seq, view: room.view(playerId) });
    socket.emit('chat:history', room.chatHistory(playerId));
  };

  /** Unbinds this socket; when it was the seat's last one, the player shows as disconnected. */
  const detach = (markDisconnected: boolean) => {
    const { roomCode, playerId } = socket.data;
    socket.data = {};
    if (!roomCode || !playerId) return;
    const key = channel(roomCode, playerId);
    void socket.leave(key);
    const sockets = openSockets.get(key);
    sockets?.delete(socket.id);
    if (sockets && sockets.size > 0) return;
    openSockets.delete(key);
    const room = store.get(roomCode);
    if (!markDisconnected || !room?.players.some((p) => p.id === playerId)) return;
    const events = room.setConnected(playerId, false, now());
    if (events.length > 0) publish(room, events);
  };

  const newSeat = () => ({ id: randomUUID(), token: randomBytes(24).toString('base64url') });

  on('room:create', (profile) => {
    if (!limiter.allows(ip, 'rooms')) throw new RoomError('RATE_LIMITED');
    limiter.count(ip, 'rooms');
    detach(true);
    const room = store.create(now());
    const { player } = room.join(profile, now(), newSeat(), userId);
    attach(room, player.id);
    log.info('room created', { roomCode: room.code });
    return { roomCode: room.code, playerId: player.id, token: player.token };
  });

  on('room:join', ({ roomCode, playerId, token, ...profile }) => {
    const room = store.get(roomCode);
    // Reclaiming your own seat (F5, reconnect, resync) always works: the token proves it's you.
    const ownSeat =
      room !== undefined &&
      playerId !== undefined &&
      token !== undefined &&
      room.players.some((p) => p.id === playerId);
    // Past the limit of joins to missing codes, new seats and unknown codes get the same answer
    // until the window ends: no oracle for which codes exist (BACKLOG #4, M8 review).
    if (!ownSeat && !limiter.allows(ip, 'failedJoins')) throw new RoomError('JOIN_LIMITED');
    if (!room) {
      limiter.count(ip, 'failedJoins');
      throw new RoomError('ROOM_NOT_FOUND');
    }
    if (socket.data.roomCode !== roomCode || socket.data.playerId !== playerId) detach(true);

    if (ownSeat) {
      try {
        const { player, events } = room.rejoin(playerId, token, now(), userId);
        if (events.length > 0) publish(room, events);
        attach(room, player.id);
        return { roomCode, playerId: player.id, token: player.token };
      } catch (err) {
        if (!(err instanceof RoomError)) throw err;
        // A wrong token for an existing seat: a new seat, under the same limit as any other.
        if (!limiter.allows(ip, 'failedJoins')) throw new RoomError('JOIN_LIMITED');
      }
    }
    const { player, events } = room.join(profile, now(), newSeat(), userId);
    publish(room, events);
    attach(room, player.id);
    return { roomCode, playerId: player.id, token: player.token };
  });

  on('room:leave', () => {
    const { room, playerId } = current();
    detach(false);
    const events = room.leave(playerId, now());
    publish(room, events);
    return undefined;
  });

  on('lobby:setTeam', ({ team }) => {
    const { room, playerId } = current();
    publish(room, room.setTeam(playerId, team));
    return undefined;
  });

  on('lobby:setRole', ({ role }) => {
    const { room, playerId } = current();
    publish(room, room.setRole(playerId, role));
    return undefined;
  });

  on('lobby:randomize', () => {
    const { room, playerId } = current();
    publish(room, room.randomize(playerId, seed()));
    return undefined;
  });

  on('lobby:updateSettings', ({ settings }) => {
    const { room, playerId } = current();
    publish(room, room.updateSettings(playerId, settings));
    return undefined;
  });

  on('lobby:kick', ({ playerId: target }) => {
    const { room, playerId } = current();
    const events = room.kick(playerId, target);
    const key = channel(room.code, target);
    io.to(key).emit('room:kicked');
    io.in(key).socketsLeave(key);
    openSockets.delete(key);
    publish(room, events);
    return undefined;
  });

  // Crypto randomness for every game (ADR-022): never a seeded PRNG on the server.
  const seed = () => cryptoRng;
  const game = (build: (playerId: string) => PlayerAction) => {
    const { room, playerId } = current();
    publish(room, room.act(playerId, build(playerId)));
  };

  on('game:start', () => {
    const { room, playerId } = current();
    publish(room, room.start(playerId, seed()));
    return undefined;
  });
  on('game:clue', ({ word, count }) => {
    game((playerId) => ({ type: 'GIVE_CLUE', playerId, word, count }));
    return undefined;
  });
  on('game:point', ({ cardId }) => {
    game((playerId) => ({ type: 'POINT_CARD', playerId, cardId }));
    return undefined;
  });
  on('game:reveal', ({ cardId }) => {
    game((playerId) => ({ type: 'REVEAL_CARD', playerId, cardId }));
    return undefined;
  });
  on('game:endGuessing', () => {
    game((playerId) => ({ type: 'END_GUESSING', playerId }));
    return undefined;
  });
  on('game:object', () => {
    game((playerId) => ({ type: 'OBJECT_CLUE', playerId }));
    return undefined;
  });
  on('game:vote', ({ accept }) => {
    game((playerId) => ({ type: 'VOTE_OBJECTION', playerId, accept }));
    return undefined;
  });

  // Chat and emotes don't change the game: they go out on their own events, not in a patch.
  on('chat:send', ({ text, scope }) => {
    const { room, playerId } = current();
    const { message, recipients } = room.sendChat(playerId, text, scope);
    for (const id of recipients) io.to(channel(room.code, id)).emit('chat:message', message);
    return undefined;
  });
  // Likes (docs/specs/M9-cuentas.md §5): only the receiver hears about it, and only a count.
  on('like:give', ({ playerId: target }) => {
    const { room, playerId } = current();
    const outcome = room.like(playerId, target);
    io.to(channel(room.code, outcome.receiverId)).emit('likes:received', {
      count: outcome.received,
    });
    if (outcome.keep) accounts.keepLike(outcome.keep);
    return undefined;
  });

  on('emote:send', ({ emoteId }) => {
    const { room, playerId } = current();
    const emote = room.emote(playerId, emoteId);
    for (const p of room.players) io.to(channel(room.code, p.id)).emit('emote', emote);
    return undefined;
  });

  on('game:setSpymaster', ({ playerId: target }) => {
    const { room, playerId } = current();
    publish(room, room.setSpymaster(playerId, target));
    return undefined;
  });
  on('game:rematch', ({ keepSpymasters }) => {
    const { room, playerId } = current();
    publish(room, room.rematch(playerId, keepSpymasters));
    return undefined;
  });
  on('game:backToLobby', () => {
    const { room, playerId } = current();
    publish(room, room.backToLobby(playerId));
    return undefined;
  });

  socket.on('disconnect', () => {
    detach(true);
  });
}
