import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:net'
import {
  freePorts,
  initProject,
  isPortFree,
  renderBrand,
  slugify,
} from '../scripts/setup/project.js'
import { checkProductionEnv, checkProject } from '../scripts/setup/readiness.js'

const repo = fileURLToPath(new URL('../../..', import.meta.url))
const ports = { api: 3100, client: 5180, postgres: 5440, smtp: 1030, mailUi: 8030 }
const answers = {
  name: "Élan d'Or",
  supportEmail: 'help@elan.io',
  accentColor: '#0f766e',
  workspaceOne: 'team',
  workspaceMany: 'teams',
  teams: false,
}

const STARTER_FILES = [
  'server/.env.example',
  'CHANGELOG.md',
  'CLAUDE.md',
  'README.md',
  'server/src/config/brand.ts',
  'server/src/config/plans.ts',
  'server/src/services/analytics.ts',
  'server/src/trpc/router/billing.ts',
  'server/src/trpc/router/project.ts',
  'client/src/data/legal.ts',
  'client/src/pages/legal/Terms.vue',
]

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'init-project-'))
  for (const file of STARTER_FILES) {
    mkdirSync(join(root, file, '..'), { recursive: true })
    cpSync(join(repo, file), join(root, file))
  }
})

const read = (path: string) => readFileSync(join(root, path), 'utf8')
const failing = () =>
  checkProject(root)
    .filter((c) => !c.ok)
    .map((c) => c.id)

describe('init-project', () => {
  it('slugifies accents and punctuation', () => {
    expect(slugify("Élan d'Or")).toBe('elan-d-or')
    expect(slugify('  ')).toBe('')
  })

  it('renders a brand file that escapes quotes and keeps the shape', () => {
    const source = renderBrand(answers)
    expect(source).toContain("name: 'Élan d\\'Or',")
    expect(source).toContain("workspace: { one: 'team', many: 'teams' },")
    expect(source).toContain('teams: false,')
  })

  it('writes the brand, both env files and the starter record', () => {
    initProject(root, answers, { ports, commit: 'abc123', secret: 's'.repeat(64) })

    expect(read('server/src/config/brand.ts')).toContain("supportEmail: 'help@elan.io'")
    expect(parseEnv(read('.env'))).toMatchObject({
      COMPOSE_PROJECT_NAME: 'elan-d-or',
      POSTGRES_DB: 'elan_d_or',
      POSTGRES_PORT: '5440',
      MAILPIT_UI_PORT: '8030',
      CLIENT_PORT: '5180',
    })
    expect(parseEnv(read('server/.env'))).toMatchObject({
      PORT: '3100',
      DATABASE_URL: 'postgresql://admin:quickstart@localhost:5440/elan_d_or',
      PUBLIC_URL: 'http://localhost:5180',
      CORS_ORIGINS: 'http://localhost:5180',
      AUTH_SECRET: 's'.repeat(64),
      SMTP_PORT: '1030',
      EMAIL_PROVIDER: 'smtp',
    })
    expect(JSON.parse(read('.starter.json'))).toMatchObject({ version: '2.3.0', commit: 'abc123' })
  })

  it('generates a different 64-character secret each time', () => {
    initProject(root, answers, { ports, commit: 'a' })
    const first = parseEnv(read('server/.env')).AUTH_SECRET
    initProject(root, answers, { ports, commit: 'a', force: true })
    const second = parseEnv(read('server/.env')).AUTH_SECRET
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(second).not.toBe(first)
  })

  it('refuses to overwrite an initialized project without --force', () => {
    writeFileSync(join(root, 'server/.env'), 'AUTH_SECRET=keep-me\n')
    expect(() => initProject(root, answers, { ports, commit: 'a' })).toThrow(/--force/)
    expect(read('server/.env')).toBe('AUTH_SECRET=keep-me\n')
    expect(existsSync(join(root, '.env'))).toBe(false)
  })

  it('sees a port taken by a loopback-only listener', async () => {
    const server = createServer().listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const { port } = server.address() as { port: number }
    try {
      expect(await isPortFree(port)).toBe(false)
    } finally {
      server.close()
    }
  })

  it('skips ports that are taken, and never hands the same port out twice', async () => {
    const taken = new Set([3000, 3001, 5432])
    const picked = await freePorts(async (p) => !taken.has(p))
    expect(picked).toEqual({ api: 3002, client: 5173, postgres: 5433, smtp: 1025, mailUi: 8025 })
  })
})

describe('check-ready', () => {
  it('flags every placeholder of a fresh clone', () => {
    expect(failing()).toEqual([
      'initialized',
      'brand.name',
      'brand.supportEmail',
      'claude.statement',
      'readme.title',
      'reference.projects',
      'analytics.activation',
      'plans.placeholders',
      'legal.entity',
      'legal.terms',
    ])
  })

  it('clears the brand and setup items once init-project ran', () => {
    initProject(root, answers, { ports, commit: 'a' })
    expect(failing()).not.toContain('initialized')
    expect(failing()).not.toContain('brand.name')
    expect(failing()).not.toContain('brand.supportEmail')
  })

  it('checks a production env file', () => {
    const good = [
      'PUBLIC_URL=https://app.elan.io',
      `AUTH_SECRET=${'x'.repeat(40)}`,
      'POSTGRES_PASSWORD=long-random',
      'EMAIL_PROVIDER=loops',
      'LOOPS_API_KEY=k',
      'LOOPS_TEMPLATE_IDS=magicLink=abc',
      'STRIPE_SECRET_KEY=sk_live_1',
      'STRIPE_WEBHOOK_SECRET=whsec_1',
      'STRIPE_PRICE_PRO_MONTHLY=price_1',
      'SENTRY_DSN=https://k@glitchtip.elan.io/1',
    ].join('\n')
    expect(checkProductionEnv(good, 'prod.env').filter((c) => !c.ok)).toEqual([])

    const bad = 'PUBLIC_URL=http://app.elan.io\nPOSTGRES_PASSWORD=quickstart\nSMTP_HOST=mailpit\n'
    expect(
      checkProductionEnv(bad, 'prod.env')
        .filter((c) => !c.ok)
        .map((c) => c.id),
    ).toEqual([
      'env.public_url',
      'env.auth_secret',
      'env.postgres_password',
      'env.email',
      'env.stripe',
      'env.sentry',
    ])
  })
})
