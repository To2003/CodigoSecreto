import { useState } from 'react';
import { t } from '../i18n/es-AR';
import { markTipSeen, tipsSeen } from '../lib/storage';
import { usePrefs } from '../store/prefs';

/**
 * A first-time tip (SPEC §8.3): shown until dismissed once, never again on this browser. All of
 * them can be turned off in Ajustes.
 */
export function Tip({ id, text }: { id: string; text: string }) {
  const enabled = usePrefs((p) => p.tips);
  const [hidden, setHidden] = useState(() => tipsSeen().includes(id));
  if (!enabled || hidden) return null;
  return (
    <div
      role="note"
      data-testid={`tip-${id}`}
      className="flex items-start gap-3 rounded-md border border-accent/60 bg-accent/10 p-2 text-sm"
    >
      <p className="flex-1">{text}</p>
      <button
        type="button"
        className="shrink-0 rounded px-2 py-0.5 font-semibold text-accent underline"
        onClick={() => {
          markTipSeen(id);
          setHidden(true);
        }}
      >
        {t.tips.gotIt}
      </button>
    </div>
  );
}
