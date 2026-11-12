import { AVATAR_COLORS, AVATAR_COUNT, MAX_NICKNAME_LENGTH, type Profile } from '@clave/shared';
import { useId, useState } from 'react';
import { t } from '../i18n/es-AR';
import { loadProfile, saveProfile } from '../lib/storage';
import { Avatar } from './Avatar';
import { Button } from './ui/Button';

const DEFAULT_PROFILE: Profile = { nickname: '', avatar: 0, color: 'oro' };

/** Quick profile (SPEC §3.1): nickname, one of 12 avatars and an accessory color. Remembered. */
export function ProfileForm({
  submitLabel,
  busyLabel,
  onSubmit,
  submitIcon,
  children,
}: {
  submitLabel: string;
  busyLabel: string;
  submitIcon?: React.ReactNode;
  onSubmit: (profile: Profile) => Promise<void>;
  children?: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile() ?? DEFAULT_PROFILE);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const nicknameId = useId();

  const submit = async () => {
    const nickname = profile.nickname.trim();
    if (nickname === '') {
      setMissing(true);
      return;
    }
    const clean = { ...profile, nickname };
    saveProfile(clean);
    setBusy(true);
    try {
      await onSubmit(clean);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <h2 className="text-lg font-semibold">{t.profile.title}</h2>
      <label htmlFor={nicknameId} className="flex flex-col gap-1 text-sm">
        {t.profile.nickname}
        <input
          id={nicknameId}
          value={profile.nickname}
          maxLength={MAX_NICKNAME_LENGTH}
          autoComplete="nickname"
          placeholder={t.profile.nicknamePlaceholder}
          aria-invalid={missing}
          onChange={(e) => {
            setMissing(false);
            setProfile({ ...profile, nickname: e.target.value });
          }}
          className="rounded-md border border-paper/45 bg-bg px-3 py-2 text-base text-paper"
        />
        {missing && <span className="text-red-soft">{t.profile.nicknameMissing}</span>}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">{t.profile.avatar}</legend>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: AVATAR_COUNT }, (_, i) => (
            <label key={i} className="cursor-pointer">
              <input
                type="radio"
                name="avatar"
                className="peer sr-only"
                checked={profile.avatar === i}
                onChange={() => {
                  setProfile({ ...profile, avatar: i });
                }}
                aria-label={t.profile.avatarOption(i + 1)}
              />
              <span className="flex justify-center rounded-full p-0.5 ring-accent peer-checked:ring-2 peer-focus-visible:outline-2">
                <Avatar avatar={i} color={profile.color} size={36} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm">{t.profile.color}</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((color) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                className="peer sr-only"
                checked={profile.color === color}
                onChange={() => {
                  setProfile({ ...profile, color });
                }}
              />
              <span className="flex items-center gap-1 rounded-full border border-paper/45 px-2 py-1 text-sm peer-checked:border-accent peer-focus-visible:outline-2">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ background: `var(--acc-${color})` }}
                />
                {t.profile.colors[color]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {children}

      <Button type="submit" variant="primary" size="lg" disabled={busy} icon={submitIcon}>
        {busy ? busyLabel : submitLabel}
      </Button>
    </form>
  );
}
