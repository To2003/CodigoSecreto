import { TEAMS, type RoomEvent, type RoomView, type Team } from '@clave/shared';
import { useState } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ActionZone } from '../components/game/ActionZone';
import { Board } from '../components/game/Board';
import { GameOverPanel } from '../components/game/GameOverPanel';
import { PauseOverlay } from '../components/game/PauseOverlay';
import { TeamPanel } from '../components/game/TeamPanel';
import { t } from '../i18n/es-AR';
import { useRoom } from '../store/room';

/** One line about what just happened, read by screen readers too (SPEC §10 aria-live). */
function lastNews(events: RoomEvent[], teamName: (team: Team) => string): string | null {
  for (const e of [...events].reverse()) {
    if (e.type === 'TURN_CHANGED') {
      return e.reason === 'rival'
        ? t.game.turnEnded.rival(teamName(e.team))
        : t.game.turnEnded[e.reason];
    }
    if (e.type === 'CLUE_GIVEN') return t.game.yourTurnAgents(t.game.clueLine(e.word, e.count));
  }
  return null;
}

export function Game({ view }: { view: RoomView }) {
  const game = view.game;
  const events = useRoom((s) => s.lastEvents);
  const [viewAsAgent, setViewAsAgent] = useState(false);
  if (!game) return null;
  const teamName = (team: Team) => t.lobby.teamLabel(team, view.settings.teamNames[team]);
  const phase = game.phase;
  const me = view.players.find((p) => p.id === view.youId);
  const isSpymaster = me?.role === 'spymaster' && me.team !== 'spectator';
  const news = lastNews(events, teamName);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-3 py-4">
      <header className="flex flex-wrap items-center gap-3">
        {TEAMS.map((team) => (
          <span
            key={team}
            data-testid={`remaining-${team}`}
            className={`rounded-md px-3 py-1 font-bold ${team === 'red' ? 'bg-red' : 'bg-blue'} text-paper`}
          >
            {`${teamName(team)}: ${t.game.remaining(game.remaining[team])}`}
          </span>
        ))}
        <p className="font-semibold" aria-live="polite" data-testid="turn-banner">
          {phase.name === 'over'
            ? null
            : game.paused
              ? t.game.paused
              : t.game.turnOf(teamName(phase.team))}
        </p>
        <div className="ml-auto flex items-center gap-3">
          {isSpymaster && phase.name !== 'over' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={viewAsAgent}
                onChange={(e) => {
                  setViewAsAgent(e.target.checked);
                }}
              />
              {t.game.viewAsAgent}
            </label>
          )}
          <ConnectionIndicator />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[14rem_1fr_14rem]">
        <TeamPanel view={view} team="red" name={teamName('red')} />
        <div className="flex flex-col gap-4">
          <Board view={view} showMap={game.seesMap && !viewAsAgent} />
          <section className="rounded-xl border border-paper/20 p-4" aria-label={t.game.clueLabel}>
            <p className="mb-2 min-h-5 text-sm text-accent" aria-live="polite" data-testid="news">
              {news}
            </p>
            <ActionZone view={view} teamName={teamName} />
            <GameOverPanel view={view} teamName={teamName} />
          </section>
        </div>
        <TeamPanel view={view} team="blue" name={teamName('blue')} />
      </div>
      <PauseOverlay view={view} />
    </main>
  );
}
