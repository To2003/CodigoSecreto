import { gameStats, TEAMS, type GameView, type RoomView, type Team } from '@clave/shared';
import { useId } from 'react';
import { t } from '../../i18n/es-AR';
import { backToLobby, rematch } from '../../net/client';
import { Likes } from './Likes';

/** SPEC §3.1 "Fin de partida": who won, the full map (already on the board), and what's next. */
export function GameOverPanel({
  view,
  teamName,
}: {
  view: RoomView;
  teamName: (team: Team) => string;
}) {
  const phase = view.game?.phase;
  if (phase?.name !== 'over') return null;
  const me = view.players.find((p) => p.id === view.youId);
  const loser: Team = phase.winner === 'red' ? 'blue' : 'red';
  const isHost = view.youId === view.hostId;

  return (
    <section className="flex flex-col gap-3" role="status">
      <p className="text-2xl font-bold">{t.game.win(teamName(phase.winner))}</p>
      {phase.reason === 'traitor' && (
        <p className="text-lg">
          {me?.team === loser ? t.game.traitorLoss : t.game.traitorOther(teamName(loser))}
        </p>
      )}
      <p className="text-sm text-paper/80">
        {t.game.scoreboard(view.scoreboard.red, view.scoreboard.blue)}
      </p>
      {view.game && <Stats game={view.game} teamName={teamName} />}
      <Likes view={view} />
      {isHost ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void rematch(false)}
            className="rounded-md bg-accent px-4 py-2 font-semibold text-ink active:scale-97"
          >
            {t.game.rematch}
          </button>
          <button
            type="button"
            onClick={() => void rematch(true)}
            className="rounded-md border border-accent px-4 py-2 text-accent active:scale-97"
          >
            {t.game.rematchKeep}
          </button>
          <button
            type="button"
            onClick={() => void backToLobby()}
            className="rounded-md border border-paper/40 px-4 py-2 active:scale-97"
          >
            {t.game.backToLobby}
          </button>
        </div>
      ) : (
        <p className="text-sm text-paper/70">{t.game.waitingHostEnd}</p>
      )}
    </section>
  );
}

/** End-of-game stats (SPEC §9): duration, clues and hits per team, best clue and blunder. */
function Stats({ game, teamName }: { game: GameView; teamName: (team: Team) => string }) {
  const stats = gameStats(game.clues, game.cards);
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1 text-sm" data-testid="stats">
      <h3 id={titleId} className="font-stamp text-lg">
        {t.stats.title}
      </h3>
      {game.durationMs !== null && <p>{t.stats.duration(game.durationMs)}</p>}
      <ul className="flex flex-col gap-0.5">
        {TEAMS.map((team) => (
          <li key={team}>
            <span className="font-semibold">{teamName(team)}</span>
            {t.game.clueSeparator}
            {t.stats.team(
              stats.teams[team].clues,
              stats.teams[team].hits,
              stats.teams[team].misses,
            )}
          </li>
        ))}
      </ul>
      {stats.bestClue && (
        <p>
          {t.stats.bestClue(
            t.game.clueLine(stats.bestClue.word, stats.bestClue.count),
            teamName(stats.bestClue.team),
            stats.bestClue.hits,
          )}
        </p>
      )}
      <p>
        {stats.blunder
          ? t.stats.blunder(
              stats.blunder.word,
              t.game.cardType[stats.blunder.type],
              teamName(stats.blunder.team),
            )
          : t.stats.noBlunder}
      </p>
      <p className="text-paper/70">{t.game.historyHint}</p>
    </section>
  );
}
