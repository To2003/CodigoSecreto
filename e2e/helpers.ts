import { expect, type Browser, type Locator, type Page } from '@playwright/test';

export interface Player {
  page: Page;
  name: string;
}

/** Each player gets its own browser context: separate storage, like separate devices. */
export async function newPlayer(
  browser: Browser,
  name: string,
  viewport?: { width: number; height: number },
): Promise<Player> {
  const context = await browser.newContext(viewport ? { viewport } : {});
  const page = await context.newPage();
  return { page, name };
}

async function fillProfile(page: Page, name: string) {
  await page.getByLabel('Apodo').fill(name);
}

export async function createRoom(host: Player): Promise<string> {
  await host.page.goto('/');
  await fillProfile(host.page, host.name);
  await host.page.getByRole('button', { name: 'Crear sala' }).click();
  await expect(host.page).toHaveURL(/\/sala\/[A-Z]{4}$/);
  const code = host.page.url().slice(-4);
  await expect(host.page.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
  return code;
}

export async function joinByLink(player: Player, code: string) {
  await player.page.goto(`/sala/${code}`);
  await fillProfile(player.page, player.name);
  await player.page.getByRole('button', { name: 'Entrar' }).click();
  await expect(player.page.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
}

export const team = (page: Page, name: 'Equipo Rojo' | 'Equipo Azul' | 'Espectadores') =>
  page.getByRole('region', { name });

export const row = (scope: Page | Locator, nickname: string) =>
  scope.locator(`[data-player="${nickname}"]`);

/** Ana (host) and Caro red, Beto and Dani blue (lobby auto-balance); Ana and Beto spymasters. */
export async function startGame(
  browser: Browser,
  options: { viewport?: { width: number; height: number }; customWords?: string[] } = {},
) {
  const [ana, beto, caro, dani] = await Promise.all(
    ['Ana', 'Beto', 'Caro', 'Dani'].map((name) => newPlayer(browser, name, options.viewport)),
  );
  if (!ana || !beto || !caro || !dani) throw new Error('setup');
  const code = await createRoom(ana);
  for (const p of [beto, caro, dani]) await joinByLink(p, code);
  if (options.customWords) {
    const words = ana.page.getByRole('textbox', { name: /Palabras propias/ });
    await words.fill(options.customWords.join(', '));
    await words.blur();
    // Controlled by the server: click, then wait for the round trip.
    await ana.page.getByLabel('Clásico (814)').click();
    await expect(ana.page.getByLabel('Clásico (814)')).not.toBeChecked();
    await expect(
      ana.page.getByText(`${options.customWords.length} palabras propias`),
    ).toBeVisible();
  }
  await team(ana.page, 'Equipo Rojo').getByRole('button', { name: 'Ser jefe' }).click();
  await team(beto.page, 'Equipo Azul').getByRole('button', { name: 'Ser jefe' }).click();
  await ana.page.getByRole('button', { name: 'Empezar' }).click();
  for (const p of [ana, beto, caro, dani])
    await expect(p.page.locator('[data-card-id]')).toHaveCount(25);
  return { code, ana, beto, caro, dani };
}
