import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['server/**/*.mjs', 'netlify/functions/**/*.mjs', 'herramientas/pedidos/**/*.mjs', 'herramientas/netlify/**/*.mjs', 'herramientas/gestor-local/**/*.mjs', 'tests/eliminar-producto.test.mjs', 'tests/posicion-lista-gestor.test.mjs', 'tests/pedidos-concurrencia.test.mjs', 'tests/pedidos-backend.test.mjs', 'tests/pedidos-checkout.test.mjs', 'tests/pedidos-dev.test.mjs', 'tests/build-env.test.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
