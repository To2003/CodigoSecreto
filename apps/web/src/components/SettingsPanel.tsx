import {
  CLUE_TIMER_OPTIONS,
  DECKS,
  GUESS_TIMER_OPTIONS,
  MAX_TEAM_NAME_LENGTH,
  parseCustomWords,
  TEAMS,
  type RoomView,
  type SettingsPatch,
} from '@clave/shared';
import { useId, useState } from 'react';
import { t } from '../i18n/es-AR';
import { updateSettings } from '../net/client';

const fieldClass = 'rounded-md border border-paper/30 bg-bg px-2 py-1 text-paper';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
        className="size-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

/** Room settings (SPEC §1.7). Everyone sees them; only the host can change them (SPEC §3.1). */
export function SettingsPanel({
  view,
  editable,
  onError,
}: {
  view: RoomView;
  editable: boolean;
  onError: (message: string | null) => void;
}) {
  const s = view.settings;
  const id = useId();
  const [rejected, setRejected] = useState<string[]>([]);
  const savedWords = s.customWords.join(', ');

  const patch = (settings: SettingsPatch) => {
    onError(null);
    void updateSettings(settings).then((res) => {
      if (!res.ok) onError(t.errors[res.code]);
    });
  };

  return (
    // Collapsible: open for the host who edits it, folded for everyone else (long on phones).
    <details open={editable} className="group rounded-lg bg-surface p-4">
      <summary className="cursor-pointer text-lg font-semibold">
        <h2 className="inline">{t.settings.title}</h2>
      </summary>
      {!editable && <p className="mb-3 text-sm text-paper/70">{t.settings.readOnly}</p>}
      <fieldset
        disabled={!editable}
        className="grid gap-4 text-sm md:grid-cols-2 disabled:opacity-80"
      >
        <label className="flex flex-col gap-1">
          {t.settings.mode}
          <select
            value={s.mode}
            className={fieldClass}
            onChange={(e) => {
              patch({ mode: e.target.value === 'coop' ? 'coop' : 'classic' });
            }}
          >
            <option value="classic">{t.settings.modes.classic}</option>
            <option value="coop">{t.settings.modes.coop}</option>
          </select>
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1">{t.settings.decks}</legend>
          {DECKS.map((deck) => (
            <Toggle
              key={deck.id}
              label={`${deck.name} (${deck.words.length})`}
              checked={s.deckIds.includes(deck.id)}
              onChange={(on) => {
                patch({
                  deckIds: on ? [...s.deckIds, deck.id] : s.deckIds.filter((d) => d !== deck.id),
                });
              }}
            />
          ))}
        </fieldset>

        <label htmlFor={`${id}-custom`} className="flex flex-col gap-1 md:col-span-2">
          {t.settings.customWords}
          <textarea
            // Remount when the saved words change (another update), so the field shows them.
            key={savedWords}
            id={`${id}-custom`}
            rows={3}
            defaultValue={savedWords}
            aria-describedby={`${id}-custom-help`}
            className={fieldClass}
            onBlur={(e) => {
              const parsed = parseCustomWords(e.target.value);
              setRejected(parsed.rejected);
              patch({ customWords: parsed.words });
            }}
          />
          <span id={`${id}-custom-help`} className="text-paper/70">
            {t.settings.customWordsHelp} {t.settings.customWordsCount(s.customWords.length)}
          </span>
          {rejected.length > 0 && (
            <span className="text-red-soft">{t.settings.customWordsRejected(rejected)}</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          {t.settings.customShare}
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={s.customShare}
            onChange={(e) => {
              patch({ customShare: Number(e.target.value) });
            }}
          />
          <span className="text-paper/70">{`${s.customShare}%`}</span>
        </label>

        <label className="flex flex-col gap-1">
          {t.settings.clueTimer}
          <select
            value={s.clueTimer}
            className={fieldClass}
            onChange={(e) => {
              const value = CLUE_TIMER_OPTIONS.find((o) => o === Number(e.target.value));
              if (value !== undefined) patch({ clueTimer: value });
            }}
          >
            {CLUE_TIMER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === 0 ? t.settings.timerOff : t.settings.seconds(o)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          {t.settings.guessTimer}
          <select
            value={s.guessTimer}
            className={fieldClass}
            onChange={(e) => {
              const value = GUESS_TIMER_OPTIONS.find((o) => o === Number(e.target.value));
              if (value !== undefined) patch({ guessTimer: value });
            }}
          >
            {GUESS_TIMER_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === 0 ? t.settings.timerOff : t.settings.seconds(o)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          {t.settings.revealMode}
          <select
            value={s.revealMode}
            className={fieldClass}
            onChange={(e) => {
              patch({ revealMode: e.target.value === 'majority' ? 'majority' : 'any' });
            }}
          >
            <option value="any">{t.settings.revealModes.any}</option>
            <option value="majority">{t.settings.revealModes.majority}</option>
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <Toggle
            label={t.settings.firstTurnBonus}
            checked={s.firstTurnBonus}
            onChange={(v) => {
              patch({ firstTurnBonus: v });
            }}
          />
          <Toggle
            label={t.settings.objections}
            checked={s.objections}
            onChange={(v) => {
              patch({ objections: v });
            }}
          />
          <Toggle
            label={t.settings.spectatorsSeeMap}
            checked={s.spectatorsSeeMap}
            onChange={(v) => {
              patch({ spectatorsSeeMap: v });
            }}
          />
          <Toggle
            label={t.settings.compoundWords}
            checked={s.compoundWords}
            onChange={(v) => {
              patch({ compoundWords: v });
            }}
          />
          <Toggle
            label={t.settings.chat}
            checked={s.chat}
            onChange={(v) => {
              patch({ chat: v });
            }}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1">{t.settings.teamNames}</legend>
          {TEAMS.map((team) => (
            <input
              key={`${team}-${s.teamNames[team]}`}
              defaultValue={s.teamNames[team]}
              maxLength={MAX_TEAM_NAME_LENGTH}
              placeholder={t.lobby.teamName[team]}
              aria-label={t.lobby.teamName[team]}
              className={fieldClass}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== s.teamNames[team])
                  patch({ teamNames: { ...s.teamNames, [team]: value } });
              }}
            />
          ))}
        </fieldset>
      </fieldset>
    </details>
  );
}
