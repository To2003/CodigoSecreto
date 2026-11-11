import { useEffect, useRef } from 'react';
import { t } from '../i18n/es-AR';
import { useConnection } from '../store/connection';
import { useWake } from '../store/wake';

/** Three sleepy agents: eyes open and close (opacity only), "z" drifting up. Original art. */
function SleepyAgents() {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 70" className="w-56 max-w-full">
      {[20, 80, 140].map((x, i) => (
        <g key={x} transform={`translate(${x} 40)`}>
          <path d="M-16 28 Q-16 6 0 6 Q16 6 16 28 Z" className="fill-paper/80" />
          <circle cx="0" cy="-6" r="12" className="fill-paper" />
          <rect x="-15" y="-21" width="30" height="5" rx="2" className="fill-ink" />
          <rect x="-10" y="-30" width="20" height="10" rx="3" className="fill-ink" />
          <g className="anim-blink" style={{ animationDelay: `${String(i * 400)}ms` }}>
            <rect x="-7" y="-7" width="5" height="1.6" rx="0.8" className="fill-ink" />
            <rect x="2" y="-7" width="5" height="1.6" rx="0.8" className="fill-ink" />
          </g>
          <text
            x="12"
            y="-22"
            className="anim-zzz fill-accent font-stamp text-[10px]"
            style={{ animationDelay: `${String(i * 600)}ms` }}
          >
            {t.wake.snore}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * "Despertando a los agentes…" (SPEC §0.4): shows only when /health is slow and the socket isn't
 * connected yet; after 90 s it offers a retry.
 */
export function WakeScreen({ onRetry }: { onRetry: () => void }) {
  const status = useWake((s) => s.status);
  const connected = useConnection((s) => s.status === 'connected');
  const retryRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const failed = status === 'failed';
  const shown = !connected && (status === 'waking' || failed);
  useEffect(() => {
    if (!shown) return;
    if (failed) retryRef.current?.focus();
    else boxRef.current?.focus();
  }, [shown, failed]);
  // A modal for real: what's behind it can't be reached with the keyboard while it's up.
  useEffect(() => {
    const box = boxRef.current;
    if (!shown || !box?.parentElement) return;
    const behind = [...box.parentElement.children].filter((el) => el !== box);
    for (const el of behind) el.setAttribute('inert', '');
    return () => {
      for (const el of behind) el.removeAttribute('inert');
    };
  }, [shown]);
  if (!shown) return null;
  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="wake-title"
      aria-describedby="wake-body"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg/95 px-6 text-center"
      data-testid="wake-screen"
    >
      <SleepyAgents />
      <h2 id="wake-title" className="font-stamp text-3xl">
        {failed ? t.wake.failedTitle : t.wake.title}
      </h2>
      <p id="wake-body" className="max-w-sm text-paper/80">
        {failed ? t.wake.failedBody : t.wake.body}
      </p>
      {failed ? (
        <button
          ref={retryRef}
          type="button"
          onClick={onRetry}
          className="rounded-md bg-accent px-5 py-2 font-semibold text-ink active:scale-97"
        >
          {t.wake.retry}
        </button>
      ) : (
        <div
          role="progressbar"
          aria-label={t.wake.progress}
          className="h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-paper/15"
        >
          <div className="anim-indeterminate h-full w-1/3 rounded-full bg-accent" />
        </div>
      )}
    </div>
  );
}
