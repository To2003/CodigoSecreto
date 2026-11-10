import type { RoomView, Team } from '@clave/shared';
import { t } from '../../i18n/es-AR';
import { Avatar } from '../Avatar';
import { ClueLog } from './ClueLog';

export function TeamPanel({ view, team, name }: { view: RoomView; team: Team; name: string }) {
  const members = view.players.filter((p) => p.team === team);
  const border = team === 'red' ? 'border-red' : 'border-blue';
  return (
    <aside
      aria-label={name}
      data-team={team}
      className={`flex flex-col gap-3 rounded-xl border-2 ${border} p-3`}
    >
      <h2 className="font-bold">{name}</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {members.map((p) => (
          <li key={p.id} className="flex items-center gap-2" data-player={p.nickname}>
            <Avatar avatar={p.avatar} color={p.color} size={24} dimmed={!p.connected} />
            <span className={p.connected ? '' : 'text-paper/50'}>{p.nickname}</span>
            <span className="text-xs text-paper/60">
              {[
                p.role === 'spymaster' && t.lobby.spymaster,
                p.id === view.youId && t.lobby.you,
                !p.connected && t.lobby.disconnected,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      <ClueLog view={view} team={team} />
    </aside>
  );
}
