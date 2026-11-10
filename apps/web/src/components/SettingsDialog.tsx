import { useId, useRef } from 'react';
import { t } from '../i18n/es-AR';
import { setPrefs, usePrefs, type Prefs } from '../store/prefs';

const CARD_TEXT_SIZES: Prefs['cardText'][] = ['sm', 'md', 'lg'];
const VOLUME_CHANNELS: (keyof Prefs['volumes'])[] = ['master', 'music', 'effects'];

/** "Ajustes" (SPEC §3.1 #8) in a native <dialog>: focus trap and Esc come for free. */
export function SettingsButton({ className = 'px-3 py-1 text-sm' }: { className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const prefs = usePrefs();
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={`rounded-md border border-line hover:border-paper/50 ${className}`}
        onClick={() => ref.current?.showModal()}
      >
        {t.prefs.open}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-5 text-paper backdrop:bg-black/60"
      >
        <h2 id={`${id}-title`} className="mb-4 font-stamp text-2xl">
          {t.prefs.title}
        </h2>
        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={prefs.colorBlind}
              onChange={(e) => {
                setPrefs({ colorBlind: e.target.checked });
              }}
            />
            <span>
              {t.prefs.colorBlind}
              <span className="block text-sm text-paper/70">{t.prefs.colorBlindHelp}</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={prefs.reduceMotion}
              onChange={(e) => {
                setPrefs({ reduceMotion: e.target.checked });
              }}
            />
            <span>
              {t.prefs.reduceMotion}
              <span className="block text-sm text-paper/70">{t.prefs.reduceMotionHelp}</span>
            </span>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1">{t.prefs.cardText}</legend>
            <div className="flex gap-2">
              {CARD_TEXT_SIZES.map((size) => (
                <label key={size} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-text`}
                    className="peer sr-only"
                    checked={prefs.cardText === size}
                    onChange={() => {
                      setPrefs({ cardText: size });
                    }}
                  />
                  <span className="block rounded-md border border-line px-3 py-1 peer-checked:border-accent peer-checked:text-accent peer-focus-visible:outline-2">
                    {t.prefs.sizes[size]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1">{t.prefs.sound}</legend>
            {VOLUME_CHANNELS.map((channel) => (
              <label
                key={channel}
                className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm"
              >
                {t.prefs.volumes[channel]}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.volumes[channel]}
                  onChange={(e) => {
                    setPrefs({ volumes: { ...prefs.volumes, [channel]: Number(e.target.value) } });
                  }}
                />
                <span className="text-right text-paper/80">
                  {t.prefs.percent(prefs.volumes[channel])}
                </span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={prefs.vibration}
              onChange={(e) => {
                setPrefs({ vibration: e.target.checked });
              }}
            />
            <span>{t.prefs.vibration}</span>
          </label>
        </div>
        <form method="dialog" className="mt-5 text-right">
          <button type="submit" className="rounded-md bg-accent px-4 py-2 font-semibold text-ink">
            {t.prefs.close}
          </button>
        </form>
      </dialog>
    </>
  );
}
