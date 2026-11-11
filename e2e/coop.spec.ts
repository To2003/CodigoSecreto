import { expect, test, type Page } from '@playwright/test';
import { closePlayers, createRoom, joinByLink, newPlayer, team, type Player } from './helpers';

test.afterEach(closePlayers);

/** M9.1: cooperative mode (docs/specs/M9-cooperativo.md), two sides against the board. */
async function coopRoom(browser: Parameters<typeof newPlayer>[0], withSpectator = false) {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinByLink(beto, code);
  let caro: Player | null = null;
  if (withSpectator) {
    caro = await newPlayer(browser, 'Caro');
    await joinByLink(caro, code);
    await caro.page.getByRole('button', { name: 'Mirar' }).click();
  }
  await ana.page.getByRole('combobox', { name: /Modo/ }).selectOption('coop');
  // Sides A and B, no spymasters.
  await expect(team(ana.page, 'Equipo Rojo')).toHaveCount(0);
  await expect(ana.page.getByRole('region', { name: 'Lado A' })).toBeVisible();
  await expect(ana.page.getByRole('button', { name: 'Ser jefe' })).toHaveCount(0);
  await ana.page.getByRole('button', { name: 'Empezar' }).click();
  for (const p of [ana, beto]) await expect(p.page.locator('[data-word]')).toHaveCount(25);
  return { ana, beto, caro };
}

const keysOf = (page: Page, key: string) =>
  page
    .locator(`[data-key="${key}"][data-found="false"]`)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-word') ?? ''));

async function giveClue(giver: Page) {
  await giver.getByPlaceholder('Una sola palabra').fill('QXZ');
  await giver.getByRole('button', { name: '∞', exact: true }).click();
  await giver.getByRole('button', { name: 'Mandar pista' }).click();
}

async function turn(guesser: Page, word: string) {
  const card = guesser.locator(`[data-word="${word}"]`);
  await card.click();
  await expect(card).toHaveAccessibleName(`Dar vuelta ${word}`);
  await card.click();
}

test('each side sees only its own map; spectators none', async ({ browser }) => {
  const { ana, beto, caro } = await coopRoom(browser, true);
  await expect(ana.page.locator('[data-key]')).toHaveCount(25);
  await expect(beto.page.locator('[data-key]')).toHaveCount(25);
  await expect(caro?.page.locator('[data-word]') ?? ana.page.locator('x')).toHaveCount(25);
  await expect(caro?.page.locator('[data-key]') ?? ana.page.locator('x')).toHaveCount(0);
  const mapA = await ana.page
    .locator('[data-word]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-key')).join());
  const mapB = await beto.page
    .locator('[data-word]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-key')).join());
  expect(mapA).not.toBe(mapB);
  await expect(ana.page.getByTestId('coop-agents')).toHaveText('Faltan 15 agentes');
  await expect(ana.page.getByTestId('coop-turns')).toHaveText('Quedan 9 turnos');
});

test('two players find all 15 agents and win', async ({ browser }) => {
  const { ana, beto } = await coopRoom(browser);
  const sides = { red: ana.page, blue: beto.page };
  for (let i = 0; i < 9; i++) {
    if (await ana.page.getByTestId('coop-over').isVisible()) break;
    const banner = (await ana.page.getByTestId('turn-banner').textContent()) ?? '';
    const [giver, guesser] = banner.includes('A')
      ? [sides.red, sides.blue]
      : [sides.blue, sides.red];
    await giveClue(giver);
    await expect(guesser.getByText(/Pista del otro lado: QXZ · ∞/)).toBeVisible();
    for (const word of await keysOf(giver, 'agent')) {
      if (await guesser.getByTestId('coop-over').isVisible()) break;
      await turn(guesser, word);
      await expect(guesser.locator(`[data-word="${word}"]`)).toHaveAttribute('data-found', 'true');
    }
  }
  for (const p of [ana.page, beto.page]) {
    await expect(p.getByTestId('coop-over')).toContainText('Encontraron a los 15 agentes');
    await expect(p.getByTestId('coop-agents')).toHaveText('Faltan 0 agentes');
  }
  // Rematch: a new board.
  await ana.page.getByRole('button', { name: 'Otra partida' }).click();
  await expect(beto.page.getByTestId('coop-turns')).toHaveText('Quedan 9 turnos');
});

test('a traitor of the giver’s map loses at once', async ({ browser }) => {
  const { ana, beto } = await coopRoom(browser);
  await giveClue(ana.page);
  const [traitor = ''] = await keysOf(ana.page, 'traitor');
  await turn(beto.page, traitor);
  await expect(beto.page.getByTestId('coop-over')).toContainText('Tocaron a un traidor');
  await expect(beto.page.getByTestId('news')).toContainText(`${traitor}: ¡traidor!`);
});
