import { ConnectionIndicator } from '../components/ConnectionIndicator';
import { t } from '../i18n/es-AR';

export function Landing() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-6xl font-bold tracking-widest text-paper uppercase">{t.app.name}</h1>
      <ConnectionIndicator />
    </main>
  );
}
