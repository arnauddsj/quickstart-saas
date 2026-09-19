// docs/analytics.md
import { count, eq, sql, type SQL } from 'drizzle-orm'
import { PLANS, type Limit, type PlanName } from '../config/plans.js'
import { db } from '../db/client.js'
import { project } from '../db/schema/index.js'

export const ACTIVATION_EVENT = 'project.created'
export const ACTIVATION_WINDOW_DAYS = 7
export const WEEKS = 12
export const RETENTION_OFFSETS = [1, 2, 4, 8] as const
export const NEAR_LIMIT_RATIO = 0.8

export const usageCounters: Record<
  Limit,
  (organizationId?: string) => Promise<{ organizationId: string; used: number }[]>
> = {
  projects: (organizationId) =>
    db
      .select({ organizationId: project.organizationId, used: count() })
      .from(project)
      .where(organizationId ? eq(project.organizationId, organizationId) : undefined)
      .groupBy(project.organizationId),
}

const PLAN_OF_ORG = sql.raw(
  `coalesce(case when s.status in ('active', 'trialing', 'past_due') then s.plan end, 'FREE')`,
)

async function rows<T>(query: SQL): Promise<T[]> {
  return (await db.execute(query)).rows as T[]
}

const lit = (value: number) => sql.raw(String(Math.trunc(value)))
const n = (v: unknown) => Number(v ?? 0)
const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole)

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

async function weekly() {
  const data = await rows<{ week: string; signups: string; active: string }>(sql`
    with weeks as (
      select generate_series(
        date_trunc('week', now()) - make_interval(weeks => ${lit(WEEKS - 1)}),
        date_trunc('week', now()),
        interval '1 week'
      )::date as week
    ),
    subjects as (select subject_id, min(signed_up_on) as signed_up_on from activity_day group by subject_id)
    select w.week::text as week,
      (select count(*) from subjects s where s.signed_up_on >= w.week and s.signed_up_on < w.week + 7) as signups,
      (select count(distinct a.subject_id) from activity_day a where a.day >= w.week and a.day < w.week + 7) as active
    from weeks w order by w.week`)
  return data.map((r) => ({ week: r.week, signups: n(r.signups), active: n(r.active) }))
}

async function headline() {
  const [row] = await rows<{ active7: string; active28: string; activeDays28: string }>(sql`
    select
      count(distinct subject_id) filter (where day > current_date - 7) as "active7",
      count(distinct subject_id) filter (where day > current_date - 28) as "active28",
      count(*) filter (where day > current_date - 28) as "activeDays28"
    from activity_day`)
  const active28 = n(row?.active28)
  return {
    activeUsers7d: n(row?.active7),
    activeUsers28d: active28,
    stickiness: ratio(n(row?.activeDays28) / 28, active28),
  }
}

async function activation() {
  const [row] = await rows<{ cohort: string; activated: string }>(sql`
    with subjects as (
      select subject_id, min(signed_up_on) as signed_up_on from activity_day group by subject_id
    )
    select count(*) as cohort,
      count(*) filter (where exists (
        select 1 from usage_event e
        where e.subject_id = s.subject_id and e.type = ${ACTIVATION_EVENT}
          and e.created_at < s.signed_up_on + ${lit(ACTIVATION_WINDOW_DAYS)}
      )) as activated
    from subjects s
    where s.signed_up_on >= current_date - ${lit(WEEKS * 7)}
      and s.signed_up_on <= current_date - ${lit(ACTIVATION_WINDOW_DAYS)}`)
  const cohort = n(row?.cohort)
  return {
    event: ACTIVATION_EVENT,
    windowDays: ACTIVATION_WINDOW_DAYS,
    cohort,
    rate: ratio(n(row?.activated), cohort),
  }
}

async function retention() {
  const offsets = sql.raw(
    RETENTION_OFFSETS.map(
      (k) =>
        `count(distinct a.subject_id) filter (where a.day >= c.week + ${k * 7} and a.day < c.week + ${(k + 1) * 7}) as "w${k}"`,
    ).join(',\n'),
  )
  const data = await rows<Record<string, string>>(sql`
    with subjects as (
      select subject_id, date_trunc('week', min(signed_up_on))::date as week
      from activity_day group by subject_id
    ),
    cohorts as (
      select * from subjects where week >= date_trunc('week', now())::date - ${lit((WEEKS - 1) * 7)}
    )
    select c.week::text as week, count(distinct c.subject_id) as size, ${offsets}
    from cohorts c left join activity_day a on a.subject_id = c.subject_id
    group by c.week order by c.week`)
  const today = new Date().toISOString().slice(0, 10)
  return data.map((r) => {
    const size = n(r.size)
    const start = new Date(`${r.week}T00:00:00Z`).getTime()
    return {
      week: r.week!,
      size,
      retained: RETENTION_OFFSETS.map((k) => {
        const periodEnd = new Date(start + (k + 1) * 7 * 86_400_000).toISOString().slice(0, 10)
        return { weeks: k, rate: periodEnd > today ? null : ratio(n(r[`w${k}`]), size) }
      }),
    }
  })
}

