import { LazyMotion, MotionConfig } from 'motion/react';
import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WakeScreen } from './components/WakeScreen';
import { t } from './i18n/es-AR';
import { wakeServer } from './net/health';
import { navigate, useRoute } from './lib/router';
import { Landing } from './screens/Landing';
import { RoomScreen } from './screens/RoomScreen';
import { useReducedMotion } from './store/prefs';

// Rules and tutorial are their own chunks (SPEC §10: lazy load).
const Rules = lazy(() => import('./screens/Rules'));
const Tutorial = lazy(() => import('./screens/Tutorial'));
const Table = lazy(() => import('./screens/Table'));

// Motion's features stay out of the initial bundle: the lobby rows animate once they arrive.
const loadMotionFeatures = () => import('./animations/motionFeatures').then((m) => m.default);

export function App() {
  const reduced = useReducedMotion();
  return (
    // Motion follows the same reduced-motion rule as the CSS animations (system or "Ajustes").
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <LazyMotion features={loadMotionFeatures} strict>
        <ErrorBoundary>
          <Screen />
        </ErrorBoundary>
      </LazyMotion>
    </MotionConfig>
  );
}

function Screen() {
  const route = useRoute();
  switch (route.name) {
    case 'home':
      return (
        <>
          <Landing />
          <WakeScreen onRetry={wakeServer} />
        </>
      );
    case 'room':
      return (
        <>
          <RoomScreen key={route.code} code={route.code} />
          <WakeScreen onRetry={wakeServer} />
        </>
      );
    case 'table':
      return (
        <>
          <Suspense fallback={null}>
            <Table key={route.code} code={route.code} />
          </Suspense>
          <WakeScreen onRetry={wakeServer} />
        </>
      );
    case 'rules':
      return (
        <Suspense fallback={null}>
          <Rules />
        </Suspense>
      );
    case 'tutorial':
      return (
        <Suspense fallback={null}>
          <Tutorial />
        </Suspense>
      );
    case 'notFound':
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
          <p>{t.room.notFoundPage}</p>
          <button
            type="button"
            className="rounded-md border border-accent px-4 py-2 text-accent"
            onClick={() => {
              navigate('/');
            }}
          >
            {t.room.backHome}
          </button>
        </main>
      );
  }
}
