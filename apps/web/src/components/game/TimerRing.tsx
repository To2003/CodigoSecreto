import type { TimerView } from '@clave/shared';
import { useEffect, useState } from 'react';
import { audio } from '../../audio/engine';
import { t } from '../../i18n/es-AR';

const SEGMENTS = 24;
const STEP_MS = 250;
/** The last seconds pulse in red and tick (SPEC §4, §6.2). */
const HURRY_S = 10;

/**
 * The phase timer as a ring of segments that go out one by one (only opacity changes, per the
 * animation rules). The server sends how much time is left; counting down from the moment the
 * view arrived keeps clients independent from their clock. Mount it with `key={seq}` so each
 * view restarts the countdown from the server's number.
 */
export function TimerRing({ timer, tick = false }: { timer: TimerView; tick?: boolean }) {
  const [left, setLeft] = useState(timer.remainingMs);

  useEffect(() => {
    if (!timer.running) return;
    const endsAt = performance.now() + timer.remainingMs;
    let lastSecond = Math.ceil(timer.remainingMs / 1000);
    const id = setInterval(() => {
      const ms = Math.max(0, endsAt - performance.now());
      setLeft(ms);
      const second = Math.ceil(ms / 1000);
      if (tick && second !== lastSecond && second > 0 && second <= HURRY_S) audio.play('tick');
      lastSecond = second;
    }, STEP_MS);
    return () => {
      clearInterval(id);
    };
  }, [timer, tick]);

  const seconds = Math.ceil(left / 1000);
  const lit = Math.ceil((left / timer.totalMs) * SEGMENTS);
  const hurry = timer.running && seconds <= HURRY_S;
  return (
    <span
      role="timer"
      aria-label={timer.running ? t.game.timer(timer.kind, seconds) : t.game.timerPaused}
      data-testid={`timer-${timer.kind}`}
      data-seconds={seconds}
      className={`relative inline-flex size-12 shrink-0 items-center justify-center ${hurry ? 'anim-pulse anim-move' : ''}`}
    >
      <svg aria-hidden="true" viewBox="-20 -20 40 40" className="absolute inset-0 size-full">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <rect
            key={i}
            x={-1.2}
            y={-18}
            width={2.4}
            height={6}
            rx={1}
            transform={`rotate(${(i * 360) / SEGMENTS})`}
            className={hurry ? 'fill-red-soft' : 'fill-accent'}
            opacity={i < lit ? 1 : 0.15}
          />
        ))}
      </svg>
      <span
        aria-hidden="true"
        className={`font-stamp text-sm tabular-nums ${hurry ? 'text-red-soft' : 'text-paper'}`}
      >
        {timer.running ? seconds : t.game.timerPausedIcon}
      </span>
    </span>
  );
}