async function events() {
  const data = await rows<{ week: string; type: string; events: string }>(sql`
    with top as (
      select type from usage_event
      where created_at >= date_trunc('week', now()) - make_interval(weeks => ${lit(WEEKS - 1)})
      group by type order by count(*) desc limit 5
    )
    select date_trunc('week', e.created_at)::date::text as week, e.type, count(*) as events
    from usage_event e join top using (type)
    where e.created_at >= date_trunc('week', now()) - make_interval(weeks => ${lit(WEEKS - 1)})
    group by 1, 2`)
  return data.map((r) => ({ week: r.week, type: r.type, events: n(r.events) }))
}

async function topWorkspaces() {
  const data = await rows<{
    id: string
    name: string
    plan: string
    activeUsers: string
    events: string
  }>(sql`
    select o.id, o.name, ${PLAN_OF_ORG} as plan,
      (select count(distinct a.subject_id) from activity_day a
        where a.organization_id = o.id and a.day > current_date - 30) as "activeUsers",
      (select count(*) from usage_event e
        where e.organization_id = o.id and e.created_at > now() - interval '30 days') as events
    from organization o left join subscription s on s.organization_id = o.id
    order by "activeUsers" desc, events desc limit 10`)
  return data.map((r) => ({ ...r, activeUsers: n(r.activeUsers), events: n(r.events) }))
}

async function plans() {
  const orgs = await rows<{ id: string; plan: PlanName }>(sql`
    select o.id, ${PLAN_OF_ORG} as plan
    from organization o left join subscription s on s.organization_id = o.id`)
  const [billing] = await rows<{ cancelled30d: string; checkouts30d: string }>(sql`
    select
      (select count(*) from subscription where status = 'canceled' and updated_at > now() - interval '30 days') as "cancelled30d",
      (select count(*) from usage_event where type = 'billing.checkout_started' and created_at > now() - interval '30 days') as "checkouts30d"`)

  const usage = Object.fromEntries(
    await Promise.all(
      (Object.keys(usageCounters) as Limit[]).map(async (limit) => [
        limit,
        new Map((await usageCounters[limit]()).map((u) => [u.organizationId, n(u.used)])),
      ]),
    ),
  ) as Record<Limit, Map<string, number>>

  const planNames = Object.keys(PLANS) as PlanName[]
  const paid = orgs.filter((o) => o.plan !== 'FREE').length
  return {
    workspaces: orgs.length,
    paidRate: ratio(paid, orgs.length),
    cancelled30d: n(billing?.cancelled30d),
    checkouts30d: n(billing?.checkouts30d),
    byPlan: planNames.map((plan) => {
      const ids = orgs.filter((o) => o.plan === plan).map((o) => o.id)
      return {
        plan,
        label: PLANS[plan].label,
        workspaces: ids.length,
        limits: (Object.keys(usageCounters) as Limit[]).map((limit) => {
          const max = PLANS[plan].limits[limit]
          const used = ids.map((id) => usage[limit].get(id) ?? 0)
          const freeMax = PLANS.FREE.limits[limit]
          return {
            limit,
            max,
            median: median(used),
            nearLimit: ratio(used.filter((u) => u >= max * NEAR_LIMIT_RATIO).length, ids.length),
            atLimit: ratio(used.filter((u) => u >= max).length, ids.length),
            beyondFree:
              plan === 'FREE' ? null : ratio(used.filter((u) => u > freeMax).length, ids.length),
          }
        }),
      }
    }),
  }
}

async function featuresByPlan() {
  const data = await rows<{ type: string; plan: string; events: string; users: string }>(sql`
    select e.type, ${PLAN_OF_ORG} as plan, count(*) as events, count(distinct e.subject_id) as users
    from usage_event e
    left join subscription s on s.organization_id = e.organization_id
    where e.created_at > now() - interval '30 days'
    group by 1, 2 order by 1, 2`)
  return data.map((r) => ({ type: r.type, plan: r.plan, events: n(r.events), users: n(r.users) }))
}

export async function productAnalytics() {
  const [head, weeks, act, cohorts, eventWeeks, workspaces, planFit, features] = await Promise.all([
    headline(),
    weekly(),
    activation(),
    retention(),
    events(),
    topWorkspaces(),
    plans(),
    featuresByPlan(),
  ])
  return {
    generatedAt: new Date().toISOString(),
    headline: head,
    weeks,
    activation: act,
    retention: cohorts,
    events: eventWeeks,
    topWorkspaces: workspaces,
    plans: planFit,
    featuresByPlan: features,
  }
}
