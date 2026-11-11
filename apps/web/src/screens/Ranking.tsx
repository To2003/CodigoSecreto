import type { RankingView } from '@clave/shared';
import { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { t } from '../i18n/es-AR';
import { getRanking } from '../net/accountsApi';
import { accountsEnabled } from '../net/auth';

type Tab = 'wins' | 'loved';
const TABS: readonly Tab[] = ['wins', 'loved'];

/** /ranking (docs/specs/M9-cuentas.md §4): wins and "los más queridos", mobile first. */
export default function Ranking() {
  const [tab, setTab] = useState<Tab>('wins');
  const [ranking, setRanking] = useState<RankingView | 'loading' | 'error'>('loading');
  useEffect(() => {
    if (!accountsEnabled) return;
    void getRanking().then((res) => {
      setRanking(res.ok ? res.data : 'error');
    });
  }, []);

  if (!accountsEnabled) {
    return (
      <PageShell title={t.ranking.title}>
        <p>{t.accounts.off}</p>
      </PageShell>
    );
  }
  const rows =
    typeof ranking === 'object'
      ? tab === 'wins'
        ? ranking.wins.map((r) => ({ ...r, detail: t.ranking.winsRow(r.wins, r.games) }))
        : ranking.loved.map((r) => ({
            ...r,
            detail: t.ranking.lovedRow(r.perGame, r.likes, r.games),
          }))
      : [];
  return (
    <PageShell title={t.ranking.title}>
      <div role="tablist" aria-label={t.ranking.tabs} className="flex gap-2">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`ranking-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="ranking-panel"
            tabIndex={tab === key ? 0 : -1}
            onClick={() => {
              setTab(key);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const next: Tab = tab === 'wins' ? 'loved' : 'wins';
                setTab(next);
                document.getElementById(`ranking-tab-${next}`)?.focus();
              }
            }}
            className={`flex-1 rounded-md px-3 py-2 font-semibold ${tab === key ? 'bg-accent text-ink' : 'border border-line'}`}
          >
            {key === 'wins' ? t.ranking.wins : t.ranking.loved}
          </button>
        ))}
      </div>
      <section
        id="ranking-panel"
        role="tabpanel"
        aria-labelledby={`ranking-tab-${tab}`}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-paper/70">
          {tab === 'wins' ? t.ranking.winsHelp : t.ranking.lovedHelp}
        </p>
        {ranking === 'loading' && <p role="status">{t.ranking.loading}</p>}
        {ranking === 'error' && <p role="alert">{t.ranking.unavailable}</p>}
        {typeof ranking === 'object' && rows.length === 0 && <p>{t.ranking.empty}</p>}
        {rows.length > 0 && (
          <ol className="flex flex-col gap-1.5" data-testid={`ranking-${tab}`}>
            {rows.map((r, i) => (
              <li
                key={`${r.displayName}-${String(i)}`}
                className={`paper flex items-center gap-3 rounded-md bg-paper px-3 py-2 text-ink ${r.me ? 'ring-4 ring-accent' : ''}`}
              >
                <span className="w-8 font-stamp text-lg">{t.ranking.position(i + 1)}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {r.displayName}
                  {r.me && <span className="ml-2 text-sm font-normal">{`(${t.ranking.you})`}</span>}
                </span>
                <span className="text-sm whitespace-nowrap">{r.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PageShell>
  );
}
