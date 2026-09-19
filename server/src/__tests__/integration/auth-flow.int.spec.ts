import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authPost,
  cookieHeader,
  db,
  followLink,
  requestMagicLink,
  resetDatabase,
  rowCount,
  schema,
  signIn,
  trpcMutation,
  trpcQuery,
  userByEmail,
} from './helpers.js'
import type { App } from './helpers.js'
import { clearMail, lastMail } from './mailbox.js'

vi.mock('../../email/index.js', async () => (await import('./mailbox.js')).emailModule)

type Me = { id: string; email: string; role: string }

let app: App

beforeAll(async () => {
  const { buildApp } = await import('../../app.js')
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await resetDatabase()
  clearMail()
})

describe('magic-link sign-in through the Fastify bridge', () => {
  it('starts every test from an empty database', async () => {
    expect(await rowCount(schema.user)).toBe(0)
  })

  it('makes the first account admin and every later one a member', async () => {
    const first = await signIn(app, 'first@test.io')
    const second = await signIn(app, 'second@test.io')

    const a = await trpcQuery<Me>(app, 'user.me', first)
    const b = await trpcQuery<Me>(app, 'user.me', second)
    expect(a.data).toMatchObject({ email: 'first@test.io', role: 'admin' })
    expect(b.data).toMatchObject({ email: 'second@test.io', role: 'member' })
  })

  it('forwards the session cookie so tRPC resolves the user, and rejects without it', async () => {
    const cookie = await signIn(app, 'jane@test.io')
    expect((await trpcQuery<Me>(app, 'user.me', cookie)).data?.email).toBe('jane@test.io')
    expect((await trpcQuery(app, 'user.me')).code).toBe('UNAUTHORIZED')
  })

  it('accepts a verify link only once', async () => {
    await requestMagicLink(app, 'once@test.io')
    const link = lastMail('once@test.io', 'magicLink').url

    const first = await followLink(app, link)
    expect(cookieHeader(first.headers['set-cookie'])).toContain('better-auth.session_token=')

    const replay = await followLink(app, link)
    expect(cookieHeader(replay.headers['set-cookie'])).not.toContain('better-auth.session_token=')
    expect(await rowCount(schema.session)).toBe(1)
  })

  it('ends the session on sign-out', async () => {
    const cookie = await signIn(app, 'out@test.io')
    const res = await authPost(app, '/sign-out', cookie, {})
    expect(res.statusCode).toBe(200)
    expect((await trpcQuery(app, 'user.me', cookie)).code).toBe('UNAUTHORIZED')
  })
})

describe('admin actions apply on the next request', () => {
  it('signs a user out everywhere when an admin revokes their sessions', async () => {
    const admin = await signIn(app, 'admin@test.io')
    const member = await signIn(app, 'member@test.io')
    const target = await userByEmail('member@test.io')

    const res = await trpcMutation<{ revoked: number }>(app, 'admin.revokeSessions', admin, {
      userId: target!.id,
    })
    expect(res.data).toEqual({ revoked: 1 })
    expect((await trpcQuery(app, 'user.me', member)).code).toBe('UNAUTHORIZED')
  })

  it('locks a banned user out immediately and refuses a new sign-in', async () => {
    const admin = await signIn(app, 'admin@test.io')
    const member = await signIn(app, 'member@test.io')
    const target = await userByEmail('member@test.io')

    await trpcMutation(app, 'admin.setBanned', admin, { userId: target!.id, banned: true })
    expect((await trpcQuery(app, 'user.me', member)).code).toBe('UNAUTHORIZED')

    await requestMagicLink(app, 'member@test.io')
    const verify = await followLink(app, lastMail('member@test.io', 'magicLink').url)
    expect(cookieHeader(verify.headers['set-cookie'])).not.toContain('better-auth.session_token=')
  })
})

describe('email change', () => {
  it('needs the old address first and the new address second before the row changes', async () => {
    const cookie = await signIn(app, 'old@test.io')
    const res = await authPost(app, '/change-email', cookie, {
      newEmail: 'new@test.io',
      callbackURL: '/settings/account',
    })
    expect(res.statusCode).toBe(200)

    await followLink(app, lastMail('old@test.io', 'emailChange').url, cookie)
    expect(await userByEmail('old@test.io')).toBeDefined()
    expect(await userByEmail('new@test.io')).toBeUndefined()

    await followLink(app, lastMail('new@test.io', 'emailVerification').url, cookie)
    const moved = await userByEmail('new@test.io')
    expect(moved).toMatchObject({ email: 'new@test.io', emailVerified: true })
    expect(await userByEmail('old@test.io')).toBeUndefined()
  })
})

describe('account deletion', () => {
  it('deletes only after the emailed link, taking sessions, memberships, consent and the sole-owned organization', async () => {
    const cookie = await signIn(app, 'leaver@test.io')
    const created = await authPost(app, '/organization/create', cookie, {
      name: 'Leaver Org',
      slug: 'leaver-org',
    })
    expect(created.statusCode).toBe(200)
    const withOrg = cookieHeader(created.headers['set-cookie']) || cookie
    expect((await trpcQuery(app, 'billing.getSubscription', withOrg)).data).toMatchObject({
      plan: 'FREE',
    })
    await trpcMutation(app, 'user.setConsent', withOrg, { analytics: true })

    const user = await userByEmail('leaver@test.io')
    const requested = await authPost(app, '/delete-user', withOrg, {
      callbackURL: '/login?deleted=1',
    })
    expect(requested.statusCode).toBe(200)
    expect(await userByEmail('leaver@test.io')).toBeDefined()

    await followLink(app, lastMail('leaver@test.io', 'accountDeletion').url, withOrg)

    expect(await userByEmail('leaver@test.io')).toBeUndefined()
    expect(await rowCount(schema.session, eq(schema.session.userId, user!.id))).toBe(0)
    expect(await rowCount(schema.member, eq(schema.member.userId, user!.id))).toBe(0)
    expect(await rowCount(schema.userConsent)).toBe(0)
    expect(await rowCount(schema.organization)).toBe(0)
    expect(await rowCount(schema.subscription)).toBe(0)
    expect(await db.query.organization.findFirst()).toBeUndefined()
  })
})
