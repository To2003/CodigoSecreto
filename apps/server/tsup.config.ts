import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  // Bundle the workspace package (shipped as TS source, ADR-009); keep npm deps external.
  noExternal: ['@clave/shared'],
  sourcemap: true,
  clean: true,
});
