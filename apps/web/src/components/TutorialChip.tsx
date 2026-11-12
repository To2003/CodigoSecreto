import { useState } from 'react';
import { t } from '../i18n/es-AR';
import { hideTutorialChip, tutorialChipHidden, tutorialDone } from '../lib/storage';
import { Button, buttonClass } from './ui/Button';
import { IconLens } from './ui/icons';

/**
 * "¿Primera vez?" (SPEC §8.1) for whoever enters a room without the tutorial. It opens in a new
 * tab so the seat in the room isn't lost.
 */
export function TutorialChip() {
  const [hidden, setHidden] = useState(() => tutorialDone() || tutorialChipHidden());
  if (hidden) return null;
  return (
    <p className="flex flex-wrap items-center gap-1 self-start rounded-lg border border-accent/50 bg-accent/10 p-1 text-sm">
      {/* A real link: it opens the tutorial in a new tab, so the seat in the room stays. */}
      <a href="/tutorial" target="_blank" rel="noopener" className={buttonClass('primary', 'sm')}>
        <IconLens />
        {t.tutorial.chip}
      </a>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          hideTutorialChip();
          setHidden(true);
        }}
      >
        {t.tutorial.chipDismiss}
      </Button>
    </p>
  );
}
