import type { AvatarColor } from '@clave/shared';

type Hat = 'fedora' | 'beret' | 'bowler' | 'cap' | 'hair' | 'bun';
interface Look {
  skin: string;
  hat: Hat;
  mustache?: boolean;
  glasses?: boolean;
  beard?: boolean;
  scarf?: boolean;
}

/**
 * The 12 original agents (SPEC §5.5): varied skin tones, hats and details. The accessory color
 * (hat band, beret, cap or scarf) is the player's pick, so two people can share a face.
 */
const LOOKS: readonly Look[] = [
  { skin: '#f1c9a5', hat: 'fedora', mustache: true },
  { skin: '#9c6644', hat: 'beret', glasses: true },
  { skin: '#e0ac83', hat: 'bowler', beard: true },
  { skin: '#6f4a32', hat: 'cap', scarf: true },
  { skin: '#c68863', hat: 'bun', glasses: true },
  { skin: '#f6d7c3', hat: 'hair', mustache: true, scarf: true },
  { skin: '#6f4a32', hat: 'fedora', glasses: true },
  { skin: '#e0ac83', hat: 'beret', scarf: true },
  { skin: '#9c6644', hat: 'bowler', mustache: true },
  { skin: '#f1c9a5', hat: 'cap', beard: true },
  { skin: '#c68863', hat: 'hair', glasses: true, beard: true },
  { skin: '#f6d7c3', hat: 'bun', scarf: true },
];

const DARK = '#2a2b2f';

function HatShape({ hat, accent }: { hat: Hat; accent: string }) {
  switch (hat) {
    case 'fedora':
      return (
        <g>
          <ellipse cx="32" cy="22" rx="19" ry="4" fill={DARK} />
          <path d="M20 22 Q21 9 32 9 Q43 9 44 22 Z" fill={DARK} />
          <rect x="20.5" y="17.5" width="23" height="3.5" fill={accent} />
        </g>
      );
    case 'beret':
      return (
        <g>
          <ellipse cx="30" cy="18" rx="15" ry="6.5" fill={accent} transform="rotate(-12 30 18)" />
          <circle cx="24" cy="12.5" r="1.6" fill={accent} />
        </g>
      );
    case 'bowler':
      return (
        <g>
          <ellipse cx="32" cy="21.5" rx="16" ry="3.2" fill={DARK} />
          <path d="M21 21.5 Q21 8 32 8 Q43 8 43 21.5 Z" fill={DARK} />
          <rect x="21.3" y="17.6" width="21.4" height="3" fill={accent} />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M20 23 Q20 10 32 10 Q44 10 44 23 Z" fill={accent} />
          <path d="M42 22 Q52 22 53 25 L41 25 Z" fill={accent} />
          <circle cx="32" cy="10.5" r="1.4" fill={DARK} />
        </g>
      );
    case 'hair':
      return (
        <path d="M19.5 28 Q18 13 32 13 Q46 13 44.5 28 Q42 19 32 19 Q22 19 19.5 28 Z" fill={DARK} />
      );
    case 'bun':
      return (
        <g>
          <circle cx="32" cy="11" r="5" fill={DARK} />
          <path
            d="M19.5 29 Q18 14 32 14 Q46 14 44.5 29 Q42 20 32 20 Q22 20 19.5 29 Z"
            fill={DARK}
          />
          <rect x="28" y="14.5" width="8" height="2.2" rx="1" fill={accent} />
        </g>
      );
  }
}

export function Avatar({
  avatar,
  color,
  size = 32,
  dimmed = false,
}: {
  avatar: number;
  color: AvatarColor;
  size?: number;
  dimmed?: boolean;
}) {
  // avatar is validated to 0–11 by the schema; the modulo keeps any index in range.
  const look = LOOKS[avatar % LOOKS.length] as Look;
  const accent = `var(--acc-${color})`;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 ${dimmed ? 'opacity-40 grayscale' : ''}`}
    >
      <circle cx="32" cy="32" r="32" fill="#353a44" />
      {/* Trench coat with lapels */}
      <path d="M8 64 Q10 44 32 43 Q54 44 56 64 Z" fill="#8a7a5c" />
      <path d="M26 44 L32 56 L38 44 L35 43 L32 49 L29 43 Z" fill="#6c5f46" />
      {look.scarf && <path d="M22 43 Q32 50 42 43 L42 47 Q32 54 22 47 Z" fill={accent} />}
      <rect x="28" y="36" width="8" height="8" fill={look.skin} />
      <circle cx="32" cy="29" r="11" fill={look.skin} />
      {look.beard && (
        <path d="M22 31 Q23 42 32 42 Q41 42 42 31 Q38 37 32 37 Q26 37 22 31 Z" fill={DARK} />
      )}
      <circle cx="28" cy="28.5" r="1.4" fill={DARK} />
      <circle cx="36" cy="28.5" r="1.4" fill={DARK} />
      {look.glasses && (
        <g fill="none" stroke={DARK} strokeWidth="1.4">
          <circle cx="28" cy="28.5" r="3.4" />
          <circle cx="36" cy="28.5" r="3.4" />
          <path d="M31.4 28.5 H32.6" />
        </g>
      )}
      {look.mustache && (
        <path
          d="M26.5 34 Q32 31 37.5 34 Q32 33.2 26.5 34 Z"
          fill={DARK}
          stroke={DARK}
          strokeWidth="1.2"
        />
      )}
      <HatShape hat={look.hat} accent={accent} />
    </svg>
  );
}
