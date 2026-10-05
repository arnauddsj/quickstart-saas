// docs/analytics.md
import type { PgBoss } from 'pg-boss'
import { deleteExpiredUsage } from '../services/usage.js'
import { logger } from '../utils/logger.js'
import { withReporting } from './withReporting.js'

export const USAGE_RETENTION_QUEUE = 'usage-retention'

export async function registerUsageRetention(boss: PgBoss): Promise<void> {
  await boss.createQueue(USAGE_RETENTION_QUEUE)
  await boss.work(
    USAGE_RETENTION_QUEUE,
    withReporting(USAGE_RETENTION_QUEUE, async () => {
      logger.info({ deleted: await deleteExpiredUsage() }, 'usage retention')
    }),
  )
  await boss.schedule(USAGE_RETENTION_QUEUE, '15 4 * * *')
}
