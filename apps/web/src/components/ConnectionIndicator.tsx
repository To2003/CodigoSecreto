import { t } from '../i18n/es-AR';
import { useConnection, type ConnectionStatus } from '../store/connection';

const DOT: Record<ConnectionStatus, string> = {
  connecting: 'bg-accent',
  connected: 'bg-blue',
  reconnecting: 'bg-red',
  disconnected: 'bg-red',
};

export function ConnectionIndicator() {
  const status = useConnection((s) => s.status);
  return (
    <p
      role="status"
      aria-live="polite"
      data-status={status}
      className="inline-flex items-center gap-2 text-sm text-paper"
    >
      <span aria-hidden="true" className={`size-2.5 rounded-full ${DOT[status]}`} />
      {t.connection[status]}
    </p>
  );
}
