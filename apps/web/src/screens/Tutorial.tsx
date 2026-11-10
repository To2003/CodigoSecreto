import {
  applyAction,
  DEFAULT_SETTINGS,
  mulberry32,
  validateClue,
  type Action,
  type Card,
  type CardType,
  type EnginePlayer,
  type GameState,
} from '@clave/shared';
import { useEffect, useId, useState } from 'react';
import { CardArt } from '../art/CardArt';
import { REVEALED_BG } from '../components/game/Board';
import { t } from '../i18n/es-AR';
import { navigate } from '../lib/router';
import { markTutorialDone } from '../lib/storage';

/**
 * Interactive tutorial (SPEC §8.1): 100% in the browser, on the same rules engine as the real
 * game, with a scripted board and two bots (your spymaster, then your agent).
 */

const STEPS = [
  'board',
  'agent',
  'clue',
  'civilian',
  'traitor',
  'spymaster',
  'rules',
  'done',
] as const;
type Step = (typeof STEPS)[number];

/** Scripted board: the sea clue has two answers and a dangerous neighbour (the traitor). */
const BOARD: [string, CardType][] = [
  ['RELOJ', 'red'],
  ['LUNA', 'blue'],
  ['MESA', 'civilian'],
  ['OLA', 'red'],
  ['FUEGO', 'blue'],
  ['CINE', 'civilian'],
  ['PERRO', 'blue'],
  ['NIEVE', 'red'],
  ['TIBURÓN', 'traitor'],
  ['GUITARRA', 'red'],
  ['NUBE', 'civilian'],
  ['CASTILLO', 'blue'],
  ['PEZ', 'red'],
  ['BANCO', 'blue'],
  ['ÁRBOL', 'civilian'],
  ['LÁPIZ', 'red'],
  ['LLAVE', 'blue'],
  ['HIELO', 'red'],
  ['PUENTE', 'civilian'],
  ['PIANO', 'blue'],
  ['CAMPO', 'red'],
  ['BOTÓN', 'civilian'],
  ['ROSA', 'blue'],
  ['TREN', 'red'],
  ['SILLA', 'civilian'],
];
const SEA = ['OLA', 'PEZ'];
const SPYMASTER_TARGETS = ['NIEVE', 'HIELO'];
const SHOWN_CIVILIAN = 'NUBE';
const TRAITOR = 'TIBURÓN';

const idOf = (word: string) => `tuto-${word}`;
const rng = mulberry32(2024);

function initialState(): GameState {
  const players: EnginePlayer[] = [
    { id: 'you', team: 'red', role: 'agent', connected: true },
    { id: 'bot-red', team: 'red', role: 'spymaster', connected: true },
    { id: 'bot-blue', team: 'blue', role: 'spymaster', connected: true },
    { id: 'bot-blue-agent', team: 'blue', role: 'agent', connected: true },
  ];
  const cards: Card[] = BOARD.map(([word, type]) => ({
    id: idOf(word),
    word,
    type,
    revealed: false,
  }));
  return {
    settings: DEFAULT_SETTINGS,
    players,
    cards,
    startingTeam: 'red',
    phase: { name: 'clue', team: 'red' },
    clues: [],
    points: {},
    teamTurns: { red: 1, blue: 0 },
  };
}

/** Runs an action on the engine; the tutorial's script only sends valid ones. */
function run(state: GameState, action: Action): GameState {
  const res = applyAction(state, action, rng);
  return res.ok ? res.state : state;
}

/** Your spymaster's clue for step 3, through the engine like any other clue. */
function withSeaClue(state: GameState): GameState {
  return run(state, { type: 'GIVE_CLUE', playerId: 'bot-red', word: 'MAR', count: 2 });
}

/** Step 6: you become the spymaster, the bot becomes your agent, and it's red's clue again. */
function asSpymaster(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === 'you'
        ? { ...p, role: 'spymaster' }
        : p.id === 'bot-red'
          ? { ...p, role: 'agent' }
          : p,
    ),
    phase: { name: 'clue', team: 'red' },
    points: {},
  };
}

