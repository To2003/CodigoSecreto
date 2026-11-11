import { useEffect, useRef, useState } from 'react';
import { ProfileForm } from '../components/ProfileForm';
import { t } from '../i18n/es-AR';
import { navigate } from '../lib/router';
import { loadProfile, loadSeat } from '../lib/storage';
import { joinRoom } from '../net/client';
import { useRoom } from '../store/room';
import { useSoundCues } from '../audio/useSoundCues';
import type { RoomView } from '@clave/shared';
import { CoopGame } from './CoopGame';
import { Game } from './Game';
import { Lobby } from './Lobby';

/**
 * /sala/:code (SPEC §2.3). With a stored seat (F5, reconnect) it rejoins straight away;
 * otherwise it asks for the profile first.
 */
export function RoomScreen({ code }: { code: string }) {
  const view = useRoom((s) => (s.view?.code === code ? s.view : null));
  const exit = useRoom((s) => s.exit);
  const [error, setError] = useState<string | null>(null);
  const [autoJoining, setAutoJoining] = useState(
    () => loadSeat(code) !== null && loadProfile() !== null,
  );
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current || view) return;
    triedRef.current = true;
    const profile = loadProfile();
    if (!profile || !loadSeat(code)) return;
    void joinRoom(code, profile).then((res) => {
      setAutoJoining(false);
      if (!res.ok) setError(t.errors[res.code]);
    });
  }, [code, view]);

  if (view) return <InRoom view={view} />;

  if (exit === 'kicked' || exit === 'ROOM_NOT_FOUND') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert">{exit === 'kicked' ? t.room.kicked : t.errors.ROOM_NOT_FOUND}</p>
        <button
          type="button"
          className="rounded-md border border-accent px-4 py-2 text-accent"
          onClick={() => {
            useRoom.setState({ exit: null });
            navigate('/');
          }}
        >
          {t.room.backHome}
        </button>
      </main>
    );
  }

  if (autoJoining) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <p role="status">{t.room.joining(code)}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{t.room.joinTitle(code)}</h1>
      <ProfileForm
        submitLabel={t.landing.join}
        busyLabel={t.room.joining(code)}
        onSubmit={async (profile) => {
          setError(null);
          const res = await joinRoom(code, profile);
          if (!res.ok) setError(t.errors[res.code]);
        }}
      />
      {error && (
        <p role="alert" className="text-red-soft">
          {error}
        </p>
      )}
    </main>
  );
}

/** In a room: sounds and music run for both the lobby and the game. */
function InRoom({ view }: { view: RoomView }) {
  useSoundCues(view);
  if (view.coop) return <CoopGame view={view} coop={view.coop} />;
  return view.game ? <Game view={view} /> : <Lobby view={view} />;
}
