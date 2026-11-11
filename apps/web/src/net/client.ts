import type {
  Ack,
  ClientEventName,
  ClueCount,
  ErrorPayload,
  ClientPayload,
  EmoteId,
  ErrorCode,
  Profile,
  SettingsPatch,
} from '@clave/shared';
import { forgetSeat, loadSeat, saveSeat } from '../lib/storage';
import { patchAction, useRoom } from '../store/room';
import { social } from '../store/social';
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
/** The table screen (modo mesa) keeps its own seat, so a tab of a player never takes it. */
let tableSeat = false;
const seatId = (code: string) => (tableSeat ? `${code}:mesa` : code);

function enter(code: string, ack: Record<string, unknown>) {
  const { playerId, token } = ack;
  if (typeof playerId === 'string' && typeof token === 'string')
    saveSeat(seatId(code), { playerId, token });
  currentCode = code;
  useRoom.setState({ exit: null });
}

export async function createRoom(profile: Profile): Promise<Result<{ roomCode: string }>> {
  lastProfile = profile;
  // A new room starts with an empty chat. Reset before asking: the server sends the chat
  // history right after the state, before the ack arrives.
  social.reset();
  tableSeat = false;
  const res = await request('room:create', profile);
  if (!res.ok) return res;
  const roomCode = String(res.roomCode);
  enter(roomCode, res);
  return { ok: true, roomCode };
}

/** Joins, or reclaims the stored seat for this room when there is one (SPEC §2.4). */
export async function joinRoom(
  code: string,
  profile: Profile,
  options: { table?: boolean } = {},
): Promise<Result> {
  lastProfile = profile;
  if (options.table !== undefined) tableSeat = options.table;
  if (currentCode !== code) social.reset();
  const seat = loadSeat(seatId(code));
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
  if (code) forgetSeat(seatId(code));
  currentCode = null;
  useRoom.setState({ view: null, seq: -1, lastEvents: [] });
  social.reset();
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
export const objectClue = () => request('game:object', {});
export const voteObjection = (accept: boolean) => request('game:vote', { accept });
export const sendChat = (text: string, scope: 'all' | 'team') =>
  request('chat:send', { text, scope });
export const sendEmote = (emoteId: EmoteId) => request('emote:send', { emoteId });

/** Re-sends room:join with the stored seat: answers with a full room:state. */
let resyncing = false;
function resync() {
  // One at a time: several patches after a gap must not fire several joins.
  if (resyncing || !currentCode || !lastProfile) return;
  resyncing = true;
  void joinRoom(currentCode, lastProfile).finally(() => {
    resyncing = false;
  });
}

socket.on('room:state', ({ seq, view }) => {
  // A late answer for a room we already left must not overwrite the current one.
  if (currentCode !== null && view.code !== currentCode) return;
  useRoom.setState({ view, seq, lastEvents: [] });
});

socket.on('room:patch', (patch) => {
  const action = patchAction(useRoom.getState().seq, patch.seq);
  if (action === 'apply')
    useRoom.setState({ view: patch.view, seq: patch.seq, lastEvents: patch.events });
  else if (action === 'resync') resync();
});

socket.on('room:kicked', () => {
  if (currentCode) forgetSeat(seatId(currentCode));
  currentCode = null;
  useRoom.setState({ view: null, seq: -1, lastEvents: [], exit: 'kicked' });
});

// After a drop, socket.io reconnects on its own; then we reclaim the seat.
socket.on('connect', () => {
  if (useRoom.getState().seq >= 0) resync();
});

socket.on('chat:history', (messages) => {
  social.history(messages);
});
socket.on('chat:message', (message) => {
  social.message(message);
});
socket.on('emote', (emote) => {
  social.emote(emote);
});
