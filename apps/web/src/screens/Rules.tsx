import { RulesContent } from '../components/rules/RulesContent';
import { t } from '../i18n/es-AR';
import { navigate } from '../lib/router';

/** /reglas (SPEC §8.2). Loaded lazily. */
export default function Rules() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-stamp text-4xl">{t.rules.title}</h1>
        <button
          type="button"
          className="rounded-md border border-accent px-3 py-1.5 text-accent"
          onClick={() => {
            navigate('/');
          }}
        >
          {t.rules.back}
        </button>
      </header>
      <RulesContent />
    </main>
  );
}
