import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import {
  clientEvents,
  mulberry32,
  type Ack,
  type ClientEventName,
  type ClientToServerEvents,
  type ErrorCode,
  type RoomEvent,
  type ServerToClientEvents,
} from '@clave/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Logger } from '../log';
import { ERROR_MESSAGES } from '../messages';
import { RoomError, type Room } from '../rooms/room';
import type { RoomStore } from '../rooms/store';
import { TokenBucket } from './rateLimit';

interface SocketData {
  roomCode?: string;
  playerId?: string;
}
export type IoServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface LobbyContext {
  io: IoServer;
  store: RoomStore;
  log: Logger;
  now: () => number;
}

const channel = (code: string, playerId: string) => `player:${code}:${playerId}`;
const errorAck = (code: ErrorCode): Ack => ({
  ok: false,
  error: { code, message: ERROR_MESSAGES[code] },
});

/** Sends every player in the room their own filtered view with the next seq (SPEC §2.2). */
export function broadcast(io: IoServer, room: Room, events: RoomEvent[]) {
  room.seq += 1;
  for (const p of room.players) {
    io.to(channel(room.code, p.id)).emit('room:patch', {
      seq: room.seq,
      view: room.view(p.id),
      events,
    });
  }
}

/** Counts open sockets per seat, so a second tab (or F5 overlap) doesn't flip presence. */
const openSockets = new Map<string, number>();

export function registerLobbyHandlers(ctx: LobbyContext, socket: IoSocket) {
  const { io, store, log, now } = ctx;
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
            reply(errorAck(err.code));
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
    openSockets.set(key, (openSockets.get(key) ?? 0) + 1);
    socket.data = { roomCode: room.code, playerId };
    void socket.join(key);
    socket.emit('room:state', { seq: room.seq, view: room.view(playerId) });
  };

  /** Unbinds this socket; when it was the seat's last one, the player shows as disconnected. */
  const detach = (markDisconnected: boolean) => {
    const { roomCode, playerId } = socket.data;
    socket.data = {};
    if (!roomCode || !playerId) return;
    const key = channel(roomCode, playerId);
    void socket.leave(key);
    const left = (openSockets.get(key) ?? 1) - 1;
    if (left > 0) {
      openSockets.set(key, left);
      return;
    }
    openSockets.delete(key);
    const room = store.get(roomCode);
    if (!markDisconnected || !room?.players.some((p) => p.id === playerId)) return;
    const events = room.setConnected(playerId, false, now());
    if (events.length > 0) broadcast(io, room, events);
  };

  const newSeat = () => ({ id: randomUUID(), token: randomBytes(24).toString('base64url') });

  on('room:create', (profile) => {
    detach(true);
    const room = store.create(now());
    const { player } = room.join(profile, now(), newSeat());
    attach(room, player.id);
    log.info('room created', { roomCode: room.code });
    return { roomCode: room.code, playerId: player.id, token: player.token };
  });

  on('room:join', ({ roomCode, playerId, token, ...profile }) => {
    const room = store.get(roomCode);
    if (!room) throw new RoomError('ROOM_NOT_FOUND');
    if (socket.data.roomCode !== roomCode || socket.data.playerId !== playerId) detach(true);

    if (playerId && token && room.players.some((p) => p.id === playerId)) {
      try {
        const { player, events } = room.rejoin(playerId, token, now());
        if (events.length > 0) broadcast(io, room, events);
        attach(room, player.id);
        return { roomCode, playerId: player.id, token: player.token };
      } catch (err) {
        if (!(err instanceof RoomError)) throw err;
        // A wrong token for an existing seat: fall through and take a new seat.
      }
    }
    const { player, events } = room.join(profile, now(), newSeat());
    broadcast(io, room, events);
    attach(room, player.id);
    return { roomCode, playerId: player.id, token: player.token };
  });

  on('room:leave', () => {
    const { room, playerId } = current();
    detach(false);
    const events = room.leave(playerId, now());
    broadcast(io, room, events);
    return undefined;
  });

  on('lobby:setTeam', ({ team }) => {
    const { room, playerId } = current();
    broadcast(io, room, room.setTeam(playerId, team));
    return undefined;
  });

  on('lobby:setRole', ({ role }) => {
    const { room, playerId } = current();
    broadcast(io, room, room.setRole(playerId, role));
    return undefined;
  });

  on('lobby:randomize', () => {
    const { room, playerId } = current();
    broadcast(io, room, room.randomize(playerId, mulberry32(randomInt(2 ** 31))));
    return undefined;
  });

  on('lobby:updateSettings', ({ settings }) => {
    const { room, playerId } = current();
    broadcast(io, room, room.updateSettings(playerId, settings));
    return undefined;
  });

  on('lobby:kick', ({ playerId: target }) => {
    const { room, playerId } = current();
    const events = room.kick(playerId, target);
    const key = channel(room.code, target);
    io.to(key).emit('room:kicked');
    io.in(key).socketsLeave(key);
    openSockets.delete(key);
    broadcast(io, room, events);
    return undefined;
  });

  socket.on('disconnect', () => {
    detach(true);
  });
}
