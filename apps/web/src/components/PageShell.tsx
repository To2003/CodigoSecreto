import type { ReactNode } from 'react';
import { t } from '../i18n/es-AR';
import { goBack } from '../lib/router';
import { IconBack } from './ui/icons';
import { Button } from './ui/Button';

/** "← Volver", always in the same top-left corner of every side page (ADR-035). */
export function BackButton() {
  return (
    <Button
      variant="secondary"
      icon={<IconBack />}
      className="back-button"
      data-testid="back-button"
      onClick={goBack}
    >
      {t.nav.back}
    </Button>
  );
}

/**
 * The frame of the side pages (account, ranking, privacy, rules, tutorial): the back button in
 * its corner, then a stamped title. `width` follows the content: forms are narrow, rules wider.
 */
export function PageShell({
  title,
  aside,
  width = 'max-w-2xl',
  children,
}: {
  title: string;
  /** Something small that belongs next to the title (the tutorial's step counter). */
  aside?: ReactNode;
  width?: string;
  children: ReactNode;
}) {
  return (
    <>
      <BackButton />
      <main className={`mx-auto flex min-h-dvh ${width} flex-col gap-5 px-4 pt-20 pb-10`}>
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="font-stamp text-4xl">{title}</h1>
          {aside}
        </header>
        {children}
      </main>
    </>
  );
}
