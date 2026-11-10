import type { CardType } from '@clave/shared';
import { t } from '../i18n/es-AR';

/**
 * Card backs, drawn in code (SPEC §5.4): flat 70s silhouettes on the type color.
 * The variant comes from the card id, so the same card always shows the same figure.
 */
const INK = '#1c1b19';

export function variantOf(id: string, count: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % count;
}

/** Fedora and trench coat; four poses so a team's cards don't all look alike. */
function Agent({ variant }: { variant: number }) {
  return (
    <g fill={INK}>
      {/* hat */}
      <ellipse cx="50" cy="19" rx="13" ry="2.6" />
      <path d="M42 19 Q42 9 50 9 Q58 9 58 19 Z" />
      {/* head + coat */}
      <circle cx="50" cy="24" r="6" />
      <path d="M36 66 L39 36 Q50 29 61 36 L64 66 Z" />
      <path d="M50 33 L46 46 L50 44 L54 46 Z" fill="#00000033" />
      {variant === 1 && <rect x="61" y="48" width="12" height="9" rx="1.5" />}
      {variant === 2 && (
        <g>
          <rect
            x="28"
            y="38"
            width="16"
            height="12"
            rx="1"
            fill="#efe6d2"
            transform="rotate(-8 36 44)"
          />
          <path
            d="M30 42 H42 M30 45 H40"
            stroke={INK}
            strokeWidth="1"
            transform="rotate(-8 36 44)"
          />
        </g>
      )}
      {variant === 3 && (
        <g>
          <circle cx="70" cy="34" r="5" fill="none" stroke={INK} strokeWidth="2.4" />
          <path d="M66.5 37.5 L60 44" stroke={INK} strokeWidth="2.8" />
        </g>
      )}
    </g>
  );
}

/** Passers-by: with an umbrella, a newspaper, or a mate. */
function Civilian({ variant }: { variant: number }) {
  return (
    <g fill={INK} opacity="0.85">
      <circle cx="50" cy="22" r="6" />
      <path d="M38 66 L41 33 Q50 28 59 33 L62 66 Z" />
      {variant === 0 && (
        <g>
          <path d="M60 18 Q72 6 84 18 Z" />
          <path d="M72 18 V40 Q72 43 69 43" fill="none" stroke={INK} strokeWidth="1.8" />
        </g>
      )}
      {variant === 1 && (
        <g>
          <rect x="30" y="34" width="20" height="15" rx="1" fill="#efe6d2" />
          <path d="M33 38 H47 M33 41 H45 M33 44 H46" stroke={INK} strokeWidth="1" />
        </g>
      )}
      {variant === 2 && (
        <g>
          <path d="M62 40 Q62 50 68 50 Q74 50 74 40 Z" />
          <path d="M70 41 L76 31" stroke={INK} strokeWidth="1.6" />
        </g>
      )}
    </g>
  );
}

/** The traitor: black silhouette, gold glasses, and the stamp. */
function Traitor() {
  return (
    <g>
      <ellipse cx="50" cy="17" rx="14" ry="2.8" fill="#000" />
      <path d="M41 17 Q41 6 50 6 Q59 6 59 17 Z" fill="#000" />
      <circle cx="50" cy="23" r="6.5" fill="#000" />
      <path d="M34 66 L38 34 Q50 27 62 34 L66 66 Z" fill="#000" />
      <g fill="none" stroke="var(--accent)" strokeWidth="1.6">
        <circle cx="47" cy="23" r="2.4" />
        <circle cx="53.5" cy="23" r="2.4" />
      </g>
      <g transform="rotate(-14 50 46)">
        <rect
          x="24"
          y="38"
          width="52"
          height="15"
          rx="2"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <text
          x="50"
          y="49.5"
          textAnchor="middle"
          fontFamily="var(--font-stamp)"
          fontSize="11"
          fill="var(--accent)"
        >
          {t.game.traitorStamp}
        </text>
      </g>
    </g>
  );
}

export function CardArt({ type, id }: { type: CardType; id: string }) {
  return (
    <svg
      viewBox="0 0 100 66"
      className="absolute inset-0 size-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
      {type === 'traitor' ? (
        <Traitor />
      ) : type === 'civilian' ? (
        <Civilian variant={variantOf(id, 3)} />
      ) : (
        <Agent variant={variantOf(id, 4)} />
      )}
    </svg>
  );
}
