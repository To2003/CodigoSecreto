import type { AvatarColor } from '@clave/shared';

/** Placeholder until the SVG avatars of M4: a numbered badge in the accessory color. */
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
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink ${dimmed ? 'opacity-40 grayscale' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: `var(--acc-${color})`,
      }}
    >
      {avatar + 1}
    </span>
  );
}
