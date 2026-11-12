/**
 * Hand-drawn icon set (original, ADR-035): 24 px grid, 1.75 stroke, round caps, `currentColor`.
 * Always decorative: the button next to it carries the label.
 */
import type { ReactNode } from 'react';

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

/** Arrow pointing left: going back. */
export const IconBack = () => (
  <Icon>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </Icon>
);

/** Magnifying glass: the tutorial (learning to investigate). */
export const IconLens = () => (
  <Icon>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5.5 5.5" />
    <path d="M8 9a3 3 0 0 1 2.5-1.5" />
  </Icon>
);

/** An open rulebook. */
export const IconBook = () => (
  <Icon>
    <path d="M12 6.5C10.3 5 7.8 4.5 4 4.5v13c3.8 0 6.3.5 8 2" />
    <path d="M12 6.5c1.7-1.5 4.2-2 8-2v13c-3.8 0-6.3.5-8 2" />
    <path d="M12 6.5v13" />
  </Icon>
);

/** A podium: the ranking. */
export const IconPodium = () => (
  <Icon>
    <path d="M9 20V9h6v11" />
    <path d="M3 20v-6h6" />
    <path d="M15 20v-8h6v8" />
    <path d="M2 20h20" />
    <path d="m12 3 .9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
  </Icon>
);

/** A person: the account. */
export const IconPerson = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Icon>
);

/** A door: signing out. */
export const IconDoor = () => (
  <Icon>
    <path d="M14 4H6v16h8" />
    <path d="M14 4l4 1.5v13L14 20z" />
    <path d="M11.5 12h.01" />
  </Icon>
);

/** A shield: privacy. */
export const IconShield = () => (
  <Icon>
    <path d="M12 3 5 6v5.5c0 4.2 3 7.6 7 9.5 4-1.9 7-5.3 7-9.5V6z" />
  </Icon>
);

/** A plus: a new room. */
export const IconPlus = () => (
  <Icon>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
);

/** A key: joining with a code. */
export const IconKey = () => (
  <Icon>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 9-9" />
    <path d="m17 6 3 3" />
    <path d="m14.5 8.5 2 2" />
  </Icon>
);

/** A bin: deleting. */
export const IconBin = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M10 11v5" />
    <path d="M14 11v5" />
  </Icon>
);
