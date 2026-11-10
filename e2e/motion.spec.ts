import { expect, test, type Page } from '@playwright/test';
import { startGame, type Player } from './helpers';

/**
 * M5 acceptance (SPEC §12): with reduced motion there are no flips or shakes; reveals stay at
 * 60 fps. Animations are observed through document.getAnimations() while a reveal plays.
 */
const MOVING = [
  'flip',
  'shake-x',
  'screen-shake',
  'sweep',
  'card-in',
  'drop-in',
  'pop',
  'roll-in',
  'particle',
  'traitor-zoom',
];

async function prepareReveal(browser: Parameters<typeof startGame>[0]) {
  const game = await startGame(browser);
  const banner = (await game.ana.page.getByTestId('turn-banner').textContent()) ?? '';
  const [spymaster, agent, team] = banner.includes('Rojo')
    ? [game.ana, game.caro, 'red']
    : [game.beto, game.dani, 'blue'];
  await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
  await spymaster.page.getByRole('button', { name: '∞', exact: true }).click();
  await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
  const words = await spymaster.page
    .locator(`[data-revealed="false"][data-type="${team}"]`)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-word') ?? ''));
  return { agent, words };
}

/** Reveals a card and returns the names of every animation seen during the next 1.2 s. */
async function animationsDuringReveal(agent: Player, word: string) {
  await agent.page.getByRole('button', { name: `Señalar ${word}`, exact: true }).click();
  await agent.page.evaluate(() => {
    const w = window as unknown as { seen: Set<string> };
    w.seen = new Set();
    const sample = () => {
      for (const a of document.getAnimations()) {
        if ('animationName' in a) w.seen.add(String(a.animationName));
      }
    };
    const timer = setInterval(sample, 30);
    setTimeout(() => {
      clearInterval(timer);
    }, 1200);
  });
  await agent.page.getByRole('button', { name: `Dar vuelta ${word}`, exact: true }).click();
  await agent.page.waitForTimeout(1300);
  return agent.page.evaluate(() => [...(window as unknown as { seen: Set<string> }).seen]);
}

test('reveals flip and settle with full motion', async ({ browser }) => {
  const { agent, words } = await prepareReveal(browser);
  const seen = await animationsDuringReveal(agent, words[0] ?? '');
  expect(seen).toContain('flip');
});

for (const how of ['system setting', 'Ajustes toggle'] as const) {
  test(`reduced motion (${how}): no flips, shakes or sweeps, only short fades`, async ({
    browser,
  }) => {
    const { agent, words } = await prepareReveal(browser);
    await reduceMotion(agent.page, how);
    const seen = await animationsDuringReveal(agent, words[0] ?? '');
    expect(seen.filter((name) => MOVING.includes(name))).toEqual([]);
    await expect(agent.page.locator('.anim-flip')).toHaveCount(0);
  });
}

async function reduceMotion(page: Page, how: 'system setting' | 'Ajustes toggle') {
  if (how === 'system setting') {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  } else {
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('Reducir animaciones').check();
    await page.getByRole('button', { name: 'Listo' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
}

/**
 * Frame pacing during a reveal (SPEC §4: 60 fps on a mid-range phone). The CPU is slowed 4× via
 * the DevTools protocol to stand in for a mid-range phone; requestAnimationFrame timestamps give
 * the frame intervals while the flip, glow and particles play.
 */
test('a reveal keeps frames under budget with the CPU slowed 4×', async ({ browser }) => {
  const { agent, words } = await prepareReveal(browser);
  const cdp = await agent.page.context().newCDPSession(agent.page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await agent.page.getByRole('button', { name: `Señalar ${words[0] ?? ''}`, exact: true }).click();
  await agent.page.evaluate(() => {
    const w = window as unknown as { frames: number[] };
    w.frames = [];
    const tick = (t: number) => {
      w.frames.push(t);
      if (w.frames.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await agent.page
    .getByRole('button', { name: `Dar vuelta ${words[0] ?? ''}`, exact: true })
    .click();
  await agent.page.waitForTimeout(2000);
  const frames = await agent.page.evaluate(
    () => (window as unknown as { frames: number[] }).frames,
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const raw = frames.slice(1).map((t, i) => t - (frames[i] ?? t));
  const longest = raw.indexOf(Math.max(...raw));
  console.log(
    `longest frame #${longest} of ${raw.length}: ${raw
      .slice(Math.max(0, longest - 2), longest + 3)
      .map((x) => x.toFixed(0))
      .join(' ')}`,
  );
  const intervals = [...raw].sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)] ?? 0;
  const p95 = intervals[Math.floor(intervals.length * 0.95)] ?? 0;
  console.log(
    `frames: ${intervals.length}, median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${(intervals.at(-1) ?? 0).toFixed(1)} ms`,
  );
  expect(median).toBeLessThan(17.5);
  expect(p95).toBeLessThan(34);
  // The one frame where the server patch lands and React commits: bounded, not hidden.
  expect(intervals.at(-1) ?? 0).toBeLessThan(100);
});
