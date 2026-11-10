import type { RoomEvent } from '@clave/shared';
import { generateRoomCode } from './codes';
import { Room } from './room';

/** A room with nobody connected is deleted after 30 minutes (SPEC §2.3). */
export const EMPTY_ROOM_TTL_MS = 30 * 60_000;

/** All rooms live in memory (SPEC §0.3): a game lasts 15–30 minutes. */
export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly newCode = generateRoomCode,
    /** The server clock, handed to every room for its timers. */
    private readonly clock: () => number = Date.now,
  ) {}

  get size() {
    return this.rooms.size;
  }

  create(now: number): Room {
    const room = new Room(
      this.newCode((code) => this.rooms.has(code)),
      now,
      this.clock,
    );
    this.rooms.set(room.code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  delete(code: string) {
    this.rooms.delete(code);
  }

  /** Runs out due timers (SPEC §1.7). Returns the rooms that need a broadcast. */
  tick(): { room: Room; events: RoomEvent[] }[] {
    const changed: { room: Room; events: RoomEvent[] }[] = [];
    for (const room of this.rooms.values()) {
      const events = room.tick();
      if (events.length > 0) changed.push({ room, events });
    }
    return changed;
  }

  /** Releases expired seats and drops abandoned rooms. Returns the rooms that need a broadcast. */
  sweep(now: number): { room: Room; events: RoomEvent[] }[] {
    const changed: { room: Room; events: RoomEvent[] }[] = [];
    for (const room of this.rooms.values()) {
      if (room.emptySince !== null && now - room.emptySince >= EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        continue;
      }
      const events = room.expireDisconnected(now);
      if (events.length > 0) changed.push({ room, events });
    }
    return changed;
  }
}
