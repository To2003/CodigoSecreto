import { expect, test, type Page } from '@playwright/test';
import { closePlayers, createRoom, joinByLink, newPlayer, team, type Player } from './helpers';

test.afterEach(closePlayers);

/**
 * Optional accounts (docs/specs/M9-cuentas.md), against the server's AUTH_MODE=memory: the test
 * sign-in stands in for Google. Guests play exactly as before (every other spec).
 */
async function signIn(player: Player, displayName?: string) {
  await player.page.goto('/cuenta');
  await player.page.getByLabel('Nombre de prueba').fill(player.name);
  await player.page.getByRole('button', { name: 'Entrar (modo prueba)' }).click();
  await expect(player.page.getByLabel('Tu nombre en el ranking')).toBeVisible();
  if (displayName) {
    await player.page.getByLabel('Tu nombre en el ranking').fill(displayName);
    await player.page.getByRole('button', { name: 'Guardar' }).click();
    await expect(player.page.getByText('Listo, guardado.')).toBeVisible();
  }
}

const stats = (page: Page) => page.getByTestId('account-stats');

test('sign in, pick a name, see your (empty) stats; no email anywhere', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  await signIn(ana, 'Anita');
  await expect(stats(ana.page)).toContainText('Partidas: 0');
  await expect(ana.page.getByText('@')).toHaveCount(0);
  await ana.page.reload();
  await expect(ana.page.getByLabel('Tu nombre en el ranking')).toHaveValue('Anita');
});

test('a game with two accounts: stats saved, likes only at the end and only seen by the receiver', async ({
  browser,
}) => {
  const [ana, beto, caro, dani] = await Promise.all(
    ['Ana', 'Beto', 'Caro', 'Dani'].map((n) => newPlayer(browser, n)),
  );
  if (!ana || !beto || !caro || !dani) throw new Error('setup');
  await signIn(ana, 'Ana');
  await signIn(beto, 'Beto');
  const code = await createRoom(ana);
  for (const p of [beto, caro, dani]) await joinByLink(p, code);
  await team(ana.page, 'Equipo Rojo').getByRole('button', { name: 'Ser jefe' }).click();
  await team(beto.page, 'Equipo Azul').getByRole('button', { name: 'Ser jefe' }).click();
  await ana.page.getByRole('button', { name: 'Empezar' }).click();
  for (const p of [ana, beto, caro, dani])
    await expect(p.page.locator('[data-card-id]')).toHaveCount(25);

  // No likes during the game: the panel doesn't exist.
  await expect(caro.page.getByTestId('likes')).toHaveCount(0);
  const banner = (await ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const [sm, agent] = banner.includes('Rojo') ? [ana, caro] : [beto, dani];
  await sm.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await sm.page.getByRole('button', { name: '1', exact: true }).click();
  await sm.page.getByRole('button', { name: 'Mandar pista' }).click();
  const traitor = (await sm.page.locator('[data-type="traitor"]').getAttribute('data-word')) ?? '';
  await agent.page.getByRole('button', { name: `Señalar ${traitor}`, exact: true }).click();
  await agent.page.getByRole('button', { name: `Dar vuelta ${traitor}`, exact: true }).click();
  for (const p of [ana, beto, caro, dani]) await expect(p.page.getByTestId('likes')).toBeVisible();

  // Caro (a guest) likes Ana. Only Ana sees it, as a count.
  await caro.page.getByRole('button', { name: 'Like a Ana' }).click();
  await expect(caro.page.getByText('Diste tu like.')).toBeVisible();
  await expect(ana.page.getByTestId('likes-received')).toHaveText(/Te dieron 1 like/);
  for (const p of [beto, caro, dani])
    await expect(p.page.getByTestId('likes-received')).toHaveCount(0);

  // Ana's account: one game and one like.
  const page = await ana.page.context().newPage();
  await page.goto('/cuenta');
  await expect(stats(page)).toContainText('Partidas: 1');
  await expect(stats(page)).toContainText('Likes recibidos: 1');
});

test('ranking: two tabs, empty until someone has 10 games', async ({ browser }) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/ranking');
  await expect(page.getByRole('tab', { name: 'Victorias' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('Todavía no hay nadie con 10 partidas.')).toBeVisible();
  await page.getByRole('tab', { name: 'Victorias' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Los más queridos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('Likes recibidos por partida jugada')).toBeVisible();
});

test('privacy: delete my account and my data', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  await signIn(ana, 'Ana');
  await ana.page.goto('/privacidad');
  await expect(ana.page.getByText('Tu mail lo maneja solo el sistema de login')).toBeVisible();
  await ana.page.getByRole('button', { name: 'Borrar mi cuenta y mis datos' }).click();
  await ana.page.getByRole('button', { name: 'Sí, borrar todo' }).click();
  await expect(ana.page.getByText('Listo: tu cuenta y tus datos se borraron.')).toBeVisible();
  await ana.page.goto('/cuenta');
  await expect(ana.page.getByRole('button', { name: 'Entrar (modo prueba)' })).toBeVisible();
});
