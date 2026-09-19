// docs/analytics.md
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { PLANS } from '../../config/plans.js'
import { productAnalytics } from '../../services/analytics.js'
import { anonymizeUsage, deleteExpiredUsage, recordActivity, track } from '../../services/usage.js'
import { daysAgo, db, resetDatabase, schema, seedOrg, seedUser } from './helpers.js'

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const mondayWeeksAgo = (k: number) => {
  const now = new Date()
  const monday =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    ((now.getUTCDay() + 6) % 7) * DAY
  return monday - k * 7 * DAY
}

async function activity(
  subjectId: string,
  signedUpOn: number,
  days: number[],
  organizationId?: string,
) {
  await db
    .insert(schema.activityDay)
    .values(
      days.map((d) => ({ subjectId, day: iso(d), signedUpOn: iso(signedUpOn), organizationId })),
    )
}

beforeEach(resetDatabase)

describe('recording usage', () => {
  it('records one activity row per user per day, however many requests', async () => {
    const user = await seedUser()
    await recordActivity(user, null)
    await recordActivity(user, null)
    const rows = await db.select().from(schema.activityDay)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.signedUpOn).toBe(iso(user.createdAt.getTime()))
  })

  it('anonymizes a deleted person without changing the counts', async () => {
    const user = await seedUser()
    await activity(user.id, Date.now(), [Date.now() - DAY, Date.now()])
    await track(user.id, null, 'project.created')
    await anonymizeUsage(user.id)

    const days = await db.select().from(schema.activityDay)
    const events = await db.select().from(schema.usageEvent)
    expect(days).toHaveLength(2)
    expect(new Set(days.map((d) => d.subjectId)).size).toBe(1)
    expect(days[0]?.subjectId).toMatch(/^deleted_/)
    expect(events[0]?.subjectId).toBe(days[0]?.subjectId)
    expect(
      await db.select().from(schema.activityDay).where(eq(schema.activityDay.subjectId, user.id)),
    ).toEqual([])
  })

  it('deletes usage past the retention window', async () => {
    await activity('old', Date.now() - 800 * DAY, [Date.now() - 800 * DAY, Date.now() - DAY])
    await db.insert(schema.usageEvent).values([
      { subjectId: 'old', type: 'x', createdAt: daysAgo(800) },
      { subjectId: 'old', type: 'x', createdAt: daysAgo(1) },
    ])
    expect(await deleteExpiredUsage()).toBe(2)
    expect(await db.select().from(schema.activityDay)).toHaveLength(1)
    expect(await db.select().from(schema.usageEvent)).toHaveLength(1)
  })
})

describe('productAnalytics', () => {
  it('counts sign-ups and active users per week', async () => {
    const week = mondayWeeksAgo(2)
    await activity('a', week, [week, week + DAY])
    await activity('b', week + 2 * DAY, [week + 2 * DAY, week + 8 * DAY])
    const { weeks } = await productAnalytics()
    const row = weeks.find((w) => w.week === iso(week))
    const next = weeks.find((w) => w.week === iso(week + 7 * DAY))
    expect(weeks).toHaveLength(12)
    expect(row).toMatchObject({ signups: 2, active: 2 })
    expect(next).toMatchObject({ signups: 0, active: 1 })
  })

  it('measures week-1 retention per cohort and leaves future weeks empty', async () => {
    const week = mondayWeeksAgo(3)
    await activity('kept', week, [week, week + 8 * DAY])
    await activity('lost', week, [week])
    const cohort = (await productAnalytics()).retention.find((c) => c.week === iso(week))
    expect(cohort?.size).toBe(2)
    expect(cohort?.retained.find((r) => r.weeks === 1)?.rate).toBe(0.5)
    expect(cohort?.retained.find((r) => r.weeks === 8)?.rate).toBeNull()
  })

  it('computes activation as the share doing the key action within the window', async () => {
    const signup = Date.now() - 20 * DAY
    await activity('fast', signup, [signup])
    await activity('slow', signup, [signup])
    await db.insert(schema.usageEvent).values([
      { subjectId: 'fast', type: 'project.created', createdAt: new Date(signup + DAY) },
      { subjectId: 'slow', type: 'project.created', createdAt: new Date(signup + 10 * DAY) },
    ])
    expect((await productAnalytics()).activation).toMatchObject({ cohort: 2, rate: 0.5 })
  })

  it('shows how each plan uses its limits', async () => {
    const max = PLANS.FREE.limits.projects
    const full = await seedOrg({ name: 'Full' })
    const empty = await seedOrg({ name: 'Empty' })
    const pro = await seedOrg({ name: 'Pro' })
    await db
      .insert(schema.subscription)
      .values({ organizationId: pro.id, plan: 'PRO', status: 'active' })
    const projects = (organizationId: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({ organizationId, name: `P${i}` }))
    await db
      .insert(schema.project)
      .values([...projects(full.id, max), ...projects(pro.id, max + 1)])

    const { plans } = await productAnalytics()
    const free = plans.byPlan.find((p) => p.plan === 'FREE')!.limits[0]!
    const paid = plans.byPlan.find((p) => p.plan === 'PRO')!.limits[0]!
    expect(plans).toMatchObject({ workspaces: 3 })
    expect(plans.paidRate).toBeCloseTo(1 / 3)
    expect(free).toMatchObject({ limit: 'projects', atLimit: 0.5, beyondFree: null })
    expect(paid).toMatchObject({ median: max + 1, beyondFree: 1 })
    expect(empty.id).toBeTruthy()
  })

  it('splits feature usage by the plan of the workspace', async () => {
    const pro = await seedOrg({ name: 'Pro' })
    const free = await seedOrg({ name: 'Free' })
    await db
      .insert(schema.subscription)
      .values({ organizationId: pro.id, plan: 'PRO', status: 'active' })
    await track('u1', pro.id, 'report.exported')
    await track('u1', pro.id, 'report.exported')
    await track('u2', free.id, 'report.exported')
    const rows = (await productAnalytics()).featuresByPlan
    expect(rows).toEqual([
      { type: 'report.exported', plan: 'FREE', events: 1, users: 1 },
      { type: 'report.exported', plan: 'PRO', events: 2, users: 1 },
    ])
  })
})
