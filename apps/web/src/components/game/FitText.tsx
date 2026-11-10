import { useLayoutEffect, useRef } from 'react';
import { usePrefs } from '../../store/prefs';

const MIN_PX = 7;

/**
 * One line of text that shrinks until it fits its box (SPEC §3.3: never cut with "…").
 * Starts from the CSS font size (so the "card text size" setting applies) and scales down in
 * one step to the box's content width (padding excluded), then nudges until it fits.
 */
export function FitText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cardText = usePrefs((p) => p.cardText);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      el.style.fontSize = '';
      const style = getComputedStyle(box);
      const available =
        box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      let size = parseFloat(getComputedStyle(el).fontSize);
      if (el.scrollWidth > available && el.scrollWidth > 0) {
        size = Math.max(MIN_PX, Math.floor(size * (available / el.scrollWidth) * 4) / 4);
        el.style.fontSize = `${size}px`;
        // Glyph widths don't scale perfectly linearly: nudge down until it fits.
        while (el.scrollWidth > available && size > MIN_PX) {
          size -= 0.25;
          el.style.fontSize = `${size}px`;
        }
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    void document.fonts.ready.then(fit);
    return () => {
      observer.disconnect();
    };
  }, [text, cardText]);

  return (
    <span ref={ref} className={`block whitespace-nowrap ${className}`} data-fit>
      {text}
    </span>
  );
}
