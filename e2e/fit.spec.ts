import { expect, test, type Page } from '@playwright/test';
import argento from '../packages/shared/words/argento.json' with { type: 'json' };
import clasico from '../packages/shared/words/clasico.json' with { type: 'json' };
import { startGame } from './helpers';

/**
 * M4 acceptance (SPEC §3.3): no word is ever cut. The 50 widest deck words (longest, then most
 * wide letters) are dealt in two games; part of them get revealed so both the face and the small
 * label of revealed cards are checked, at 320, 375 and 1440 px. "Cut" is measured on screen: the
 * text's box must stay inside the card button that clips it, and inside its own label.
 */
const WIDE = /[MWÑOQD]/gu;
const widest = [...clasico.words, ...argento.words]
  .sort(
    (a, b) => b.length - a.length || (b.match(WIDE)?.length ?? 0) - (a.match(WIDE)?.length ?? 0),
  )
  .slice(0, 50);

/** Words whose rendered text sticks out of the clipping card or of its own label. */
function cutWords(page: Page) {
  return page.locator('[data-fit]').evaluateAll((els) =>
    els
      .filter((el) => {
        const text = el.getBoundingClientRect();
        const button = el.closest('button')?.getBoundingClientRect();
        const label = el.parentElement?.getBoundingClientRect();
        if (!button || !label) return true;
        const inside = (outer: DOMRect) =>
          text.left >= outer.left - 0.5 && text.right <= outer.right + 0.5;
        return !inside(button) || !inside(label) || el.scrollWidth > el.clientWidth + 0.5;
      })
      .map((el) => el.textContent),
  );
}

for (const [i, words] of [widest.slice(0, 25), widest.slice(25, 50)].entries()) {
  test(`the widest words fit their cards, hidden and revealed (batch ${i + 1})`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const { ana, beto, caro, dani } = await startGame(browser, { customWords: words });

    // Reveal most of the active team's agents so long words also sit on revealed labels.
    const banner = (await ana.page.getByTestId('turn-banner').textContent()) ?? '';
    const [spymaster, agent, team] = banner.includes('Rojo')
      ? [ana, caro, 'red']
      : [beto, dani, 'blue'];
    await spymaster.page.getByPlaceholder('Una sola palabra').fill('QXZ');
    await spymaster.page.getByRole('button', { name: '∞', exact: true }).click();
    await spymaster.page.getByRole('button', { name: 'Mandar pista' }).click();
    const own = await spymaster.page
      .locator(`[data-revealed="false"][data-type="${team}"]`)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-word') ?? ''));
    for (const word of own.slice(0, 7)) {
      await agent.page.getByRole('button', { name: `Señalar ${word}`, exact: true }).click();
      await agent.page.getByRole('button', { name: `Dar vuelta ${word}`, exact: true }).click();
      await expect(agent.page.locator(`[data-word="${word}"]`)).toHaveAttribute(
        'data-revealed',
        'true',
      );
    }

    for (const width of [320, 375, 1440]) {
      await caro.page.setViewportSize({ width, height: 800 });
      await caro.page.evaluate(() => document.fonts.ready);
      // FitText re-fits from a ResizeObserver after the resize: poll until it settles.
      await expect
        .poll(() => cutWords(caro.page), { message: `${width}px`, timeout: 3000 })
        .toEqual([]);
      const ellipsis = await caro.page
        .locator('[data-card-id]')
        .evaluateAll((els) => els.filter((el) => el.textContent.includes('…')).length);
      expect(ellipsis).toBe(0);
    }
  });
}
