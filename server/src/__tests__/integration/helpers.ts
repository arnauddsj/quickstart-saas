// docs/testing.md
import { count, eq } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { buildApp } from '../../app.js'
import { db, pool } from '../../db/client.js'
import * as schema from '../../db/schema/index.js'
import { createCallerFactory } from '../../trpc/index.js'
import { appRouter } from '../../trpc/router/index.js'
import { lastMail } from './mailbox.js'

export const ORIGIN = 'http://localhost:5173'

export type App = Awaited<ReturnType<typeof buildApp>>

type UserRow = typeof schema.user.$inferSelect
type SessionRow = typeof schema.session.$inferSelect

let seq = 0
const uid = () => crypto.randomUUID()
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

export async function resetDatabase() {
  const { rows } = await pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  )
  if (rows.length === 0) return
  await pool.query(`truncate ${rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`)
}

export async function rowCount(table: PgTable, where?: SQL) {
  const [row] = await db.select({ value: count() }).from(table).where(where)
  return row?.value ?? 0
}

export async function seedUser(
  over: Partial<typeof schema.user.$inferInsert> = {},
): Promise<UserRow> {
  seq += 1
  const [row] = await db
    .insert(schema.user)
    .values({
      id: uid(),
      name: `User ${seq}`,
      email: `user${seq}-${uid().slice(0, 8)}@test.io`,
      emailVerified: true,
      role: 'member',
      ...over,
    })
    .returning()
  return row!
}

export async function seedOrg(over: Partial<typeof schema.organization.$inferInsert> = {}) {
  seq += 1
  const [row] = await db
    .insert(schema.organization)
    .values({
      id: uid(),
      name: `Org ${seq}`,
      slug: `org-${seq}-${uid().slice(0, 8)}`,
      createdAt: new Date(),
      ...over,
    })
    .returning()
  return row!
}

export async function addMember(organizationId: string, userId: string, role = 'member') {
  const [row] = await db
    .insert(schema.member)
    .values({ id: uid(), organizationId, userId, role, createdAt: new Date() })
    .returning()
  return row!
}

export async function seedSession(
  userId: string,
  over: Partial<typeof schema.session.$inferInsert> = {},
): Promise<SessionRow> {
  const [row] = await db
    .insert(schema.session)
    .values({
      id: uid(),
      userId,
      token: uid(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    })
    .returning()
  return row!
}

export async function seedInvitation(organizationId: string, email: string, inviterId: string) {
  const [row] = await db
    .insert(schema.invitation)
    .values({
      id: uid(),
      organizationId,
      email,
      inviterId,
      role: 'member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning()
  return row!
}

export function callerFor(user: UserRow | null, session: Partial<SessionRow> | null = null) {
  return createCallerFactory(appRouter)({
    req: {} as never,
    res: {} as never,
    user: user as never,
    session: (session ?? (user ? { id: uid(), activeOrganizationId: null } : null)) as never,
  })
}

let ip = 0
const nextIp = () => {
  ip = (ip % 250) + 1
  return `198.51.100.${ip}`
}

function cookieHeader(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return list
    .map((c) => c.split(';')[0]!)
    .filter((c) => !c.endsWith('='))
    .join('; ')
}

export function pathOf(link: string) {
  const url = new URL(link)
  return url.pathname + url.search
}

export async function requestMagicLink(app: App, email: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/magic-link',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
    payload: { email, callbackURL: '/auth/callback' },
  })
}

export async function followLink(app: App, link: string, cookie?: string) {
  return app.inject({ method: 'GET', url: pathOf(link), headers: cookie ? { cookie } : {} })
}

export async function signIn(app: App, email: string): Promise<string> {
  const res = await requestMagicLink(app, email)
  if (res.statusCode !== 200)
    throw new Error(`magic link request failed: ${res.statusCode} ${res.body}`)
  const verify = await followLink(app, lastMail(email, 'magicLink').url)
  const cookie = cookieHeader(verify.headers['set-cookie'])
  if (!cookie.includes('better-auth.session_token=')) {
    throw new Error(
      `no session cookie after verify: ${verify.statusCode} ${verify.headers.location}`,
    )
  }
  return cookie
}

export { cookieHeader }

export async function authPost(app: App, path: string, cookie: string, payload: unknown) {
  return app.inject({
    method: 'POST',
    url: `/api/auth${path}`,
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      cookie,
      'x-forwarded-for': nextIp(),
    },
    payload: payload as object,
  })
}

export async function trpcQuery<T = unknown>(app: App, path: string, cookie?: string) {
  const res = await app.inject({
    method: 'GET',
    url: `/trpc/${path}`,
    headers: cookie ? { cookie } : {},
  })
  const body = res.json() as { result?: { data: T }; error?: { data: { code: string } } }
  return { status: res.statusCode, data: body.result?.data, code: body.error?.data.code }
}

export async function trpcMutation<T = unknown>(
  app: App,
  path: string,
  cookie: string,
  input: unknown,
) {
  const res = await app.inject({
    method: 'POST',
    url: `/trpc/${path}`,
    headers: { origin: ORIGIN, 'content-type': 'application/json', cookie },
    payload: input as object,
  })
  const body = res.json() as { result?: { data: T }; error?: { data: { code: string } } }
  return { status: res.statusCode, data: body.result?.data, code: body.error?.data.code }
}

export async function userByEmail(email: string) {
  return db.query.user.findFirst({ where: eq(schema.user.email, email) })
}

export { daysAgo, schema, db }
