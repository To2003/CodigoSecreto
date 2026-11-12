import { roomCodeSchema } from '@clave/shared';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ProfileForm } from '../components/ProfileForm';
import { SettingsButton } from '../components/SettingsDialog';
import { Button, ButtonLink } from '../components/ui/Button';
import {
  IconBook,
  IconKey,
  IconLens,
  IconPerson,
  IconPlus,
  IconPodium,
} from '../components/ui/icons';
import { t } from '../i18n/es-AR';
import { navigate, roomPath } from '../lib/router';
import { getAccount } from '../net/accountsApi';
import { hasSession } from '../net/auth';
import { createRoom } from '../net/client';

/** The signed-in name for "Mi cuenta"; guests never ask the server anything. */
function useAccountName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (!hasSession()) return;
    void getAccount().then((res) => {
      if (res.ok) setName(res.data.displayName);
    });
  }, []);
  return name;
}

/** A case folder: the paper tab on top names what's inside (SPEC §5.4). */
function Folder({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <section aria-label={tab} className="rounded-lg bg-surface">
      <h2 className="rounded-t-lg bg-paper-shade px-4 py-1.5 font-stamp text-lg text-ink">{tab}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Landing() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const codeId = useId();
  const validCode = roomCodeSchema.safeParse(code);
  const accountName = useAccountName();

  const learn = [
    { to: '/tutorial', label: t.tutorial.landingLink, icon: <IconLens /> },
    { to: '/reglas', label: t.tutorial.rulesLink, icon: <IconBook /> },
    { to: '/ranking', label: t.ranking.title, icon: <IconPodium /> },
    { to: '/cuenta', label: accountName ?? t.accounts.landingAccount, icon: <IconPerson /> },
  ];

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
      </header>

      <nav aria-label={t.landing.learn} className="-mt-2">
        <ul className="grid grid-cols-2 gap-2">
          {learn.map((item) => (
            <li key={item.to} className="flex">
              <ButtonLink
                to={item.to}
                variant="secondary"
                size="compact"
                icon={item.icon}
                className="w-full min-w-0 justify-start"
                data-testid={item.to === '/cuenta' ? 'landing-account' : undefined}
              >
                <span className="truncate">{item.label}</span>
              </ButtonLink>
            </li>
          ))}
        </ul>
      </nav>

      <Folder tab={t.landing.newCase}>
        <ProfileForm
          submitLabel={t.landing.create}
          busyLabel={t.landing.creating}
          submitIcon={<IconPlus />}
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
      </Folder>

      <Folder tab={t.landing.joinCase}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (validCode.success) navigate(roomPath(validCode.data));
          }}
        >
          <label htmlFor={codeId} className="text-sm">
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
            className="-mt-2 rounded-md border border-paper/45 bg-bg px-3 py-2.5 text-center font-card text-2xl tracking-[0.4em] text-paper uppercase"
          />
          <p id={`${codeId}-help`} className="-mt-1 text-sm text-paper/70">
            {t.landing.codeHelp}
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!validCode.success}
            icon={<IconKey />}
          >
            {t.landing.join}
          </Button>
        </form>
      </Folder>

      <footer className="mt-auto text-center text-xs text-paper/60">{t.app.footer}</footer>
    </main>
  );
}
