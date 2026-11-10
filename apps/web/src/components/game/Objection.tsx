import type { RoomView } from '@clave/shared';
import { useState } from 'react';
import { t } from '../../i18n/es-AR';
import { objectClue, voteObjection } from '../../net/client';
import { useRoom } from '../../store/room';
import { TimerRing } from './TimerRing';

const errorText = (code: keyof typeof t.errors) => t.errors[code];

/**
 * "Objetar pista" (SPEC §1.6): for the rival spymaster, while the room allows objections and no
 * card has been revealed for the current clue yet.
 */
export function ObjectButton({ view }: { view: RoomView }) {
  const [error, setError] = useState<string | null>(null);
  const game = view.game;
  const me = view.players.find((p) => p.id === view.youId);
  const phase = game?.phase;
  const clue = game?.clues.at(-1);
  const can =
    view.settings.objections &&
    phase?.name === 'guess' &&
    me?.role === 'spymaster' &&
    me.team !== 'spectator' &&
    me.team !== phase.team &&
    clue?.objection === 'none' &&
    clue.guesses.length === 0;
  if (!can) return null;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-describedby="object-help"
        onClick={() => {
          void objectClue().then((res) => {
            setError(res.ok ? null : errorText(res.code));
          });
        }}
        className="self-start rounded-md border border-red-soft px-4 py-2 font-semibold text-red-soft active:scale-97"
      >
        {t.game.object}
      </button>
      <p id="object-help" className="text-sm text-paper/70">
        {t.game.objectHelp}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-soft">
          {error}
        </p>
      )}
    </div>
  );
}

/** The vote (SPEC §1.6): 15 s, everyone in the game but the spymaster who gave the clue. */
export function ObjectionPanel({ view }: { view: RoomView }) {
  const seq = useRoom((s) => s.seq);
  const [error, setError] = useState<string | null>(null);
  const game = view.game;
  const phase = game?.phase;
  if (!game || phase?.name !== 'objection') return null;
  const clue = game.clues.at(-1);
  const objector = view.players.find((p) => p.id === phase.objector)?.nickname ?? '';
  const votes = Object.values(phase.votes);
  const yes = votes.filter(Boolean).length;
  const voter = phase.voters.includes(view.youId);
  const voted = view.youId in phase.votes;
  const vote = (accept: boolean) => {
    void voteObjection(accept).then((res) => {
      setError(res.ok ? null : errorText(res.code));
    });
  };

  return (
    <section
      aria-labelledby="objection-title"
      className="flex flex-col gap-2 rounded-lg border border-red-soft/60 p-3"
      data-testid="objection"
    >
      <div className="flex items-center gap-3">
        {game.timer?.kind === 'objection' && <TimerRing key={seq} timer={game.timer} />}
        <div>
          <p id="objection-title" className="font-semibold">
            {t.game.objectionTitle(objector, clue ? t.game.clueLine(clue.word, clue.count) : '')}
          </p>
          <p className="text-sm text-paper/80" aria-live="polite">
            {t.game.votesTally(yes, votes.length - yes, phase.voters.length)}
          </p>
        </div>
      </div>
      {voter && !voted ? (
        <div className="flex flex-col gap-2">
          <p>{t.game.objectionQuestion}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                vote(true);
              }}
              className="rounded-md bg-red-deep px-4 py-2 font-semibold text-paper active:scale-97"
            >
              {t.game.voteYes}
            </button>
            <button
              type="button"
              onClick={() => {
                vote(false);
              }}
              className="rounded-md border border-paper/50 px-4 py-2 font-semibold active:scale-97"
            >
              {t.game.voteNo}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-paper/70">{voter ? t.game.voted : t.game.notVoter}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-soft">
          {error}
        </p>
      )}
    </section>
  );
}
