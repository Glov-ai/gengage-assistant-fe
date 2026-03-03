import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config([
  // Global ignores (replaces ignorePatterns)
  {
    ignores: ['dist/', 'node_modules/', 'examples/', '*.cjs', '*.js'],
  },

  // Base recommended rules
  ...tseslint.configs.recommended,

  // Prettier compat (disables formatting rules)
  eslintConfigPrettier,

  // Project-specific overrides
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
]);
