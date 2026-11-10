import { timingSafeEqual } from 'node:crypto';
import {
  chooseWords,
  MAX_PLAYERS,
  mulberry32,
  sanitizeNickname,
  settingsSchema,
  shuffle,
  TEAMS,
  DEFAULT_SETTINGS,
  type ErrorCode,
  type PlayerTeam,
  type Profile,
  type PublicPlayer,
  type Rng,
  type Role,
  type RoomEvent,
  type RoomStatus,
  type RoomView,
  type Settings,
  type SettingsPatch,
  type StartBlocker,
  type Team,
} from '@clave/shared';

/** Grace period a disconnected player keeps their place (SPEC §2.4). */
export const RECONNECT_GRACE_MS = 60_000;

export class RoomError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

export interface RoomPlayer extends PublicPlayer {
  /** Secret that lets this player reclaim their seat. Never serialized into a view. */
  token: string;
  disconnectedAt: number | null;
}

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** One room's lobby state and rules (SPEC §2.3–2.4, §3.1). Pure: callers pass time, ids and rng. */
export class Room {
  hostId = '';
  players: RoomPlayer[] = [];
  settings: Settings = DEFAULT_SETTINGS;
  status: RoomStatus = 'lobby';
  scoreboard: Record<Team, number> = { red: 0, blue: 0 };
  /** Incremented on every broadcast so clients can detect a missed patch (SPEC §2.2). */
  seq = 0;
  /** When the last connected player left; a new room counts as empty from its creation. */
  emptySince: number | null;

  constructor(
    readonly code: string,
    readonly createdAt: number,
  ) {
    this.emptySince = createdAt;
  }

  private player(id: string): RoomPlayer {
    const p = this.players.find((x) => x.id === id);
    if (!p) throw new RoomError('PLAYER_NOT_FOUND');
    return p;
  }

  private requireHost(id: string) {
    if (id !== this.hostId) throw new RoomError('NOT_HOST');
  }

  private requireLobby() {
    if (this.status !== 'lobby') throw new RoomError('LOBBY_ONLY');
  }

  private updateEmptySince(now: number) {
    const anyone = this.players.some((p) => p.connected);
    if (anyone) this.emptySince = null;
    else this.emptySince ??= now;
  }

