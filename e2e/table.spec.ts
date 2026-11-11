import { expect, test } from '@playwright/test';
import { closePlayers, createRoom, newPlayer, startGame } from './helpers';

test.afterEach(closePlayers);

/** M9.2, modo mesa: the room on a big screen; it never shows the key map. */
test('the table joins as a spectator and shows how to get in', async ({ browser }) => {
  const host = await newPlayer(browser, 'Ana');
  const code = await createRoom(host);
  const link = host.page.getByRole('link', { name: 'Abrir pantalla de mesa' });
  await expect(link).toHaveAttribute('href', `/sala/${code}/mesa`);
  await expect(link).toHaveAttribute('target', '_blank');

  const tv = await newPlayer(browser, 'TV');
  await tv.page.goto(`/sala/${code}/mesa`);
  await expect(tv.page.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
  await expect(tv.page.getByText(`/sala/${code}`)).toBeVisible();
  // On the host's lobby, "Mesa" sits with the spectators.
  await expect(
    host.page.getByRole('region', { name: 'Espectadores' }).getByText('Mesa'),
  ).toBeVisible();
});

test('during a game the table shows the board and the clue, never the map', async ({ browser }) => {
  const game = await startGame(browser);
  const tv = await newPlayer(browser, 'TV');
  await tv.page.goto(`/sala/${game.code}/mesa`);
  await expect(tv.page.locator('[data-card-id]')).toHaveCount(25);
  await expect(tv.page.locator('[data-revealed="false"][data-type]')).toHaveCount(0);
  const banner = (await game.ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const spymaster = banner.includes('Rojo') ? game.ana : game.beto;
  await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.page.getByRole('button', { name: '2', exact: true }).click();
  await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
  await expect(tv.page.getByTestId('table-clue')).toHaveText('Pista: QXZ · 2');
  // The table is a screen: no buttons to point or reveal.
  await expect(tv.page.getByRole('button', { name: /^Señalar/ })).toHaveCount(0);
});

test('a player and the table in the same browser keep their own seats', async ({ browser }) => {
  const host = await newPlayer(browser, 'Ana');
  const code = await createRoom(host);
  const tv = await host.page.context().newPage();
  await tv.goto(`/sala/${code}/mesa`);
  await expect(tv.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
  // The host is still in a team with the host's name, the table is a separate spectator.
  await expect(
    host.page.getByRole('region', { name: 'Espectadores' }).getByText('Mesa'),
  ).toBeVisible();
  await expect(
    host.page.getByRole('region', { name: 'Equipo Rojo' }).getByText('Ana'),
  ).toBeVisible();
});
