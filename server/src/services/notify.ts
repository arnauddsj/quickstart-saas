// docs/notifications.md
import { and, eq, lt, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import { member, notification } from '../db/schema/index.js'

export type NotificationInput = {
  type: string
  title: string
  body?: string
  link?: string
}

export const NOTIFICATION_RETENTION_DAYS = 90

export async function notify(
  userId: string,
  input: NotificationInput & { organizationId?: string | null },
): Promise<void> {
  await db.insert(notification).values({ ...input, userId })
}

export async function notifyWorkspace(
  organizationId: string,
  input: NotificationInput,
  options: { exceptUserId?: string } = {},
): Promise<number> {
  const members = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      options.exceptUserId
        ? and(eq(member.organizationId, organizationId), ne(member.userId, options.exceptUserId))
        : eq(member.organizationId, organizationId),
    )
  if (members.length === 0) return 0
  await db
    .insert(notification)
    .values(members.map((m) => ({ ...input, userId: m.userId, organizationId })))
  return members.length
}

export async function deleteExpiredNotifications(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(notification)
    .where(lt(notification.createdAt, cutoff))
    .returning({ id: notification.id })
  return deleted.length
}
