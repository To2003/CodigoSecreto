import type {
  Ack,
  ClientEventName,
  ClueCount,
  ErrorPayload,
  ClientPayload,
  ErrorCode,
  Profile,
  SettingsPatch,
} from '@clave/shared';
import { forgetSeat, loadSeat, saveSeat } from '../lib/storage';
import { patchAction, useRoom } from '../store/room';
import { socket } from './socket';

const ACK_TIMEOUT_MS = 8_000;

export type Result<T extends object = object> =
  ({ ok: true } & T) | { ok: false; code: ErrorCode | 'TIMEOUT'; clue?: ErrorPayload['clue'] };

/** Emits with an ack and a timeout, so a sleeping server never leaves a button hanging. */
async function request<E extends ClientEventName>(
  event: E,
  payload: ClientPayload<E>,
): Promise<Result<Record<string, unknown>>> {
  try {
    // The typed overloads can't be picked for a generic event name; payload is checked by callers.
    const timed = socket.timeout(ACK_TIMEOUT_MS);
    const emit = timed.emitWithAck.bind(timed) as unknown as (
      ev: E,
      data: ClientPayload<E>,
    ) => Promise<Ack<Record<string, unknown>>>;
    const res = await emit(event, payload);
    if (res.ok) return res;
    return res.error.clue
      ? { ok: false, code: res.error.code, clue: res.error.clue }
      : { ok: false, code: res.error.code };
  } catch {
    return { ok: false, code: 'TIMEOUT' };
  }
}

let currentCode: string | null = null;
let lastProfile: Profile | null = null;

function enter(code: string, ack: Record<string, unknown>) {
  const { playerId, token } = ack;
  if (typeof playerId === 'string' && typeof token === 'string')
    saveSeat(code, { playerId, token });
  currentCode = code;
  useRoom.setState({ exit: null });
}

export async function createRoom(profile: Profile): Promise<Result<{ roomCode: string }>> {
  lastProfile = profile;
  const res = await request('room:create', profile);
  if (!res.ok) return res;
  const roomCode = String(res.roomCode);
  enter(roomCode, res);
  return { ok: true, roomCode };
}

/** Joins, or reclaims the stored seat for this room when there is one (SPEC §2.4). */
export async function joinRoom(code: string, profile: Profile): Promise<Result> {
  lastProfile = profile;
  const seat = loadSeat(code);
  const res = await request('room:join', { ...profile, roomCode: code, ...(seat ?? {}) });
  if (!res.ok) {
    useRoom.setState({ exit: res.code === 'TIMEOUT' ? null : res.code });
    return res;
  }
  enter(code, res);
  return { ok: true };
}

export async function leaveRoom(): Promise<Result> {
  const code = currentCode;
  const res = await request('room:leave', {});
  if (code) forgetSeat(code);
  currentCode = null;
  useRoom.setState({ view: null, seq: -1, lastEvents: [] });
  return res;
}

export const setTeam = (team: 'red' | 'blue' | 'spectator') => request('lobby:setTeam', { team });
export const setRole = (role: 'spymaster' | 'agent') => request('lobby:setRole', { role });
export const randomizeTeams = () => request('lobby:randomize', {});
export const updateSettings = (settings: SettingsPatch) =>
  request('lobby:updateSettings', { settings });
export const kickPlayer = (playerId: string) => request('lobby:kick', { playerId });

export const startGame = () => request('game:start', {});
export const giveClue = (word: string, count: ClueCount) => request('game:clue', { word, count });
export const pointCard = (cardId: string | null) => request('game:point', { cardId });
export const revealCard = (cardId: string) => request('game:reveal', { cardId });
export const endGuessing = () => request('game:endGuessing', {});
export const rematch = (keepSpymasters: boolean) => request('game:rematch', { keepSpymasters });
export const backToLobby = () => request('game:backToLobby', {});
export const reassignSpymaster = (playerId: string) => request('game:setSpymaster', { playerId });

/** Re-sends room:join with the stored seat: answers with a full room:state. */
function resync() {
  if (currentCode && lastProfile) void joinRoom(currentCode, lastProfile);
}

socket.on('room:state', ({ seq, view }) => {
  useRoom.setState({ view, seq, lastEvents: [] });
});

socket.on('room:patch', (patch) => {
  const action = patchAction(useRoom.getState().seq, patch.seq);
  if (action === 'apply')
    useRoom.setState({ view: patch.view, seq: patch.seq, lastEvents: patch.events });
  else if (action === 'resync') resync();
});

socket.on('room:kicked', () => {
  if (currentCode) forgetSeat(currentCode);
  currentCode = null;
  useRoom.setState({ view: null, seq: -1, lastEvents: [], exit: 'kicked' });
});

// After a drop, socket.io reconnects on its own; then we reclaim the seat.
socket.on('connect', () => {
  if (useRoom.getState().seq >= 0) resync();
});
