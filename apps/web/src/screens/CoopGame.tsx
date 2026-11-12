import {
  TEAMS,
  type CoopKey,
  type CoopPublicCard,
  type CoopView,
  type RoomEvent,
  type RoomView,
  type Side,
} from '@clave/shared';
import { useEffect, useState } from 'react';
import { CardArt } from '../art/CardArt';
import { REVEALED_BG } from '../art/cardStyles';
import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { ClueInput } from '../components/game/ActionZone';
import { GuessControls } from '../components/game/GuessControls';
import { RulesButton } from '../components/rules/RulesButton';
import { SettingsButton } from '../components/SettingsDialog';
import { ChatPanel } from '../components/social/ChatPanel';
import { EmoteLayer } from '../components/social/EmoteLayer';
import { t } from '../i18n/es-AR';
import { backToLobby, rematch, revealCard } from '../net/client';
import { useRoom } from '../store/room';

/** How long a first tap keeps a card armed for the revealing second tap. */
const ARM_MS = 3_000;

/** The band and icon a key gets on the viewer's map, like a spymaster's in the classic game. */
const keyBand = (key: CoopKey, side: Side): string =>
  key === 'agent' ? REVEALED_BG[side] : key === 'traitor' ? REVEALED_BG.traitor : '';
const keyIcon = (key: CoopKey, side: Side): string =>
  key === 'agent' ? t.game.typeIcon[side] : key === 'traitor' ? t.game.typeIcon.traitor : '';

