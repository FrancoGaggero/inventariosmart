// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/mobile/**',
      'packages/api-client/src/generated/**',
      '**/*.config.js',
      '**/*.config.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // NestJS inyecta dependencias leyendo los tipos de los constructores (emitDecoratorMetadata):
    // esas clases deben importarse como valor, no con `import type`.
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    // Los módulos de negocio usan `prisma.tenant` (filtra por comercio y activa RLS).
    // `prisma.raw` queda reservado a auth/ (provisioning), al propio servicio y a los tests.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/auth/**', 'apps/api/src/prisma/**', 'apps/api/src/health/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name="raw"][object.property.name="prisma"]',
          message:
            'Usá prisma.tenant (filtra por comercio y respeta RLS). prisma.raw sólo se permite en auth/.',
        },
      ],
    },
  },
);
