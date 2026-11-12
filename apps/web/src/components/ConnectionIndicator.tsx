import { t } from '../i18n/es-AR';
import { useConnection, type ConnectionStatus } from '../store/connection';
import { Button } from './ui/Button';

const DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-accent',
  connected: 'bg-blue',
  reconnecting: 'bg-red',
  disconnected: 'bg-red',
  refused: 'bg-red',
};

/** `compact`: on small screens only the dot shows; the text stays for screen readers. */
export function ConnectionIndicator({ compact = false }: { compact?: boolean }) {
  const status = useConnection((s) => s.status);
  const retry = useConnection((s) => s.retry);
  return (
    <p
      role="status"
      aria-live="polite"
      data-status={status}
      className="inline-flex items-center gap-2 text-sm text-paper"
    >
      <span aria-hidden="true" className={`size-2.5 rounded-full ${DOT[status]}`} />
      {/* Compact hides only the reassuring "Conectado": problems always show in words (SPEC §5.6). */}
      <span className={compact && status === 'connected' ? 'sr-only sm:not-sr-only' : ''}>
        {t.connection[status]}
      </span>
      {status === 'refused' && (
        <Button variant="secondary" size="sm" onClick={retry}>
          {t.connection.retry}
        </Button>
      )}
    </p>
  );
}
