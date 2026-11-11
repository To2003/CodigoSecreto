import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { closePlayers, createRoom, newPlayer } from './helpers';

test.afterEach(closePlayers);

/** M9.4: community decks, exported and imported as a JSON file. */
const deck = (words: string[]) =>
  Buffer.from(JSON.stringify({ format: 'clave-deck', version: 1, name: 'Asado', words }));

test('the host imports a deck file and exports the room words back', async ({ browser }) => {
  const host = await newPlayer(browser, 'Ana');
  await createRoom(host);
  const input = host.page.getByLabel('Importar mazo (archivo)');
  await input.setInputFiles({
    name: 'asado.json',
    mimeType: 'application/json',
    buffer: deck(['chori', 'vacío', 'molleja', 'dos palabras']),
  });
  await expect(host.page.getByText('Se cargó "Asado": 3 palabras.')).toBeVisible();
  await expect(host.page.getByText('3 palabras propias')).toBeVisible();
  await expect(host.page.getByText('No se usaron: dos palabras')).toBeVisible();

  const download = host.page.waitForEvent('download');
  await host.page.getByRole('button', { name: 'Exportar palabras (archivo)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^clave-mazo-[a-z]{4}\.json$/);
  const saved = JSON.parse(await readFile(await file.path(), 'utf8')) as {
    format: string;
    words: string[];
  };
  expect(saved.format).toBe('clave-deck');
  expect(saved.words).toEqual(['CHORI', 'VACÍO', 'MOLLEJA']);
});

test('a file that is not a deck is refused with a message', async ({ browser }) => {
  const host = await newPlayer(browser, 'Ana');
  await createRoom(host);
  await host.page.getByLabel('Importar mazo (archivo)').setInputFiles({
    name: 'otra.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hola": 1}'),
  });
  await expect(host.page.getByText('Ese archivo no es un mazo de Clave.')).toBeVisible();
  await expect(host.page.getByText('0 palabras propias')).toBeVisible();
});
