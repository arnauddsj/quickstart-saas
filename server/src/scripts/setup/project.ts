// docs/new-project.md
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect, createServer } from 'node:net'
import { join } from 'node:path'

export type ProjectAnswers = {
  name: string
  supportEmail: string
  accentColor: string
  workspaceOne: string
  workspaceMany: string
  teams: boolean
}

export type Ports = { api: number; client: number; postgres: number; smtp: number; mailUi: number }

export const DEFAULT_PORTS: Ports = {
  api: 3000,
  client: 5173,
  postgres: 5432,
  smtp: 1025,
  mailUi: 8025,
}

export const STARTER_REPOSITORY = 'https://github.com/arnauddsj/quickstart-saas.git'

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export function renderBrand(a: ProjectAnswers): string {
  return `// docs/branding.md
export const brand = {
  name: ${quote(a.name)},
  supportEmail: ${quote(a.supportEmail)},
  accentColor: ${quote(a.accentColor)},
  workspace: { one: ${quote(a.workspaceOne)}, many: ${quote(a.workspaceMany)} },
  teams: ${a.teams},
} as const

export type Brand = typeof brand
`
}

export function databaseName(slug: string): string {
  return slug.replace(/-/g, '_') || 'app'
}

export function renderRootEnv(slug: string, ports: Ports): string {
  return `# Written by pnpm init-project. Read by Docker Compose, Vite and Playwright; see docs/development.md.
COMPOSE_PROJECT_NAME=${slug}
POSTGRES_DB=${databaseName(slug)}
POSTGRES_PORT=${ports.postgres}
MAILPIT_SMTP_PORT=${ports.smtp}
MAILPIT_UI_PORT=${ports.mailUi}
CLIENT_PORT=${ports.client}
`
}

function setLine(source: string, key: string, value: string): string {
  const line = new RegExp(`^${key}=.*$`, 'm')
  if (!line.test(source)) throw new Error(`${key} is missing from server/.env.example`)
  return source.replace(line, `${key}=${value}`)
}

export function renderServerEnv(example: string, slug: string, ports: Ports, secret: string) {
  const origin = `http://localhost:${ports.client}`
  const values: Record<string, string> = {
    PORT: String(ports.api),
    DATABASE_URL: `postgresql://admin:quickstart@localhost:${ports.postgres}/${databaseName(slug)}`,
    PUBLIC_URL: origin,
    CORS_ORIGINS: origin,
    AUTH_SECRET: secret,
    SMTP_PORT: String(ports.smtp),
  }
  return Object.entries(values).reduce((env, [key, value]) => setLine(env, key, value), example)
}

export function starterVersion(changelog: string): string {
  const match = /^## \[(\d+\.\d+\.\d+)\]/m.exec(changelog)
  if (!match?.[1]) throw new Error('CHANGELOG.md has no released version heading')
  return match[1]
}

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, () => server.close(() => resolve(true)))
  })
}

function answers(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host })
    const done = (open: boolean) => {
      socket.destroy()
      resolve(open)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.setTimeout(500, () => done(false))
  })
}

export async function isPortFree(port: number): Promise<boolean> {
  if (!(await canListen(port))) return false
  const [ipv4, ipv6] = await Promise.all([answers(port, '127.0.0.1'), answers(port, '::1')])
  return !ipv4 && !ipv6
}

export async function freePorts(
  isFree: (port: number) => Promise<boolean> = isPortFree,
): Promise<Ports> {
  const taken = new Set<number>()
  const pick = async (start: number) => {
    let port = start
    while (taken.has(port) || !(await isFree(port))) port += 1
    taken.add(port)
    return port
  }
  return {
    api: await pick(DEFAULT_PORTS.api),
    client: await pick(DEFAULT_PORTS.client),
    postgres: await pick(DEFAULT_PORTS.postgres),
    smtp: await pick(DEFAULT_PORTS.smtp),
    mailUi: await pick(DEFAULT_PORTS.mailUi),
  }
}

export type InitResult = { slug: string; ports: Ports; written: string[] }

export function initProject(
  root: string,
  answers: ProjectAnswers,
  options: { ports: Ports; commit: string; force?: boolean; secret?: string },
): InitResult {
  const slug = slugify(answers.name)
  if (!slug) throw new Error('The product name needs at least one letter or digit')
  const targets = {
    brand: join(root, 'server/src/config/brand.ts'),
    rootEnv: join(root, '.env'),
    serverEnv: join(root, 'server/.env'),
    starter: join(root, '.starter.json'),
  }
  const existing = [targets.rootEnv, targets.serverEnv, targets.starter].filter((p) =>
    existsSync(p),
  )
  if (existing.length > 0 && !options.force) {
    throw new Error(`Already initialized (${existing.join(', ')}); pass --force to overwrite`)
  }
  const secret = options.secret ?? randomBytes(32).toString('hex')
  const example = readFileSync(join(root, 'server/.env.example'), 'utf8')
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')

  writeFileSync(targets.brand, renderBrand(answers))
  writeFileSync(targets.rootEnv, renderRootEnv(slug, options.ports))
  writeFileSync(targets.serverEnv, renderServerEnv(example, slug, options.ports, secret))
  writeFileSync(
    targets.starter,
    `${JSON.stringify(
      {
        repository: STARTER_REPOSITORY,
        version: starterVersion(changelog),
        commit: options.commit,
      },
      null,
      2,
    )}\n`,
  )
  return { slug, ports: options.ports, written: Object.values(targets) }
}
