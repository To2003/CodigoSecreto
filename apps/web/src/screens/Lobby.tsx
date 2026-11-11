import { TEAMS, type PublicPlayer, type RoomView, type Team } from '@clave/shared';
import { LayoutGroup, m } from 'motion/react';
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { RulesButton } from '../components/rules/RulesButton';
import { SettingsButton } from '../components/SettingsDialog';
import { TutorialChip } from '../components/TutorialChip';
import { SettingsPanel } from '../components/SettingsPanel';
import { ChatPanel } from '../components/social/ChatPanel';
import { EmoteLayer } from '../components/social/EmoteLayer';
import { t } from '../i18n/es-AR';
import { navigate } from '../lib/router';
import {
  kickPlayer,
  leaveRoom,
  randomizeTeams,
  setRole,
  setTeam,
  startGame,
  type Result,
} from '../net/client';

function PlayerRow({ player, view }: { player: PublicPlayer; view: RoomView }) {
  const isYou = player.id === view.youId;
  const youAreHost = view.youId === view.hostId;
  const tags = [
    isYou && t.lobby.you,
    player.id === view.hostId && t.lobby.host,
    !player.connected && t.lobby.disconnected,
  ].filter(Boolean);
  return (
    // Joining slides in; changing team, the row travels to the other column (SPEC §4 lobby).
    <m.li
      layout
      layoutId={player.id}
      // `x`, not a raw transform, so MotionConfig's reducedMotion="user" can drop it.
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0.15 }}
      className="flex items-center gap-2 py-1"
      data-player={player.nickname}
    >
      <Avatar avatar={player.avatar} color={player.color} size={28} dimmed={!player.connected} />
      <span className={player.connected ? '' : 'text-paper/60'}>{player.nickname}</span>
      {tags.length > 0 && <span className="text-xs text-paper/60">({tags.join(', ')})</span>}
      {youAreHost && !isYou && (
        <button
          type="button"
          className="ml-auto rounded px-2 text-paper/60 hover:text-red-soft"
          aria-label={t.lobby.kick(player.nickname)}
          onClick={() => void kickPlayer(player.id)}
        >
          {t.lobby.kickIcon}
        </button>
      )}
    </m.li>
  );
}

