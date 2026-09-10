// @ts-check
const eslint = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const tseslint = require('typescript-eslint');

module.exports = defineConfig([
  globalIgnores(['apps/frontend/**', '**/dist/**', '**/node_modules/**']),
  {
    files: ['apps/backend/**/*.ts', 'packages/**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
  },
]);
