/**
 * Vitest (UI-v2 S1) — unit tests for the PURE domain layer only (`src/domain`,
 * `src/lib` helpers): external behaviour of aggregates/undo/period math. UI is
 * verified visually against the spec etalons, not unit-tested (PRD #18).
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
