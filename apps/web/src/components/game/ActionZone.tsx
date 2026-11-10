import {
  validateClue,
  type ClueCount,
  type ClueRecord,
  type RoomView,
  type Team,
} from '@clave/shared';
import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
import { t } from '../../i18n/es-AR';
import { endGuessing, giveClue } from '../../net/client';
import { useRoom } from '../../store/room';
import { Tip } from '../Tip';
import { ObjectButton, ObjectionPanel } from './Objection';
import { TimerRing } from './TimerRing';

const COUNTS: ClueCount[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'inf'];

/** The clue types itself in (40 ms per letter) and the number pops (SPEC §4). */
function TypedClue({ clue }: { clue: ClueRecord }) {
  // NFC, so an accent typed as a combining mark stays on its letter instead of popping in alone.
  const letters = Array.from(clue.word.normalize('NFC'));
  return (
    <>
      {letters.map((letter, i) => (
        <span key={i} className="anim-letter" style={{ '--i': i } as CSSProperties}>
          {letter}
        </span>
      ))}
      {t.game.clueSeparator}
      <span
        className="anim-pop anim-move"
        style={{ '--d': `${letters.length * 40}ms` } as CSSProperties}
      >
        {t.game.count(clue.count)}
      </span>
    </>
  );
}

function ClueInput({ view }: { view: RoomView }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState<ClueCount>(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const unrevealed = (view.game?.cards ?? []).filter((c) => !c.revealed).map((c) => c.word);
  const check = validateClue(word, unrevealed, { allowCompound: view.settings.compoundWords });
  const clueError =
    word.trim() === '' || check.ok
      ? null
      : `${t.game.clueInvalid[check.reason]} ${check.conflict ? t.game.clueConflict(check.conflict) : ''}`;
  const showError = clueError !== null;

  const send = async () => {
    if (!check.ok || busy) return;
    setBusy(true);
    setServerError(null);
    const res = await giveClue(word.trim(), count);
    setBusy(false);
    if (res.ok) {
      setWord('');
      setCount(1);
      return;
    }
    setServerError(
      res.clue
        ? `${t.game.clueInvalid[res.clue.reason]} ${res.clue.conflict ? t.game.clueConflict(res.clue.conflict) : ''}`
        : t.errors[res.code],
    );
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <p className="font-semibold">{t.game.yourTurnSpymaster}</p>
      <Tip id="clue" text={t.tips.clue} />
      <label htmlFor={`${id}-word`} className="sr-only">
        {t.game.clueLabel}
      </label>
      <input
        id={`${id}-word`}
        value={word}
        autoComplete="off"
        placeholder={t.game.cluePlaceholder}
        aria-invalid={showError}
        aria-describedby={`${id}-error`}
        onChange={(e) => {
          setWord(e.target.value);
          setServerError(null);
        }}
        className={`rounded-md border-2 bg-bg px-3 py-2 text-lg text-paper uppercase ${showError ? 'border-red' : 'border-paper/45'}`}
      />
      <p id={`${id}-error`} className="min-h-5 text-sm text-red-soft" aria-live="polite">
        {clueError ?? serverError}
      </p>
      <fieldset>
        <legend className="mb-1 text-sm">{t.game.countLabel}</legend>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {COUNTS.map((c) => (
            <button
              key={String(c)}
              type="button"
              aria-pressed={count === c}
              onClick={() => {
                setCount(c);
              }}
              className={`size-9 shrink-0 rounded-md border font-bold ${count === c ? 'border-accent bg-accent text-ink' : 'border-paper/45'}`}
            >
              {t.game.count(c)}
            </button>
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={!check.ok || busy}
        className="rounded-md bg-accent px-4 py-2 font-semibold text-ink active:scale-97 disabled:opacity-50"
      >
        {t.game.sendClue}
      </button>
    </form>
  );
}

/** What each player can do right now (SPEC §3.2 "zona de acción"), plus the phase timer. */
export function ActionZone({
  view,
  teamName,
}: {
  view: RoomView;
  teamName: (team: Team) => string;
}) {
  const seq = useRoom((s) => s.seq);
  const game = view.game;
  if (!game || game.phase.name === 'over') return null;
  if (game.phase.name === 'objection') return <ObjectionPanel view={view} />;
  const me = view.players.find((p) => p.id === view.youId);
  const timer = game.timer;
  // Only the ones who have to act hear the last seconds tick.
  const acting =
    me?.team === game.phase.team &&
    (game.phase.name === 'clue' ? me.role === 'spymaster' : me.role === 'agent');
  return (
    <div className="flex items-start gap-3">
      {timer && timer.kind !== 'objection' && <TimerRing key={seq} timer={timer} tick={acting} />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* SPEC §8.3: the spymaster always knows how many of their agents are still hidden. */}
        {me?.role === 'spymaster' && me.team !== 'spectator' && (
          <p className="text-sm text-paper/80" data-testid="agents-left">
            {t.game.agentsLeft(game.remaining[me.team])}
          </p>
        )}
        <PhaseActions view={view} teamName={teamName} />
        <ObjectButton view={view} />
      </div>
    </div>
  );
}

function PhaseActions({ view, teamName }: { view: RoomView; teamName: (team: Team) => string }) {
  const game = view.game;
  const me = view.players.find((p) => p.id === view.youId);
  if (!game || game.phase.name === 'over' || game.phase.name === 'objection') return null;
  const phase = game.phase;
  const onActiveTeam = me?.team === phase.team;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const spymaster = view.players.find((p) => p.team === phase.team && p.role === 'spymaster');

  if (phase.name === 'clue') {
    if (onActiveTeam && me.role === 'spymaster') return <ClueInput view={view} />;
    return (
      <p>
        {onActiveTeam
          ? t.game.waitingClue(spymaster?.nickname ?? '')
          : t.game.waitingRival(teamName(phase.team))}
      </p>
    );
  }

  const clue = game.clues[game.clues.length - 1];
  const clueText = clue ? t.game.clueLine(clue.word, clue.count) : '';
  if (onActiveTeam && me.role === 'agent') {
    const guessed = (clue?.guesses.length ?? 0) > 0;
    return (
      <div className="flex flex-col gap-2">
        <p className="hidden text-lg sm:block">{t.game.yourTurnAgents(clueText)}</p>
        <Tip id="point" text={t.tips.point} />
        {/* Screen readers get the clue whole; the letter-by-letter version is only visual. */}
        <p className="sr-only">{clueText}</p>
        <p
          aria-hidden="true"
          className="text-2xl font-bold tracking-wide sm:text-3xl"
          data-testid="current-clue"
        >
          {clue ? <TypedClue key={game.clues.length} clue={clue} /> : null}
        </p>
        <p className="text-sm text-paper/80">{t.game.guessesLeft(phase.guessesLeft)}</p>
        <p className="text-sm text-paper/70">
          {view.settings.revealMode === 'majority'
            ? t.game.majorityHint
            : coarse
              ? t.game.pointHintTouch
              : t.game.pointHint}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!guessed}
            aria-describedby={guessed ? undefined : 'end-turn-help'}
            onClick={() => void endGuessing()}
            className="rounded-md border border-paper/50 px-4 py-2 font-semibold whitespace-nowrap active:scale-97 disabled:opacity-50"
          >
            {t.game.endTurn}
          </button>
          {!guessed && (
            <span id="end-turn-help" className="text-sm text-paper/70">
              {t.game.endTurnDisabled}
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <p>
      {onActiveTeam
        ? t.game.spymasterWatching(clueText)
        : t.game.rivalGuessing(teamName(phase.team), clueText)}
    </p>
  );
}
