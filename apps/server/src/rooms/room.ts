import { timingSafeEqual } from 'node:crypto';
import {
  applyAction,
  chooseWords,
  rotateSpymasters,
  MAX_PLAYERS,
  sanitizeNickname,
  settingsSchema,
  shuffle,
  TEAMS,
  DEFAULT_SETTINGS,
  type Action,
  type EnginePlayer,
  type ErrorCode,
  type ErrorPayload,
  type GameState,
  type GameView,
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
import { toPublicView } from '../views/gameView';

/** Team problems that keep a game from starting: a connected spymaster and agent per team. */
export function teamBlockers(players: readonly EnginePlayer[]): StartBlocker[] {
  const blockers: StartBlocker[] = [];
  for (const team of TEAMS) {
    const members = players.filter((p) => p.team === team);
    const spymasters = members.filter((p) => p.role === 'spymaster');
    if (spymasters.length === 0) blockers.push({ code: 'NO_SPYMASTER', team });
    if (spymasters.length > 1) blockers.push({ code: 'TOO_MANY_SPYMASTERS', team });
    if (spymasters.length === 1 && !spymasters[0]?.connected) {
      blockers.push({ code: 'SPYMASTER_AWAY', team });
    }
    if (!members.some((p) => p.role === 'agent' && p.connected))
      blockers.push({ code: 'NO_AGENT', team });
  }
  return blockers;
}

/** Grace period a disconnected player keeps their place (SPEC §2.4). */
export const RECONNECT_GRACE_MS = 60_000;

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly clue?: ErrorPayload['clue'],
  ) {
    super(code);
  }
}

/** Game actions players can send. START_GAME, REMATCH and system actions go through Room methods. */
export type PlayerAction = Extract<
  Action,
  {
    type:
      | 'GIVE_CLUE'
      | 'POINT_CARD'
      | 'REVEAL_CARD'
      | 'END_GUESSING'
      | 'OBJECT_CLUE'
      | 'VOTE_OBJECTION';
  }