function TeamColumn({
  team,
  view,
  act,
}: {
  team: Team;
  view: RoomView;
  act: (p: Promise<Result>) => void;
}) {
  const members = view.players.filter((p) => p.team === team);
  const spymaster = members.find((p) => p.role === 'spymaster');
  const agents = members.filter((p) => p.role === 'agent');
  const you = view.players.find((p) => p.id === view.youId);
  // Cooperative mode (M9.1): sides A and B, no spymasters: everyone sees their own side's map.
  const coop = view.settings.mode === 'coop';
  const name = coop ? t.coop.side[team] : t.lobby.teamLabel(team, view.settings.teamNames[team]);
  const accent = team === 'red' ? 'bg-red-deep pattern-red' : 'bg-blue-deep pattern-blue';

  return (
    <section aria-label={name} data-team={team} className="flex flex-col rounded-lg bg-surface">
      <h2 className={`rounded-t-lg px-4 py-2 font-stamp text-xl text-paper ${accent}`}>{name}</h2>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {coop ? (
          <div>
            <h3 className="text-sm font-semibold text-paper/80">{t.coop.members}</h3>
            {members.length > 0 ? (
              <ul>
                {members.map((p) => (
                  <PlayerRow key={p.id} player={p} view={view} />
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm text-paper/60">{t.coop.noMembers}</p>
            )}
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold text-paper/80">{t.lobby.spymaster}</h3>
              {spymaster ? (
                <ul>
                  <PlayerRow player={spymaster} view={view} />
                </ul>
              ) : (
                <p className="py-1 text-sm text-paper/60">{t.lobby.noSpymaster}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-paper/80">{t.lobby.agents}</h3>
              {agents.length > 0 ? (
                <ul>
                  {agents.map((p) => (
                    <PlayerRow key={p.id} player={p} view={view} />
                  ))}
                </ul>
              ) : (
                <p className="py-1 text-sm text-paper/60">{t.lobby.noAgents}</p>
              )}
            </div>
          </>
        )}
        <div className="mt-auto flex flex-wrap gap-2">
          {you?.team !== team && (
            <button
              type="button"
              className="rounded-md border border-paper/40 px-3 py-1 text-sm active:scale-97"
              onClick={() => {
                act(setTeam(team));
              }}
            >
              {t.lobby.joinTeam}
            </button>
          )}
          {!coop && you?.team === team && you.role === 'agent' && !spymaster && (
            <button
              type="button"
              className="rounded-md border border-accent px-3 py-1 text-sm text-accent active:scale-97"
              onClick={() => {
                act(setRole('spymaster'));
              }}
            >
              {t.lobby.beSpymaster}
            </button>
          )}
          {!coop && you?.team === team && you.role === 'spymaster' && (
            <button
              type="button"
              className="rounded-md border border-paper/40 px-3 py-1 text-sm active:scale-97"
              onClick={() => {
                act(setRole('agent'));
              }}
            >
              {t.lobby.beAgent}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function Lobby({ view }: { view: RoomView }) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isHost = view.youId === view.hostId;
  const you = view.players.find((p) => p.id === view.youId);
  const spectators = view.players.filter((p) => p.team === 'spectator');
  const names = {
    red:
      view.settings.mode === 'coop'
        ? t.coop.side.red
        : t.lobby.teamLabel('red', view.settings.teamNames.red),
    blue:
      view.settings.mode === 'coop'
        ? t.coop.side.blue
        : t.lobby.teamLabel('blue', view.settings.teamNames.blue),
  };
  const link = `${window.location.origin}/sala/${view.code}`;

  const act = (p: Promise<Result>) => {
    setError(null);
    void p.then((res) => {
      if (!res.ok) setError(t.errors[res.code]);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard blocked: the link is visible to copy by hand.
    }
  };

  return (
    <LayoutGroup>
      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-stamp text-3xl tracking-wider sm:text-4xl">
            {t.lobby.title(view.code)}
          </h1>
          <button
            type="button"
            className="rounded-md border border-paper/40 px-3 py-1 text-sm active:scale-97"
            onClick={() => void copy()}
          >
            {copied ? t.lobby.copied : t.lobby.copyLink}
          </button>
          {'share' in navigator && (
            <button
              type="button"
              className="rounded-md border border-paper/40 px-3 py-1 text-sm active:scale-97"
              onClick={() => {
                navigator
                  .share({ text: t.lobby.shareText(view.code), url: link })
                  .catch(() => undefined);
              }}
            >
              {t.lobby.share}
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <RulesButton className="px-3 py-1.5" />
            <SettingsButton />
            <ConnectionIndicator />
          </div>
        </header>
        <TutorialChip />

        {error && (
          <p role="alert" className="text-red-soft">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {TEAMS.map((team) => (
            <TeamColumn key={team} team={team} view={view} act={act} />
          ))}
        </div>

        <section
          aria-label={t.lobby.spectators}
          data-team="spectator"
          className="rounded-lg bg-surface p-4"
        >
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">{t.lobby.spectators}</h2>
            {you?.team !== 'spectator' && (
              <button
                type="button"
                className="rounded-md border border-paper/40 px-3 py-1 text-sm active:scale-97"
                onClick={() => {
                  act(setTeam('spectator'));
                }}
              >
                {t.lobby.watch}
              </button>
            )}
          </div>
          {spectators.length > 0 ? (
            <ul>
              {spectators.map((p) => (
                <PlayerRow key={p.id} player={p} view={view} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-paper/60">{t.lobby.noSpectators}</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
          {view.startBlockers.length > 0 ? (
            <ul id="start-blockers" className="text-sm text-paper/80">
              {view.startBlockers.map((b) => (
                <li key={JSON.stringify(b)}>{t.lobby.blocker(b, names)}</li>
              ))}
            </ul>
          ) : (
            <p id="start-blockers">{isHost ? t.lobby.ready : t.lobby.waitingHost}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {isHost && (
              <>
                <button
                  type="button"
                  disabled={view.startBlockers.length > 0}
                  aria-describedby="start-blockers"
                  onClick={() => {
                    act(startGame());
                  }}
                  className="rounded-md bg-accent px-4 py-2 font-semibold text-ink disabled:opacity-50"
                >
                  {t.lobby.start}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-paper/40 px-3 py-2 text-sm active:scale-97"
                  onClick={() => {
                    act(randomizeTeams());
                  }}
                >
                  {view.settings.mode === 'coop' ? t.coop.randomize : t.lobby.randomize}
                </button>
              </>
            )}
            <button
              type="button"
              className="ml-auto rounded-md px-3 py-2 text-sm text-paper/70 underline"
              onClick={() => {
                void leaveRoom().then(() => {
                  navigate('/');
                });
              }}
            >
              {t.lobby.leave}
            </button>
          </div>
        </section>

        <SettingsPanel view={view} editable={isHost} onError={setError} />
        <ChatPanel view={view} />
        <EmoteLayer view={view} />
      </main>
    </LayoutGroup>
  );
}
