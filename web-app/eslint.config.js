import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Underscore-prefixed identifiers are intentionally unused —
      // standard convention for "I have to declare this but won't use it"
      // (test mock signatures, partial destructuring, etc.).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // ADR-013 / DDD-05 §Anti-corruption layer — marketing surface isolation.
  // Marketing files must NOT import from the product DDD stack.
  {
    files: [
      'src/components/marketing/**',
      'src/pages/MarketingLanding.tsx',
      'src/pages/MarketingRoot.tsx',
      'src/data/marketing-copy.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/services/wsClient*'],      message: 'Marketing surface must not import wsClient (ADR-013 / DDD-05).' },
            { group: ['**/services/sessionStore*'],  message: 'Marketing surface must not import sessionStore (ADR-013 / DDD-05).' },
            { group: ['**/services/cloudSync*'],     message: 'Marketing surface must not import cloudSync (ADR-013 / DDD-05).' },
            { group: ['**/workers/**'],              message: 'Marketing surface must not import workers (ADR-013 / DDD-05).' },
            { group: ['**/types/vitals*'],           message: 'Marketing surface must not import vitals types (ADR-013 / DDD-05).' },
            { group: ['**/types/state*'],            message: 'Marketing surface must not import state types (ADR-013 / DDD-05).' },
            { group: ['**/types/intervention*'],     message: 'Marketing surface must not import intervention types (ADR-013 / DDD-05).' },
            { group: ['**/components/dashboard/**'], message: 'Marketing surface must not import dashboard components (ADR-013 / DDD-05).' },
          ],
        },
      ],
    },
  },

  // ADR-013 / DDD-05 §Anti-corruption layer — dashboard surface isolation.
  // Dashboard files must NOT import from the marketing surface.
  {
    files: [
      'src/pages/Dashboard.tsx',
      'src/components/dashboard/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/styles/marketing-tokens*'], message: 'Dashboard surface must not import marketing tokens (ADR-013 / DDD-05).' },
            { group: ['**/components/marketing/**'],  message: 'Dashboard surface must not import marketing components (ADR-013 / DDD-05).' },
            { group: ['**/data/marketing-copy*'],     message: 'Dashboard surface must not import marketing copy (ADR-013 / DDD-05).' },
          ],
        },
      ],
    },
  },
])
