import { useId, useRef, useState } from 'react';
import { t } from '../i18n/es-AR';
import { deleteAccount } from '../net/accountsApi';
import { signOut } from '../net/auth';
import { Button } from './ui/Button';
import { IconBin } from './ui/icons';

/**
 * The danger zone (ADR-035): a red button set apart at the end of the page, and a modal that says
 * exactly what gets deleted before anything is. Focus starts on "Cancelar": the safe answer.
 */
export function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-red-deep/70 p-4"
      data-testid="danger-zone"
    >
      <h2 id={`${id}-title`} className="font-stamp text-xl text-red-ink">
        {t.privacy.dangerTitle}
      </h2>
      <p className="text-paper/85">{t.privacy.deleteHelp}</p>
      <Button
        variant="danger"
        icon={<IconBin />}
        onClick={() => {
          setFailed(false);
          ref.current?.showModal();
          cancelRef.current?.focus();
        }}
      >
        {t.privacy.delete}
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-red-soft">
          {t.privacy.failed}
        </p>
      )}
      <dialog
        ref={ref}
        role="alertdialog"
        aria-labelledby={`${id}-confirm`}
        aria-describedby={`${id}-what`}
        className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-xl border border-line bg-surface p-5 text-paper backdrop:bg-black/70"
      >
        <h2 id={`${id}-confirm`} className="font-stamp text-2xl">
          {t.privacy.confirmTitle}
        </h2>
        <div id={`${id}-what`} className="mt-3 flex flex-col gap-3">
          <p>{t.privacy.confirm}</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-paper/90">
            {t.privacy.confirmList.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm text-paper/75">{t.privacy.confirmKeeps}</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="secondary"
            onClick={() => {
              ref.current?.close();
            }}
          >
            {t.privacy.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void deleteAccount().then(async (res) => {
                setBusy(false);
                ref.current?.close();
                if (!res.ok) {
                  setFailed(true);
                  return;
                }
                await signOut();
                onDeleted();
              });
            }}
          >
            {busy ? t.privacy.deleting : t.privacy.confirmYes}
          </Button>
        </div>
      </dialog>
    </section>
  );
}
