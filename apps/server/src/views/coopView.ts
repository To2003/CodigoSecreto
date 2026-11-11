import { totalAgentsLeft, type CoopState, type CoopView } from '@clave/shared';

/**
 * The ONLY way a cooperative game leaves the server (docs/specs/M9-cooperativo.md §6, CLAUDE.md
 * golden rule). A player gets their own side's map and nothing of the other's; spectators get no
 * map. Everything else is already public: found agents and "civilian for X" marks happened in
 * front of everyone. Both maps go out once the game is over.
 */
export function toCoopView(state: CoopState, viewerId: string): CoopView {
  const viewer = state.players.find((p) => p.id === viewerId);
  const side = viewer && viewer.team !== 'spectator' ? viewer.team : null;
  const over = state.phase.name === 'over';
  return {
    side,
    cards: state.cards.map(({ id, word, found, civilianFor, key }) => ({
      id,
      word,
      found,
      civilianFor: [...civilianFor],
      ...(over ? { keys: { ...key } } : side ? { key: key[side] } : {}),
    })),
    phase: structuredClone(state.phase),
    turnsLeft: state.turnsLeft,
    agentsLeft: totalAgentsLeft(state),
    clues: structuredClone(state.clues),
  };
}
