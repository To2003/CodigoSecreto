import { devices, expect, test, type Page } from '@playwright/test';
import { startGame, type Player, closePlayers } from './helpers';

test.afterEach(closePlayers);

type Team = 'red' | 'blue';

async function activeTeam(page: Page): Promise<Team> {
  const banner = (await page.getByTestId('turn-banner').textContent()) ?? '';
  return banner.includes('Rojo') ? 'red' : 'blue';
}

async function hiddenWords(spymaster: Page, type: string) {
  return spymaster
    .locator(`[data-revealed="false"][data-type="${type}"]`)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-word') ?? ''));
}

async function giveClue(spymaster: Page, count = '∞') {
  await spymaster.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.getByRole('button', { name: count, exact: true }).click();
  await spymaster.getByRole('button', { name: 'Mandar pista' }).click();
}

async function reveal(agent: Page, word: string) {
  await agent.getByRole('button', { name: `Señalar ${word}`, exact: true }).click();
  await agent.getByRole('button', { name: `Dar vuelta ${word}`, exact: true }).click();
  await expect(agent.locator(`[data-word="${word}"]`)).toHaveAttribute('data-revealed', 'true');
}

/** DOM-level anti-leak check: an agent's page never knows the type of a hidden card. */
async function expectNoHiddenTypes(agent: Player) {
  await expect(agent.page.locator('[data-revealed="false"][data-type]')).toHaveCount(0);
}

test('four players play a full game to the end, then a rematch rotates spymasters', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { ana, beto, caro, dani } = await startGame(browser);
  const spymaster: Record<Team, Player> = { red: ana, blue: beto };
  const agent: Record<Team, Player> = { red: caro, blue: dani };
  await expect(ana.page.locator('[data-revealed="false"][data-type]')).toHaveCount(25);

  for (let turn = 0; turn < 30; turn++) {
    if (await ana.page.getByText('¡Misión cumplida!').isVisible()) break;
    const active = await activeTeam(ana.page);
    await expectNoHiddenTypes(caro);
    await expectNoHiddenTypes(dani);
    await giveClue(spymaster[active].page);
    await expect(agent[active].page.getByTestId('current-clue')).toHaveText('QXZ · ∞');
    const own = (await hiddenWords(spymaster[active].page, active)).slice(0, 3);
    for (const word of own) {
      if (await agent[active].page.getByText('¡Misión cumplida!').isVisible()) break;
      await reveal(agent[active].page, word);
    }
    const end = agent[active].page.getByRole('button', { name: 'Pasar turno' });
    if (await end.isVisible()) {
      await end.click();
      // Wait for the turn to reach Ana's page before reading it again on the next lap.
      await expect(ana.page.getByTestId('turn-banner')).toContainText(
        active === 'red' ? 'Azul' : 'Rojo',
      );
    }
  }

  for (const p of [ana, beto, caro, dani]) {
    await expect(p.page.getByText(/¡Misión cumplida! Ganó el Equipo (Rojo|Azul)\./)).toBeVisible();
    // The full key map is public at the end (SPEC §3.1).
    await expect(p.page.locator('[data-type]')).toHaveCount(25);
  }
  await expect(ana.page.getByText(/Marcador de la sala: Rojo \d · Azul \d/)).toBeVisible();
  await expect(ana.page.locator('[data-testid="clues-red"] li').first()).toContainText('QXZ · ∞');

  await ana.page.getByRole('button', { name: 'Revancha (rotan los jefes)' }).click();
  // Caro (red) and Dani (blue) are the new spymasters: they see the map, Ana doesn't.
  await expect(caro.page.locator('[data-revealed="false"][data-type]')).toHaveCount(25);
  await expect(dani.page.locator('[data-revealed="false"][data-type]')).toHaveCount(25);
  await expectNoHiddenTypes(ana);
});

test('the clue input validates live against the board', async ({ browser }) => {
  const { ana, beto } = await startGame(browser);
  const active = await activeTeam(ana.page);
  const spymaster = active === 'red' ? ana.page : beto.page;
  const word = (await spymaster.locator('[data-card-id]').first().getAttribute('data-word')) ?? '';
  await spymaster.getByPlaceholder('Una sola palabra').fill(word.toLowerCase());
  await expect(spymaster.getByText('No vale, esa palabra está en el tablero.')).toBeVisible();
  await expect(spymaster.getByRole('button', { name: 'Mandar pista' })).toBeDisabled();
  await spymaster.getByPlaceholder('Una sola palabra').fill('dos palabras');
  await expect(spymaster.getByText('Tiene que ser una sola palabra.')).toBeVisible();
  await spymaster.getByPlaceholder('Una sola palabra').fill('QXZ');
  await expect(spymaster.getByRole('button', { name: 'Mandar pista' })).toBeEnabled();
});

