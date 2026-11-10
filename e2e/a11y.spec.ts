import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createRoom, newPlayer, startGame } from './helpers';

/** CONSTRAINTS.md: zero critical or serious axe violations (WCAG 2.1 A/AA, contrast included). */
async function expectAccessible(page: Page, label: string) {
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

  const { ana, caro } = await startGame(browser);
  await expectAccessible(ana.page, 'game (spymaster)');
  await expectAccessible(caro.page, 'game (agent)');
});

test('color-blind mode stays accessible', async ({ browser }) => {
  const { ana } = await startGame(browser);
  await ana.page.getByRole('button', { name: 'Ajustes' }).click();
  await ana.page.getByLabel('Modo daltónico').check();
  await ana.page.getByRole('button', { name: 'Listo' }).click();
  await expect(ana.page.locator('html')).toHaveAttribute('data-colorblind', 'true');
  await expectAccessible(ana.page, 'game (color-blind)');
});
