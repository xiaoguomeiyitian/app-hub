// ESLint Flat Configuration (v9+)
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': "warn",
      '@typescript-eslint/no-unused-vars': ["error", { "argsIgnorePattern": "^_" }],
      "no-console": ["warn", { "allow": ["warn", "error"] }],
    },
  },
];
