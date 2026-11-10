import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './net/client';
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
bindConnection(socket);
socket.connect();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
