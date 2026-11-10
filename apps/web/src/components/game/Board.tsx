import type { CardType, PublicCard, RoomView } from '@clave/shared';
import { useEffect, useState } from 'react';
import { CardArt } from '../../art/CardArt';
import { t } from '../../i18n/es-AR';
import { pointCard, revealCard } from '../../net/client';
import { Avatar } from '../Avatar';
import { FitText } from './FitText';

const REVEALED_BG: Record<CardType, string> = {
  red: 'bg-red pattern-red',
  blue: 'bg-blue pattern-blue',
  civilian: 'bg-civil',
  traitor: 'bg-traitor',
};
/** Spymaster's key map: a colored band and a light tint keep the word readable (SPEC §3.2). */
const KEY_BAND: Record<CardType, string> = {
  red: 'bg-red pattern-red',
  blue: 'bg-blue pattern-blue',
  civilian: 'bg-civil',
  traitor: 'bg-traitor',
};
const KEY_TINT: Record<CardType, string> = {
  red: 'bg-red/25',
  blue: 'bg-blue/25',
  civilian: 'bg-transparent',
  traitor: 'bg-ink/85',
};

/** How long a first tap keeps a card "armed" for the revealing second tap (SPEC §3.3). */
const ARM_MS = 3000;

const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

function TypeIcon({ type, className = '' }: { type: CardType; className?: string }) {
  return (
    <span aria-hidden="true" className={`font-bold leading-none ${className}`}>
      {t.game.typeIcon[type]}
    </span>
  );
}

function Card({
  card,
  view,
  showMap,
  armed,
  arm,
}: {
  card: PublicCard;
  view: RoomView;
  showMap: boolean;
  armed: boolean;
  arm: (cardId: string | null) => void;
}) {
  const game = view.game;
  if (!game) return null;
  const me = view.players.find((p) => p.id === view.youId);
  const type = card.revealed || showMap ? card.type : undefined;
  const phase = game.phase;
  const canPoint =
    !card.revealed &&
    !game.paused &&
    phase.name === 'guess' &&
    me?.team === phase.team &&
    me.role === 'agent';
  const iPoint = game.points[view.youId] === card.id;
  const revealable = canPoint && view.settings.revealMode === 'any';
  const touchArmed = revealable && armed;
  const pointers = view.players.filter((p) => game.points[p.id] === card.id);
  const describedBy = pointers.length > 0 ? `pointed-${card.id}` : undefined;

  const onClick = () => {
    if (!coarsePointer() || !revealable) {
      void pointCard(iPoint ? null : card.id);
      return;
    }
    // Touch (SPEC §3.3): first tap points and arms; a second tap within ARM_MS reveals.
    // Armed state is local, so the second tap doesn't wait for the server's confirmation.
    if (touchArmed) {
      arm(null);
      void revealCard(card.id);
    } else if (iPoint) {
      void pointCard(null);
    } else {
      arm(card.id);
      void pointCard(card.id);
    }
  };

  const label = touchArmed
    ? t.game.reveal(card.word)
    : canPoint
      ? iPoint
        ? t.game.unpoint(card.word)
        : t.game.point(card.word)
      : t.game.cardLabel(card.word, type ? t.game.cardType[type] : null, card.revealed);

  return (
    <div
      className="relative"
      data-card-id={card.id}
      data-word={card.word}
      data-revealed={card.revealed}
      data-type={type}
    >
      <button
        type="button"
        disabled={!canPoint}
        aria-pressed={canPoint && !touchArmed ? iPoint : undefined}
        aria-label={label}
        aria-describedby={describedBy}
        onClick={onClick}
        className={`relative block aspect-[3/2] w-full overflow-hidden rounded-[10px] text-left shadow-[0_2px_0_rgb(0_0_0/0.35)] transition-transform enabled:cursor-pointer enabled:hover:-translate-y-0.5 ${iPoint || touchArmed ? 'ring-4 ring-accent' : ''}`}
      >
        {card.revealed && type ? (
          <span className={`absolute inset-0 ${REVEALED_BG[type]}`}>
            <span className="absolute inset-0 opacity-90">
              <CardArt type={type} id={card.id} />
            </span>
            <span className="revealed-label absolute inset-x-0.5 bottom-0.5 rounded-sm bg-black/60 px-0.5 text-center text-paper">
              <FitText text={card.word} className="font-card font-medium uppercase" />
            </span>
          </span>
        ) : (
          <span className="paper absolute inset-0 text-ink">
            {type && <span className={`absolute inset-0 ${KEY_TINT[type]}`} />}
            {type && (
              <span className={`absolute inset-y-0 left-0 w-1.5 sm:w-2 ${KEY_BAND[type]}`} />
            )}
            <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 text-center sm:inset-x-2.5">
              <FitText
                text={card.word}
                className={`font-card font-semibold tracking-wide uppercase ${type === 'traitor' ? 'text-paper' : ''}`}
              />
            </span>
          </span>
        )}
      </button>
      {/* Decorations sit outside the button so its accessible name is just the word (WCAG 2.5.3). */}
      {!card.revealed && (
        // Mirrored word, as on a physical card read from across the table (SPEC §5.4).
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-2 top-1 hidden rotate-180 text-center font-card text-[0.6rem] tracking-wide uppercase sm:block ${type === 'traitor' ? 'text-paper/50' : 'text-ink/35'}`}
        >
          {card.word}
        </span>
      )}
      {/* The type icon is always on the spymaster's map, not only in color-blind mode (SPEC §3.2). */}
      {!card.revealed && type && (
        <TypeIcon
          type={type}
          className={`pointer-events-none absolute top-1 right-1.5 text-[0.65rem] sm:text-sm ${type === 'traitor' ? 'text-accent' : 'text-ink'}`}
        />
      )}
      {touchArmed && (
        <span className="pointer-events-none absolute inset-x-0 -bottom-5 z-10 text-center text-[0.65rem] font-semibold text-accent">
          {t.game.tapAgain}
        </span>
      )}
      {pointers.length > 0 && (
        <div className="pointer-events-none absolute -top-2 left-1 flex -space-x-2">
          <span id={describedBy} className="sr-only">
            {t.game.pointedBy(pointers.map((p) => p.nickname))}
          </span>
          {pointers.map((p) => (
            <Avatar key={p.id} avatar={p.avatar} color={p.color} size={22} />
          ))}
        </div>
      )}
      {revealable && iPoint && (
        <button
          type="button"
          aria-label={t.game.reveal(card.word)}
          onClick={() => {
            arm(null);
            void revealCard(card.id);
          }}
          className="absolute -top-2.5 -right-2 flex size-8 items-center justify-center rounded-full bg-accent font-bold text-ink shadow active:scale-97"
        >
          {t.game.revealIcon}
        </button>
      )}
    </div>
  );
}

export function Board({ view, showMap }: { view: RoomView; showMap: boolean }) {
  const cards = view.game?.cards ?? [];
  const [armed, setArmed] = useState<string | null>(null);

  // An armed card disarms after ARM_MS; the next tap then just un-points it.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => {
      setArmed(null);
    }, ARM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [armed]);

  return (
    <div
      className="grid touch-manipulation grid-cols-5 gap-x-1.5 gap-y-2.5 sm:gap-2.5"
      role="group"
      aria-label={t.game.board}
    >
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          view={view}
          showMap={showMap}
          armed={armed === card.id}
          arm={setArmed}
        />
      ))}
    </div>
  );
}
