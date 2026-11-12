import type { ComponentProps, ReactNode } from 'react';
import { navigate } from '../../lib/router';

/**
 * The one button of the app (ADR-035). Four variants, each with one job:
 * - `primary`: the main action of a screen (yellow, like the stamp ink).
 * - `secondary`: actions and navigation next to it (a folder on the desk: surface and a border).
 * - `ghost`: tertiary actions, text only, never underlined.
 * - `danger`: destructive actions (deleting the account).
 * Press feedback, hover, focus ring and reduced motion come from `.btn` in index.css, so a plain
 * `<a>` styled as a button feels the same as a `<button>`.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'compact' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};
/** `md`, `compact` and `lg` keep the 44 px touch target; `sm` is only for dense spots in a game. */
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
  /** 44 px tall like `md`, smaller text on phones: rows of buttons that must fit side by side. */
  compact: 'min-h-11 px-3 text-sm sm:px-4 sm:text-base',
  lg: 'min-h-14 px-6 text-lg',
};

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md') {
  return `btn ${VARIANTS[variant]} ${SIZES[size]}`;
}

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A decorative SVG before the label (see `icons.tsx`). */
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: Common & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/**
 * Navigation inside the app that looks like a button. It stays an `<a href>`: it goes somewhere,
 * so it can be opened in a new tab and screen readers call it a link.
 */
export function ButtonLink({
  to,
  variant,
  size,
  icon,
  children,
  className = '',
  ...rest
}: Common & { to: string } & Omit<ComponentProps<'a'>, 'children' | 'href'>) {
  return (
    <a
      href={to}
      className={`${buttonClass(variant, size)} ${className}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {icon}
      {children}
    </a>
  );
}
