import { expect, test } from '@playwright/test';
import { closePlayers, newPlayer } from './helpers';

test.afterEach(closePlayers);

/** M9.5: installable app. The E2E server is the production build, so the worker is live. */
test('manifest and icons are there for installing', async ({ browser }) => {
  const { page } = await newPlayer(browser, 'Ana');
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as {
    name: string;
    display: string;
    icons: { src: string; sizes: string }[];
  };
  expect(manifest).toMatchObject({ name: 'Clave', display: 'standalone' });
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((i) => i.sizes === size);
    expect(icon, size).toBeDefined();
    const res = await page.request.get(icon?.src ?? '');
    expect(res.headers()['content-type']).toContain('image/png');
  }
});

test('the service worker keeps the app shell for when the connection drops', async ({
  browser,
}) => {
  const player = await newPlayer(browser, 'Ana');
  const { page } = player;
  await page.goto('/');
  const ready = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? '';
  });
  expect(ready).toMatch(/\/sw\.js$/);
  // Once the worker controls the page, a reload without network still shows the app.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Clave' })).toBeVisible();
  await page.context().setOffline(false);
});
