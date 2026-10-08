import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // describe/it/expect без импорта (используется в slug.spec.ts)
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
