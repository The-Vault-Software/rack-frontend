import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/client']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Requirement `onboarding-wizard` #9: all HTTP calls must go through
      // the generated client in src/client/ (already excluded above via
      // globalIgnores), so any raw `fetch(...)` elsewhere fails lint instead
      // of silently landing in application code again.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            'Raw fetch() is forbidden outside src/client/. Use the generated API client (src/client/) instead.',
        },
      ],
    },
  },
])
