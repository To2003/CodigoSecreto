import { TEAMS, type RoomEvent, type RoomView, type Team } from '@clave/shared';
import { useRef, useState } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ActionZone } from '../components/game/ActionZone';
import { Board } from '../components/game/Board';
import { GameOverPanel } from '../components/game/GameOverPanel';
import { PauseOverlay } from '../components/game/PauseOverlay';
import { TeamPanel } from '../components/game/TeamPanel';
import { TurnStamp } from '../components/game/TurnStamp';
import { SettingsButton } from '../components/SettingsDialog';
import { t } from '../i18n/es-AR';
import { backToLobby } from '../net/client';
import { usePrefs } from '../store/prefs';
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

/** Host escape hatch (ADR-021): ends the game for everyone, with a confirm step. */
function EndGameButton() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className="text-sm text-paper/70 underline"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t.game.backToLobby}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      {t.game.endGameConfirm}
      <button
        type="button"
        className="font-semibold text-red-soft underline"
        onClick={() => void backToLobby()}
      >
        {t.game.endGame}
      </button>
    </span>
  );
}

function Counter({ view, team, name }: { view: RoomView; team: Team; name: string }) {
  const colorBlind = usePrefs((p) => p.colorBlind);
  const left = view.game?.remaining[team] ?? 0;
  return (
    <span
      data-testid={`remaining-${team}`}
      aria-label={`${name}: ${t.game.remaining(left)}`}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold text-paper ${team === 'red' ? 'bg-red pattern-red' : 'bg-blue pattern-blue'}`}
    >
      {colorBlind && <span aria-hidden="true">{t.game.typeIcon[team]}</span>}
      <span aria-hidden="true" className="hidden sm:inline">
        {name}
      </span>
      <span aria-hidden="true" className="font-stamp text-xl leading-none">
        {left}
      </span>
    </span>
  );
}

/** Mobile (SPEC §3.3): teams and clue history live in a sheet with one tab per team. */
function TeamsSheet({ view, teamName }: { view: RoomView; teamName: (team: Team) => string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Team>('red');
  return (
    <>
      <button
        type="button"
        className="rounded-md border border-line px-2.5 py-1 text-xs sm:text-sm lg:hidden"
        onClick={() => ref.current?.showModal()}
      >
        {t.game.teamsAndHistory}
      </button>
      <dialog
        ref={ref}
        aria-label={t.game.teamsAndHistory}
        className="mt-auto mb-0 max-h-[80dvh] w-full max-w-none rounded-t-xl bg-bg p-3 text-paper backdrop:bg-black/60"
      >
        <div role="tablist" className="mb-3 flex gap-2">
          {TEAMS.map((team) => (
            <button
              key={team}
              type="button"
              role="tab"
              aria-selected={tab === team}
              onClick={() => {
                setTab(team);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${tab === team ? (team === 'red' ? 'bg-red' : 'bg-blue') : 'border border-line'}`}
            >
              {teamName(team)}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          <TeamPanel view={view} team={tab} name={teamName(tab)} />
        </div>
        <form method="dialog" className="mt-3 text-right">
          <button type="submit" className="rounded-md bg-accent px-4 py-1.5 font-semibold text-ink">
            {t.game.close}
          </button>
        </form>
      </dialog>
    </>
  );
}

export function Game({ view }: { view: RoomView }) {
  const game = view.game;
  const events = useRoom((s) => s.lastEvents);
  const [viewAsAgent, setViewAsAgent] = useState(false);
  if (!game) return null;
  const teamName = (team: Team) => t.lobby.teamLabel(team, view.settings.teamNames[team]);
  const me = view.players.find((p) => p.id === view.youId);
  const isSpymaster = me?.role === 'spymaster' && me.team !== 'spectator';
  const news = lastNews(events, teamName);

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-3 px-3 pt-3 pb-64 lg:gap-4 lg:px-5 lg:pb-6">
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <Counter view={view} team="red" name={teamName('red')} />
        <TurnStamp game={game} teamName={teamName} />
        <Counter view={view} team="blue" name={teamName('blue')} />
      </header>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm sm:gap-x-4">
        {isSpymaster && game.phase.name !== 'over' && (
          <label className="mr-auto flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={viewAsAgent}
              onChange={(e) => {
                setViewAsAgent(e.target.checked);
              }}
            />
            {t.game.viewAsAgent}
          </label>
        )}
        <TeamsSheet view={view} teamName={teamName} />
        <ConnectionIndicator compact />
        <SettingsButton className="px-2.5 py-1 text-xs sm:px-3 sm:text-sm" />
        {view.youId === view.hostId && game.phase.name !== 'over' && <EndGameButton />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr_15rem]">
        <TeamPanel view={view} team="red" name={teamName('red')} className="hidden lg:flex" />
        <div className="flex flex-col gap-4">
          <Board view={view} showMap={game.seesMap && !viewAsAgent} />
          {/* Action zone: a bottom sheet on phones, a panel under the board on desktop. */}
          <section
            aria-label={t.game.clueLabel}
            className="fixed inset-x-0 bottom-0 z-10 max-h-[45dvh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-4 shadow-[0_-8px_24px_rgb(0_0_0/0.4)] lg:static lg:max-h-none lg:rounded-xl lg:border lg:shadow-none"
          >
            <p className="mb-2 min-h-5 text-sm text-accent" aria-live="polite" data-testid="news">
              {news}
            </p>
            <ActionZone view={view} teamName={teamName} />
            <GameOverPanel view={view} teamName={teamName} />
          </section>
        </div>
        <TeamPanel view={view} team="blue" name={teamName('blue')} className="hidden lg:flex" />
      </div>
      <PauseOverlay view={view} teamName={teamName} />
    </main>
  );
}
