import type { ClueCount } from '@clave/shared';
import { t } from '../../i18n/es-AR';
import { endGuessing } from '../../net/client';

/**
 * What the guessers see under the clue, in classic and cooperative mode alike (ADR-034): how many
 * guesses are left and "Pasar turno". The server is what enforces the `count + 1` limit; this only
 * tells them. With exactly one guess left every earlier guess was a hit (a miss ends the turn), so
 * they just found the clue's number: the button stands out, since stopping is usually right.
 */
export function GuessControls({
  guessesLeft,
  count,
  guessed,
}: {
  guessesLeft: number | null;
  count: ClueCount | undefined;
  guessed: boolean;
}) {
  const reached = guessesLeft === 1 && typeof count === 'number' && count > 0;
  return (
    <>
      <p
        data-testid="guesses-left"
        className={reached ? 'text-sm font-semibold text-accent' : 'text-sm text-paper/80'}
      >
        {t.game.guessesLeft(guessesLeft)}
      </p>
      {reached && (
        <p id="count-reached" className="text-sm text-paper/80">
          {t.game.countReached(count)}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!guessed}
          aria-describedby={guessed ? (reached ? 'count-reached' : undefined) : 'end-turn-help'}
          data-highlight={reached || undefined}
          onClick={() => void endGuessing()}
          className={`rounded-md px-4 py-2 font-semibold whitespace-nowrap active:scale-97 disabled:opacity-50 ${
            reached ? 'bg-accent text-ink' : 'border border-paper/50'
          }`}
        >
          {t.game.endTurn}
        </button>
        {!guessed && (
          <span id="end-turn-help" className="text-sm text-paper/70">
            {t.game.endTurnDisabled}
          </span>
        )}
      </div>
    </>
  );
}
