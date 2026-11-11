/**
 * Plays a full game with bots and prints it (M1 acceptance: "partida completa simulable por consola").
 * Usage: pnpm --filter @clave/shared simulate [seed] [any|majority]
 */
import { simulateGame } from '../engine/simulate';

const seed = Number(process.argv[2] ?? Date.now() % 100000);
const revealMode = process.argv[3] === 'majority' ? 'majority' : 'any';
const { state, events, actions } = simulateGame(seed, { revealMode });

const TEAM = { red: 'Rojo', blue: 'Azul' } as const;
const TYPE = { red: 'agente rojo', blue: 'agente azul', civilian: 'civil', traitor: 'TRAIDOR' };
const word = (cardId: string) => state.cards.find((c) => c.id === cardId)?.word ?? cardId;

console.log(`Semilla ${seed} · revelar: ${revealMode} · empieza ${TEAM[state.startingTeam]}\n`);
console.log('Mapa clave:');
for (let row = 0; row < 5; row++) {
  const cells = state.cards.slice(row * 5, row * 5 + 5);
  console.log(
    cells
      .map((c) =>
        `${c.word} (${{ red: 'R', blue: 'A', civilian: 'c', traitor: 'X' }[c.type]})`.padEnd(18),
      )
      .join(''),
  );
}
console.log('');
for (const e of events) {
  switch (e.type) {
    case 'CLUE_GIVEN':
      console.log(`[${TEAM[e.team]}] Pista: ${e.word} · ${e.count === 'inf' ? '∞' : e.count}`);
      break;
    case 'CARD_REVEALED':
      console.log(`  ${e.penalty ? 'Penalización: ' : ''}${word(e.cardId)} → ${TYPE[e.cardType]}`);
      break;
    case 'TURN_CHANGED':
      console.log(`  — turno de ${TEAM[e.team]} (${e.reason})`);
      break;
    case 'OBJECTION_OPENED':
      console.log(`  ¡Objeción de ${e.objector}!`);
      break;
    case 'OBJECTION_RESOLVED':
      console.log(`  Objeción ${e.accepted ? 'aceptada' : 'rechazada'}`);
      break;
    case 'GAME_OVER':
      console.log(
        `\nGanó el Equipo ${TEAM[e.winner]} (${e.reason === 'traitor' ? 'tocaron al traidor' : 'agentes completos'}) en ${actions} acciones.`,
      );
      break;
  }
}