  join(profile: Profile, now: number, ids: { id: string; token: string }) {
    if (this.players.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL');
    const nickname = sanitizeNickname(profile.nickname);
    if (nickname === '') throw new RoomError('INVALID_NICKNAME');
    const count = (team: Team) => this.players.filter((p) => p.team === team).length;
    const team: PlayerTeam =
      this.status !== 'lobby' ? 'spectator' : count('red') <= count('blue') ? 'red' : 'blue';
    const player: RoomPlayer = {
      id: ids.id,
      token: ids.token,
      nickname,
      avatar: profile.avatar,
      color: profile.color,
      team,
      role: 'agent',
      connected: true,
      disconnectedAt: null,
    };
    this.players.push(player);
    if (this.hostId === '') this.hostId = player.id;
    this.updateEmptySince(now);
    const events: RoomEvent[] = [{ type: 'PLAYER_JOINED', playerId: player.id }];
    return { player, events };
  }

  /** Reclaims a seat with the token handed out on join (F5, network drop). */
  rejoin(playerId: string, token: string, now: number) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !sameSecret(player.token, token)) throw new RoomError('PLAYER_NOT_FOUND');
    return { player, events: this.setConnected(playerId, true, now) };
  }

  setConnected(playerId: string, connected: boolean, now: number): RoomEvent[] {
    const p = this.player(playerId);
    const changed = p.connected !== connected;
    p.connected = connected;
    p.disconnectedAt = connected ? null : (p.disconnectedAt ?? now);
    this.updateEmptySince(now);
    return changed ? [{ type: 'PLAYER_CONNECTION', playerId, connected }] : [];
  }

  private remove(playerId: string, event: RoomEvent): RoomEvent[] {
    this.players = this.players.filter((p) => p.id !== playerId);
    const events = [event];
    if (playerId === this.hostId) {
      const next = this.players.find((p) => p.connected) ?? this.players[0];
      this.hostId = next?.id ?? '';
      if (next) events.push({ type: 'HOST_CHANGED', playerId: next.id });
    }
    return events;
  }

  leave(playerId: string, now: number): RoomEvent[] {
    this.player(playerId);
    const events = this.remove(playerId, { type: 'PLAYER_LEFT', playerId });
    this.updateEmptySince(now);
    return events;
  }

  kick(by: string, target: string): RoomEvent[] {
    this.requireHost(by);
    if (by === target) throw new RoomError('CANNOT_KICK_SELF');
    this.player(target);
    return this.remove(target, { type: 'PLAYER_KICKED', playerId: target });
  }

  /** In the lobby, a seat is released 60 s after the drop. During a game it is kept (M3). */
  expireDisconnected(now: number): RoomEvent[] {
    if (this.status !== 'lobby') return [];
    const expired = this.players.filter(
      (p) =>
        !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= RECONNECT_GRACE_MS,
    );
    return expired.flatMap((p) => this.remove(p.id, { type: 'PLAYER_LEFT', playerId: p.id }));
  }

  setTeam(playerId: string, team: PlayerTeam): RoomEvent[] {
    this.requireLobby();
    const p = this.player(playerId);
    p.team = team;
    p.role = 'agent';
    return [{ type: 'TEAM_CHANGED', playerId, team, role: 'agent' }];
  }

  setRole(playerId: string, role: Role): RoomEvent[] {
    this.requireLobby();
    const p = this.player(playerId);
    if (p.team === 'spectator') throw new RoomError('BAD_REQUEST');
    if (role === 'spymaster') {
      const taken = this.players.some(
        (x) => x.id !== playerId && x.team === p.team && x.role === 'spymaster',
      );
      if (taken) throw new RoomError('SPYMASTER_TAKEN');
    }
    p.role = role;
    return [{ type: 'TEAM_CHANGED', playerId, team: p.team, role }];
  }

  /** Host: balanced random teams with a random spymaster each; spectators stay put. */
  randomize(by: string, rng: Rng): RoomEvent[] {
    this.requireHost(by);
    this.requireLobby();
    const playing = shuffle(
      this.players.filter((p) => p.team !== 'spectator'),
      rng,
    );
    playing.forEach((p, i) => {
      p.team = TEAMS[i % 2] as Team;
      p.role = i < 2 ? 'spymaster' : 'agent';
    });
    return [{ type: 'TEAMS_RANDOMIZED' }];
  }

  updateSettings(by: string, patch: SettingsPatch): RoomEvent[] {
    this.requireHost(by);
    this.requireLobby();
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    this.settings = settingsSchema.parse({ ...this.settings, ...defined });
    return [{ type: 'SETTINGS_CHANGED' }];
  }

  startBlockers(): StartBlocker[] {
    const blockers: StartBlocker[] = [];
    if (this.settings.mode !== 'classic') blockers.push({ code: 'MODE_NOT_AVAILABLE' });
    for (const team of TEAMS) {
      const members = this.players.filter((p) => p.team === team);
      const spymasters = members.filter((p) => p.role === 'spymaster').length;
      if (spymasters === 0) blockers.push({ code: 'NO_SPYMASTER', team });
      if (spymasters > 1) blockers.push({ code: 'TOO_MANY_SPYMASTERS', team });
      if (members.length - spymasters === 0) blockers.push({ code: 'NO_AGENT', team });
    }
    // Same word selection the engine runs at start, with a throwaway rng.
    if (!chooseWords(this.settings, mulberry32(0))) blockers.push({ code: 'NOT_ENOUGH_WORDS' });
    return blockers;
  }

  view(forId: string): RoomView {
    return {
      code: this.code,
      youId: forId,
      hostId: this.hostId,
      players: this.players.map(({ id, nickname, avatar, color, team, role, connected }) => ({
        id,
        nickname,
        avatar,
        color,
        team,
        role,
        connected,
      })),
      settings: this.settings,
      status: this.status,
      scoreboard: this.scoreboard,
      startBlockers: this.startBlockers(),
    };
  }
}
