import { TEAMS, type GameView, type RoomEvent, type RoomView, type Team } from '@clave/shared';
import { useEffect, useRef, useState } from 'react';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ActionZone } from '../components/game/ActionZone';
import { Board } from '../components/game/Board';
import { GameEffects } from '../components/game/GameEffects';
import { GameOverPanel } from '../components/game/GameOverPanel';
import { PauseOverlay } from '../components/game/PauseOverlay';
import { TeamPanel } from '../components/game/TeamPanel';
import { TurnStamp } from '../components/game/TurnStamp';
import { RulesButton } from '../components/rules/RulesButton';
import { SettingsButton } from '../components/SettingsDialog';
import { TutorialChip } from '../components/TutorialChip';
import { ChatPanel } from '../components/social/ChatPanel';
import { EmoteLayer } from '../components/social/EmoteLayer';
import { t } from '../i18n/es-AR';
import { backToLobby } from '../net/client';
import { usePrefs, useReducedMotion } from '../store/prefs';
import { useRoom } from '../store/room';
import { Button } from '../components/ui/Button';

/** One line about what just happened, read by screen readers too (SPEC §10 aria-live). */
function lastNews(events: RoomEvent[], teamName: (team: Team) => string): string | null {
  for (const e of [...events].reverse()) {
    if (e.type === 'TURN_CHANGED') {
      return e.reason === 'rival'
        ? t.game.turnEnded.rival(teamName(e.team))
        : t.game.turnEnded[e.reason];
    }
    if (e.type === 'CLUE_GIVEN') return t.game.yourTurnAgents(t.game.clueLine(e.word, e.count));
    if (e.type === 'OBJECTION_RESOLVED') return t.game.objectionResolved(e.accepted);
  }
  return null;
}

/** Every reveal is announced, not only turn changes (SPEC §10 aria-live). */
function revealNews(events: RoomEvent[], cards: GameView['cards']): string | null {
  const reveal = [...events].reverse().find((e) => e.type === 'CARD_REVEALED');
  if (reveal?.type !== 'CARD_REVEALED') return null;
  const word = cards.find((c) => c.id === reveal.cardId)?.word ?? '';
  return t.game.revealedNews(word, t.game.cardType[reveal.cardType]);
}

/** Host escape hatch (ADR-021): ends the game for everyone, with a confirm step. */
function EndGameButton() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t.game.backToLobby}
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      {t.game.endGameConfirm}
      <Button variant="danger" size="sm" onClick={() => void backToLobby()}>
        {t.game.endGame}
      </Button>
    </span>
  );
}

function Counter({ view, team, name }: { view: RoomView; team: Team; name: string }) {
  const colorBlind = usePrefs((p) => p.colorBlind);
  const left = view.game?.remaining[team] ?? 0;
  return (
    <span
      data-testid={`remaining-${team}`}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold text-paper ${team === 'red' ? 'bg-red-deep pattern-red' : 'bg-blue-deep pattern-blue'}`}
    >
      <span className="sr-only">{`${name}: ${t.game.remaining(left)}`}</span>
      {colorBlind && <span aria-hidden="true">{t.game.typeIcon[team]}</span>}
      <span aria-hidden="true" className="hidden sm:inline">
        {name}
      </span>
      {/* Rolling number: remounts on change so the roll plays once (SPEC §4). */}
      <span
        key={left}
        aria-hidden="true"
        className="anim-roll anim-move font-stamp text-xl leading-none"
      >
        {left}
      </span>
    </span>
  );
}

type SheetTab = Team | 'chat';
const SHEET_TABS: readonly SheetTab[] = [...TEAMS, 'chat'];

/** Mobile (SPEC §3.3): teams, clue history and chat live in a sheet with one tab each. */
function TeamsSheet({ view, teamName }: { view: RoomView; teamName: (team: Team) => string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<SheetTab>('red');
  // Content only while open: a closed <dialog> would otherwise duplicate the teams in the DOM.
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="rounded-md border border-line px-2.5 py-1 text-xs sm:text-sm lg:hidden"
        onClick={() => {
          setOpen(true);
          ref.current?.showModal();
        }}
      >
        {t.game.teamsAndHistory}
      </button>
      <dialog
        ref={ref}
        aria-label={t.game.teamsAndHistory}
        onClose={() => {
          setOpen(false);
        }}
        className="mt-auto mb-0 max-h-[80dvh] w-full max-w-none rounded-t-xl bg-bg p-3 text-paper backdrop:bg-black/60"
      >
        <div
          role="tablist"
          className="mb-3 flex gap-2"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const step = e.key === 'ArrowRight' ? 1 : SHEET_TABS.length - 1;
              const next =
                SHEET_TABS[(SHEET_TABS.indexOf(tab) + step) % SHEET_TABS.length] ?? 'red';
              setTab(next);
              document.getElementById(`teams-tab-${next}`)?.focus();
            }
          }}
        >
          {SHEET_TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`teams-tab-${key}`}
              aria-controls="teams-panel"
              tabIndex={tab === key ? 0 : -1}
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
              }}
              className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${tab === key ? (key === 'red' ? 'bg-red-deep' : key === 'blue' ? 'bg-blue-deep' : 'bg-surface') : 'border border-line'}`}
            >
              {key === 'chat' ? t.social.chat : teamName(key)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="teams-panel" aria-labelledby={`teams-tab-${tab}`}>
          {open &&
            (tab === 'chat' ? (
              <ChatPanel view={view} />
            ) : (
              <TeamPanel view={view} team={tab} name={teamName(tab)} />
            ))}
        </div>
        <form method="dialog" className="mt-3 text-right">
          <button type="submit" className="rounded-md bg-accent px-4 py-1.5 font-semibold text-ink">
            {t.game.close}
          </button>
        </form>
      </dialog>
    </>
  );
}

