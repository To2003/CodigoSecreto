import { expect, test } from '@playwright/test';
import { newPlayer, closePlayers, startGame } from './helpers';

test.afterEach(closePlayers);

/** M6 (SPEC §12): audio starts on the first gesture; volumes persist. */
test('audio unlocks on the first gesture', async ({ browser }) => {
  const player = await newPlayer(browser, 'Ana');
  await player.page.goto('/');
  await expect(player.page.locator('html')).not.toHaveAttribute('data-audio', 'running');
  await player.page.getByLabel('Apodo').click();
  await expect(player.page.locator('html')).toHaveAttribute('data-audio', 'running');
});

test('volumes persist across reloads', async ({ browser }) => {
  const player = await newPlayer(browser, 'Ana');
  await player.page.goto('/');
  await player.page.getByRole('button', { name: 'Ajustes' }).click();
  const music = player.page.getByRole('slider', { name: 'Música' });
  await music.fill('0.15');
  await expect(player.page.getByText('15%')).toBeVisible();
  await player.page.getByRole('button', { name: 'Listo' }).click();
  await player.page.reload();
  await player.page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(player.page.getByRole('slider', { name: 'Música' })).toHaveValue('0.15');
  await expect(player.page.getByRole('slider', { name: 'Volumen general' })).toHaveValue('0.8');
});

test('"te toca" with the tab in the background blinks the title until you come back', async ({
  browser,
}) => {
  const game = await startGame(browser);
  const banner = (await game.ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const [spymaster, agent] = banner.includes('Rojo')
    ? [game.ana, game.caro]
    : [game.beto, game.dani];
  const original = await agent.page.title();
  // The agent's tab goes to the background (Playwright pages are always "visible").
  const setHidden = (hidden: boolean) =>
    agent.page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
    }, hidden);
  await setHidden(true);
  await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.page.getByRole('button', { name: '1', exact: true }).click();
  await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
  await expect(agent.page).toHaveTitle('⚠ ¡Te toca!', { timeout: 3000 });
  await setHidden(false);
  await expect(agent.page).toHaveTitle(original, { timeout: 3000 });
});
