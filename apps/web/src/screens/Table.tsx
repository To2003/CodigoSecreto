import type { Profile, RoomView, Team } from '@clave/shared';
import { useEffect, useRef, useState } from 'react';
import { useSoundCues } from '../audio/useSoundCues';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { Board } from '../components/game/Board';
import { GameEffects } from '../components/game/GameEffects';
import { TimerRing } from '../components/game/TimerRing';
import { TurnStamp } from '../components/game/TurnStamp';
import { t } from '../i18n/es-AR';
import { roomPath } from '../lib/router';
import { joinRoom, setTeam } from '../net/client';
import { useRoom } from '../store/room';
import { CoopGame } from './CoopGame';

/** The table joins as a spectator with its own name: it's a screen, not a player. */
const TABLE_PROFILE: Profile = { nickname: t.table.nickname, avatar: 0, color: 'pizarra' };

function TableGame({ view }: { view: RoomView }) {
  const game = view.game;
  const seq = useRoom((s) => s.seq);
  const events = useRoom((s) => s.lastEvents);
  if (!game) return null;
  const teamName = (team: Team) => t.lobby.teamLabel(team, view.settings.teamNames[team]);
  const phase = game.phase;
  const clue = phase.name === 'guess' || phase.name === 'objection' ? game.clues.at(-1) : null;
  return (
    <main className="flex min-h-dvh flex-col gap-4 px-6 py-5">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-2xl">
        <p className="font-semibold text-red-ink" data-testid="table-red">
          {`${teamName('red')}: ${t.game.remaining(game.remaining.red)}`}
        </p>
        <TurnStamp game={game} teamName={teamName} />
        <p className="text-right font-semibold text-blue-ink" data-testid="table-blue">
          {`${teamName('blue')}: ${t.game.remaining(game.remaining.blue)}`}
        </p>
      </header>
      <div className="flex min-h-14 items-center justify-center gap-4">
        {game.timer && <TimerRing key={seq} timer={game.timer} />}
        <p
          className="font-stamp text-4xl tracking-wide"
          aria-live="polite"
          data-testid="table-clue"
        >
          {phase.name === 'over'
            ? t.game.win(teamName(phase.winner))
            : clue
              ? t.table.clue(t.game.clueLine(clue.word, clue.count))
              : ''}
        </p>
      </div>
      {/* Never the map: the table is in front of everyone (the key map lives on phones). */}
      <div className="mx-auto w-full max-w-[110rem] [--card-text-scale:1.6]">
        <Board view={view} showMap={false} />
      </div>
      <GameEffects game={game} events={events} seq={seq} myTeam={undefined} />
    </main>
  );
}

function TableLobby({ view }: { view: RoomView }) {
  const url = `${window.location.origin}${roomPath(view.code)}`;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-stamp text-7xl tracking-[0.2em]">{t.table.title(view.code)}</h1>
      <p className="text-2xl">{t.table.joinFrom(url)}</p>
      <p className="text-xl text-paper/80">
        {t.table.players(view.players.filter((p) => p.team !== 'spectator').length)}
      </p>
      <p className="text-paper/70">{t.table.waiting}</p>
      <ConnectionIndicator />
    </main>
  );
}

function TableRoom({ view }: { view: RoomView }) {
  useSoundCues(view);
  const me = view.players.find((p) => p.id === view.youId);
  const moved = useRef(false);
  // In the lobby the table sits with the spectators, never in a team.
  useEffect(() => {
    if (moved.current || view.status !== 'lobby' || me?.team === 'spectator') return;
    moved.current = true;
    void setTeam('spectator');
  }, [view.status, me?.team]);
  if (view.coop) return <CoopGame view={view} coop={view.coop} />;
  return view.game ? <TableGame view={view} /> : <TableLobby view={view} />;
}

/** /sala/:code/mesa (SPEC §12 M9.2): the room on a TV or a laptop, for playing in person. */
export default function Table({ code }: { code: string }) {
  const view = useRoom((s) => (s.view?.code === code ? s.view : null));
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    void joinRoom(code, TABLE_PROFILE, { table: true }).then((res) => {
      if (!res.ok) setError(t.errors[res.code]);
    });
  }, [code]);
  if (view) return <TableRoom view={view} />;
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center text-2xl">
      <p role={error ? 'alert' : 'status'}>{error ?? t.table.connecting}</p>
    </main>
  );
}