export function Game({ view }: { view: RoomView }) {
  const game = view.game;
  const events = useRoom((s) => s.lastEvents);
  const seq = useRoom((s) => s.seq);
  const [viewAsAgent, setViewAsAgent] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const observer = new ResizeObserver(() => {
      setSheetHeight(sheet.getBoundingClientRect().height);
    });
    observer.observe(sheet);
    return () => {
      observer.disconnect();
    };
  }, []);
  if (!game) return null;
  const teamName = (team: Team) => t.lobby.teamLabel(team, view.settings.teamNames[team]);
  const me = view.players.find((p) => p.id === view.youId);
  const isSpymaster = me?.role === 'spymaster' && me.team !== 'spectator';
  const news = [revealNews(events, game.cards), lastNews(events, teamName)]
    .filter(Boolean)
    .join(' ');
  const over = game.phase.name === 'over';
  const traitorNow = events.some((e) => e.type === 'CARD_REVEALED' && e.cardType === 'traitor');

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-3 px-3 pt-3 pb-(--sheet) lg:gap-4 lg:px-5 lg:pb-6"
      style={{ '--sheet': `${Math.ceil(sheetHeight) + 16}px` } as React.CSSProperties}
    >
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <Counter view={view} team="red" name={teamName('red')} />
        <TurnStamp game={game} teamName={teamName} />
        <Counter view={view} team="blue" name={teamName('blue')} />
      </header>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm sm:gap-x-4">
        {isSpymaster && game.phase.name !== 'over' && (
          <label className="mr-auto flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={viewAsAgent}
              onChange={(e) => {
                setViewAsAgent(e.target.checked);
              }}
            />
            {t.game.viewAsAgent}
          </label>
        )}
        <TutorialChip />
        <TeamsSheet view={view} teamName={teamName} />
        <ConnectionIndicator compact />
        <RulesButton className="px-2.5 py-1 text-xs sm:px-3 sm:text-sm" />
        <SettingsButton className="px-2.5 py-1 text-xs sm:px-3 sm:text-sm" />
        {view.youId === view.hostId && game.phase.name !== 'over' && <EndGameButton />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr_15rem]">
        <TeamPanel view={view} team="red" name={teamName('red')} className="hidden lg:flex" />
        <div className="flex flex-col gap-4">
          {/* At game over the full map is public: "view as agent" no longer applies (SPEC §3.1). */}
          {/* Card ids are random per game, so a rematch gets a fresh wrapper (and fresh motion). */}
          <ShakeOnTraitor key={game.cards[0]?.id} active={traitorNow} seq={seq}>
            <Board view={view} showMap={game.seesMap && (!viewAsAgent || over)} />
          </ShakeOnTraitor>
          {/* Action zone: a bottom sheet on phones, a panel under the board on desktop. */}
          <section
            ref={sheetRef}
            aria-label={t.game.clueLabel}
            className="fixed inset-x-0 bottom-0 z-10 max-h-[45dvh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-4 shadow-[0_-8px_24px_rgb(0_0_0/0.4)] lg:static lg:max-h-none lg:rounded-xl lg:border lg:shadow-none"
          >
            <p
              className={`text-sm text-accent ${news ? 'mb-2' : 'sr-only lg:not-sr-only lg:mb-2 lg:min-h-5'}`}
              aria-live="polite"
              data-testid="news"
            >
              {news}
            </p>
            <ActionZone view={view} teamName={teamName} />
            <GameOverPanel view={view} teamName={teamName} />
          </section>
        </div>
        <div className="hidden flex-col gap-4 lg:flex">
          <TeamPanel view={view} team="blue" name={teamName('blue')} />
          <ChatPanel view={view} />
        </div>
      </div>
      <PauseOverlay view={view} teamName={teamName} />
      <EmoteLayer view={view} />
      <GameEffects
        game={game}
        events={events}
        seq={seq}
        myTeam={me && me.team !== 'spectator' ? me.team : undefined}
      />
    </main>
  );
}

/** How long the board keeps the shake class (400 ms shake after the 600 ms flip). */
const SHAKE_MS = 1100;

/**
 * The traitor shakes the board (SPEC §4), never the page: shaking an ancestor of the fixed
 * overlays would turn them relative to it. No shake with reduced motion.
 */
function ShakeOnTraitor({
  active,
  seq,
  children,
}: {
  active: boolean;
  seq: number;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const [prevSeq, setPrevSeq] = useState(seq);
  const [shaking, setShaking] = useState(false);
  if (seq !== prevSeq) {
    setPrevSeq(seq);
    if (active && !reduced) setShaking(true);
  }
  useEffect(() => {
    if (!shaking) return;
    const timer = setTimeout(() => {
      setShaking(false);
    }, SHAKE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [shaking]);
  return <div className={shaking ? 'anim-screen-shake anim-move' : undefined}>{children}</div>;
}
