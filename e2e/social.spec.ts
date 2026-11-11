import { expect, test, type Page } from '@playwright/test';
import { closePlayers, startGame, type Player } from './helpers';

test.afterEach(closePlayers);

/** M7: chat, emotes, the timer, objections, end-of-game stats and the clue history. */

async function roles(game: Awaited<ReturnType<typeof startGame>>) {
  const banner = (await game.ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const red = banner.includes('Rojo');
  return {
    team: red ? 'red' : 'blue',
    spymaster: red ? game.ana : game.beto,
    rivalSpymaster: red ? game.beto : game.ana,
    agent: red ? game.caro : game.dani,
    rivalAgent: red ? game.dani : game.caro,
  } as const;
}

async function giveClue(spymaster: Player, count = '∞') {
  await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.page.getByRole('button', { name: count, exact: true }).click();
  await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
}

const wordsOf = (spymaster: Page, type: string) =>
  spymaster
    .locator(`[data-revealed="false"][data-type="${type}"]`)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-word') ?? ''));

async function reveal(agent: Page, word: string) {
  await agent.getByRole('button', { name: `Señalar ${word}`, exact: true }).click();
  await agent.getByRole('button', { name: `Dar vuelta ${word}`, exact: true }).click();
  await expect(agent.locator(`[data-word="${word}"]`)).toHaveAttribute('data-revealed', 'true');
}

test('team chat stays in the team; spymasters only get emotes during the game', async ({
  browser,
}) => {
  const game = await startGame(browser);
  const { ana, beto, caro, dani } = game;
  const chat = (p: Player) => p.page.getByRole('region', { name: 'Chat' });

  await chat(caro).getByLabel('Mi equipo').check();
  await chat(caro).getByPlaceholder('Escribí algo…').fill('vamos por las del mar');
  await chat(caro).getByRole('button', { name: 'Mandar', exact: true }).click();
  await expect(chat(ana).getByTestId('chat-log')).toContainText(
    'Caro (equipo): vamos por las del mar',
  );
  await expect(chat(caro).getByTestId('chat-log')).toContainText('vos (equipo): vamos');

  await chat(dani).getByPlaceholder('Escribí algo…').fill('suerte a todos');
  await chat(dani).getByRole('button', { name: 'Mandar', exact: true }).click();
  for (const p of [ana, beto, caro]) {
    await expect(chat(p).getByTestId('chat-log')).toContainText('Dani: suerte a todos');
  }
  await expect(chat(beto).getByTestId('chat-log')).not.toContainText('vamos por las del mar');
  await expect(chat(dani).getByTestId('chat-log')).not.toContainText('vamos por las del mar');

  // Spymasters see the map: no input during the game, emotes yes.
  await expect(chat(ana).getByPlaceholder('Escribí algo…')).toHaveCount(0);
  await expect(chat(ana)).toContainText('quien ve el mapa no escribe');
  await chat(ana).getByRole('button', { name: 'Mandar emote: fuego' }).click();
  await expect(dani.page.getByTestId('emotes')).toContainText('Ana 🔥');
});

test('the phase timer counts down from the server time', async ({ browser }) => {
  const game = await startGame(browser, {
    beforeStart: async (host) => {
      await host.getByLabel('Tiempo para la pista').selectOption('60');
    },
  });
  const { spymaster } = await roles(game);
  const ring = spymaster.page.getByTestId('timer-clue');
  // 60 s + 30 s on each team's first turn.
  await expect(ring).toHaveAttribute('data-seconds', /^(90|89|88)$/);
  await expect(ring).toHaveAccessibleName(/Tiempo para la pista: quedan \d+ s/);
  await spymaster.page.waitForTimeout(2_200);
  const seconds = Number(await ring.getAttribute('data-seconds'));
  expect(seconds).toBeLessThanOrEqual(88);
  expect(seconds).toBeGreaterThan(80);
});

test('an accepted objection ends the turn and gives the rival a card', async ({ browser }) => {
  const game = await startGame(browser);
  const { spymaster, rivalSpymaster, agent, rivalAgent, team } = await roles(game);
  await giveClue(spymaster, '1');
  await rivalSpymaster.page.getByRole('button', { name: 'Objetar pista' }).click();
  await expect(agent.page.getByTestId('objection')).toContainText('objetó la pista QXZ · 1');
  await expect(agent.page.getByTestId('timer-objection')).toBeVisible();
  // The objector already counts as a yes; one more yes out of three voters is a majority.
  await rivalAgent.page.getByRole('button', { name: 'Sí, esa pista no vale' }).click();
  await expect(agent.page.getByTestId('news')).toContainText('Objeción aceptada');
  const rival = team === 'red' ? 'Azul' : 'Rojo';
  await expect(agent.page.getByTestId('turn-banner')).toContainText(rival);
  await expect(spymaster.page.locator('[data-revealed="true"]')).toHaveCount(1);
});

test('game over shows stats; the clue history highlights its cards', async ({ browser }) => {
  const game = await startGame(browser);
  const { spymaster, agent, team } = await roles(game);
  await giveClue(spymaster);
  const own = await wordsOf(spymaster.page, team);
  await reveal(agent.page, own[0] ?? '');
  await reveal(agent.page, own[1] ?? '');

  // Clue history: the entry highlights both cards, a second click clears them.
  const entry = agent.page
    .getByTestId(`clues-${team}`)
    .getByRole('button', { name: /QXZ · ∞/ })
    .first();
  if (!(await entry.isVisible())) {
    await agent.page.getByRole('button', { name: 'Equipos, historial y chat' }).click();
  }
  await entry.click();
  await expect(agent.page.locator('[data-highlighted="true"]')).toHaveCount(2);
  await entry.click();
  await expect(agent.page.locator('[data-highlighted="true"]')).toHaveCount(0);

  const traitor = (await wordsOf(spymaster.page, 'traitor'))[0] ?? '';
  await reveal(agent.page, traitor);
  const stats = spymaster.page.getByTestId('stats');
  await expect(stats).toContainText('Duración:');
  await expect(stats).toContainText('Mejor pista: QXZ · ∞');
  await expect(stats).toContainText(`Pifia de la partida: ${traitor} (traidor)`);
});
