import { roomCodeSchema } from '@clave/shared';
import { useId, useState } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ProfileForm } from '../components/ProfileForm';
import { SettingsButton } from '../components/SettingsDialog';
import { t } from '../i18n/es-AR';
import { navigate, roomPath } from '../lib/router';
import { createRoom } from '../net/client';

const LEARN = ['/tutorial', '/reglas', '/ranking', '/cuenta'] as const;
const LEARN_LABEL: Record<(typeof LEARN)[number], string> = {
  '/tutorial': t.tutorial.landingLink,
  '/reglas': t.tutorial.rulesLink,
  '/ranking': t.ranking.title,
  '/cuenta': t.accounts.landingAccount,
};

export function Landing() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const codeId = useId();
  const validCode = roomCodeSchema.safeParse(code);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-4 pt-4 text-center">
        <div className="relative">
          <h1 className="font-stamp text-7xl tracking-[0.2em] text-paper uppercase sm:text-8xl">
            {t.app.name}
          </h1>
          <span
            aria-hidden="true"
            className="absolute -right-6 -bottom-3 rotate-[-8deg] rounded border-[3px] border-double border-red-ink px-2 font-stamp text-base tracking-widest text-red-ink uppercase sm:-right-10"
          >
            {t.app.stamp}
          </span>
        </div>
        <p className="max-w-sm text-paper/80">{t.app.tagline}</p>
        <div className="flex items-center gap-3">
          <ConnectionIndicator />
          <SettingsButton />
        </div>
        <nav aria-label={t.landing.learn} className="flex gap-4 text-sm">
          {LEARN.map((path) => (
            <a
              key={path}
              href={path}
              className="text-accent underline"
              onClick={(e) => {
                e.preventDefault();
                navigate(path);
              }}
            >
              {LEARN_LABEL[path]}
            </a>
          ))}
        </nav>
      </header>

      <section className="rounded-lg bg-surface">
        <p className="rounded-t-lg bg-paper-shade px-4 py-1.5 font-stamp text-ink">
          {t.landing.newCase}
        </p>
        <div className="p-4">
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
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-surface p-4">
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
            className="w-28 rounded-md border border-paper/45 bg-bg px-3 py-2 text-center font-mono text-lg tracking-widest text-paper uppercase"
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
