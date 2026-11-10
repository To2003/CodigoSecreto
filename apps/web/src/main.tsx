import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './net/client';
import { socket } from './net/socket';
import { App } from './App';
import { bindConnection } from './store/connection';
import { initPrefs } from './store/prefs';
import '@fontsource-variable/inter';
import '@fontsource-variable/oswald';
import '@fontsource/special-elite';
import './index.css';

// Bound once at module load, outside React, so StrictMode's double effects can't double-bind.
initPrefs();
bindConnection(socket);
socket.connect();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
