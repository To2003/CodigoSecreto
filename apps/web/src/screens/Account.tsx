import type { AccountView } from '@clave/shared';
import { useEffect, useId, useState } from 'react';
import { DeleteAccount } from '../components/DeleteAccount';
import { PageShell } from '../components/PageShell';
import { Button, ButtonLink } from '../components/ui/Button';
import { IconDoor, IconPodium, IconShield } from '../components/ui/icons';
import { t } from '../i18n/es-AR';
import { getAccount, setDisplayName } from '../net/accountsApi';
import { accountsEnabled, authMode, signIn, signOut } from '../net/auth';

type State =
  | { name: 'loading' }
  | { name: 'guest' }
  | { name: 'error' }
  | { name: 'deleted' }
  | { name: 'ready'; account: AccountView };

/** Sign in with Google (or the test sign-in in development). */
function SignIn() {
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  const id = useId();
  const go = () => {
    void signIn({ returnTo: `${window.location.origin}/cuenta`, name }).then((ok) => {
      if (!ok) setFailed(true);
      // A new session needs a new connection: the token travels when the socket connects.
      else if (authMode === 'memory') window.location.reload();
    });
  };
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
      <p className="text-paper/80">{t.accounts.optional}</p>
      {authMode === 'memory' ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <label htmlFor={id} className="flex flex-col gap-1 text-sm">
            {t.accounts.devName}
            <input
              id={id}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              className="min-h-11 rounded-md border border-line bg-bg px-3 py-2"
            />
          </label>
          <Button type="submit" variant="primary">
            {t.accounts.signInDev}
          </Button>
        </form>
      ) : (
        <Button variant="primary" size="lg" className="self-start" onClick={go}>
          {t.accounts.signInGoogle}
        </Button>
      )}
      {failed && (
        <p role="alert" className="text-sm text-red-soft">
          {t.accounts.signInFailed}
        </p>
      )}
    </section>
  );
}

function NameForm({
  initial,
  onSaved,
}: {
  initial: string | null;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(initial ?? '');
  const [note, setNote] = useState<string | null>(null);
  const id = useId();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void setDisplayName(name).then((res) => {
          if (res.ok) {
            setNote(t.accounts.saved);
            onSaved(res.data.displayName);
          } else setNote(res.status === 400 ? t.accounts.nameInvalid : t.accounts.unavailable);
        });
      }}
    >
      <label htmlFor={id} className="font-semibold">
        {t.accounts.nameLabel}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={name}
          maxLength={20}
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            setName(e.target.value);
          }}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2"
        />
        <Button type="submit" variant="primary">
          {t.accounts.save}
        </Button>
      </div>
      <p id={`${id}-help`} className="text-sm text-paper/70">
        {initial === null ? t.accounts.nameEmpty : t.accounts.nameHelp}
      </p>
      {note && (
        <p role="status" className="text-sm text-accent">
          {note}
        </p>
      )}
    </form>
  );
}

/** /cuenta (docs/specs/M9-cuentas.md §2): sign in, your public name and your stats. */
export default function Account() {
  const [state, setState] = useState<State>({ name: 'loading' });
  useEffect(() => {
    if (!accountsEnabled) return;
    void getAccount().then((res) => {
      if (res.ok) setState({ name: 'ready', account: res.data });
      else setState(res.status === 401 ? { name: 'guest' } : { name: 'error' });
    });
  }, []);

  if (!accountsEnabled) {
    return (
      <PageShell title={t.accounts.title}>
        <p>{t.accounts.off}</p>
      </PageShell>
    );
  }
  return (
    <PageShell title={t.accounts.title}>
      {state.name === 'loading' && <p role="status">{t.accounts.loading}</p>}
      {state.name === 'error' && <p role="alert">{t.accounts.unavailable}</p>}
      {state.name === 'deleted' && <p role="status">{t.privacy.deleted}</p>}
      {(state.name === 'guest' || state.name === 'deleted') && <SignIn />}
      {state.name === 'ready' && (
        <>
          <section className="rounded-lg bg-surface p-4">
            <NameForm
              initial={state.account.displayName}
              onSaved={(displayName) => {
                setState({ name: 'ready', account: { ...state.account, displayName } });
              }}
            />
          </section>
          <section
            aria-labelledby="stats-title"
            className="flex flex-col gap-1 rounded-lg bg-surface p-4"
            data-testid="account-stats"
          >
            <h2 id="stats-title" className="mb-1 font-stamp text-xl">
              {t.accounts.statsTitle}
            </h2>
            <p>{t.accounts.games(state.account.stats.games)}</p>
            <p>{t.accounts.wins(state.account.stats.wins)}</p>
            <p>
              {t.accounts.asSpymaster(
                state.account.stats.gamesAsSpymaster,
                state.account.stats.winsAsSpymaster,
              )}
            </p>
            <p>
              {t.accounts.asAgent(
                state.account.stats.gamesAsAgent,
                state.account.stats.winsAsAgent,
              )}
            </p>
            <p>
              {t.accounts.streak(state.account.stats.currentStreak, state.account.stats.bestStreak)}
            </p>
            <p>
              {state.account.stats.bestClue
                ? t.accounts.bestClue(
                    state.account.stats.bestClue.word,
                    state.account.stats.bestClue.hits,
                  )
                : t.accounts.noBestClue}
            </p>
            <p>{t.accounts.likes(state.account.stats.likesReceived)}</p>
            <p className="mt-2 text-sm text-paper/70">{t.accounts.statsNote}</p>
          </section>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink to="/ranking" variant="secondary" icon={<IconPodium />}>
              {t.accounts.toRanking}
            </ButtonLink>
            <Button
              variant="secondary"
              icon={<IconDoor />}
              onClick={() => {
                void signOut().then(() => {
                  window.location.assign('/');
                });
              }}
            >
              {t.accounts.signOut}
            </Button>
            <ButtonLink to="/privacidad" variant="ghost" icon={<IconShield />}>
              {t.accounts.toPrivacy}
            </ButtonLink>
          </div>
          <DeleteAccount
            onDeleted={() => {
              setState({ name: 'deleted' });
            }}
          />
        </>
      )}
    </PageShell>
  );
}
