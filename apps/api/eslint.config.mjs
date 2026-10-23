// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],           // ← explicit, more stable than projectService
        // projectService: true,                // ← commented out – often causes type resolution issues in monorepos
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',

      // Downgraded to warn – prevents blocking lint/fix while you fix types
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      '@typescript-eslint/no-floating-promises': 'warn',

      // Keep Prettier as error
      "prettier/prettier": ["error", { endOfLine: "auto" }],

      // Optional: reduce noise from common early-stage issues
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);