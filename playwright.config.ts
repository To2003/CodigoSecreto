import { defineConfig } from '@playwright/test';

const CI = Boolean(process.env.CI);

/** E2E (SPEC §10.1): real server + the built web app, several browser contexts as different players. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: 'pnpm --filter @clave/server dev',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !CI,
      // Every test player comes from 127.0.0.1 and the suite creates dozens of rooms a minute.
      // Accounts in memory (test sign-in) and every game counting, for the accounts E2E.
      env: {
        CLIENT_ORIGIN: 'http://localhost:5173',
        LOG_LEVEL: 'warn',
        ROOMS_PER_MINUTE: '1000',
        AUTH_MODE: 'memory',
        STATS_MIN_GAME_SECONDS: '0',
      },
    },
    {
      // The production build, as it ships (ADR-026): dev React re-renders twice and adds checks,
      // so frame budgets and timings measured on it say nothing about what players get.
      command:
        'pnpm --filter @clave/web build && pnpm --filter @clave/web preview --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: { VITE_SERVER_URL: 'http://localhost:3001', VITE_AUTH_MODE: 'memory' },
    },
  ],
});
