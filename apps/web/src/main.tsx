import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './net/client';
import { wakeServer } from './net/health';
import { sessionToken } from './net/auth';
import { socket } from './net/socket';
import { App } from './App';
import { audio } from './audio/engine';
import { bindConnection } from './store/connection';
import { initPrefs } from './store/prefs';
import '@fontsource-variable/inter';
import '@fontsource-variable/oswald';
import '@fontsource/special-elite';
import './index.css';

// Bound once at module load, outside React, so StrictMode's double effects can't double-bind.
initPrefs();

// Audio may only start after a user gesture (iOS Safari, Chrome): unlock on the first one.
const unlock = () => {
  audio.unlock();
};
window.addEventListener('pointerdown', unlock, { passive: true });
window.addEventListener('keydown', unlock);
// A soft click for every enabled button press (SPEC §6.2 ui_click).
document.addEventListener('click', (e) => {
  if (e.target instanceof Element && e.target.closest('button:not(:disabled)'))
    audio.play('ui_click');
});
// A finished entrance or effect is marked, so switching reduced motion on or off later can't
// replay it (changing an element's animation restarts it). See .anim-move[data-anim-done].
document.addEventListener('animationend', (e) => {
  if (e.target instanceof HTMLElement && e.target.classList.contains('anim-move'))
    e.target.dataset.animDone = '';
});
// Installable app (SPEC §12 M9.5). Only in production builds: in dev it would cache Vite's files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      console.warn('Clave: no se pudo registrar el service worker', err);
    });
  });
}
bindConnection(socket);
// Signed in? Each (re)connection carries the current session token; guests send nothing
// and never load the accounts code (docs/specs/M9-cuentas.md §2).
socket.auth = (cb) => {
  void sessionToken().then((token) => {
    cb(token ? { token } : {});
  });
};
// Wake a sleeping server as early as possible (SPEC §0.4), alongside the socket.
wakeServer();
socket.connect();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
