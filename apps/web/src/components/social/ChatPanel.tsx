import { EMOTES, MAX_CHAT_LENGTH, type RoomView } from '@clave/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../../i18n/es-AR';
import { sendChat, sendEmote } from '../../net/client';
import { useSocial } from '../../store/social';

const SCOPES = ['all', 'team'] as const;

/** Who may write right now (SPEC §9): mirrors the server rule so the UI explains instead of failing. */
function mutedNow(view: RoomView): boolean {
  const me = view.players.find((p) => p.id === view.youId);
  if (view.status !== 'playing' || !me) return false;
  if (me.team === 'spectator') return view.settings.spectatorsSeeMap && view.game?.seesMap === true;
  return me.role === 'spymaster';
}

export function EmoteBar() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label={t.social.emotes} className="flex flex-wrap gap-1">
        {EMOTES.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={t.social.emoteName[id]}
            onClick={() => {
              void sendEmote(id).then((res) => {
                setError(res.ok ? null : t.errors[res.code]);
              });
            }}
            className="flex size-9 items-center justify-center rounded-md border border-line text-lg active:scale-97"
          >
            {t.social.emoji[id]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-soft">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * General and team chat (SPEC §9). The log is `role="log"`, so screen readers announce new lines.
 * `data-chat-log` lets the sound cue know whether a chat is on screen.
 */
export function ChatPanel({ view, className = '' }: { view: RoomView; className?: string }) {
  const messages = useSocial((s) => s.messages);
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'all' | 'team'>('all');
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const me = view.players.find((p) => p.id === view.youId);
  const name = (id: string) =>
    id === view.youId ? t.social.you : (view.players.find((p) => p.id === id)?.nickname ?? '');
  const disabled = !view.settings.chat;
  const muted = mutedNow(view);

  // Keep the newest line in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  return (
    <section
      aria-label={t.social.chat}
      className={`flex flex-col gap-2 rounded-lg bg-surface p-3 ${className}`}
    >
      <h2 className="font-stamp text-lg">{t.social.chat}</h2>
      <EmoteBar />
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        data-chat-log
        data-testid="chat-log"
        className="flex max-h-56 min-h-16 flex-col gap-1 overflow-y-auto text-sm"
      >
        {messages.length === 0 && <p className="text-paper/60">{t.social.empty}</p>}
        {messages.map((m) => (
          <p key={m.id} className={m.scope === 'team' ? 'text-accent' : ''}>
            {t.social.line(name(m.playerId), m.text, m.scope === 'team')}
          </p>
        ))}
      </div>
      {disabled ? (
        <p className="text-sm text-paper/70">{t.social.disabled}</p>
      ) : muted ? (
        <p className="text-sm text-paper/70">{t.social.muted}</p>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() === '') return;
            void sendChat(text, scope).then((res) => {
              if (res.ok) {
                setText('');
                setError(null);
              } else setError(t.errors[res.code]);
            });
          }}
        >
          {me?.team !== 'spectator' && (
            <fieldset className="flex gap-3 text-sm">
              <legend className="sr-only">{t.social.scope}</legend>
              {SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`${inputId}-scope`}
                    checked={scope === s}
                    onChange={() => {
                      setScope(s);
                    }}
                  />
                  {s === 'all' ? t.social.scopeAll : t.social.scopeTeam}
                </label>
              ))}
            </fieldset>
          )}
          <div className="flex gap-2">
            <label htmlFor={inputId} className="sr-only">
              {t.social.placeholder}
            </label>
            <input
              id={inputId}
              value={text}
              maxLength={MAX_CHAT_LENGTH}
              placeholder={t.social.placeholder}
              autoComplete="off"
              onChange={(e) => {
                setText(e.target.value);
              }}
              className="min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1.5"
            />
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-1.5 font-semibold text-ink active:scale-97"
            >
              {t.social.send}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-soft">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
