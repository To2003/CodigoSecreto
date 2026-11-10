import type { RoomView } from '@clave/shared';
import { useId, useState } from 'react';
import { t } from '../../i18n/es-AR';
import { reassignSpymaster } from '../../net/client';

/** SPEC §2.4: the game pauses while the active spymaster is away; the host can pick another. */
export function PauseOverlay({ view }: { view: RoomView }) {
  const paused = view.game?.paused;
  const id = useId();
  const candidates = view.players.filter(
    (p) => p.team === paused?.team && p.connected && p.id !== paused.spymasterId,
  );
  const [choice, setChoice] = useState('');
  if (!paused) return null;
  const missing = view.players.find((p) => p.id === paused.spymasterId)?.nickname ?? '';
  const isHost = view.youId === view.hostId;
  const selected = candidates.some((c) => c.id === choice) ? choice : (candidates[0]?.id ?? '');

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-bg/85 px-4"
      role="alertdialog"
      aria-labelledby={`${id}-title`}
    >
      <div className="flex max-w-sm flex-col gap-3 rounded-xl border border-paper/30 bg-bg p-5 text-center">
        <p id={`${id}-title`} className="text-xl font-bold">
          {t.game.pausedWaiting(missing)}
        </p>
        <p className="text-sm text-paper/80">{t.game.pausedHint}</p>
        {isHost && candidates.length > 0 && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void reassignSpymaster(selected);
            }}
          >
            <label className="flex flex-1 flex-col gap-1 text-left text-sm">
              {t.game.reassignLabel}
              <select
                value={selected}
                onChange={(e) => {
                  setChoice(e.target.value);
                }}
                className="rounded-md border border-paper/30 bg-bg px-2 py-1"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-1.5 font-semibold text-ink"
            >
              {t.game.reassign}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
