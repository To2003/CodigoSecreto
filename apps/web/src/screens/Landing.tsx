import { roomCodeSchema } from '@clave/shared';
import { useId, useState } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ProfileForm } from '../components/ProfileForm';
import { t } from '../i18n/es-AR';
import { navigate, roomPath } from '../lib/router';
import { createRoom } from '../net/client';

export function Landing() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const codeId = useId();
  const validCode = roomCodeSchema.safeParse(code);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-6xl font-bold tracking-widest text-paper uppercase">{t.app.name}</h1>
        <p className="text-paper/80">{t.app.tagline}</p>
        <ConnectionIndicator />
      </header>

      <section className="rounded-xl border border-paper/15 p-4">
        <ProfileForm
          submitLabel={t.landing.create}
          busyLabel={t.landing.creating}
          onSubmit={async (profile) => {
            setError(null);
            const res = await createRoom(profile);
            if (res.ok) navigate(roomPath(res.roomCode));
            else setError(t.errors[res.code]);
          }}
        />
        {error && (
          <p role="alert" className="mt-3 text-red-soft">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-paper/15 p-4">
        <h2 className="text-lg font-semibold">{t.landing.joinTitle}</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (validCode.success) navigate(roomPath(validCode.data));
          }}
        >
          <label htmlFor={codeId} className="sr-only">
            {t.landing.codeLabel}
          </label>
          <input
            id={codeId}
            value={code}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={t.landing.codePlaceholder}
            aria-describedby={`${codeId}-help`}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
            }}
            className="w-28 rounded-md border border-paper/30 bg-bg px-3 py-2 text-center font-mono text-lg tracking-widest text-paper uppercase"
          />
          <button
            type="submit"
            disabled={!validCode.success}
            className="rounded-md border border-accent px-4 py-2 font-semibold text-accent active:scale-97 disabled:opacity-50"
          >
            {t.landing.join}
          </button>
        </form>
        <p id={`${codeId}-help`} className="text-sm text-paper/70">
          {t.landing.codeHelp}
        </p>
      </section>

      <footer className="mt-auto text-center text-xs text-paper/60">{t.app.footer}</footer>
    </main>
  );
}
