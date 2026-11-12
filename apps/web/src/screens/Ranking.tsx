import type { RankingView } from '@clave/shared';
import { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { ButtonLink } from '../components/ui/Button';
import { IconPlus } from '../components/ui/icons';
import { t } from '../i18n/es-AR';
import { getRanking } from '../net/accountsApi';
import { accountsEnabled } from '../net/auth';

type Tab = 'wins' | 'loved';
const TABS: readonly Tab[] = ['wins', 'loved'];

/** An empty podium under the detective's lens: nobody has 10 games yet (original art, ADR-035). */
function EmptyPodium() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 128"
      width="200"
      height="128"
      className="max-w-full"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 116h172" stroke="var(--line)" strokeWidth="3" />
      <rect
        x="72"
        y="52"
        width="56"
        height="64"
        rx="3"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="2.5"
      />
      <rect
        x="22"
        y="76"
        width="50"
        height="40"
        rx="3"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="2.5"
      />
      <rect
        x="128"
        y="88"
        width="50"
        height="28"
        rx="3"
        fill="var(--surface)"
        stroke="var(--line)"
        strokeWidth="2.5"
      />
      <path d="M100 66v18M93 72l7-6" stroke="var(--line)" strokeWidth="3" />
      <path d="M44 89h6a4 4 0 0 1 0 8h-6v8h10" stroke="var(--line)" strokeWidth="3" />
      <path
        d="M147 98h6a3.5 3.5 0 0 1 0 7h-3h3a3.5 3.5 0 0 1 0 7h-6"
        stroke="var(--line)"
        strokeWidth="2.5"
      />
      <g transform="rotate(-14 136 34)">
        <circle cx="128" cy="30" r="17" fill="var(--bg)" stroke="var(--accent)" strokeWidth="4" />
        <path d="M120 24a10 10 0 0 1 8-4" stroke="var(--accent)" strokeWidth="2.5" opacity="0.6" />
        <path d="M141 43l16 16" stroke="var(--accent)" strokeWidth="6" />
      </g>
      <path
        d="M62 34l4 4M70 26v6M54 30l5 2"
        stroke="var(--paper)"
        strokeOpacity="0.45"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function EmptyRanking() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-lg bg-surface px-4 py-8 text-center"
      data-testid="ranking-empty"
    >
      <EmptyPodium />
      <p className="font-stamp text-xl">{t.ranking.empty}</p>
      <p className="max-w-sm text-paper/80">{t.ranking.emptyHelp}</p>
      <ButtonLink to="/" variant="primary" icon={<IconPlus />} className="mt-2">
        {t.ranking.emptyCreate}
      </ButtonLink>
    </div>
  );
}

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
            className={`btn min-h-11 flex-1 px-3 ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
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
        {typeof ranking === 'object' && rows.length === 0 && <EmptyRanking />}
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
