import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * NestJS-тесты требуют emitDecoratorMetadata (DI через Reflect design:paramtypes),
 * которого нет в стандартном esbuild-транзите vitest — подключаем SWC.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2021',
      },
    }),
  ],
  test: {
    globals: true, // describe/it/expect без импорта (используется в slug.spec.ts)
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
