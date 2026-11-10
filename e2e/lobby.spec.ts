import { expect, test } from '@playwright/test';
import { createRoom, joinByLink, newPlayer, row, team } from './helpers';

/** M2 acceptance (SPEC §12): 4 tabs build teams; F5 keeps the seat; team changes show in < 200 ms. */
test('four players build teams, survive F5 and see changes fast', async ({ browser }) => {
  const [ana, beto, caro, dani] = await Promise.all(
    ['Ana', 'Beto', 'Caro', 'Dani'].map((name) => newPlayer(browser, name)),
  );
  if (!ana || !beto || !caro || !dani) throw new Error('setup');

  const code = await createRoom(ana);
  for (const p of [beto, caro, dani]) await joinByLink(p, code);
  for (const p of [ana, beto, caro, dani]) {
    await expect(p.page.locator('[data-player]')).toHaveCount(4);
  }

  // Auto-balance put Ana and Caro in red, Beto and Dani in blue. Each team picks a spymaster.
  await team(ana.page, 'Equipo Rojo').getByRole('button', { name: 'Ser jefe' }).click();
  await team(beto.page, 'Equipo Azul').getByRole('button', { name: 'Ser jefe' }).click();
  await expect(ana.page.getByText('¡Listos! Cuando quieras, arrancá.')).toBeVisible();
  await expect(dani.page.getByText('Esperando a que el host arranque la partida…')).toBeVisible();

  // Latency: Dani moves to red; Ana's page reports when the row lands there.
  await ana.page.evaluate(() => {
    const w = window as unknown as { seenAt: Promise<number> };
    w.seenAt = new Promise((resolve) => {
      const check = () => document.querySelector('[data-team="red"] [data-player="Dani"]');
      const observer = new MutationObserver(() => {
        if (check()) {
          observer.disconnect();
          resolve(Date.now());
        }
      });
      observer.observe(document.body, { subtree: true, childList: true });
    });
  });
  const clickedAt = await dani.page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-team="red"] button');
    const now = Date.now();
    button?.click();
    return now;
  });
  const seenAt = await ana.page.evaluate(
    () => (window as unknown as { seenAt: Promise<number> }).seenAt,
  );
  const latency = seenAt - clickedAt;
  console.log(`team change latency: ${latency} ms`);
  expect(latency).toBeLessThan(200);
  for (const p of [ana, beto, caro, dani]) {
    await expect(row(team(p.page, 'Equipo Rojo'), 'Dani')).toBeVisible();
  }

  // F5: Beto (blue spymaster) reloads and keeps team, role and identity.
  await beto.page.reload();
  await expect(beto.page.getByRole('heading', { name: `Sala ${code}` })).toBeVisible();
  const betoRow = row(team(beto.page, 'Equipo Azul'), 'Beto');
  await expect(betoRow).toContainText('vos');
  await expect(
    team(beto.page, 'Equipo Azul').getByRole('button', { name: 'Ser agente' }),
  ).toBeVisible();
  await expect(beto.page.locator('[data-player]')).toHaveCount(4);
  await expect(row(ana.page, 'Beto')).not.toContainText('desconectado');
});

test('host settings reach everyone; non-hosts see them read-only', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinByLink(beto, code);

  await ana.page.getByLabel('Tiempo para la pista').selectOption('90');
  // Guests see the settings folded; they can open them to read.
  await beto.page.getByText('Configuración').click();
  await expect(beto.page.getByLabel('Tiempo para la pista')).toHaveValue('90');
  await expect(beto.page.getByLabel('Tiempo para la pista')).toBeDisabled();
  await expect(beto.page.getByText('Solo quien armó la sala puede cambiarla.')).toBeVisible();
});

test('the host can kick a player', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  const beto = await newPlayer(browser, 'Beto');
  const code = await createRoom(ana);
  await joinByLink(beto, code);
  await ana.page.getByRole('button', { name: 'Echar a Beto' }).click();
  await expect(beto.page.getByText('Te sacaron de la sala.')).toBeVisible();
  await expect(ana.page.locator('[data-player]')).toHaveCount(1);
});

test('an unknown room code says so', async ({ browser }) => {
  const ana = await newPlayer(browser, 'Ana');
  await ana.page.goto('/sala/ZZZZ');
  await ana.page.getByLabel('Apodo').fill('Ana');
  await ana.page.getByRole('button', { name: 'Entrar' }).click();
  await expect(ana.page.getByText('No existe esa sala. Revisá el código.')).toBeVisible();
});
