import type { RoomView, Team } from '@clave/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '../../i18n/es-AR';
import { backToLobby, reassignSpymaster } from '../../net/client';
import { Button } from '../ui/Button';

/**
 * SPEC §2.4: the game pauses while the active team can't move (its spymaster is away, or nobody is
 * left to guess). The host can pick another spymaster, or end the game, so it never stays stuck.
 */
export function PauseOverlay({
  view,
  teamName,
}: {
  view: RoomView;
  teamName: (team: Team) => string;
}) {
  const paused = view.game?.paused;
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  // A native modal dialog: focus moves in and the board behind becomes inert (no tabbing to it).
  useEffect(() => {
    const dialog = ref.current;
    if (paused && dialog && !dialog.open) dialog.showModal();
  }, [paused]);
  const [choice, setChoice] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!paused) return null;
  const isHost = view.youId === view.hostId;
  const candidates =
    paused.reason === 'spymaster'
      ? view.players.filter((p) => p.team === paused.team && p.role === 'agent' && p.connected)
      : [];
  const selected = candidates.some((c) => c.id === choice) ? choice : (candidates[0]?.id ?? '');
  const names = paused.waitingFor
    .map((pid) => view.players.find((p) => p.id === pid)?.nickname)
    .filter((n): n is string => Boolean(n));
  const title =
    paused.reason === 'spymaster'
      ? t.game.pausedWaiting(names[0] ?? t.game.theSpymaster)
      : t.game.pausedNoAgents(teamName(paused.team));

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      // The pause isn't the viewer's to dismiss: Esc does nothing.
      onCancel={(e) => {
        e.preventDefault();
      }}
      className="m-auto bg-transparent px-4 text-paper backdrop:bg-bg/85"
    >
      <div className="flex max-w-sm flex-col gap-3 rounded-xl border border-paper/30 bg-bg p-5 text-center">
        <p id={`${id}-title`} className="text-xl font-bold">
          {title}
        </p>
        <p className="text-sm text-paper/80">
          {paused.reason === 'spymaster' ? t.game.pausedHint : t.game.pausedAgentsHint}
        </p>
        {isHost && candidates.length > 0 && (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              void reassignSpymaster(selected).then((res) => {
                if (!res.ok) setError(t.errors[res.code]);
              });
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
        {error && (
          <p role="alert" className="text-sm text-red-soft">
            {error}
          </p>
        )}
        {isHost && (
          <Button variant="ghost" size="sm" onClick={() => void backToLobby()}>
            {t.game.endGame}
          </Button>
        )}
      </div>
    </dialog>
  );
}
