// docs/auth.md
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const serverEnv = loadEnv('development', new URL('../server', import.meta.url).pathname, '')
const apiUrl = process.env.API_URL ?? `http://localhost:${serverEnv.PORT || 3000}`
const port = Number(process.env.CLIENT_PORT ?? 5173)

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port,
    strictPort: true,
    proxy: {
      '/trpc': { target: apiUrl, changeOrigin: false },
      '/api/auth': { target: apiUrl, changeOrigin: false },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-vue', test: /node_modules\/(vue|vue-router|pinia|@vue)\// },
            { name: 'vendor-query', test: /node_modules\/@tanstack\// },
            { name: 'vendor-trpc', test: /node_modules\/@trpc\// },
            { name: 'vendor-reka', test: /node_modules\/reka-ui\// },
            {
              name: 'vendor-auth',
              test: /node_modules\/(better-auth|better-call|nanostores|@better-fetch)\//,
            },
            { name: 'vendor-misc', test: /node_modules\// },
          ],
        },
      },
    },
  },
})
