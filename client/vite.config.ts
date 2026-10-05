// docs/auth.md
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const serverEnv = loadEnv('development', new URL('../server', import.meta.url).pathname, '')
const rootEnv = loadEnv('development', new URL('..', import.meta.url).pathname, '')
const apiUrl = process.env.API_URL ?? `http://localhost:${serverEnv.PORT || 3000}`
const port = Number(process.env.CLIENT_PORT ?? (rootEnv.CLIENT_PORT || 5173))
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN

const uploadSourceMaps = sentryAuthToken
  ? [
      sentryVitePlugin({
        url: process.env.SENTRY_URL,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: sentryAuthToken,
        release: { name: process.env.VITE_SENTRY_RELEASE },
        sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
        telemetry: false,
      }),
    ]
  : []

export default defineConfig({
  plugins: [vue(), tailwindcss(), ...uploadSourceMaps],
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
    sourcemap: sentryAuthToken ? 'hidden' : false,
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
            { name: 'vendor-charts', test: /node_modules\/(chart\.js|vue-chartjs|@kurkle)\// },
            { name: 'vendor-misc', test: /node_modules\// },
          ],
        },
      },
    },
  },
})
