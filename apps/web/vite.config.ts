import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  // A production bundle without the server URL would silently point at localhost. Fail the build,
  // not the page (SPEC §13: never a blank screen).
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_SERVER_URL?.trim()) {
    throw new Error('VITE_SERVER_URL is required to build the web app (see apps/web/.env.example)');
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true },
  };
});
