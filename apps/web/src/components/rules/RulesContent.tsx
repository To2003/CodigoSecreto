import type { CardType } from '@clave/shared';
import { CardArt } from '../../art/CardArt';
import { t } from '../../i18n/es-AR';
import { REVEALED_BG } from '../game/Board';

const CARD_TYPES: readonly CardType[] = ['red', 'blue', 'civilian', 'traitor'];

/**
 * The rules (SPEC §8.2): collapsible sections and a mini illustration of each card. Shared by the
 * /reglas page and the in-game modal; loaded lazily in both.
 */
export function RulesContent({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="rules-cards">
        <Heading id="rules-cards" className="mb-2 font-stamp text-xl">
          {t.rules.cardsTitle}
        </Heading>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CARD_TYPES.map((type) => (
            <li key={type} className="flex flex-col gap-1.5 text-sm">
              <span
                aria-hidden="true"
                className={`relative block aspect-[3/2] overflow-hidden rounded-[10px] ${REVEALED_BG[type]}`}
              >
                <CardArt type={type} id={`rules-${type}`} />
              </span>
              {t.rules.cards[type]}
            </li>
          ))}
        </ul>
      </section>
      {t.rules.sections.map((section, i) => (
        <details
          key={section.id}
          id={`reglas-${section.id}`}
          open={i === 0}
          className="rounded-lg bg-surface px-4 py-3"
        >
          <summary className="cursor-pointer font-semibold">
            <Heading className="inline text-lg">{section.title}</Heading>
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-paper/90">
            {section.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
