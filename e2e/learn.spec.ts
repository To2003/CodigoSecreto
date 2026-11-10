import { expect, test } from '@playwright/test';
import { closePlayers, createRoom, newPlayer, startGame } from './helpers';

test.afterEach(closePlayers);

/** M7: tutorial (SPEC §8.1), rules (§8.2) and first-time help (§8.3). */

test('the tutorial goes through all 8 steps on the real rules engine', async ({ browser }) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/');
  await page.getByRole('link', { name: 'Tutorial (2 min)' }).click();
  await expect(page).toHaveURL(/\/tutorial$/);
  const step = page.getByTestId('tutorial-step');
  const next = page.getByRole('button', { name: 'Siguiente' });
  const board = page.getByRole('group', { name: 'Tablero del tutorial' });

  await expect(step).toHaveAttribute('data-step', 'board');
  await expect(board.getByRole('button')).toHaveCount(25);
  await next.click();
  await expect(step).toContainText('Vos sos agente');
  await next.click();

  // Step 3: MAR · 2. Wrong picks explain; the traitor warns; the two sea words turn.
  await expect(step).toContainText('MAR · 2');
  await expect(next).toBeDisabled();
  await board.getByRole('button', { name: 'MESA', exact: true }).click();
  await expect(step).toContainText('MESA no tiene mucho que ver con el mar');
  await board.getByRole('button', { name: 'TIBURÓN', exact: true }).click();
  await expect(step).toContainText('TIBURÓN es el traidor');
  await board.getByRole('button', { name: 'OLA', exact: true }).click();
  await board.getByRole('button', { name: 'PEZ', exact: true }).click();
  await expect(page.locator('[data-word="OLA"]')).toHaveAttribute('data-revealed', 'true');
  await expect(step).toContainText('Encontraste los dos');
  await next.click();

  await expect(step).toContainText('Si tocás un civil');
  await next.click();
  await expect(step).toContainText('nunca tenés que tocar');
  await next.click();

  // Step 6: spymaster with live validation, then the bot turns NIEVE and HIELO.
  await expect(step).toContainText('Ahora sos jefe');
  const clue = page.getByLabel('Tu pista para NIEVE y HIELO');
  await clue.fill('nieves');
  await expect(step).toContainText('esa palabra está en el tablero');
  await expect(page.getByRole('button', { name: 'Mandar pista' })).toBeDisabled();
  await clue.fill('frío');
  await page.getByRole('button', { name: 'Mandar pista' }).click();
  await expect(step).toContainText('Con FRÍO · 2, tus agentes encontraron NIEVE y HIELO');
  await expect(page.locator('[data-word="HIELO"]')).toHaveAttribute('data-revealed', 'true');
  await next.click();

  await expect(step).toContainText('Pistas: una sola palabra');
  await next.click();
  await expect(step).toContainText('¡Listo!');
  await page.getByRole('button', { name: 'Ir a armar una sala' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Done: the "¿Primera vez?" chip no longer shows in rooms.
  const host = { page, name: 'Ana' };
  await createRoom(host);
  await expect(page.getByText('¿Primera vez?')).toHaveCount(0);
});

test('first time in a room: the tutorial chip; skipping the tutorial counts as done', async ({
  browser,
}) => {
  const host = await newPlayer(browser, 'Ana');
  await createRoom(host);
  const chip = host.page.getByRole('link', { name: '¿Primera vez? Mirá el tutorial (2 min)' });
  await expect(chip).toHaveAttribute('target', '_blank');
  await expect(chip).toHaveAttribute('href', '/tutorial');

  const fresh = await newPlayer(browser, 'Beto');
  await fresh.page.goto('/tutorial');
  await fresh.page.getByRole('button', { name: 'Saltear tutorial' }).click();
  await expect(fresh.page).toHaveURL(/\/$/);
  await createRoom(fresh);
  await expect(fresh.page.getByText('¿Primera vez?')).toHaveCount(0);
});

test('rules: a page with collapsible sections and a modal from the game', async ({ browser }) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/reglas');
  await expect(page.getByRole('heading', { name: 'Reglas de Clave', level: 1 })).toBeVisible();
  for (const title of ['Objetivo', 'Roles', 'Turno', 'Pistas válidas', 'Ganar y perder']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('GIRASOL no vale')).toBeHidden();
  await page.getByText('Pistas válidas', { exact: true }).click();
  await expect(page.getByText('GIRASOL no vale', { exact: false })).toBeVisible();
  await expect(page.getByText('Traidor: quien lo toca pierde la partida.')).toBeVisible();

  const game = await startGame(browser);
  await game.caro.page.getByRole('button', { name: 'Reglas' }).click();
  const dialog = game.caro.page.getByRole('dialog', { name: 'Reglas de Clave' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Objetivo', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(dialog).toBeHidden();
  // Still in the game.
  await expect(game.caro.page.locator('[data-card-id]')).toHaveCount(25);
});

test('first-time tips show once and can be turned off', async ({ browser }) => {
  const game = await startGame(browser);
  const banner = (await game.ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const [spymaster, agent] = banner.includes('Rojo')
    ? [game.ana, game.caro]
    : [game.beto, game.dani];
  const tip = spymaster.page.getByTestId('tip-clue');
  await expect(tip).toBeVisible();
  await tip.getByRole('button', { name: 'Entendido' }).click();
  await expect(tip).toHaveCount(0);
  await spymaster.page.reload();
  await expect(spymaster.page.getByPlaceholder('Una sola palabra')).toBeVisible();
  await expect(spymaster.page.getByTestId('tip-clue')).toHaveCount(0);

  // The agent turns all tips off in Ajustes.
  await agent.page.getByRole('button', { name: 'Ajustes' }).click();
  await agent.page.getByLabel(/Mostrar ayudas la primera vez/).uncheck();
  await agent.page.getByRole('button', { name: 'Listo' }).click();
  await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.page.getByRole('button', { name: '1', exact: true }).click();
  await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
  await expect(agent.page.getByTestId('current-clue')).toHaveText('QXZ · 1');
  await expect(agent.page.getByTestId('tip-point')).toHaveCount(0);
});
