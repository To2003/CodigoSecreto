import type { RoomView, Team } from '@clave/shared';
import { useId } from 'react';
import { t } from '../../i18n/es-AR';
import { social, useSocial } from '../../store/social';

/**
 * Clue history for one team (SPEC §9): "PLAYA · 2 → ARENA ✓, SOL ✓". Each entry is a button that
 * highlights that clue's cards on the board.
 */
export function ClueLog({ view, team }: { view: RoomView; team: Team }) {
  const highlight = useSocial((s) => s.highlight);
  const hintId = useId();
  const game = view.game;
  if (!game) return null;
  const clues = game.clues.filter((c) => c.team === team);
  const word = (id: string) => game.cards.find((c) => c.id === id)?.word ?? '';
  return (
    <section aria-label={t.game.history}>
      <h3 className="mb-1 text-sm font-semibold text-paper/80">{t.game.history}</h3>
      <p id={hintId} className="sr-only">
        {t.game.historyHint}
      </p>
      {clues.length === 0 ? (
        <p className="text-sm text-paper/60">{t.game.noClues}</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm" data-testid={`clues-${team}`}>
          {clues.map((clue) => {
            const ids = [
              ...clue.guesses.map((g) => g.cardId),
              ...(clue.penaltyCardId ? [clue.penaltyCardId] : []),
            ];
            const line = t.game.clueLine(clue.word, clue.count);
            const on = ids.length > 0 && highlight.join() === ids.join();
            const guesses = clue.guesses.map((g) =>
              g.type === team
                ? `${word(g.cardId)} ${t.game.guessRight}`
                : `${word(g.cardId)} ${t.game.guessWrong(t.game.cardType[g.type])}`,
            );
            if (clue.penaltyCardId) guesses.push(t.game.penalty(word(clue.penaltyCardId)));
            // Clues have no id, but the game's clue list only grows: its position is stable.
            return (
              <li key={game.clues.indexOf(clue)}>
                <button
                  type="button"
                  disabled={ids.length === 0}
                  aria-pressed={ids.length > 0 ? on : undefined}
                  aria-describedby={hintId}
                  onClick={() => {
                    social.toggleHighlight(ids);
                  }}
                  className={`w-full rounded px-1 text-left enabled:hover:bg-paper/10 ${on ? 'bg-accent/20' : ''}`}
                >
                  <span className="font-bold">{line}</span>
                  {guesses.length > 0 && ` → ${guesses.join(', ')}`}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
