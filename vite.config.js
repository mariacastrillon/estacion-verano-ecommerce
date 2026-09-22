import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { verificarSupabaseEnBundle } from './herramientas/verificar-entorno-build.mjs'
import { pedidosDevPlugin } from './herramientas/pedidos/vite-plugin.mjs'
import { cspNetlifyBuild } from './herramientas/netlify/csp.mjs'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/gestor': {
        target: 'http://127.0.0.1:4174',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: {},
  },
  plugins: [
    react(),
    tailwindcss(),
    verificarSupabaseEnBundle(),
    pedidosDevPlugin(),
    cspNetlifyBuild(),
  ],
})
