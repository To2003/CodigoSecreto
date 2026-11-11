import type { CoopState } from './coop';
import type { GameState } from './types';

/**
 * SPEC §9 as amended by ADR-032: a spymaster can't send emotes while their own team is guessing
 * (an objection vote on their clue included). They see the key map and their team's pointing, so
 * a 🔥 or a 😱 right after a card is pointed works as a yes/no. On the rival's turn, while
 * giving the clue, in the lobby and at the end of the game they can.
 */
export function emoteBlocked(game: GameState | null, playerId: string): boolean {
  if (!game) return false;
  const phase = game.phase;
  if (phase.name !== 'guess' && phase.name !== 'objection') return false;
  const player = game.players.find((p) => p.id === playerId);
  return player?.role === 'spymaster' && player.team === phase.team;
}

/** Cooperative mode: the side whose map is being guessed is the one that could signal. */
export function coopEmoteBlocked(state: CoopState | null, playerId: string): boolean {
  if (state?.phase.name !== 'guess') return false;
  const giver = state.phase.giver;
  return state.players.some((p) => p.id === playerId && p.team === giver);
}
