import { expect, test } from '@playwright/test';
import argento from '../packages/shared/words/argento.json' with { type: 'json' };
import clasico from '../packages/shared/words/clasico.json' with { type: 'json' };
import { startGame } from './helpers';

/**
 * M4 acceptance (SPEC §3.3): no word is ever cut on a phone. The 50 widest words of all decks
 * (longest, then most wide letters) are dealt in two games and checked at 375 and 320 px.
 */
const WIDE = /[MWÑOQD]/gu;
const widest = [...clasico.words, ...argento.words]
  .sort(
    (a, b) => b.length - a.length || (b.match(WIDE)?.length ?? 0) - (a.match(WIDE)?.length ?? 0),
  )
  .slice(0, 50);

for (const [i, words] of [widest.slice(0, 25), widest.slice(25, 50)].entries()) {
  test(`the widest words fit their cards on phones (batch ${i + 1})`, async ({ browser }) => {
    test.setTimeout(90_000);
    const { caro } = await startGame(browser, { customWords: words });
    for (const width of [375, 320]) {
      await caro.page.setViewportSize({ width, height: 700 });
      await caro.page.evaluate(() => document.fonts.ready);
      // FitText re-fits from a ResizeObserver after the resize: poll until it settles.
      await expect
        .poll(
          () =>
            caro.page
              .locator('[data-fit]')
              .evaluateAll((els) =>
                els
                  .filter((el) => el.scrollWidth > (el.parentElement?.clientWidth ?? 0) + 0.5)
                  .map((el) => el.textContent),
              ),
          { message: `${width}px`, timeout: 3000 },
        )
        .toEqual([]);
      const ellipsis = await caro.page
        .locator('[data-card-id]')
        .evaluateAll((els) => els.filter((el) => el.textContent.includes('…')).length);
      expect(ellipsis).toBe(0);
    }
  });
}