function CoopCardView({
  card,
  side,
  canReveal,
  armed,
  onTap,
}: {
  card: CoopPublicCard;
  side: Side | null;
  canReveal: boolean;
  armed: boolean;
  onTap: () => void;
}) {
  const dead = card.civilianFor.length === TEAMS.length;
  const face = card.found ? REVEALED_BG[side ?? 'blue'] : dead ? REVEALED_BG.civilian : '';
  const parts = [
    card.found ? t.coop.found : null,
    ...card.civilianFor.map((s) => t.coop.civilianFor(t.coop.side[s])),
    card.key && side ? t.coop.keyLabel[card.key] : null,
    ...(card.keys
      ? TEAMS.map((s) => `${t.coop.side[s]}: ${t.coop.keyLabel[card.keys?.[s] ?? 'civilian']}`)
      : []),
  ].filter((p): p is string => p !== null);
  return (
    <button
      type="button"
      disabled={!canReveal}
      onClick={onTap}
      aria-label={armed ? t.coop.reveal(card.word) : t.coop.cardLabel(card.word, parts)}
      data-word={card.word}
      data-found={card.found}
      data-key={card.key}
      className={`relative block aspect-[3/2] w-full overflow-hidden rounded-[10px] text-left shadow-[0_2px_0_rgb(0_0_0/0.35)] enabled:cursor-pointer enabled:hover:-translate-y-0.5 ${face || 'paper bg-paper text-ink'} ${armed ? 'ring-4 ring-accent' : ''}`}
    >
      {card.found && <CardArt type={side ?? 'blue'} id={card.id} />}
      {/* Own map (or both, at the end): bands on top (A) and bottom (B), like a spymaster's. */}
      {card.key && side && !card.found && (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-1.5 ${keyBand(card.key, side)}`}
        />
      )}
      {card.keys &&
        !card.found &&
        TEAMS.map((s) => (
          <span
            key={s}
            aria-hidden="true"
            className={`absolute inset-x-0 h-1.5 ${s === 'red' ? 'top-0' : 'bottom-0'} ${keyBand(card.keys?.[s] ?? 'civilian', s)}`}
          />
        ))}
      <span
        className={`absolute inset-x-1 text-center font-card text-[clamp(0.55rem,2.3vw,1rem)] leading-tight uppercase ${card.found || dead ? 'bottom-1 text-paper' : 'top-1/2 -translate-y-1/2'}`}
      >
        {card.word}
      </span>
      {card.key && side && !card.found && keyIcon(card.key, side) && (
        <span aria-hidden="true" className="absolute top-2 right-1.5 text-xs font-bold">
          {keyIcon(card.key, side)}
        </span>
      )}
      {!dead && card.civilianFor.length > 0 && !card.found && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 rounded bg-civil px-1 text-[0.6rem] font-semibold text-paper"
        >
          {t.coop.sideShort[card.civilianFor[0] ?? 'red']}
        </span>
      )}
    </button>
  );
}

/** One line about the last guess, for everyone and for screen readers (SPEC §10 aria-live). */
function guessNews(events: RoomEvent[], coop: CoopView): string | null {
  const guess = [...events].reverse().find((e) => e.type === 'COOP_GUESS');
  if (guess?.type !== 'COOP_GUESS') return null;
  const word = coop.cards.find((c) => c.id === guess.cardId)?.word ?? '';
  return t.coop.news[guess.result](word);
}

function CoopActions({ view, coop }: { view: RoomView; coop: CoopView }) {
  const phase = coop.phase;
  const clue = coop.clues.at(-1);
  const clueText = clue ? t.game.clueLine(clue.word, clue.count) : '';
  if (phase.name === 'over') {
    const isHost = view.youId === view.hostId;
    const endText = phase.won
      ? t.coop.won
      : phase.reason === 'traitor'
        ? t.coop.lost.traitor
        : t.coop.lost.turns;
    return (
      <section role="status" className="flex flex-col gap-3" data-testid="coop-over">
        <p className="text-2xl font-bold">{endText}</p>
        {isHost ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void rematch(false)}
              className="rounded-md bg-accent px-4 py-2 font-semibold text-ink active:scale-97"
            >
              {t.coop.rematch}
            </button>
            <button
              type="button"
              onClick={() => void backToLobby()}
              className="rounded-md border border-paper/40 px-4 py-2 active:scale-97"
            >
              {t.game.backToLobby}
            </button>
          </div>
        ) : (
          <p className="text-sm text-paper/70">{t.game.waitingHostEnd}</p>
        )}
      </section>
    );
  }
  const giving = coop.side === phase.giver;
  if (phase.name === 'clue') {
    return giving ? (
      <ClueInput
        hiddenWords={coop.cards.filter((c) => !c.found).map((c) => c.word)}
        compoundWords={view.settings.compoundWords}
        prompt={t.coop.yourClue}
      />
    ) : (
      <p>{t.coop.waitingClue(t.coop.side[phase.giver])}</p>
    );
  }
  if (giving || coop.side === null) {
    return (
      <div className="flex flex-col gap-1">
        <p>{t.coop.theyGuess(clueText)}</p>
        <p className="text-sm text-paper/70" data-testid="guesses-left">
          {t.game.guessesLeftOthers(phase.guessesLeft)}
        </p>
      </div>
    );
  }
  const guessed = (clue?.guesses.length ?? 0) > 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg">{t.coop.yourGuess(clueText)}</p>
      <p className="text-sm text-paper/70">{t.coop.guessHint}</p>
      <GuessControls guessesLeft={phase.guessesLeft} count={clue?.count} guessed={guessed} />
    </div>
  );
}

/** Cooperative mode (M9.1, docs/specs/M9-cooperativo.md): two sides against the board. */
export function CoopGame({ view, coop }: { view: RoomView; coop: CoopView }) {
  const events = useRoom((s) => s.lastEvents);
  const [armed, setArmed] = useState<string | null>(null);
  const phase = coop.phase;
  const guessing = phase.name === 'guess' && coop.side !== null && coop.side !== phase.giver;
  const giver = phase.name === 'over' ? null : phase.giver;

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => {
      setArmed(null);
    }, ARM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [armed]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-3 px-3 py-3 lg:px-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="rounded-md bg-surface px-3 py-1 font-semibold" data-testid="coop-agents">
          {t.coop.agentsLeft(coop.agentsLeft)}
        </p>
        <p className="flex justify-center" data-testid="turn-banner" aria-live="polite">
          <span className="inline-block -rotate-3 rounded-md border-[3px] border-double border-accent px-3 py-0.5 font-stamp text-xl tracking-wider text-accent uppercase sm:text-3xl">
            {giver ? t.game.stampTurn(t.coop.sideShort[giver]) : t.game.stampOver}
          </span>
        </p>
        <p className="rounded-md bg-surface px-3 py-1 font-semibold" data-testid="coop-turns">
          {t.coop.turnsLeft(coop.turnsLeft)}
        </p>
      </header>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
        {coop.side && (
          <p className="mr-auto text-paper/80">{t.coop.mapOf(t.coop.side[coop.side])}</p>
        )}
        <ConnectionIndicator compact />
        <RulesButton className="px-2.5 py-1 text-xs sm:px-3 sm:text-sm" />
        <SettingsButton className="px-2.5 py-1 text-xs sm:px-3 sm:text-sm" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-4">
          <div
            role="group"
            aria-label={t.game.board}
            className="grid grid-cols-5 gap-x-1.5 gap-y-2.5 sm:gap-2.5"
          >
            {coop.cards.map((card) => {
              const canReveal =
                guessing && giver !== null && !card.found && !card.civilianFor.includes(giver);
              return (
                <CoopCardView
                  key={card.id}
                  card={card}
                  side={coop.side}
                  canReveal={canReveal}
                  armed={armed === card.id}
                  onTap={() => {
                    // First tap arms the card, the second turns it: no reveal by a slip.
                    if (armed === card.id) {
                      setArmed(null);
                      void revealCard(card.id);
                    } else setArmed(card.id);
                  }}
                />
              );
            })}
          </div>
          <section
            aria-label={t.game.clueLabel}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <p className="mb-2 min-h-5 text-sm text-accent" aria-live="polite" data-testid="news">
              {guessNews(events, coop)}
            </p>
            <CoopActions view={view} coop={coop} />
          </section>
        </div>
        <ChatPanel view={view} />
      </div>
      <EmoteLayer view={view} />
    </main>
  );
}
