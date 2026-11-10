import { expect, type Browser, type Locator, type Page } from '@playwright/test';

export interface Player {
  page: Page;
  name: string;
}

/** Each player gets its own browser context: separate storage, like separate devices. */
export async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext();
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