function TutorialCard({
  card,
  showType,
  faceUp,
  onPick,
}: {
  card: Card;
  showType: boolean;
  faceUp: boolean;
  onPick: (() => void) | undefined;
}) {
  const up = card.revealed || faceUp;
  return (
    <button
      type="button"
      disabled={!onPick}
      onClick={onPick}
      data-word={card.word}
      data-revealed={card.revealed}
      aria-label={up || showType ? `${card.word}, ${t.game.cardType[card.type]}` : card.word}
      className={`relative block aspect-[3/2] w-full overflow-hidden rounded-[10px] shadow-[0_2px_0_rgb(0_0_0/0.35)] enabled:cursor-pointer enabled:hover:-translate-y-0.5 ${up ? REVEALED_BG[card.type] : 'paper bg-paper text-ink'}`}
    >
      {up && <CardArt type={card.type} id={card.id} />}
      {showType && !up && (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-1.5 ${REVEALED_BG[card.type]}`}
        />
      )}
      <span
        className={`absolute inset-x-1 font-card text-[clamp(0.55rem,2.3vw,1rem)] leading-tight uppercase ${up ? 'bottom-1 text-paper' : 'top-1/2 -translate-y-1/2 text-center'}`}
      >
        {card.word}
      </span>
    </button>
  );
}

export default function Tutorial() {
  const [step, setStep] = useState<Step>('board');
  const [state, setState] = useState<GameState>(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [clue, setClue] = useState('');
  const [sentClue, setSentClue] = useState<string | null>(null);
  const clueId = useId();
  const index = STEPS.indexOf(step);

  const finish = () => {
    markTutorialDone();
    navigate('/');
  };
  const next = () => {
    const following = STEPS[index + 1];
    if (!following) return;
    setFeedback(null);
    if (following === 'clue') setState(withSeaClue);
    if (following === 'spymaster') setState(asSpymaster);
    if (following === 'done') markTutorialDone();
    setStep(following);
  };

  // Step 6, after your clue: the bot agent turns your two words, one after the other.
  useEffect(() => {
    if (step !== 'spymaster' || sentClue === null) return;
    const timers = SPYMASTER_TARGETS.map((word, i) =>
      setTimeout(
        () => {
          setState((s) => run(s, { type: 'REVEAL_CARD', playerId: 'bot-red', cardId: idOf(word) }));
        },
        700 * (i + 1),
      ),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [step, sentClue]);

  const seaFound = SEA.every((w) => state.cards.find((c) => c.word === w)?.revealed);
  const targetsFound = SPYMASTER_TARGETS.every(
    (w) => state.cards.find((c) => c.word === w)?.revealed,
  );
  const unrevealed = state.cards.filter((c) => !c.revealed).map((c) => c.word);
  const check = validateClue(clue, unrevealed, { allowCompound: false });
  const canNext =
    (step !== 'clue' || seaFound) && (step !== 'spymaster' || (sentClue !== null && targetsFound));

  const pick = (card: Card) => {
    if (card.revealed) return;
    if (SEA.includes(card.word)) {
      setState((s) => run(s, { type: 'REVEAL_CARD', playerId: 'you', cardId: card.id }));
      setFeedback(t.tutorial.steps.clueRight(card.word));
    } else if (card.type === 'traitor') {
      setFeedback(t.tutorial.steps.clueTraitor(card.word));
    } else {
      setFeedback(t.tutorial.steps.clueWrong(card.word));
    }
  };

  const text: Record<Step, string> = {
    board: t.tutorial.steps.board,
    agent: t.tutorial.steps.agent,
    clue: seaFound ? t.tutorial.steps.clueDone : t.tutorial.steps.clue,
    civilian: t.tutorial.steps.civilian,
    traitor: t.tutorial.steps.traitor,
    spymaster:
      sentClue !== null && targetsFound
        ? t.tutorial.steps.spymasterDone(sentClue)
        : t.tutorial.steps.spymaster,
    rules: t.tutorial.steps.rules,
    done: t.tutorial.steps.done,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-4 px-3 py-4 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-stamp text-3xl">{t.tutorial.title}</h1>
        <p className="text-sm text-paper/70">{t.tutorial.step(index + 1, STEPS.length)}</p>
        {step !== 'done' && (
          <button type="button" className="text-sm text-paper/80 underline" onClick={finish}>
            {t.tutorial.exit}
          </button>
        )}
      </header>

      <section
        aria-live="polite"
        className="flex flex-col gap-3 rounded-lg bg-surface p-4"
        data-testid="tutorial-step"
        data-step={step}
      >
        <p className="text-lg">{text[step]}</p>
        {step === 'clue' && (
          <p className="font-stamp text-3xl tracking-wide">{t.game.clueLine('MAR', 2)}</p>
        )}
        {feedback && step === 'clue' && <p className="text-accent">{feedback}</p>}
        {step === 'rules' && (
          <ul className="flex flex-col gap-1 text-paper/90">
            <li>{t.tutorial.steps.rulesOk}</li>
            <li>{t.tutorial.steps.rulesBad}</li>
          </ul>
        )}
        {step === 'spymaster' && sentClue === null && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!check.ok) return;
              const res = applyAction(
                state,
                { type: 'GIVE_CLUE', playerId: 'you', word: clue, count: 2 },
                rng,
              );
              if (!res.ok) return;
              setState(res.state);
              setSentClue(t.game.clueLine(clue.trim().toLocaleUpperCase('es-AR'), 2));
            }}
          >
            <label htmlFor={clueId} className="text-sm">
              {t.tutorial.steps.clueLabel}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={clueId}
                value={clue}
                autoComplete="off"
                placeholder={t.tutorial.steps.cluePlaceholder}
                aria-invalid={clue !== '' && !check.ok}
                aria-describedby={`${clueId}-error`}
                onChange={(e) => {
                  setClue(e.target.value);
                }}
                className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 uppercase"
              />
              <button
                type="submit"
                disabled={!check.ok}
                className="rounded-md bg-accent px-4 py-2 font-semibold text-ink disabled:opacity-50"
              >
                {t.tutorial.steps.send}
              </button>
            </div>
            <p id={`${clueId}-error`} role="status" className="min-h-5 text-sm text-red-soft">
              {clue !== '' && !check.ok
                ? `${t.game.clueInvalid[check.reason]} ${check.conflict ? t.game.clueConflict(check.conflict) : ''}`
                : ''}
            </p>
          </form>
        )}
        <div className="flex gap-2">
          {step === 'done' ? (
            <button
              type="button"
              className="rounded-md bg-accent px-4 py-2 font-semibold text-ink"
              onClick={finish}
            >
              {t.tutorial.steps.finish}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext}
              className="rounded-md bg-accent px-4 py-2 font-semibold text-ink disabled:opacity-50"
              onClick={next}
            >
              {t.tutorial.next}
            </button>
          )}
        </div>
      </section>

      <div
        role="group"
        aria-label={t.tutorial.board}
        className={`grid grid-cols-5 gap-1.5 rounded-xl p-1 sm:gap-2.5 ${step === 'board' ? 'ring-4 ring-accent' : ''}`}
      >
        {state.cards.map((card) => (
          <TutorialCard
            key={card.id}
            card={card}
            showType={step === 'spymaster'}
            faceUp={
              (step === 'civilian' && card.word === SHOWN_CIVILIAN) ||
              (step === 'traitor' && card.word === TRAITOR)
            }
            onPick={
              step === 'clue' && !seaFound && !card.revealed
                ? () => {
                    pick(card);
                  }
                : undefined
            }
          />
        ))}
      </div>
    </main>
  );
}
