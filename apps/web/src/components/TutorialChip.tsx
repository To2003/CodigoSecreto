import { useState } from 'react';
import { t } from '../i18n/es-AR';
import { hideTutorialChip, tutorialChipHidden, tutorialDone } from '../lib/storage';

/**
 * "¿Primera vez?" (SPEC §8.1) for whoever enters a room without the tutorial. It opens in a new
 * tab so the seat in the room isn't lost.
 */
export function TutorialChip() {
  const [hidden, setHidden] = useState(() => tutorialDone() || tutorialChipHidden());
  if (hidden) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 self-start rounded-full border border-accent/60 bg-accent/10 py-1 pr-2 pl-3 text-sm">
      <a
        href="/tutorial"
        target="_blank"
        rel="noopener"
        className="font-semibold text-accent underline"
      >
        {t.tutorial.chip}
      </a>
      <button
        type="button"
        className="rounded-full px-2 text-paper/70 underline"
        onClick={() => {
          hideTutorialChip();
          setHidden(true);
        }}
      >
        {t.tutorial.chipDismiss}
      </button>
    </p>
  );
}
