import { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { t } from '../i18n/es-AR';
import { deleteAccount, getAccount } from '../net/accountsApi';
import { accountsEnabled, signOut } from '../net/auth';

/** /privacidad (docs/specs/M9-cuentas.md §2): what is kept, and deleting your account. */
export default function Privacy() {
  const [signedIn, setSignedIn] = useState(false);
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleted' | 'failed'>('idle');
  useEffect(() => {
    if (!accountsEnabled) return;
    void getAccount().then((res) => {
      setSignedIn(res.ok);
    });
  }, []);

  return (
    <PageShell title={t.privacy.title}>
      <section className="flex flex-col gap-3 text-paper/90">
        {t.privacy.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>
      {accountsEnabled && (
        <section
          aria-labelledby="delete-title"
          className="flex flex-col gap-3 rounded-lg bg-surface p-4"
        >
          <h2 id="delete-title" className="font-stamp text-xl">
            {t.privacy.deleteTitle}
          </h2>
          {step === 'deleted' ? (
            <p role="status">{t.privacy.deleted}</p>
          ) : !signedIn ? (
            <p className="text-paper/80">{t.privacy.signedOut}</p>
          ) : step === 'confirm' ? (
            <div className="flex flex-col gap-2">
              <p role="alert">{t.privacy.confirm}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md bg-red-deep px-4 py-2 font-semibold text-paper"
                  onClick={() => {
                    void deleteAccount().then(async (res) => {
                      if (!res.ok) {
                        setStep('failed');
                        return;
                      }
                      await signOut();
                      setSignedIn(false);
                      setStep('deleted');
                    });
                  }}
                >
                  {t.privacy.confirmYes}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-paper/40 px-4 py-2"
                  onClick={() => {
                    setStep('idle');
                  }}
                >
                  {t.privacy.cancel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-paper/80">{t.privacy.deleteHelp}</p>
              <button
                type="button"
                className="self-start rounded-md border border-red-soft px-4 py-2 font-semibold text-red-soft"
                onClick={() => {
                  setStep('confirm');
                }}
              >
                {t.privacy.delete}
              </button>
              {step === 'failed' && (
                <p role="alert" className="text-sm text-red-soft">
                  {t.privacy.failed}
                </p>
              )}
            </>
          )}
        </section>
      )}
    </PageShell>
  );
}
