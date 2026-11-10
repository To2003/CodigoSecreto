import type { GameView, RoomEvent } from '@clave/shared';
import { useEffect, useRef } from 'react';
import { CardArt } from '../../art/CardArt';
import { t } from '../../i18n/es-AR';
import { useReducedMotion } from '../../store/prefs';

/** Team colors for the confetti, read from the live tokens (color-blind palette included). */
const tokenColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Screen-level moments of SPEC §4: the turn sweep, the rival-agent edge flash, the traitor
 * (vignette and the card big in the middle) and the victory confetti. Each overlay is keyed by
 * the patch seq, so it plays once per event and never loops at rest.
 */
export function GameEffects({
  game,
  events,
  seq,
}: {
  game: GameView;
  events: RoomEvent[];
  seq: number;
}) {
  const reduced = useReducedMotion();
  const turn = events.find((e) => e.type === 'TURN_CHANGED');
  const reveal = events.find((e) => e.type === 'CARD_REVEALED' && !e.penalty);
  const over = events.find((e) => e.type === 'GAME_OVER');
  const rivalColor =
    reveal?.type === 'CARD_REVEALED' &&
    (reveal.cardType === 'red' || reveal.cardType === 'blue') &&
    reveal.cardType !== reveal.team
      ? reveal.cardType
      : null;
  const traitor = reveal?.type === 'CARD_REVEALED' && reveal.cardType === 'traitor' ? reveal : null;

  // One burst per game-over patch, however many times this re-renders.
  const confettiFor = useRef(-1);
  useEffect(() => {
    if (over?.type !== 'GAME_OVER' || reduced || confettiFor.current === seq) return;
    confettiFor.current = seq;
    const winner = over.winner;
    // After the traitor's moment, then confetti in the winner's colors (lazy: not in the bundle).
    const delay = traitor ? 2200 : 500;
    const timer = setTimeout(() => {
      void import('canvas-confetti').then(({ default: confetti }) => {
        const colors = [
          tokenColor(`--${winner}`),
          tokenColor(`--${winner}-soft`),
          tokenColor('--accent'),
        ];
        void confetti({
          particleCount: 140,
          spread: 75,
          origin: { y: 0.65 },
          colors,
          disableForReducedMotion: true,
        });
      });
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [over, reduced, seq, traitor]);

  const active = game.phase.name === 'over' ? null : game.phase.team;
  const traitorWord = traitor ? game.cards.find((c) => c.id === traitor.cardId)?.word : undefined;

  return (
    <>
      {/* The desk takes a tint of the team in turn, with a 700 ms crossfade. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div
          className={`absolute inset-0 bg-red/[0.07] transition-opacity duration-700 ${active === 'red' ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`absolute inset-0 bg-blue/[0.08] transition-opacity duration-700 ${active === 'blue' ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {turn?.type === 'TURN_CHANGED' && !over && !reduced && (
        <div
          key={`turn-${seq}`}
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-1/3 z-30 flex justify-center overflow-hidden"
        >
          <span
            className={`anim-sweep anim-move block w-full py-3 text-center font-stamp text-3xl tracking-[0.3em] text-paper uppercase sm:text-5xl ${turn.team === 'red' ? 'bg-red-deep/90' : 'bg-blue-deep/90'}`}
          >
            {t.game.stampTurn(t.game.shortTeam[turn.team])}
          </span>
        </div>
      )}

      {rivalColor && (
        <div
          key={`flash-${seq}`}
          aria-hidden="true"
          className={`anim-edge-flash pointer-events-none fixed inset-0 z-30 opacity-0 ${rivalColor === 'red' ? 'shadow-[inset_0_0_80px_24px_var(--red)]' : 'shadow-[inset_0_0_80px_24px_var(--blue)]'}`}
        />
      )}

      {traitor && (
        <div
          key={`traitor-${seq}`}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-40"
        >
          <div className="anim-vignette absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(0_0_0/0.85)_80%)]" />
          {!reduced && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="anim-traitor-zoom anim-move relative aspect-[3/2] w-[min(70vw,22rem)] overflow-hidden rounded-2xl bg-traitor shadow-2xl">
                <CardArt type="traitor" id={traitor.cardId} />
                <span className="absolute inset-x-0 bottom-2 text-center font-card text-2xl text-paper uppercase">
                  {traitorWord}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
