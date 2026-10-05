// docs/analytics.md
import { randomUUID } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { activityDay, usageEvent } from '../db/schema/index.js'
import { reportError } from './reportError.js'

export const USAGE_RETENTION_DAYS = 760

type Actor = { id: string; createdAt: Date }

const utcDay = (d: Date) => d.toISOString().slice(0, 10)

const seenToday = new Set<string>()
let seenDay = ''

export async function recordActivity(user: Actor, organizationId: string | null | undefined) {
  const day = utcDay(new Date())
  if (day !== seenDay) {
    seenToday.clear()
    seenDay = day
  }
  const key = `${user.id}:${day}`
  if (seenToday.has(key)) return
  seenToday.add(key)
  try {
    await db
      .insert(activityDay)
      .values({
        subjectId: user.id,
        day,
        signedUpOn: utcDay(user.createdAt),
        organizationId: organizationId ?? null,
      })
      .onConflictDoNothing()
  } catch (err) {
    seenToday.delete(key)
    reportError({
      severity: 'WARNING',
      type: 'usage.activity',
      message: 'Activity not recorded',
      error: err,
    })
  }
}

export async function track(
  userId: string,
  organizationId: string | null | undefined,
  type: string,
): Promise<void> {
  try {
    await db
      .insert(usageEvent)
      .values({ subjectId: userId, organizationId: organizationId ?? null, type })
  } catch (err) {
    reportError({
      severity: 'WARNING',
      type: 'usage.track',
      message: 'Usage event not recorded',
      error: err,
      context: { event: type },
    })
  }
}

export async function anonymizeUsage(userId: string): Promise<void> {
  const pseudonym = `deleted_${randomUUID()}`
  await db
    .update(activityDay)
    .set({ subjectId: pseudonym })
    .where(eq(activityDay.subjectId, userId))
  await db.update(usageEvent).set({ subjectId: pseudonym }).where(eq(usageEvent.subjectId, userId))
}

export async function deleteExpiredUsage(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const days = await db
    .delete(activityDay)
    .where(lt(activityDay.day, utcDay(cutoff)))
    .returning({ day: activityDay.day })
  const events = await db
    .delete(usageEvent)
    .where(lt(usageEvent.createdAt, cutoff))
    .returning({ id: usageEvent.id })
  return days.length + events.length
}
