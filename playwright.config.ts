import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { defineConfig } from '@playwright/test'

function envFile(path: string): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(new URL(path, import.meta.url), 'utf8'))
  } catch {
    return {}
  }
}
const serverEnv = envFile('./server/.env')
const composeEnv = envFile('./.env')

const apiUrl = process.env.API_URL ?? `http://localhost:${serverEnv.PORT || 3000}`
const clientUrl = `http://localhost:${process.env.CLIENT_PORT ?? 5173}`
process.env.MAILPIT_URL ??= `http://localhost:${composeEnv.MAILPIT_UI_PORT || 8025}`

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: clientUrl, trace: 'retain-on-failure' },
  projects: [
    { name: 'first-account', testMatch: /admin\.spec\.ts/ },
    { name: 'app', testIgnore: /admin\.spec\.ts/, dependencies: ['first-account'] },
  ],
  webServer: [
    {
      command: 'pnpm --filter server dev',
      url: `${apiUrl}/health/ready`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter client dev',
      url: clientUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
})
