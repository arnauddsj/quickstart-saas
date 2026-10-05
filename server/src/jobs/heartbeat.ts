// docs/background-jobs.md
import type { PgBoss } from 'pg-boss'
import { recordHeartbeat } from '../services/watchdog.js'
import { withReporting } from './withReporting.js'

export const HEARTBEAT_QUEUE = 'worker-heartbeat'

export async function registerHeartbeat(boss: PgBoss): Promise<void> {
  await boss.createQueue(HEARTBEAT_QUEUE)
  await boss.work(
    HEARTBEAT_QUEUE,
    withReporting(HEARTBEAT_QUEUE, async () => {
      recordHeartbeat()
    }),
  )
  await boss.schedule(HEARTBEAT_QUEUE, '*/5 * * * *')
}
