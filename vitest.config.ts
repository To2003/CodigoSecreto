import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/*',
      { test: { name: 'scripts', include: ['scripts/**/*.test.ts'], environment: 'node' } },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['packages/*/**/*.ts', 'apps/*/src/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/*.config.ts',
        'packages/*/scripts/**',
      ],
      // CONSTRAINTS.md: the rule engine stays at ≥ 95% on every metric (SPEC §1.8).
      thresholds: {
        'packages/shared/engine/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
