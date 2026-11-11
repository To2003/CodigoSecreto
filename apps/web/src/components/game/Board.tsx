import type { CardType, PublicCard, PublicPlayer, RoomEvent, RoomView } from '@clave/shared';
import { memo, useEffect, useState, type CSSProperties } from 'react';
import { CardArt } from '../../art/CardArt';
import { t } from '../../i18n/es-AR';
import { pointCard, revealCard } from '../../net/client';
import { useReducedMotion } from '../../store/prefs';
import { useRoom } from '../../store/room';
import { useSocial } from '../../store/social';
import { REVEALED_BG } from '../../art/cardStyles';
import { Avatar } from '../Avatar';
import { FitText } from './FitText';

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

/** How long a reveal's own effects (glow, particles, shake) stay mounted. */
const EFFECT_MS = 1800;

/** How long a first tap keeps a card "armed" for the revealing second tap (SPEC §3.3). */
const ARM_MS = 3000;

const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

/** How a reveal landed for the team that made it (SPEC §4 reveal table). */
export type RevealKind = 'own' | 'civilian' | 'rival' | 'traitor' | 'penalty';

function revealKinds(events: RoomEvent[]): Map<string, RevealKind> {
  const kinds = new Map<string, RevealKind>();
  for (const e of events) {
    if (e.type !== 'CARD_REVEALED') continue;
    const kind: RevealKind = e.penalty
      ? 'penalty'
      : e.cardType === e.team
        ? 'own'
        : e.cardType === 'civilian' || e.cardType === 'traitor'
          ? e.cardType
          : 'rival';
    kinds.set(e.cardId, kind);
  }
  return kinds;
}

/** Six specks that burst from the card's center (transform and opacity only). */
const PARTICLES = [
  [-28, -18],
  [26, -20],
  [-34, 6],
  [34, 8],
  [-12, 22],
  [14, 24],
] as const;

function RevealEffects({ kind, type }: { kind: RevealKind; type: CardType }) {
  if (kind === 'own') {
    const color = type === 'red' ? 'bg-red' : 'bg-blue';
    return (
      <>
        <span
          aria-hidden="true"
          className={`anim-glow anim-move pointer-events-none absolute -inset-1.5 rounded-[14px] opacity-0 blur-md ${color}`}
        />
        {PARTICLES.map(([dx, dy]) => (
          <span
            key={`${dx},${dy}`}
            aria-hidden="true"
            className="anim-particle anim-move pointer-events-none absolute top-1/2 left-1/2 size-1.5 rounded-full bg-accent opacity-0"
            style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
          />
        ))}
      </>
    );
  }
  return null;
}

function TypeIcon({ type, className = '' }: { type: CardType; className?: string }) {
  return (
    <span aria-hidden="true" className={`font-bold leading-none ${className}`}>
      {t.game.typeIcon[type]}
    </span>
  );
}

interface CardProps {
  card: PublicCard;
  showMap: boolean;
  armed: boolean;
  arm: (cardId: string | null) => void;
  index: number;
  kind: RevealKind | undefined;
  /** This viewer is an agent of the team guessing right now (and the game isn't paused). */
  canAct: boolean;
  /** Reveals happen by direct click (not by majority). */
  directReveal: boolean;
  iPoint: boolean;
  pointers: PublicPlayer[];
  over: boolean;
  /** Picked from the clue history (SPEC §9). */
  highlighted: boolean;
}

/** Props compared by value: a patch rebuilds every object, but most cards don't change. */
function sameCard(a: CardProps, b: CardProps): boolean {
  return (
    a.card.id === b.card.id &&
    a.card.word === b.card.word &&
    a.card.revealed === b.card.revealed &&
    a.card.type === b.card.type &&
    a.showMap === b.showMap &&
    a.armed === b.armed &&
    a.index === b.index &&
    a.kind === b.kind &&
    a.canAct === b.canAct &&
    a.directReveal === b.directReveal &&
    a.iPoint === b.iPoint &&
    a.over === b.over &&
    a.highlighted === b.highlighted &&
    a.pointers.map((p) => `${p.id}:${p.avatar}:${p.color}:${p.nickname}`).join() ===
      b.pointers.map((p) => `${p.id}:${p.avatar}:${p.color}:${p.nickname}`).join()
  );
}

