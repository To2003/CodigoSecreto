import { useEffect, useState } from 'react';
import { DeleteAccount } from '../components/DeleteAccount';
import { PageShell } from '../components/PageShell';
import { t } from '../i18n/es-AR';
import { getAccount } from '../net/accountsApi';
import { accountsEnabled } from '../net/auth';

/** /privacidad (docs/specs/M9-cuentas.md §2): what is kept, and deleting your account. */
export default function Privacy() {
  const [account, setAccount] = useState<'guest' | 'signedIn' | 'deleted'>('guest');
  useEffect(() => {
    if (!accountsEnabled) return;
    void getAccount().then((res) => {
      if (res.ok) setAccount('signedIn');
    });
  }, []);

  return (
    <PageShell title={t.privacy.title}>
      <section className="flex max-w-prose flex-col gap-3 text-paper/90">
        {t.privacy.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>
      {accountsEnabled &&
        (account === 'signedIn' ? (
          <DeleteAccount
            onDeleted={() => {
              setAccount('deleted');
            }}
          />
        ) : (
          <section
            aria-labelledby="delete-title"
            className="flex flex-col gap-2 rounded-lg bg-surface p-4"
          >
            <h2 id="delete-title" className="font-stamp text-xl">
              {t.privacy.deleteTitle}
            </h2>
            {account === 'deleted' ? (
              <p role="status">{t.privacy.deleted}</p>
            ) : (
              <p className="text-paper/80">{t.privacy.signedOut}</p>
            )}
          </section>
        ))}
    </PageShell>
  );
}
