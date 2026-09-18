// docs/admin.md
import { and, count, desc, eq, gte, max, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { member, organization, session, subscription, user } from '../db/schema/index.js'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

export async function roleForNewUser(): Promise<'admin' | 'member'> {
  const [row] = await db.select({ value: count() }).from(user)
  return (row?.value ?? 0) === 0 ? 'admin' : 'member'
}

export async function adminStats() {
  const [users, new7, new30, active7, active30, orgs, paid] = await Promise.all([
    db.select({ value: count() }).from(user),
    db
      .select({ value: count() })
      .from(user)
      .where(gte(user.createdAt, daysAgo(7))),
    db
      .select({ value: count() })
      .from(user)
      .where(gte(user.createdAt, daysAgo(30))),
    db
      .select({ value: sql<number>`count(distinct ${session.userId})` })
      .from(session)
      .where(gte(session.updatedAt, daysAgo(7))),
    db
      .select({ value: sql<number>`count(distinct ${session.userId})` })
      .from(session)
      .where(gte(session.updatedAt, daysAgo(30))),
    db.select({ value: count() }).from(organization),
    db
      .select({ value: count() })
      .from(subscription)
      .where(and(sql`${subscription.plan} <> 'FREE'`, eq(subscription.status, 'active'))),
  ])
  return {
    users: users[0]?.value ?? 0,
    newUsers7d: new7[0]?.value ?? 0,
    newUsers30d: new30[0]?.value ?? 0,
    activeUsers7d: Number(active7[0]?.value ?? 0),
    activeUsers30d: Number(active30[0]?.value ?? 0),
    organizations: orgs[0]?.value ?? 0,
    paidSubscriptions: paid[0]?.value ?? 0,
  }
}

export const userActivity = db
  .select({
    userId: session.userId,
    lastLoginAt: max(session.createdAt).as('last_login_at'),
    lastActiveAt: max(session.updatedAt).as('last_active_at'),
    sessionCount: count().as('session_count'),
  })
  .from(session)
  .groupBy(session.userId)
  .as('activity')

export const userOrganizations = db
  .select({ userId: member.userId, organizationCount: count().as('organization_count') })
  .from(member)
  .groupBy(member.userId)
  .as('orgs')

export async function recentSignups(limit: number) {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      lastLoginAt: userActivity.lastLoginAt,
    })
    .from(user)
    .leftJoin(userActivity, eq(userActivity.userId, user.id))
    .orderBy(desc(user.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
  }))
}
