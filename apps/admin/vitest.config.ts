import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Резолв алиаса @/* (тот же, что в tsconfig) для vitest. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
