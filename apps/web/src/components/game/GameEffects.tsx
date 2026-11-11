import type { GameView, RoomEvent, Team } from '@clave/shared';
import { useEffect, useRef, useState } from 'react';
import { CardArt } from '../../art/CardArt';
import { t } from '../../i18n/es-AR';
import { useReducedMotion } from '../../store/prefs';

/** Team colors for the confetti, read from the live tokens (color-blind palette included). */
const tokenColor = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** How long each overlay stays mounted: a bit more than its animation, delays included. */
const SWEEP_MS = 1500;
const FLASH_MS = 1400;
const TRAITOR_MS = 3000;
/** When a reveal and a turn change come in the same patch, the sweep waits for the flip. */
const SWEEP_AFTER_FLIP_MS = 650;

interface Moments {
  seq: number;
  sweep: { team: Team; delayed: boolean } | null;
  flash: Team | null;
  traitor: { cardId: string; word: string | undefined } | null;
}

/** What each patch sets off on screen. Pure: the overlays below decide how long they live. */
function momentsOf(events: RoomEvent[], game: GameView, seq: number): Moments {
  const turn = events.find((e) => e.type === 'TURN_CHANGED');
  const reveal = events.find((e) => e.type === 'CARD_REVEALED' && !e.penalty);
  const over = events.some((e) => e.type === 'GAME_OVER');
  const revealed = reveal?.type === 'CARD_REVEALED' ? reveal : null;
  const flash =
    revealed &&
    (revealed.cardType === 'red' || revealed.cardType === 'blue') &&
    revealed.cardType !== revealed.team
      ? revealed.cardType
      : null;
  return {
    seq,
    sweep:
      turn?.type === 'TURN_CHANGED' && !over
        ? { team: turn.team, delayed: revealed !== null }
        : null,
    flash,
    traitor:
      revealed?.cardType === 'traitor'
        ? {
            cardId: revealed.cardId,
            word: game.cards.find((c) => c.id === revealed.cardId)?.word,
          }
        : null,
  };
}

/** Keeps a value for `ms` after it was set, so the next patch doesn't cut an overlay short. */
function useTransient<T>(value: T | null, key: number, ms: number) {
  const [shown, setShown] = useState<{ key: number; value: T } | null>(null);
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    if (value !== null) setShown({ key, value });
  }
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => {
      setShown(null);
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  }, [shown, ms]);
  return shown;
}

/**
 * Screen-level moments of SPEC §4: the turn sweep, the rival-agent edge flash, the traitor
 * (vignette and the card big in the middle) and the victory confetti. Each overlay plays once
 * per event, outlives the patches that come after it, and never loops at rest.
 */
export function GameEffects({
  game,
  events,
  seq,
  myTeam,
}: {
  game: GameView;
  events: RoomEvent[];
  seq: number;
  /** Undefined for spectators: they celebrate any winner. */
  myTeam: Team | undefined;
}) {
  const reduced = useReducedMotion();
  const moments = momentsOf(events, game, seq);
  const sweep = useTransient(reduced ? null : moments.sweep, seq, SWEEP_MS);
  const flash = useTransient(moments.flash, seq, FLASH_MS);
  const traitor = useTransient(reduced ? null : moments.traitor, seq, TRAITOR_MS);
  const over = events.find((e) => e.type === 'GAME_OVER');
  const traitorNow = moments.traitor !== null;

  // One burst per game-over patch, for the winners and the spectators only.
  const confettiForRef = useRef(-1);
  useEffect(() => {
    if (over?.type !== 'GAME_OVER' || reduced || confettiForRef.current === seq) return;
    confettiForRef.current = seq;
    const winner = over.winner;
    if (myTeam !== undefined && myTeam !== winner) return;
    // After the traitor's moment, then confetti in the winner's colors (lazy: not in the bundle).
    const timer = setTimeout(
      () => {
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
      },
      traitorNow ? 2200 : 500,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [over, reduced, seq, traitorNow, myTeam]);

  const active = game.phase.name === 'over' ? null : game.phase.team;

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

      {sweep && (
        <div
          key={`sweep-${String(sweep.key)}`}
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-1/3 z-30 flex justify-center overflow-hidden"
        >
          <span
            className={`anim-sweep anim-move block w-full py-3 text-center font-stamp text-3xl tracking-[0.3em] text-paper uppercase opacity-0 sm:text-5xl ${sweep.value.team === 'red' ? 'bg-red-deep/90' : 'bg-blue-deep/90'}`}
            style={
              sweep.value.delayed
                ? { animationDelay: `${String(SWEEP_AFTER_FLIP_MS)}ms` }
                : undefined
            }
            data-testid="turn-sweep"
          >
            {t.game.stampTurn(t.game.shortTeam[sweep.value.team])}
          </span>
        </div>
      )}

      {flash && (
        <div
          key={`flash-${String(flash.key)}`}
          aria-hidden="true"
          data-testid="edge-flash"
          className={`anim-edge-flash pointer-events-none fixed inset-0 z-30 opacity-0 ${flash.value === 'red' ? 'shadow-[inset_0_0_80px_24px_var(--red)]' : 'shadow-[inset_0_0_80px_24px_var(--blue)]'}`}
        />
      )}

      {traitor && (
        <div
          key={`traitor-${String(traitor.key)}`}
          aria-hidden="true"
          data-testid="traitor-moment"
          className="pointer-events-none fixed inset-0 z-40"
        >
          <div className="anim-vignette absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(0_0_0/0.85)_80%)] opacity-0" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="anim-traitor-zoom anim-move relative aspect-[3/2] w-[min(70vw,22rem)] overflow-hidden rounded-2xl bg-traitor opacity-0 shadow-2xl">
              <CardArt type="traitor" id={traitor.value.cardId} />
              <span className="absolute inset-x-0 bottom-2 text-center font-card text-2xl text-paper uppercase">
                {traitor.value.word}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
