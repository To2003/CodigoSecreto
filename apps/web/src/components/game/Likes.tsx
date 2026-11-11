import type { RoomView } from '@clave/shared';
import { useState } from 'react';
import { t } from '../../i18n/es-AR';
import { giveLike } from '../../net/client';
import { useSocial } from '../../store/social';

/**
 * Likes at the end of a classic game (docs/specs/M9-cuentas.md §5): give one to anyone who
 * played, and see how many you got. Nobody sees who gave what; the server enforces the rules.
 */
export function Likes({ view }: { view: RoomView }) {
  const likes = view.likes;
  const live = useSocial((s) => s.likesReceived);
  const [given, setGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!likes) return null;
  const received = Math.max(likes.received, live);
  const done = given || likes.given;
  const others = view.players.filter((p) => p.id !== view.youId && p.team !== 'spectator');

  return (
    <section aria-labelledby="likes-title" className="flex flex-col gap-2" data-testid="likes">
      {received > 0 && (
        <p
          key={received}
          role="status"
          className="flex items-center gap-2 font-semibold text-accent"
          data-testid="likes-received"
        >
          <span
            aria-hidden="true"
            className="anim-like anim-move inline-block text-2xl text-red-soft"
          >
            {t.likes.heart}
          </span>
          {t.likes.received(received)}
        </p>
      )}
      <h3 id="likes-title" className="font-stamp text-lg">
        {t.likes.title}
      </h3>
      {done ? (
        <p className="text-sm text-paper/80">{t.likes.given}</p>
      ) : (
        <>
          <p className="text-sm text-paper/70">{t.likes.help}</p>
          <ul className="flex flex-wrap gap-2">
            {others.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    void giveLike(p.id).then((res) => {
                      if (res.ok) setGiven(true);
                      else setError(t.errors[res.code]);
                    });
                  }}
                  className="rounded-full border border-red-soft/70 px-3 py-1 text-sm active:scale-97"
                >
                  <span aria-hidden="true" className="mr-1 text-red-soft">
                    {t.likes.heart}
                  </span>
                  {t.likes.give(p.nickname)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-soft">
          {error}
        </p>
      )}
    </section>
  );
}
