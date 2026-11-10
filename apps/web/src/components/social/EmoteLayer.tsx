import type { RoomView } from '@clave/shared';
import { t } from '../../i18n/es-AR';
import { useSocial } from '../../store/social';
import { Avatar } from '../Avatar';

/**
 * Emotes float up over the sender's avatar (SPEC §9). They live in a corner layer so they show
 * on every layout, phones included, where the team panels are tucked in a sheet.
 */
export function EmoteLayer({ view }: { view: RoomView }) {
  const emotes = useSocial((s) => s.emotes);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-16 right-3 z-30 flex flex-col items-end gap-2"
      data-testid="emotes"
    >
      {emotes.map((e) => {
        const player = view.players.find((p) => p.id === e.playerId);
        if (!player) return null;
        return (
          <div
            key={e.key}
            className="anim-emote flex items-center gap-1.5 rounded-full bg-surface/90 py-1 pr-3 pl-1 opacity-0 shadow-lg"
          >
            <Avatar avatar={player.avatar} color={player.color} size={28} />
            <span className="text-sm">
              {t.social.emoteFrom(player.nickname, t.social.emoji[e.emoteId])}
            </span>
          </div>
        );
      })}
    </div>
  );
}
