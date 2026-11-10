import { useLayoutEffect, useRef } from 'react';

const MIN_PX = 7;

/**
 * One line of text that shrinks until it fits its box (SPEC §3.3: never cut with "…").
 * Starts from the CSS font size and steps down by 0.5px while it overflows.
 */
export function FitText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > box.clientWidth && size > MIN_PX) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    void document.fonts.ready.then(fit);
    return () => {
      observer.disconnect();
    };
  }, [text]);

  return (
    <span ref={ref} className={`block whitespace-nowrap ${className}`} data-fit>
      {text}
    </span>
  );
}
