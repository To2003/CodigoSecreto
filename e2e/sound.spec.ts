import { expect, test } from '@playwright/test';
import { newPlayer } from './helpers';

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
