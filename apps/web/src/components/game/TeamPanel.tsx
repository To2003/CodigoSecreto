import type { RoomView, Team } from '@clave/shared';
import { t } from '../../i18n/es-AR';
import { Avatar } from '../Avatar';
import { ClueLog } from './ClueLog';

/** A team as a case folder: colored tab, members, and its clue history. */
export function TeamPanel({
  view,
  team,
  name,
  className = '',
}: {
  view: RoomView;
  team: Team;
  name: string;
  className?: string;
}) {
  const members = view.players.filter((p) => p.team === team);
  const tab = team === 'red' ? 'bg-red pattern-red' : 'bg-blue pattern-blue';
  return (
    <aside
      aria-label={name}
      data-team={team}
      className={`flex flex-col rounded-lg bg-surface ${className}`}
    >
      <h2 className={`rounded-t-lg px-3 py-1.5 font-stamp text-lg text-paper ${tab}`}>{name}</h2>
      <div className="flex flex-col gap-4 p-3">
        <ul className="flex flex-col gap-1.5 text-sm">
          {members.map((p) => (
            <li key={p.id} className="flex items-center gap-2" data-player={p.nickname}>
              <Avatar avatar={p.avatar} color={p.color} size={28} dimmed={!p.connected} />
              <span className={p.connected ? '' : 'text-paper/50'}>{p.nickname}</span>
              <span className="text-xs text-paper/60">
                {[
                  p.role === 'spymaster' && t.lobby.spymaster,
                  p.id === view.youId && t.lobby.you,
                  !p.connected && t.lobby.disconnected,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </li>
          ))}
        </ul>
        <ClueLog view={view} team={team} />
      </div>
    </aside>
  );
}
