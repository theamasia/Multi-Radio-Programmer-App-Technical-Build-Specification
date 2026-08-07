module.exports = {
  root: true,
  env: { node: true, browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist', 'release', 'node_modules', '*.cjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    eqeqeq: ['error', 'always'],
  },
  overrides: [
    {
      // Enforce the process boundary: the renderer must never reach for Node,
      // serial, or database access directly. Everything goes through IPC.
      files: ['src/renderer/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [
            { name: 'serialport', message: 'Serial access is main-process only. Use window.radioApi via IPC.' },
            { name: 'better-sqlite3', message: 'Database access is main-process only. Use window.radioApi via IPC.' },
            { name: 'electron', message: 'Import from the preload bridge instead. Use window.radioApi.' },
            { name: 'node:fs', message: 'Filesystem access is main-process only. Use window.radioApi via IPC.' },
          ],
          patterns: [
            { group: ['../main/*', '**/src/main/*'], message: 'The renderer must not import main-process code. Share types via src/shared.' },
          ],
        }],
      },
    },
  ],
};
