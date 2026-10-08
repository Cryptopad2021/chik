/**
 * Единый ESLint-конфиг monorepo (flat config, ESLint 9).
 * Приложения импортируют base() и добавляют свои фреймворк-плагины.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * @param {object} [opts]
 * @param {string[]} [opts.ignores] дополнительные glob-паттерны игнорирования
 * @returns {import('eslint').Linter.Config[]}
 */
export function base({ ignores = [] } = {}) {
  return tseslint.config(
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/coverage/**',
        ...ignores,
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
      },
    },
  );
}

/** Конфиг по умолчанию (для пакетов без своих правил). */
export default base();