>;

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
  /** Full game state, types included. Leaves the server only through toPublicView. */
  game: GameState | null = null;
  private rng: Rng | null = null;
  /** Words of the last game, avoided by the next one (SPEC §7). */
  private previousWords: string[] = [];
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
    this.syncPresence(playerId, connected);
    return changed ? [{ type: 'PLAYER_CONNECTION', playerId, connected }] : [];
  }

  /** Presence feeds the engine (majority reveal, objection voters). Unknown ids are fine. */
  private syncPresence(playerId: string, connected: boolean) {
    if (!this.game || !this.rng || !this.game.players.some((p) => p.id === playerId)) return;
    const res = applyAction(this.game, { type: 'SET_CONNECTED', playerId, connected }, this.rng);
    if (res.ok) this.game = res.state;
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
    this.syncPresence(playerId, false);
    const events = this.remove(playerId, { type: 'PLAYER_LEFT', playerId });
    this.updateEmptySince(now);
    return events;
  }

  kick(by: string, target: string): RoomEvent[] {
    this.requireHost(by);
    if (by === target) throw new RoomError('CANNOT_KICK_SELF');
    this.player(target);
    this.syncPresence(target, false);
    return this.remove(target, { type: 'PLAYER_KICKED', playerId: target });
  }

  /**
   * In the lobby, a seat is released 60 s after the drop. During a game seats are kept, but a host
   * gone for 60 s hands the role to the oldest connected player, so someone can still reassign a
   * missing spymaster (SPEC §2.4) instead of the game staying paused forever.
   */
  expireDisconnected(now: number): RoomEvent[] {
    const gone = (p: RoomPlayer) =>
      !p.connected && p.disconnectedAt !== null && now - p.disconnectedAt >= RECONNECT_GRACE_MS;
    if (this.status !== 'lobby') {
      const host = this.players.find((p) => p.id === this.hostId);
      const next = this.players.find((p) => p.connected);
      if (!host || !gone(host) || !next) return [];
      this.hostId = next.id;
      return [{ type: 'HOST_CHANGED', playerId: next.id }];
    }
    const expired = this.players.filter(gone);
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
    blockers.push(...teamBlockers(this.players));
    // Same word selection the engine runs at start; only the count matters, so any rng will do.
    if (!chooseWords(this.settings, () => 0)) blockers.push({ code: 'NOT_ENOUGH_WORDS' });
    return blockers;
  }

  // ── game ────────────────────────────────────────────────────────────────

  private requireGame(): { game: GameState; rng: Rng } {
    if (!this.game || !this.rng || this.status === 'lobby') throw new RoomError('NOT_PLAYING');
    return { game: this.game, rng: this.rng };
  }

  /** Runs an engine action; engine errors become RoomErrors (with the clue detail). */
  private apply(action: Action, rng: Rng): RoomEvent[] {
    const res = applyAction(this.game, action, rng);
    if (!res.ok) throw new RoomError(res.error.code, res.error.clue);
    this.game = res.state;
    this.rng = rng;
    // Teams and roles can change in the engine (benched spymaster, rotation): mirror them.
    for (const p of this.players) {
      const inGame = res.state.players.find((g) => g.id === p.id);
      if (inGame) {
        p.team = inGame.team;
        p.role = inGame.role;
      }
    }
    for (const e of res.events) {
      if (e.type === 'GAME_STARTED') this.status = 'playing';
      if (e.type === 'GAME_OVER') {
        this.status = 'over';
        this.scoreboard[e.winner] += 1;
      }
    }
    return res.events;
  }

  private newGame(players: EnginePlayer[], rng: Rng): RoomEvent[] {
    const words = this.game?.cards.map((c) => c.word);
    if (words) this.previousWords = words;
    return this.apply(
      { type: 'START_GAME', players, settings: this.settings, excludeWords: this.previousWords },
      rng,
    );
  }

  private enginePlayers(): EnginePlayer[] {
    return this.players.map(({ id, team, role, connected }) => ({ id, team, role, connected }));
  }

  start(by: string, rng: Rng): RoomEvent[] {
    this.requireHost(by);
    this.requireLobby();
    if (this.startBlockers().length > 0) throw new RoomError('CANNOT_START');
    this.game = null;
    return this.newGame(this.enginePlayers(), rng);
  }

  /**
   * SPEC §2.4: the game pauses while the active team's spymaster is away. It also pauses while the
   * active team is guessing with no agent connected, since nobody could move (M3 review).
   */
  paused(): GameView['paused'] {
    const game = this.game;
    if (!game || game.phase.name === 'over') return null;
    const team = game.phase.team;
    const here = (id: string) => this.players.some((p) => p.id === id && p.connected);
    const spymaster = game.players.find((p) => p.team === team && p.role === 'spymaster');
    if (spymaster && !here(spymaster.id)) {
      return { team, reason: 'spymaster', waitingFor: [spymaster.id] };
    }
    if (game.phase.name !== 'clue') {
      const agents = game.players.filter((p) => p.team === team && p.role === 'agent');
      if (!agents.some((a) => here(a.id))) {
        return { team, reason: 'agents', waitingFor: agents.map((a) => a.id) };
      }
    }
    return null;
  }

  act(playerId: string, action: PlayerAction): RoomEvent[] {
    const { rng } = this.requireGame();
    if (this.paused()) throw new RoomError('GAME_PAUSED');
    if (action.playerId !== playerId) throw new RoomError('BAD_REQUEST');
    return this.apply(action, rng);
  }

  /**
   * Host only, and only to unblock a pause caused by the active spymaster being away (SPEC §2.4):
   * a connected agent of that team takes over, and the team must keep at least one connected agent.
   */
  setSpymaster(by: string, playerId: string): RoomEvent[] {
    this.requireHost(by);
    const { game, rng } = this.requireGame();
    const pause = this.paused();
    if (pause?.reason !== 'spymaster') throw new RoomError('NOT_PAUSED');
    const candidate = game.players.find((p) => p.id === playerId);
    const present = this.players.some((p) => p.id === playerId && p.connected);
    if (!candidate || !present || candidate.team !== pause.team || candidate.role !== 'agent') {
      throw new RoomError('PLAYER_UNAVAILABLE');
    }
    const agentsLeft = game.players.filter(
      (p) =>
        p.team === pause.team &&
        p.role === 'agent' &&
        p.id !== playerId &&
        this.players.some((r) => r.id === p.id && r.connected),
    );
    if (agentsLeft.length === 0) throw new RoomError('NO_AGENT_LEFT');
    return this.apply({ type: 'SET_SPYMASTER', team: pause.team, playerId }, rng);
  }

  /**
   * Same teams as they are in the room now (who left is out, who joined mid-game is in as a
   * spectator), spymasters rotated unless asked to keep them (SPEC §9).
   */
  rematch(by: string, keepSpymasters: boolean): RoomEvent[] {
    this.requireHost(by);
    const { rng } = this.requireGame();
    if (this.status !== 'over') throw new RoomError('GAME_IN_PROGRESS');
    const players = keepSpymasters ? this.enginePlayers() : rotateSpymasters(this.enginePlayers());
    if (teamBlockers(players).length > 0) throw new RoomError('CANNOT_START');
    return this.newGame(players, rng);
  }

  backToLobby(by: string): RoomEvent[] {
    this.requireHost(by);
    const { game } = this.requireGame();
    this.previousWords = game.cards.map((c) => c.word);
    this.game = null;
    this.rng = null;
    this.status = 'lobby';
    return [{ type: 'BACK_TO_LOBBY' }];
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
      game: this.game ? toPublicView(this.game, forId, this.paused()) : null,
    };
  }
}
