import { Component, type ReactNode } from 'react';
import { t } from '../i18n/es-AR';

/** SPEC §10: never a silently broken screen. A reload rejoins the room with the stored seat. */
function CrashScreen() {
  const inRoom = window.location.pathname.startsWith('/sala/');
  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h1 className="font-stamp text-4xl">{t.crash.title}</h1>
      <p className="max-w-sm text-paper/80">{t.crash.body}</p>
      <button
        type="button"
        className="rounded-md bg-accent px-5 py-2 font-semibold text-ink"
        onClick={() => {
          if (inRoom) window.location.reload();
          else window.location.assign('/');
        }}
      >
        {inRoom ? t.crash.back : t.crash.home}
      </button>
    </main>
  );
}

/** React still needs a class for error boundaries. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    // The console log is the "log en consola" half of SPEC §10's error handling.
    console.error('Clave: algo se rompió', error);
  }

  override render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}
