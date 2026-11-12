import { expect, test } from '@playwright/test';
import { closePlayers, newPlayer } from './helpers';

/** ADR-035: one Button component, a fixed "← Volver" and real buttons instead of underlined links. */
test.afterEach(closePlayers);

test('landing: the four side screens as 44 px buttons; back returns to where you were', async ({
  browser,
}) => {
  const { page } = await newPlayer(browser, 'Ana', { viewport: { width: 375, height: 812 } });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Más sobre Clave' });
  for (const name of ['Tutorial (2 min)', 'Reglas', 'Ranking', 'Mi cuenta']) {
    const link = nav.getByRole('link', { name });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
  }
  // Nothing on the landing is an underlined link anymore.
  const underlined = await page
    .locator('a, button')
    .evaluateAll(
      (els) => els.filter((el) => getComputedStyle(el).textDecorationLine === 'underline').length,
    );
  expect(underlined).toBe(0);

  await nav.getByRole('link', { name: 'Reglas' }).click();
  await expect(page).toHaveURL(/\/reglas$/);
  const back = page.getByTestId('back-button');
  const before = await back.boundingBox();
  await page.mouse.wheel(0, 1500);
  // Fixed: same corner after scrolling.
  await expect.poll(async () => (await back.boundingBox())?.y).toBe(before?.y);
  await back.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Crear sala' })).toBeVisible();
});

test('a side page opened directly goes back to the home page; the keyboard reaches everything', async ({
  browser,
}) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/ranking');
  await expect(page.getByRole('heading', { name: 'Ranking', level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('back-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tab', { name: 'Victorias' })).toBeFocused();
  // The empty ranking invites to play instead of a bare sentence.
  const empty = page.getByTestId('ranking-empty');
  await expect(empty.locator('svg').first()).toBeVisible();
  await empty.getByRole('link', { name: 'Crear sala' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/privacidad');
  await page.getByTestId('back-button').click();
  await expect(page).toHaveURL(/\/$/);
});

test('signed in: "Mi cuenta" shows your name; the danger zone asks in a modal first', async ({
  browser,
}) => {
  const ana = await newPlayer(browser, 'Ana');
  const { page } = ana;
  await page.goto('/cuenta');
  await page.getByLabel('Nombre de prueba').fill('Ana');
  await page.getByRole('button', { name: 'Entrar (modo prueba)' }).click();
  await page.getByLabel('Tu nombre en el ranking').fill('Anita');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Listo, guardado.')).toBeVisible();

  await expect(page.getByRole('link', { name: 'Ver el ranking' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacidad' })).toBeVisible();

  const zone = page.getByTestId('danger-zone');
  await zone.getByRole('button', { name: 'Borrar mi cuenta y mis datos' }).click();
  const dialog = page.getByRole('alertdialog', { name: '¿Borrar tu cuenta?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Tu nombre en el ranking.');
  await expect(dialog).toContainText('Tu cuenta de Google no se toca');
  // The safe answer has the focus; Escape closes without deleting.
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.goto('/');
  await expect(page.getByTestId('landing-account')).toHaveText('Anita');
});
