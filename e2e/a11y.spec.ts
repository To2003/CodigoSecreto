import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createRoom, newPlayer, startGame, closePlayers } from './helpers';

test.afterEach(closePlayers);

/** CONSTRAINTS.md: zero critical or serious axe violations (WCAG 2.1 A/AA, contrast included). */
async function expectAccessible(page: Page, label: string) {
  // Audit the settled UI: a card mid-flip briefly shows its word on both faces.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== 'running'),
    undefined,
    { timeout: 5000 },
  );
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(serious, label).toEqual([]);
}

test('landing, lobby and game have no serious accessibility violations', async ({ browser }) => {
  const visitor = await newPlayer(browser, 'Visita');
  await visitor.page.goto('/');
  await expectAccessible(visitor.page, 'landing');

  const lobbyHost = await newPlayer(browser, 'Ana');
  await createRoom(lobbyHost);
  await expectAccessible(lobbyHost.page, 'lobby');

  const { ana, beto, caro, dani } = await startGame(browser);
  await expectAccessible(ana.page, 'game (spymaster)');
  await expectAccessible(caro.page, 'game (agent)');

  // Revealed cards (own agent, then a civilian) with their art and labels.
  const banner = (await ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const [spymaster, agent, team] = banner.includes('Rojo')
    ? [ana, caro, 'red']
    : [beto, dani, 'blue'];
  await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.page.getByRole('button', { name: '∞', exact: true }).click();
  await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
  for (const type of [team, 'civilian']) {
    const word = await spymaster.page
      .locator(`[data-revealed="false"][data-type="${type}"]`)
      .first()
      .getAttribute('data-word');
    await agent.page.getByRole('button', { name: `Señalar ${word ?? ''}`, exact: true }).click();
    await agent.page.getByRole('button', { name: `Dar vuelta ${word ?? ''}`, exact: true }).click();
  }
  await expect(agent.page.locator('[data-revealed="true"]')).toHaveCount(2);
  await expectAccessible(agent.page, 'game with revealed cards (agent)');
  await expectAccessible(spymaster.page, 'game with revealed cards (spymaster)');
});

test('color-blind mode stays accessible', async ({ browser }) => {
  const { ana } = await startGame(browser);
  await ana.page.getByRole('button', { name: 'Ajustes' }).click();
  await ana.page.getByLabel('Modo daltónico').check();
  await ana.page.getByRole('button', { name: 'Listo' }).click();
  await expect(ana.page.locator('html')).toHaveAttribute('data-colorblind', 'true');
  await expectAccessible(ana.page, 'game (color-blind)');
});

test('rules, tutorial and the in-game rules modal have no serious violations', async ({
  browser,
}) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/reglas');
  await expectAccessible(page, 'rules page');
  await page.goto('/tutorial');
  await expectAccessible(page, 'tutorial');
  for (let i = 0; i < 5; i++) {
    const next = page.getByRole('button', { name: 'Siguiente' });
    if (await next.isDisabled()) {
      for (const word of ['OLA', 'PEZ']) {
        await page.getByRole('button', { name: word, exact: true }).click();
      }
    }
    await next.click();
  }
  await expect(page.getByTestId('tutorial-step')).toHaveAttribute('data-step', 'spymaster');
  await expectAccessible(page, 'tutorial as spymaster');

  const game = await startGame(browser);
  await game.caro.page.getByRole('button', { name: 'Reglas' }).click();
  await expectAccessible(game.caro.page, 'rules modal');
});

test('account, ranking and privacy pages have no serious violations', async ({ browser }) => {
  const { page } = await newPlayer(browser, 'Ana');
  for (const path of ['/cuenta', '/ranking', '/privacidad']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page, path);
  }
  // Signed in: the name form and the stats.
  await page.goto('/cuenta');
  await page.getByLabel('Nombre de prueba').fill('Ana');
  await page.getByRole('button', { name: 'Entrar (modo prueba)' }).click();
  await expect(page.getByTestId('account-stats')).toBeVisible();
  await expectAccessible(page, '/cuenta signed in');
});
