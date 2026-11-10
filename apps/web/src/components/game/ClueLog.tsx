import type { RoomView, Team } from '@clave/shared';
import { t } from '../../i18n/es-AR';

/** Clue history for one team (SPEC §9): "PLAYA · 2 → ARENA ✓, SOL ✓". */
export function ClueLog({ view, team }: { view: RoomView; team: Team }) {
  const game = view.game;
  if (!game) return null;
  const clues = game.clues.filter((c) => c.team === team);
  const word = (id: string) => game.cards.find((c) => c.id === id)?.word ?? '';
  return (
    <section aria-label={t.game.history}>
      <h3 className="mb-1 text-sm font-semibold text-paper/80">{t.game.history}</h3>
      {clues.length === 0 ? (
        <p className="text-sm text-paper/60">{t.game.noClues}</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm" data-testid={`clues-${team}`}>
          {clues.map((clue, i) => (
            <li key={i}>
              <span className="font-bold">{t.game.clueLine(clue.word, clue.count)}</span>
              {clue.guesses.length > 0 && ' → '}
              {clue.guesses
                .map((g) =>
                  g.type === team
                    ? `${word(g.cardId)} ${t.game.guessRight}`
                    : `${word(g.cardId)} ${t.game.guessWrong(t.game.cardType[g.type])}`,
                )
                .join(', ')}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