test('the active spymaster reloads (F5) and drops: the game pauses and resumes', async ({
  browser,
}) => {
  const { code, ana, beto, caro } = await startGame(browser);
  const active = await activeTeam(ana.page);
  const spymaster = active === 'red' ? ana : beto;
  const other = active === 'red' ? beto : ana;
  const words = await spymaster.page
    .locator('[data-card-id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-word')));

  // F5: same board, still spymaster, can give the clue.
  await spymaster.page.reload();
  await expect(spymaster.page.locator('[data-revealed="false"][data-type]')).toHaveCount(25);
  expect(
    await spymaster.page
      .locator('[data-card-id]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-word'))),
  ).toEqual(words);

  // Drop: the page closes. Everyone else sees the pause.
  const context = spymaster.page.context();
  await spymaster.page.close();
  await expect(other.page.getByText(`Esperando a ${spymaster.name}…`)).toBeVisible();
  await expect(caro.page.getByText(`Esperando a ${spymaster.name}…`)).toBeVisible();

  // Back on the same device (stored seat): the pause lifts and the clue goes through.
  const back = await context.newPage();
  await back.goto(`/sala/${code}`);
  await expect(other.page.getByText(`Esperando a ${spymaster.name}…`)).toBeHidden();
  await giveClue(back, '1');
  await expect(other.page.getByText('QXZ · 1').first()).toBeVisible();
});

test('on a phone, tap to point and tap again to reveal; a late tap only un-points', async ({
  browser,
}) => {
  const { ana, beto, caro, dani } = await startGame(browser, { context: devices['iPhone SE'] });
  const active = await activeTeam(ana.page);
  const [spymaster, agent] = active === 'red' ? [ana, caro] : [beto, dani];
  await giveClue(spymaster.page);
  const [first, second] = await hiddenWords(spymaster.page, active);

  await agent.page.getByRole('button', { name: `Señalar ${first}`, exact: true }).tap();
  // Armed: the same card now announces what the next tap does, and says it on screen.
  await expect(
    agent.page.getByRole('button', { name: `Dar vuelta ${first}`, exact: true }).first(),
  ).toBeVisible();
  await expect(agent.page.getByText('Tocá de nuevo')).toBeVisible();
  await agent.page.locator(`[data-word="${first}"] > button`).first().tap();
  await expect(agent.page.locator(`[data-word="${first}"]`)).toHaveAttribute(
    'data-revealed',
    'true',
  );

  // After the arming window, a second tap takes the point back instead of revealing.
  await agent.page.getByRole('button', { name: `Señalar ${second}`, exact: true }).tap();
  await expect(agent.page.getByText('Tocá de nuevo')).toBeHidden({ timeout: 5000 });
  await agent.page.locator(`[data-word="${second}"] > button`).first().tap();
  await expect(
    agent.page.getByRole('button', { name: `Señalar ${second}`, exact: true }),
  ).toBeVisible();
  await expect(agent.page.locator(`[data-word="${second}"]`)).toHaveAttribute(
    'data-revealed',
    'false',
  );
});

test('clue 1: two guesses at most, the counter says so and the turn ends on its own (ADR-034)', async ({
  browser,
}) => {
  const { ana, beto, caro, dani } = await startGame(browser);
  const active = await activeTeam(ana.page);
  const spymaster = active === 'red' ? ana.page : beto.page;
  const agent = active === 'red' ? caro.page : dani.page;
  await giveClue(spymaster, '1');
  await expect(agent.getByTestId('guesses-left')).toHaveText('Te quedan 2 intentos');
  await expect(spymaster.getByTestId('guesses-left')).toHaveText('Les quedan 2 intentos');
  const [first, second] = await hiddenWords(spymaster, active);
  await reveal(agent, first ?? '');
  // They hit the clue's number: last guess, and "Pasar turno" stands out.
  await expect(agent.getByTestId('guesses-left')).toHaveText('Último intento');
  await expect(agent.getByRole('button', { name: 'Pasar turno' })).toHaveAttribute(
    'data-highlight',
    'true',
  );
  await reveal(agent, second ?? '');
  await expect(ana.page.getByTestId('turn-banner')).toContainText(
    active === 'red' ? 'Azul' : 'Rojo',
  );
  await expect(agent.getByRole('button', { name: 'Pasar turno' })).toHaveCount(0);
});
