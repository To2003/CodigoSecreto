import { TEAMS, type GameState, type GameView, type RoomEvent, type Team } from '@clave/shared';

/**
 * The ONLY way game state leaves the server (SPEC §2.1, CLAUDE.md golden rule).
 * A card's `type` goes out only if it is revealed, the game is over, the viewer is a spymaster,
 * or the viewer is a spectator in a room that lets spectators see the map.
 * Viewers who aren't in the game (joined mid-game) are treated as spectators.
 */
export function toPublicView(
  game: GameState,
  viewerId: string,
  paused: GameView['paused'] = null,
  room: Pick<GameView, 'timer' | 'durationMs'> = { timer: null, durationMs: null },
): GameView {
  const viewer = game.players.find((p) => p.id === viewerId);
  const team = viewer?.team ?? 'spectator';
  const over = game.phase.name === 'over';
  // "Spectators see the map" covers spectators who were in the game from the start (or were
  // benched after seeing it). Someone joining mid-game never does: otherwise any agent could open
  // a second window as a spectator and read the map (M3 review).
  const seesMap =
    over ||
    (viewer?.team !== 'spectator' && viewer?.role === 'spymaster') ||
    (viewer?.team === 'spectator' && game.settings.spectatorsSeeMap);

  const remaining = Object.fromEntries(
    TEAMS.map((t) => [t, game.cards.filter((c) => c.type === t && !c.revealed).length]),
  ) as Record<Team, number>;

  return {
    phase: structuredClone(game.phase),
    startingTeam: game.startingTeam,
    cards: game.cards.map(({ id, word, revealed, type }) =>
      revealed || seesMap ? { id, word, revealed, type } : { id, word, revealed },
    ),
    clues: structuredClone(game.clues),
    points: seesPoints(game, team) ? { ...game.points } : {},
    remaining,
    seesMap,
    paused,
    // Room-level facts with no card information in them: the timer and the game's duration.
    timer: room.timer && { ...room.timer },
    durationMs: room.durationMs,
  };
}

/** Points are table talk of the active team: only its members see them (SPEC §3.4). */
function seesPoints(game: GameState, team: Team | 'spectator') {
  return game.phase.name !== 'over' && game.phase.name !== 'clue' && team === game.phase.team;
}

/** Events a viewer may receive. Pointing is private to the pointer's team, like the points. */
export function eventsFor(events: RoomEvent[], game: GameState | null, viewerId: string) {
  if (!game) return events;
  const team = game.players.find((p) => p.id === viewerId)?.team ?? 'spectator';
  return events.filter((e) => e.type !== 'CARD_POINTED' || e.team === team);
}
