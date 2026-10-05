// docs/testing.md
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.int.spec.ts', '**/node_modules/**'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      AUTH_SECRET: 'test_secret_that_is_long_enough_for_zod_32',
      LOG_LEVEL: 'silent',
    },
  },
})
