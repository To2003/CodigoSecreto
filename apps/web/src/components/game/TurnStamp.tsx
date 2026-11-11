import type { GameView, Team } from '@clave/shared';
import { t } from '../../i18n/es-AR';

/**
 * The turn, as a rubber stamp on the case file: the one loud element of the game screen.
 * The visible label stays the accessible "Turno del Equipo X" for screen readers.
 */
export function TurnStamp({
  game,
  teamName,
}: {
  game: GameView;
  teamName: (team: Team) => string;
}) {
  const phase = game.phase;
  const color =
    phase.name === 'over'
      ? 'text-accent border-accent'
      : phase.team === 'red'
        ? 'text-red-ink border-red-ink'
        : 'text-blue-ink border-blue-ink';
  const stamp =
    phase.name === 'over'
      ? t.game.stampOver
      : game.paused
        ? t.game.stampPaused
        : t.game.stampTurn(t.game.shortTeam[phase.team]);
  const spoken =
    phase.name === 'over'
      ? stamp
      : game.paused
        ? t.game.paused
        : t.game.turnOf(teamName(phase.team));
  return (
    <p className="flex justify-center" data-testid="turn-banner" aria-live="polite">
      <span className="sr-only">{spoken}</span>
      <span
        aria-hidden="true"
        className={`inline-block -rotate-3 rounded-md border-[3px] border-double px-3 py-0.5 font-stamp text-xl tracking-wider uppercase sm:text-3xl ${color}`}
      >
        {stamp}
      </span>
    </p>
  );
}
