import type { ReactNode } from 'react';
import { t } from '../i18n/es-AR';
import { navigate } from '../lib/router';

/** The frame of the side pages (account, ranking, privacy): a stamped title and a way back. */
export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-stamp text-4xl">{title}</h1>
        <a
          href="/"
          className="text-sm text-accent underline"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          {t.accounts.home}
        </a>
      </header>
      {children}
    </main>
  );
}

/** An in-app link that keeps the single-page navigation. */
export function PageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={to}
      className="text-accent underline"
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
