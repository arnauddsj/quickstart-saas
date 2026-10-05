// docs/background-jobs.md
import { PgBoss } from 'pg-boss'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'
import { registerHeartbeat } from './heartbeat.js'
import { registerNotificationCleanup } from './notificationCleanup.js'
import { registerUsageRetention } from './usageRetention.js'

export const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss', max: 3 })

let started = false
export const bossStarted = () => started

boss.on('error', (err: Error) => logger.error({ err }, 'pg-boss error'))

export async function startBoss(): Promise<void> {
  await boss.start()
  await registerHeartbeat(boss)
  await registerNotificationCleanup(boss)
  await registerUsageRetention(boss)
  started = true
  logger.info('pg-boss started')
}

export async function stopBoss(): Promise<void> {
  if (!started) return
  started = false
  await boss.stop({ graceful: true, timeout: 5_000 })
}
