import { validateClue, type ClueCount, type RoomView, type Team } from '@clave/shared';
import { useId, useState } from 'react';
import { t } from '../../i18n/es-AR';
import { endGuessing, giveClue } from '../../net/client';

const COUNTS: ClueCount[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'inf'];

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
        className={`rounded-md border-2 bg-bg px-3 py-2 text-lg text-paper uppercase ${showError ? 'border-red' : 'border-paper/30'}`}
      />
      <p id={`${id}-error`} className="min-h-5 text-sm text-red-soft" aria-live="polite">
        {clueError ?? serverError}
      </p>
      <fieldset>
        <legend className="mb-1 text-sm">{t.game.countLabel}</legend>
        <div className="flex flex-wrap gap-1">
          {COUNTS.map((c) => (
            <button
              key={String(c)}
              type="button"
              aria-pressed={count === c}
              onClick={() => {
                setCount(c);
              }}
              className={`size-9 rounded-md border font-bold ${count === c ? 'border-accent bg-accent text-ink' : 'border-paper/30'}`}
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

/** What each player can do right now (SPEC §3.2 "zona de acción"). */
export function ActionZone({
  view,
  teamName,
}: {
  view: RoomView;
  teamName: (team: Team) => string;
}) {
  const game = view.game;
  const me = view.players.find((p) => p.id === view.youId);
  if (!game || game.phase.name === 'over' || game.phase.name === 'objection') return null;
  const phase = game.phase;
  const onActiveTeam = me?.team === phase.team;
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
        <p className="text-lg">{t.game.yourTurnAgents(clueText)}</p>
        <p className="text-3xl font-bold tracking-wide" data-testid="current-clue">
          {clueText}
        </p>
        <p className="text-sm text-paper/80">{t.game.guessesLeft(phase.guessesLeft)}</p>
        <p className="text-sm text-paper/70">
          {view.settings.revealMode === 'majority' ? t.game.majorityHint : t.game.pointHint}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!guessed}
            aria-describedby={guessed ? undefined : 'end-turn-help'}
            onClick={() => void endGuessing()}
            className="rounded-md border border-paper/50 px-4 py-2 font-semibold active:scale-97 disabled:opacity-50"
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