const Card = memo(function Card({
  card,
  showMap,
  armed,
  arm,
  index,
  kind,
  canAct,
  directReveal,
  iPoint,
  pointers,
  over,
  highlighted,
}: CardProps) {
  const reduced = useReducedMotion();
  // Flip only when this card turns while on screen (not when the board loads already revealed).
  // Detected during render ("previous prop" pattern), so the first frame is already the flip.
  const [prevRevealed, setPrevRevealed] = useState(card.revealed);
  const [flipping, setFlipping] = useState(false);
  const [fading, setFading] = useState(false);
  // The reveal's outcome, captured when it happens, so later patches don't cut its effects.
  const [effect, setEffect] = useState<RevealKind | undefined>(undefined);
  if (card.revealed !== prevRevealed) {
    setPrevRevealed(card.revealed);
    if (card.revealed && reduced) setFading(true);
    if (card.revealed && !reduced) {
      setFlipping(true);
      setEffect(kind);
    }
  }
  useEffect(() => {
    if (!effect) return;
    const timer = setTimeout(() => {
      setEffect(undefined);
    }, EFFECT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [effect]);
  const type = card.revealed || showMap ? card.type : undefined;
  const canPoint = !card.revealed && canAct;
  const revealable = canPoint && directReveal;
  const touchArmed = revealable && armed;
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

  const back = type ? (
    <span className={`absolute inset-0 overflow-hidden rounded-[10px] ${REVEALED_BG[type]}`}>
      <span className="absolute inset-0 opacity-90">
        <CardArt type={type} id={card.id} />
      </span>
      {type === 'civilian' && (
        // Civilians stay softly desaturated; the veil fades in only right after the flip.
        <span
          aria-hidden="true"
          className={`absolute inset-0 bg-[#7f7a70]/35 ${effect === 'civilian' ? 'anim-veil' : ''}`}
        />
      )}
      <span className="revealed-label absolute inset-x-0.5 bottom-0.5 rounded-sm bg-black/60 px-0.5 text-center text-paper">
        <FitText text={card.word} className="font-card font-medium uppercase" />
      </span>
    </span>
  ) : null;
  const front = (
    <span className="paper absolute inset-0 overflow-hidden rounded-[10px] text-ink">
      {type && (
        // At game over the rest of the map fades in as a cascade (SPEC §4 victory).
        <span
          className={`absolute inset-0 ${KEY_TINT[type]} ${over ? 'anim-map-in' : ''}`}
          style={over ? ({ '--i': index } as CSSProperties) : undefined}
        />
      )}
      {type && <span className={`absolute inset-y-0 left-0 w-1.5 sm:w-2 ${KEY_BAND[type]}`} />}
      <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 text-center sm:inset-x-2.5">
        <FitText
          text={card.word}
          className={`font-card font-semibold tracking-wide uppercase ${type === 'traitor' ? 'text-paper' : ''}`}
        />
      </span>
    </span>
  );
  const row = Math.floor(index / 5);
  const col = index % 5;

  return (
    <div
      className="anim-card-in anim-move relative"
      style={{ '--i': row + col } as CSSProperties}
      data-card-id={card.id}
      data-word={card.word}
      data-revealed={card.revealed}
      data-type={type}
      data-highlighted={highlighted || undefined}
    >
      {highlighted && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 z-10 rounded-[13px] ring-4 ring-accent"
        />
      )}
      <button
        type="button"
        disabled={!canPoint}
        aria-pressed={canPoint && !touchArmed ? iPoint : undefined}
        aria-label={label}
        aria-describedby={describedBy}
        onClick={onClick}
        style={{ perspective: '700px' }}
        className={`${effect === 'rival' ? 'anim-shake anim-move' : ''} relative block aspect-[3/2] w-full rounded-[10px] text-left shadow-[0_2px_0_rgb(0_0_0/0.35)] transition-transform enabled:cursor-pointer enabled:hover:-translate-y-0.5 ${iPoint || touchArmed ? 'ring-4 ring-accent' : ''}`}
      >
        {flipping && type ? (
          // 3D flip (SPEC §4): the word face turns over onto the revealed face.
          <span
            className="anim-flip absolute inset-0"
            onAnimationEnd={(e) => {
              // Only the flip itself ends the flip: inner animations (the game-over tint) bubble up.
              if (e.target === e.currentTarget && e.animationName === 'flip') setFlipping(false);
            }}
          >
            <span
              aria-hidden="true"
              className="face absolute inset-0 overflow-hidden rounded-[10px]"
            >
              {front}
            </span>
            <span className="face face-back absolute inset-0 overflow-hidden rounded-[10px]">
              {back}
            </span>
          </span>
        ) : card.revealed && type ? (
          <span
            className={`absolute inset-0 ${fading ? 'anim-fade-quick' : ''}`}
            onAnimationEnd={() => {
              setFading(false);
            }}
          >
            {back}
          </span>
        ) : (
          front
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
      {effect && card.revealed && type && !reduced && <RevealEffects kind={effect} type={type} />}
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
            <span key={p.id} className="anim-drop anim-move">
              <Avatar avatar={p.avatar} color={p.color} size={22} />
            </span>
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
}, sameCard);

export function Board({ view, showMap }: { view: RoomView; showMap: boolean }) {
  const cards = view.game?.cards ?? [];
  const [armed, setArmed] = useState<string | null>(null);
  const kinds = revealKinds(useRoom((s) => s.lastEvents));
  const highlight = useSocial((s) => s.highlight);
  const game = view.game;
  const me = view.players.find((p) => p.id === view.youId);
  const phase = game?.phase;
  const canAct =
    !!game &&
    !game.paused &&
    phase?.name === 'guess' &&
    me?.team === phase.team &&
    me.role === 'agent';

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
      {cards.map((card, index) => (
        <Card
          key={card.id}
          index={index}
          kind={kinds.get(card.id)}
          canAct={canAct}
          directReveal={view.settings.revealMode === 'any'}
          iPoint={game?.points[view.youId] === card.id}
          pointers={view.players.filter((p) => game?.points[p.id] === card.id)}
          over={phase?.name === 'over'}
          highlighted={highlight.includes(card.id)}
          card={card}
          showMap={showMap}
          armed={armed === card.id}
          arm={setArmed}
        />
      ))}
    </div>
  );
}
