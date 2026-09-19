// docs/seeding.md
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { planLimit } from '../../config/plans.js'
import { KNOWN_USERS, runSeed, SeedRefused } from '../../scripts/seed/index.js'
import { db, resetDatabase, rowCount, schema, userByEmail } from './helpers.js'

beforeEach(resetDatabase)

async function membershipsByUser() {
  const rows = await db.select().from(schema.member)
  const byUser = new Map<string, number>()
  for (const r of rows) byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + 1)
  return byUser
}

async function projectsByOrg() {
  const rows = await db.select().from(schema.project)
  const byOrg = new Map<string, number>()
  for (const r of rows) byOrg.set(r.organizationId, (byOrg.get(r.organizationId) ?? 0) + 1)
  return byOrg
}

describe('db seed', () => {
  it('in teams mode fills every feature and respects plan limits', async () => {
    const summary = await runSeed({ teams: true })
    expect(summary.map((s) => s.name)).toEqual([
      'users',
      'organizations',
      'projects',
      'notifications',
      'activity',
    ])

    for (const known of KNOWN_USERS) expect(await userByEmail(known.email)).toBeDefined()
    expect((await userByEmail('admin@example.com'))!.role).toBe('admin')

    const users = await db.select().from(schema.user)
    const memberships = await membershipsByUser()
    for (const u of users) expect(memberships.get(u.id)).toBeGreaterThan(0)

    const subs = await db.select().from(schema.subscription)
    const acme = await db.query.organization.findFirst({
      where: eq(schema.organization.name, 'Acme'),
    })
    expect(subs.find((s) => s.organizationId === acme!.id)).toMatchObject({
      plan: 'PRO',
      status: 'active',
    })
    const perOrg = await projectsByOrg()
    for (const sub of subs.filter((s) => s.plan === 'FREE')) {
      expect(perOrg.get(sub.organizationId) ?? 0).toBeLessThan(planLimit('FREE', 'projects'))
    }

    expect(await rowCount(schema.invitation)).toBe(1)
    const unread = await db.query.notification.findMany({
      where: (n, { isNull }) => isNull(n.readAt),
    })
    expect(unread.length).toBeGreaterThan(0)
    expect(await rowCount(schema.session)).toBe(users.length)
    expect(await rowCount(schema.activityDay)).toBeGreaterThan(users.length)
    expect(await rowCount(schema.usageEvent)).toBe(await rowCount(schema.project))
  })

  it('in solo mode gives each user one workspace and sends no invitations', async () => {
    await runSeed({ teams: false })
    const users = await db.select().from(schema.user)
    const memberships = await membershipsByUser()
    for (const u of users) expect(memberships.get(u.id)).toBe(1)
    expect(await rowCount(schema.organization)).toBe(users.length)
    expect(await rowCount(schema.invitation)).toBe(0)
  })

  it('refuses a database that has users unless told to reset', async () => {
    await runSeed({ teams: true })
    await expect(runSeed({ teams: true })).rejects.toBeInstanceOf(SeedRefused)
    const before = await rowCount(schema.user)
    await runSeed({ teams: true, reset: true })
    expect(await rowCount(schema.user)).toBe(before)
  })
})
