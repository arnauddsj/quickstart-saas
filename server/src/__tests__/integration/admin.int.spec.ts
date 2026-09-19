import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminStats, claimFirstAdmin } from '../../services/admin.js'
import {
  addMember,
  callerFor,
  daysAgo,
  db,
  resetDatabase,
  rowCount,
  schema,
  seedOrg,
  seedSession,
  seedUser,
} from './helpers.js'
import { clearMail, lastMail } from './mailbox.js'

vi.mock('../../email/index.js', async () => (await import('./mailbox.js')).emailModule)

async function code(p: Promise<unknown>) {
  try {
    await p
    return 'OK'
  } catch (err) {
    return err instanceof TRPCError ? err.code : String(err)
  }
}

beforeEach(async () => {
  await resetDatabase()
  clearMail()
})

describe('first account', () => {
  it('promotes only the earliest account, however many claim at once', async () => {
    const users = []
    for (let i = 0; i < 10; i++) users.push(await seedUser({ createdAt: daysAgo(10 - i) }))

    const claims = await Promise.all(users.map((u) => claimFirstAdmin(u.id)))

    expect(claims.filter(Boolean)).toHaveLength(1)
    expect(claims[0]).toBe(true)
    expect(await rowCount(schema.user, eq(schema.user.role, 'admin'))).toBe(1)
  })

  it('does not hand admin to a newcomer after every admin is gone', async () => {
    await seedUser({ createdAt: daysAgo(5) })
    const newcomer = await seedUser()
    expect(await claimFirstAdmin(newcomer.id)).toBe(false)
  })
})

describe('stats', () => {
  it('counts sign-ups and activity in the 7- and 30-day windows', async () => {
    const old = await seedUser({ createdAt: daysAgo(40) })
    await seedUser({ createdAt: daysAgo(10) })
    const recent = await seedUser({ createdAt: daysAgo(1) })
    await seedSession(old.id, { createdAt: daysAgo(20), updatedAt: daysAgo(20) })
    await seedSession(recent.id, { createdAt: daysAgo(1), updatedAt: new Date() })
    await seedSession(recent.id, { createdAt: daysAgo(2), updatedAt: daysAgo(2) })
    const [a, b, c] = [await seedOrg(), await seedOrg(), await seedOrg()]
    await db.insert(schema.subscription).values([
      { organizationId: a.id, plan: 'PRO', status: 'active' },
      { organizationId: b.id, plan: 'PRO', status: 'canceled' },
      { organizationId: c.id, plan: 'FREE', status: 'active' },
    ])

    expect(await adminStats()).toEqual({
      users: 3,
      newUsers7d: 1,
      newUsers30d: 2,
      activeUsers7d: 1,
      activeUsers30d: 2,
      organizations: 3,
      paidSubscriptions: 1,
    })
  })

  it('lists users with activity derived from their sessions', async () => {
    const admin = await seedUser({ role: 'admin' })
    const user = await seedUser({ email: 'active@acme.dev' })
    await seedUser({ email: 'idle@acme.dev' })
    await seedSession(user.id, { createdAt: daysAgo(3), updatedAt: daysAgo(1) })
    await seedSession(user.id, { createdAt: daysAgo(2), updatedAt: daysAgo(2) })
    const org = await seedOrg()
    await addMember(org.id, user.id)

    const { users, total } = await callerFor(admin).admin.listUsers({ search: 'acme.dev' })
    expect(total).toBe(2)
    const active = users.find((u) => u.email === 'active@acme.dev')!
    const idle = users.find((u) => u.email === 'idle@acme.dev')!
    expect(active.sessionCount).toBe(2)
    expect(active.organizationCount).toBe(1)
    expect(new Date(active.lastLoginAt!).getTime()).toBeCloseTo(daysAgo(2).getTime(), -4)
    expect(new Date(active.lastActiveAt!).getTime()).toBeCloseTo(daysAgo(1).getTime(), -4)
    expect(idle).toMatchObject({
      sessionCount: 0,
      organizationCount: 0,
      lastLoginAt: null,
      lastActiveAt: null,
    })
  })
})

describe('user levers', () => {
  it('changes an email, lowercases it, marks it unverified and mails the new address', async () => {
    const admin = await seedUser({ role: 'admin' })
    const target = await seedUser({ email: 'before@test.io' })

    await callerFor(admin).admin.setEmail({ userId: target.id, email: 'After@Test.io' })

    const row = await db.query.user.findFirst({ where: eq(schema.user.id, target.id) })
    expect(row).toMatchObject({ email: 'after@test.io', emailVerified: false })
    expect(lastMail('after@test.io', 'emailVerification').url).toContain('verify-email')
  })

  it("refuses another account's address but accepts the user's own", async () => {
    const admin = await seedUser({ role: 'admin' })
    const target = await seedUser({ email: 'target@test.io' })
    await seedUser({ email: 'taken@test.io' })

    expect(
      await code(callerFor(admin).admin.setEmail({ userId: target.id, email: 'taken@test.io' })),
    ).toBe('CONFLICT')
    expect(
      await code(callerFor(admin).admin.setEmail({ userId: target.id, email: 'target@test.io' })),
    ).toBe('OK')
  })

  it('revokes every session and reports how many', async () => {
    const admin = await seedUser({ role: 'admin' })
    const target = await seedUser()
    await seedSession(target.id)
    await seedSession(target.id)
    await seedSession(admin.id)

    expect(await callerFor(admin).admin.revokeSessions({ userId: target.id })).toEqual({
      revoked: 2,
    })
    expect(await rowCount(schema.session)).toBe(1)
  })

  it('removes a user with their sole-owned organization and refuses to remove itself', async () => {
    const admin = await seedUser({ role: 'admin' })
    const target = await seedUser()
    const org = await seedOrg()
    await addMember(org.id, target.id, 'owner')

    await callerFor(admin).admin.removeUser({ userId: target.id })
    expect(await rowCount(schema.user, eq(schema.user.id, target.id))).toBe(0)
    expect(await rowCount(schema.organization)).toBe(0)
    expect(await code(callerFor(admin).admin.removeUser({ userId: admin.id }))).toBe('FORBIDDEN')
  })

  it('bans by clearing sessions, and never lets an admin demote themself', async () => {
    const admin = await seedUser({ role: 'admin' })
    const target = await seedUser()
    await seedSession(target.id)

    await callerFor(admin).admin.setBanned({ userId: target.id, banned: true, reason: 'spam' })
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, target.id) })
    expect(row).toMatchObject({ banned: true, banReason: 'spam' })
    expect(await rowCount(schema.session, eq(schema.session.userId, target.id))).toBe(0)

    expect(await code(callerFor(admin).admin.setRole({ userId: admin.id, role: 'member' }))).toBe(
      'FORBIDDEN',
    )
    await callerFor(admin).admin.setRole({ userId: target.id, role: 'admin' })
    expect((await db.query.user.findFirst({ where: eq(schema.user.id, target.id) }))?.role).toBe(
      'admin',
    )
  })
})
