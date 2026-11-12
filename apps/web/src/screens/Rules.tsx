import { PageShell } from '../components/PageShell';
import { RulesContent } from '../components/rules/RulesContent';
import { t } from '../i18n/es-AR';

/** /reglas (SPEC §8.2). Loaded lazily. */
export default function Rules() {
  return (
    <PageShell title={t.rules.title} width="max-w-3xl">
      <RulesContent />
    </PageShell>
  );
}
