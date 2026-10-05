// docs/notifications.md
import type { PgBoss } from 'pg-boss'
import { deleteExpiredNotifications } from '../services/notify.js'
import { logger } from '../utils/logger.js'
import { withReporting } from './withReporting.js'

export const NOTIFICATION_CLEANUP_QUEUE = 'notification-cleanup'

export async function registerNotificationCleanup(boss: PgBoss): Promise<void> {
  await boss.createQueue(NOTIFICATION_CLEANUP_QUEUE)
  await boss.work(
    NOTIFICATION_CLEANUP_QUEUE,
    withReporting(NOTIFICATION_CLEANUP_QUEUE, async () => {
      logger.info({ deleted: await deleteExpiredNotifications() }, 'notification cleanup')
    }),
  )
  await boss.schedule(NOTIFICATION_CLEANUP_QUEUE, '0 4 * * *')
}
