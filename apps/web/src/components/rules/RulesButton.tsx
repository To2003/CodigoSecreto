import { lazy, Suspense, useRef, useState } from 'react';
import { t } from '../../i18n/es-AR';
import { Button } from '../ui/Button';

const RulesContent = lazy(() =>
  import('./RulesContent').then((m) => ({ default: m.RulesContent })),
);

/** "?" in the game bar (SPEC §8.2): the rules in a modal, without leaving the game. */
export function RulesButton({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Content only while open: it's lazy, and a closed dialog shouldn't hold a second copy.
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`btn btn-secondary ${className}`}
        onClick={() => {
          setOpen(true);
          ref.current?.showModal();
        }}
      >
        {/* The name is the word ("Reglas"); phones show just the "?" next to it. */}
        <span aria-hidden="true">{t.rules.openShort}</span>
        <span className="sr-only sm:not-sr-only sm:ml-1 sm:font-normal">{t.rules.open}</span>
      </button>
      <dialog
        ref={ref}
        aria-labelledby="rules-dialog-title"
        onClose={() => {
          setOpen(false);
        }}
        className="m-auto max-h-[85dvh] w-[min(42rem,calc(100%-2rem))] rounded-xl bg-bg p-5 text-paper backdrop:bg-black/70"
      >
        <h2 id="rules-dialog-title" className="mb-4 font-stamp text-3xl">
          {t.rules.title}
        </h2>
        {open && (
          <Suspense fallback={null}>
            <RulesContent headingLevel={3} />
          </Suspense>
        )}
        <form method="dialog" className="mt-4 text-right">
          <Button type="submit" variant="primary">
            {t.rules.close}
          </Button>
        </form>
      </dialog>
    </>
  );
}
