// docs/background-jobs.md
import { lt } from 'drizzle-orm'
import type { PgBoss } from 'pg-boss'
import { db } from '../db/client.js'
import { errorLog } from '../db/schema/app.js'
import { logger } from '../utils/logger.js'

export const ERROR_LOG_CLEANUP_QUEUE = 'error-log-cleanup'
const RETENTION_DAYS = 30

export async function deleteExpiredErrorLogs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(errorLog)
    .where(lt(errorLog.createdAt, cutoff))
    .returning({ id: errorLog.id })
  logger.info({ deleted: deleted.length }, 'error_log cleanup')
  return deleted.length
}

export async function registerErrorLogCleanup(boss: PgBoss): Promise<void> {
  await boss.createQueue(ERROR_LOG_CLEANUP_QUEUE)
  await boss.work(ERROR_LOG_CLEANUP_QUEUE, async () => {
    await deleteExpiredErrorLogs()
  })
  await boss.schedule(ERROR_LOG_CLEANUP_QUEUE, '0 4 * * *')
}
