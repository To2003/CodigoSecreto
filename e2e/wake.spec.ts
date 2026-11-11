import { expect, test } from '@playwright/test';
import { closePlayers, newPlayer } from './helpers';

test.afterEach(closePlayers);

/** M8 (SPEC §0.4): a sleeping server on Render free takes up to a minute to answer. */
test('a sleeping server shows "Despertando a los agentes…" until it answers', async ({
  browser,
}) => {
  const { page } = await newPlayer(browser, 'Ana');
  let wakeUp: () => void = () => undefined;
  const awake = new Promise<void>((resolve) => {
    wakeUp = resolve;
  });
  // Asleep: the socket can't connect and /health doesn't answer yet.
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/health', async (route) => {
    await awake;
    await route.continue();
  });
  await page.goto('/');
  const screen = page.getByTestId('wake-screen');
  await expect(screen).toBeVisible();
  await expect(screen.getByRole('heading', { name: 'Despertando a los agentes…' })).toBeVisible();
  await expect(screen.getByRole('progressbar', { name: 'Despertando el servidor' })).toBeVisible();
  wakeUp();
  await expect(screen).toBeHidden();
  await expect(page.getByLabel('Apodo')).toBeVisible();
});

test('a fast server never shows it, and the rules page never asks', async ({ browser }) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/');
  await expect(page.getByText('Conectado')).toBeVisible();
  await page.waitForTimeout(2_000);
  await expect(page.getByTestId('wake-screen')).toHaveCount(0);

  const other = await newPlayer(browser, 'Beto');
  await other.page.route('**/health', () => new Promise(() => undefined));
  await other.page.route('**/socket.io/**', (route) => route.abort());
  await other.page.goto('/reglas');
  await other.page.waitForTimeout(2_500);
  await expect(other.page.getByTestId('wake-screen')).toHaveCount(0);
});
