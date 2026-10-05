// docs/testing.md
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from 'vitest/config'

function serverUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  try {
    const local = parseEnv(readFileSync(new URL('./.env', import.meta.url), 'utf8')).DATABASE_URL
    if (local) return local
  } catch {
    return 'postgresql://admin:quickstart@localhost:5432/quickstart'
  }
  return 'postgresql://admin:quickstart@localhost:5432/quickstart'
}

if (!process.env.QS_TEST_DATABASE_URL) {
  const url = new URL(serverUrl())
  url.pathname = `/quickstart_test_${Date.now()}`
  process.env.QS_TEST_DATABASE_URL = url.toString()
}

export default defineConfig({
  test: {
    include: ['src/**/*.int.spec.ts'],
    environment: 'node',
    globalSetup: ['src/__tests__/integration/globalSetup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.QS_TEST_DATABASE_URL,
      AUTH_SECRET: 'integration_secret_that_is_long_enough_32',
      PUBLIC_URL: 'http://localhost:5173',
      CORS_ORIGINS: 'http://localhost:5173',
      STRIPE_SECRET_KEY: 'sk_test_integration',
      STRIPE_WEBHOOK_SECRET: 'whsec_integration',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_test',
      LOG_LEVEL: 'silent',
    },
  },
})
