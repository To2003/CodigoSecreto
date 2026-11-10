import type { CardType, PublicCard, RoomView } from '@clave/shared';
import { t } from '../../i18n/es-AR';
import { pointCard, revealCard } from '../../net/client';
import { Avatar } from '../Avatar';

const REVEALED: Record<CardType, string> = {
  red: 'bg-red text-paper',
  blue: 'bg-blue text-paper',
  civilian: 'bg-civil text-ink',
  traitor: 'bg-traitor text-accent',
};
/** The spymaster's key map: a tint and a colored edge, so the word stays readable (SPEC §3.2). */
const KEYED: Record<CardType, string> = {
  red: 'bg-red-soft text-ink border-l-8 border-red',
  blue: 'bg-blue-soft text-ink border-l-8 border-blue',
  civilian: 'bg-paper text-ink border-l-8 border-civil',
  traitor: 'bg-ink text-paper border-l-8 border-accent',
};

function Card({ card, view, showMap }: { card: PublicCard; view: RoomView; showMap: boolean }) {
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
  const pointers = view.players.filter((p) => game.points[p.id] === card.id);
  const style = card.revealed && type ? REVEALED[type] : type ? KEYED[type] : 'bg-paper text-ink';

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
        aria-pressed={canPoint ? iPoint : undefined}
        aria-label={
          canPoint
            ? iPoint
              ? t.game.unpoint(card.word)
              : t.game.point(card.word)
            : t.game.cardLabel(card.word, type ? t.game.cardType[type] : null, card.revealed)
        }
        onClick={() => void pointCard(iPoint ? null : card.id)}
        className={`flex aspect-[3/2] w-full items-center justify-center rounded-lg px-1 text-center font-bold uppercase shadow-sm transition-transform enabled:hover:-translate-y-0.5 ${style} ${card.revealed ? 'opacity-80' : ''} ${iPoint ? 'ring-4 ring-accent' : ''}`}
        style={{ fontSize: 'clamp(0.55rem, 1.6vw, 1rem)' }}
      >
        <span className={card.revealed ? 'line-through decoration-2' : ''}>{card.word}</span>
      </button>
      {pointers.length > 0 && (
        <div
          className="pointer-events-none absolute top-1 left-1 flex -space-x-2"
          aria-label={t.game.pointedBy(pointers.map((p) => p.nickname))}
        >
          {pointers.map((p) => (
            <Avatar key={p.id} avatar={p.avatar} color={p.color} size={20} />
          ))}
        </div>
      )}
      {iPoint && game.phase.name === 'guess' && view.settings.revealMode === 'any' && (
        <button
          type="button"
          aria-label={t.game.reveal(card.word)}
          onClick={() => void revealCard(card.id)}
          className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-accent font-bold text-ink shadow active:scale-97"
        >
          {t.game.revealIcon}
        </button>
      )}
    </div>
  );
}

export function Board({ view, showMap }: { view: RoomView; showMap: boolean }) {
  const cards = view.game?.cards ?? [];
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label={t.app.name}>
      {cards.map((card) => (
        <Card key={card.id} card={card} view={view} showMap={showMap} />
      ))}
    </div>
  );
}
